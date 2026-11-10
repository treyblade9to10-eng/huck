// HUCK - quick sim for games you don't play
import { teamOvr, rand } from './data.js';

function wpick(list, w) {
  let tot = 0; for (const c of list) tot += w(c);
  let r = rand() * tot; for (const c of list) { r -= w(c); if (r <= 0) return c; }
  return list[0];
}
export function simGame(A, B, n, to) {
  const ra = teamOvr(A.roster, n), rb = teamOvr(B.roster, n);
  const pa = A.roster.slice(0, n), pb = B.roster.slice(0, n);
  const st = {};
  const S = (c) => (st[c.id] ||= { id: c.id, g: 0, a: 0, d: 0 });
  const score = [0, 0];
  let recv = rand() < 0.5 ? 0 : 1;
  while (score[0] < to && score[1] < to) {
    const edge = (ra - rb) / 9;
    let pA = 1 / (1 + Math.exp(-edge));
    pA += recv === 0 ? 0.12 : -0.12;
    const w = rand() < pA ? 0 : 1;
    score[w]++;
    const ps = w ? pb : pa, def = w ? pa : pb;
    const g = wpick(ps, (c) => Math.pow(c.stats.cat + c.stats.spd, 2));
    S(g).g++;
    const a = wpick(ps.filter((c) => c !== g), (c) => Math.pow(c.stats.thr, 2));
    if (a) S(a).a++;
    if (rand() < 0.55) S(wpick(ps, (c) => Math.pow(c.stats.def, 2))).d++;
    if (rand() < 0.35) S(wpick(def, (c) => Math.pow(c.stats.def, 2))).d++;
    recv = 1 - w;
  }
  return { score, stats: Object.values(st) };
}
