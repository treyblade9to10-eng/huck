// HUCK - shared UI helpers: card HTML, logos, stars, modal, toast
import { STAR_COLOR, STAR_LABEL, POS, STAT_KEYS, fullName } from './data.js';
import { portrait } from './model.js';

export const h = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const fmt = (n) => Math.round(n).toLocaleString('en-US');

const STAR = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';
export function starsHTML(n, size = 15) {
  let s = '';
  for (let i = 0; i < 5; i++) s += `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><path d="${STAR}" fill="${i < n ? STAR_COLOR[Math.max(1, n)] : 'rgba(255,255,255,.14)'}" stroke="${i < n ? 'rgba(0,0,0,.4)' : 'none'}" stroke-width="1"/></svg>`;
  return `<div class="stars">${s}</div>`;
}
export const coinHTML = (n) => `<span class="row" style="gap:5px;display:inline-flex"><span class="coin"></span><b class="cond" style="font-size:18px">${fmt(n)}</b></span>`;

const LOGO_PATHS = {
  disc: (a, b) => `<ellipse cx="32" cy="35" rx="24" ry="10" fill="${b}"/><ellipse cx="32" cy="31" rx="24" ry="10" fill="${a}"/><ellipse cx="32" cy="31" rx="12" ry="5" fill="none" stroke="${b}" stroke-width="3"/>`,
  bolt: (a, b) => `<path d="M36 4 14 36h14l-4 24 26-36H35z" fill="${a}" stroke="${b}" stroke-width="3" stroke-linejoin="round"/>`,
  wing: (a, b) => `<path d="M6 40c10-22 30-30 52-30-8 6-12 10-14 16 6 0 10-2 14-4-4 10-12 16-24 18 4 2 8 2 12 2-10 8-26 8-40-2z" fill="${a}" stroke="${b}" stroke-width="2.5" stroke-linejoin="round"/>`,
  star: (a, b) => `<path d="M32 5l7.7 16 17.5 2.3-12.9 12.1 3.3 17.4L32 44.4 16.4 52.8l3.3-17.4L6.8 23.3 24.3 21z" fill="${a}" stroke="${b}" stroke-width="3" stroke-linejoin="round"/>`,
  wave: (a, b) => `<path d="M4 40c8-14 18-22 30-22 10 0 16 6 16 14-6-6-14-4-16 2-2 8 6 12 26 8-6 10-18 16-32 16C16 58 6 52 4 40z" fill="${a}" stroke="${b}" stroke-width="2.5" stroke-linejoin="round"/>`,
  peak: (a, b) => `<path d="M4 54 24 16l10 16 6-10 20 32z" fill="${a}" stroke="${b}" stroke-width="3" stroke-linejoin="round"/><path d="M24 16l-5 10 5-3 4 4z" fill="${b}"/>`,
  claw: (a, b) => `<path d="M14 54C10 34 16 16 26 8c-4 14-2 28 4 46zm12 2c-2-18 4-34 16-44-4 14-4 30 0 44zm14-2c2-14 8-26 18-32-6 12-8 22-6 32z" fill="${a}" stroke="${b}" stroke-width="2.5" stroke-linejoin="round"/>`,
  flame: (a, b) => `<path d="M32 4c4 12 18 18 18 34a18 18 0 0 1-36 0c0-10 6-14 8-22 2 6 4 8 6 8 0-8 2-14 4-20z" fill="${a}" stroke="${b}" stroke-width="3" stroke-linejoin="round"/><path d="M32 30c3 6 8 8 8 14a8 8 0 0 1-16 0c0-4 4-8 8-14z" fill="${b}"/>`,
};
export function logoSVG(team, size = 64) {
  const f = LOGO_PATHS[team.logo] || LOGO_PATHS.disc;
  const b = team.c2 === team.c1 ? '#fff' : team.c2;
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}">${f(team.c1, b)}</svg>`;
}
export const LOGO_IDS = Object.keys(LOGO_PATHS);

const STAT_SHORT = { spd: 'SPD', thr: 'THR', cat: 'CAT', def: 'DEF', jmp: 'HOP' };
export function cardHTML(c, team, extra = {}) {
  const img = portrait(c, team);
  const sts = STAT_KEYS.map((k) => `<div>${c.stats[k]}<small>${STAT_SHORT[k]}</small></div>`).join('');
  return `<div class="pc t${c.stars} ${extra.cls || ''}" data-id="${c.id}" style="--tier:${STAR_COLOR[c.stars]};--c1:${team.c1}">
    <div class="por" style="background-image:url(${img})"></div>
    <div class="ov">${c.ovr}</div><div class="ps">${c.pos === 'Y' ? 'HYB' : POS[c.pos].slice(0, 3).toUpperCase()}</div>
    <div class="tm">${logoSVG(team, 26)}</div>
    ${extra.badge ? `<div class="badge">${extra.badge}</div>` : ''}
    <div class="nm">${h(c.first[0])}. ${h(c.last.toUpperCase())}</div>
    ${starsHTML(c.stars)}
    <div class="sts">${sts}</div></div>`;
}
export const tierName = (c) => STAR_LABEL[c.stars];
export { fullName };

export function toast(msg) {
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.tm); toast.tm = setTimeout(() => t.classList.remove('show'), 2200);
}
export function modal(html, onMount) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="box">${html}</div>`;
  m.addEventListener('click', (e) => { if (e.target === m) close(); });
  document.body.appendChild(m);
  function close() { m.remove(); }
  onMount && onMount(m.querySelector('.box'), close);
  return close;
}
export function timeLeft(ms) {
  if (ms <= 0) return 'ENDED';
  const s = Math.ceil(ms / 1000), m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}
