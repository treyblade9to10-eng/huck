// HUCK - save data (localStorage)
import { genCard, uid } from './data.js';

const KEY = 'huck_save_v1';
export let S = null;

function fresh() {
  const plan = [[2, 'H'], [1, 'H'], [2, 'C'], [1, 'C'], [1, 'C'], [0, 'C'], [2, 'D'], [1, 'D'], [0, 'Y'], [3, 'Y']];
  const cards = plan.map(([s, p]) => genCard(s, { pos: p }));
  cards.sort((a, b) => b.ovr - a.ovr);
  return {
    v: 1, coins: 3000, cards,
    team: { name: 'My Squad', abbr: 'SQD', c1: '#1e88e5', c2: '#f2c14e', logo: 'disc', lineup: cards.map((c) => c.id) },
    league: null,
    market: { listings: [], refreshAt: 0, mine: [], log: [] },
    record: { w: 0, l: 0, pts: 0 },
    settings: { quality: 'high', size: 5, to: 7, diff: 'pro' },
    seen: {},
  };
}

export function load() {
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || !S.v) { S = fresh(); save(); }
  // keep lineup valid
  const ids = new Set(S.cards.map((c) => c.id));
  S.team.lineup = S.team.lineup.filter((id) => ids.has(id));
  for (const c of S.cards) if (!S.team.lineup.includes(c.id) && S.team.lineup.length < 10) S.team.lineup.push(c.id);
  return S;
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
export function reset() { S = fresh(); save(); return S; }

export const card = (id) => S.cards.find((c) => c.id === id);
export function lineupCards() { return S.team.lineup.map(card).filter(Boolean); }
export function addCards(list) { for (const c of list) S.cards.push(c); fillLineup(); save(); }
export function removeCard(id) {
  S.cards = S.cards.filter((c) => c.id !== id);
  S.team.lineup = S.team.lineup.filter((x) => x !== id);
  fillLineup();
}
export function fillLineup() {
  for (const c of [...S.cards].sort((a, b) => b.ovr - a.ovr)) {
    if (S.team.lineup.length >= 10) break;
    if (!S.team.lineup.includes(c.id)) S.team.lineup.push(c.id);
  }
}
export function myTeamObj() {
  const t = S.team;
  const roster = lineupCards();
  for (const c of S.cards) if (!roster.includes(c)) roster.push(c);
  return { id: 'me', name: t.name, abbr: t.abbr, c1: t.c1, c2: t.c2, logo: t.logo, roster, cpu: false, ai: 1 };
}
export function addCoins(n) { S.coins = Math.max(0, S.coins + Math.round(n)); save(); }
export { uid };
