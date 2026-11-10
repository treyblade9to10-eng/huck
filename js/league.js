// HUCK - leagues + seasons
import { S, save, myTeamObj } from './store.js';
import { genTeam, STAT_KEYS, clamp, ri, refresh } from './data.js';
import { simGame } from './sim.js';

export function createLeague({ name, size, n, to, diff, rounds }) {
  const used = new Set([S.team.name]);
  const teams = [{ id: 'me' }];
  for (let i = 0; i < size - 1; i++) teams.push(genTeam(i + ri(0, 50), diff, used));
  S.league = { name, n, to, diff, rounds, season: 1, teams, history: [] };
  newSeason(S.league, false);
  save();
}
export function teamById(L, id) { return id === 'me' ? myTeamObj() : L.teams.find((t) => t.id === id); }

function roundRobin(ids) {
  const a = [...ids]; if (a.length % 2) a.push(null);
  const out = [], m = a.length;
  for (let r = 0; r < m - 1; r++) {
    const wk = [];
    for (let i = 0; i < m / 2; i++) { const x = a[i], y = a[m - 1 - i]; if (x && y) wk.push(r % 2 ? [y, x] : [x, y]); }
    out.push(wk); a.splice(1, 0, a.pop());
  }
  return out;
}
export function newSeason(L, advance = true) {
  if (advance) {
    L.season++;
    for (const t of L.teams) if (t.roster) for (const c of t.roster) { // CPU players develop / decline a bit
      const d = ri(-3, 4);
      for (const k of STAT_KEYS) c.stats[k] = clamp(c.stats[k] + d + ri(-1, 1), 20, 99);
      refresh(c);
    }
  }
  const ids = L.teams.map((t) => t.id);
  let weeks = roundRobin(ids);
  if (L.rounds === 2) weeks = weeks.concat(weeks.map((w) => w.map(([a, b]) => [b, a])));
  L.weeks = weeks.map((w) => w.map(([a, b]) => ({ a, b, score: null })));
  L.week = 0; L.playoffs = null; L.champ = null; L.pstats = {}; L.done = false;
  save();
}
export function standings(L) {
  const T = {}; for (const t of L.teams) T[t.id] = { id: t.id, w: 0, l: 0, pf: 0, pa: 0 };
  for (const w of L.weeks) for (const g of w) if (g.score) {
    const [x, y] = g.score; T[g.a].pf += x; T[g.a].pa += y; T[g.b].pf += y; T[g.b].pa += x;
    if (x > y) { T[g.a].w++; T[g.b].l++; } else { T[g.b].w++; T[g.a].l++; }
  }
  return Object.values(T).sort((a, b) => b.w - a.w || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf);
}
function addStats(L, stats) { for (const s of stats) { const o = (L.pstats[s.id] ||= { g: 0, a: 0, d: 0, gp: 0 }); o.g += s.g || 0; o.a += s.a || 0; o.d += s.d || 0; o.gp++; } }
export function recordGame(L, g, score, stats) { g.score = score; addStats(L, stats); save(); }
export function simGameFor(L, g) {
  const A = teamById(L, g.a), B = teamById(L, g.b);
  const r = simGame(A, B, L.n, L.to); recordGame(L, g, r.score, r.stats); return r;
}
export function myGame(L) {
  if (L.playoffs) { const g = currentPlayoffGames(L).find((x) => !x.score && (x.a === 'me' || x.b === 'me')); return g || null; }
  const w = L.weeks[L.week]; return w ? w.find((x) => x.a === 'me' || x.b === 'me') || null : null;
}
// sim every other game this week, then advance
export function finishWeek(L) {
  if (L.playoffs) return finishPlayoffRound(L);
  const w = L.weeks[L.week]; if (!w) return;
  for (const g of w) if (!g.score) simGameFor(L, g);
  L.week++;
  if (L.week >= L.weeks.length) startPlayoffs(L);
  save();
}
function startPlayoffs(L) {
  const st = standings(L), k = L.teams.length >= 6 ? 4 : 2;
  const seeds = st.slice(0, k).map((s) => s.id);
  L.playoffs = { seeds, rounds: [k === 4 ? [{ a: seeds[0], b: seeds[3], score: null }, { a: seeds[1], b: seeds[2], score: null }] : [{ a: seeds[0], b: seeds[1], score: null }]] };
}
export function currentPlayoffGames(L) { return L.playoffs ? L.playoffs.rounds[L.playoffs.rounds.length - 1] : []; }
function winner(g) { return g.score[0] > g.score[1] ? g.a : g.b; }
function finishPlayoffRound(L) {
  const r = currentPlayoffGames(L);
  for (const g of r) if (!g.score) simGameFor(L, g);
  if (r.length === 1) { L.champ = winner(r[0]); L.done = true; L.history.unshift({ season: L.season, champ: L.champ, champName: teamById(L, L.champ).name }); }
  else L.playoffs.rounds.push([{ a: winner(r[0]), b: winner(r[1]), score: null }]);
  save();
}
export function seasonPrize(L) { return L.champ === 'me' ? 6000 : L.playoffs && L.playoffs.rounds.flat().some((g) => g.a === 'me' || g.b === 'me') ? 2000 : 600; }
