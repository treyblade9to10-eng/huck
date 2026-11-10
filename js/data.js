// HUCK - data: names, player cards, stars, packs, CPU teams
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let _r = rng(Date.now() & 0xffffffff);
export const rand = () => _r();
export const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(rand() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const uid = () => Date.now().toString(36) + Math.floor(rand() * 1e9).toString(36);

const FIRST = ['Aiden','Marcus','Theo','Jalen','Kai','Rowan','Dante','Miles','Ezra','Luca','Omar','Felix','Andre','Silas','Mateo','Jonah','Cyrus','Darius','Emmett','Isaiah','Koa','Leon','Nico','Quinn','Rafael','Tobias','Wes','Zane','Bodhi','Caleb','Dev','Elias','Finn','Gavin','Hugo','Ike','Jasper','Kenji','Liam','Malik','Nate','Oscar','Pax','Reid','Sami','Tariq','Uriel','Vance','Wyatt','Xavi','Yusuf','Zion','Ari','Beau','Cole','Diego','Eli','Grey','Hank','Idris','Jude','Kobe','Lars','Moss','Noel','Orion','Pierce','Ravi','Sol','Tate','Ulises','Vic','Arlo','Bram','Cruz','Deshawn','Enzo','Femi','Gus','Hiro','Iker','Jace','Kwame','Lio','Mylo','Nash','Otis','Pablo','Rhys','Sora','Tomas','Ugo','Wren','Yaw','Zev','Amir','Bastian','Callum','Dorian','Emeka'];
const LAST = ['Hale','Brooks','Okafor','Vance','Reyes','Lindqvist','Moreau','Kimura','Adeyemi','Castillo','Ferro','Gallagher','Haddad','Ivers','Jansen','Kowalski','Laurent','Mbeki','Novak','Ortega','Petrov','Quarles','Rasmussen','Sato','Thorne','Underwood','Varga','Whitlock','Xiong','Yarrow','Zeller','Abara','Bellamy','Cordero','Dunmore','Eklund','Fontaine','Grayson','Holloway','Ito','Jovanovic','Kessler','Lockhart','Mendez','Nakamura','Osei','Pemberton','Quint','Rivera','Stroud','Tanaka','Ulloa','Vasquez','Wilder','Yoon','Zamora','Ashby','Barros','Crane','Delacroix','Esposito','Falk','Garza','Hollis','Ibarra','Juarez','Kader','Larkin','Mosley','Nwosu','Oyelaran','Pryce','Rook','Sandoval','Takeda','Vidal','Weston','Yilmaz','Aldana','Birch','Cobb','Duarte','Ellery','Fairbanks','Gentry','Hawke','Ingram','Jolly','Kipling','Lowe','Marsh','Nyberg','Ocampo','Pike','Rhee','Sterling','Tolliver','Voss','Wolfe','Achebe','Banerjee','Cahill','Draper'];

export const SKINS = ['#f3d2b3','#e8bf9a','#d9a77f','#c18a5e','#a8714a','#8a5636','#6e4127','#54301c'];
export const HAIRC = ['#1b1210','#2e1d14','#4a2d1a','#6b4423','#a5753c','#d8b26a','#b04a24','#888888'];
export const HAIRS = ['buzz','short','crop','curly','afro','long','bun','bald','mohawk','headband'];
export const POS = { H: 'Handler', C: 'Cutter', D: 'Defender', Y: 'Hybrid' };
export const STAT_KEYS = ['spd', 'thr', 'cat', 'def', 'jmp'];
export const STAT_NAMES = { spd: 'SPEED', thr: 'THROW', cat: 'CATCH', def: 'DEFENSE', jmp: 'HOPS' };

const WEIGHTS = {
  H: { spd: .15, thr: .40, cat: .20, def: .10, jmp: .15 },
  C: { spd: .30, thr: .10, cat: .30, def: .10, jmp: .20 },
  D: { spd: .30, thr: .10, cat: .10, def: .35, jmp: .15 },
  Y: { spd: .22, thr: .22, cat: .22, def: .17, jmp: .17 },
};
const SPECIAL = { H: ['thr', 'cat'], C: ['spd', 'cat', 'jmp'], D: ['def', 'spd'], Y: [] };

export function ovrOf(card) {
  const w = WEIGHTS[card.pos]; let s = 0;
  for (const k of STAT_KEYS) s += card.stats[k] * w[k];
  return Math.round(s);
}
export function starsFor(ovr) {
  if (ovr >= 90) return 5; if (ovr >= 80) return 4; if (ovr >= 70) return 3;
  if (ovr >= 60) return 2; if (ovr >= 50) return 1; return 0;
}
export const STAR_FLOOR = [38, 50, 60, 70, 80, 90];
export const STAR_LABEL = ['Rookie', 'Bronze', 'Silver', 'Gold', 'Elite', 'Legend'];
export const STAR_COLOR = ['#7d8794', '#c58a52', '#c9d2dc', '#f2c14e', '#7fd8ff', '#ff7ad9'];

export function refresh(card) {
  for (const k of STAT_KEYS) card.stats[k] = clamp(Math.round(card.stats[k]), 20, 99);
  card.ovr = ovrOf(card); card.stars = starsFor(card.ovr);
  return card;
}

export function genLook() {
  return {
    skin: ri(0, SKINS.length - 1), hair: pick(HAIRS), hairC: ri(0, HAIRC.length - 1),
    h: +(0.93 + rand() * 0.14).toFixed(2), build: +(0.9 + rand() * 0.22).toFixed(2),
    beard: rand() < 0.22, band: rand() < 0.3 ? ri(0, 5) : -1, sleeve: rand() < 0.35,
  };
}

export function genCard(stars, opts = {}) {
  const pos = opts.pos || pick(['H', 'H', 'C', 'C', 'C', 'D', 'D', 'Y']);
  const lo = STAR_FLOOR[stars], hi = stars === 5 ? 97 : STAR_FLOOR[stars + 1] - 1;
  const target = ri(lo, hi);
  const card = {
    id: uid(), first: pick(FIRST), last: pick(LAST), pos, num: ri(0, 99),
    look: opts.look || genLook(), stats: {}, ovr: 0, stars: 0,
  };
  for (const k of STAT_KEYS) {
    let v = target + ri(-9, 6);
    if (SPECIAL[pos].includes(k)) v += ri(4, 10);
    card.stats[k] = v;
  }
  // nudge so ovr lands on target
  for (let i = 0; i < 12; i++) {
    const d = target - ovrOf(card); if (Math.abs(d) < 1) break;
    for (const k of STAT_KEYS) card.stats[k] = clamp(card.stats[k] + d, 20, 99);
  }
  return refresh(card);
}
export const fullName = (c) => c.first + ' ' + c.last;
export const shortName = (c) => c.first[0] + '. ' + c.last;

// Star up: costs coins + 2 sacrifice cards with stars >= this card's stars (any card for 0 star)
export const STARUP_COST = [250, 600, 1500, 3500, 8000];
export function starUp(card) {
  if (card.stars >= 5) return card;
  const goal = STAR_FLOOR[card.stars + 1] + ri(0, 3);
  for (let i = 0; i < 20 && ovrOf(card) < goal; i++)
    for (const k of STAT_KEYS) card.stats[k] = clamp(card.stats[k] + 1, 20, 99);
  return refresh(card);
}

// card value (coins) - used by auction + quick sell
export function cardValue(c) {
  const base = [60, 150, 400, 1100, 3200, 9000][c.stars];
  const within = (c.ovr - STAR_FLOOR[c.stars]) / 10;
  return Math.round(base * (1 + within * 0.8));
}

// ---------- packs ----------
export const PACKS = [
  { id: 'street', name: 'Street Pack', price: 400, n: 3, odds: [40, 40, 16, 4, 0, 0], color: '#7d8794', blurb: '3 players. Mostly Rookie and Bronze.' },
  { id: 'club', name: 'Club Pack', price: 1200, n: 4, odds: [0, 35, 42, 19, 4, 0], color: '#c9d2dc', blurb: '4 players. Bronze to Gold, small Elite chance.' },
  { id: 'pro', name: 'Pro Pack', price: 3500, n: 5, odds: [0, 0, 35, 45, 17, 3], color: '#f2c14e', blurb: '5 players. Silver and up, 3% Legend.' },
  { id: 'legend', name: 'Legend Pack', price: 9000, n: 3, odds: [0, 0, 0, 30, 55, 15], color: '#ff7ad9', blurb: '3 players. Gold or better, 15% Legend.' },
];
export function rollStars(odds) {
  let r = rand() * 100;
  for (let s = 0; s < odds.length; s++) { r -= odds[s]; if (r < 0) return s; }
  return 0;
}
export function openPack(pack) {
  const out = [];
  for (let i = 0; i < pack.n; i++) out.push(genCard(rollStars(pack.odds)));
  out.sort((a, b) => a.ovr - b.ovr); // best last for the reveal
  return out;
}

// ---------- CPU teams ----------
const CITY = ['Harbor', 'Summit', 'Coastal', 'Granite', 'Prairie', 'Redwood', 'Lakeside', 'Northgate', 'Ironbridge', 'Sandbar', 'Foxhollow', 'Westfield', 'Bayview', 'Stonebrook', 'Cedar', 'Riverside'];
const NICK = ['Hawks', 'Riptide', 'Cyclones', 'Comets', 'Wolves', 'Vipers', 'Owls', 'Storm', 'Falcons', 'Rockets', 'Flash', 'Breakers', 'Kites', 'Herons', 'Lynx', 'Thunder'];
const COLORS = [['#d7263d', '#1b1b1e'], ['#1e88e5', '#ffffff'], ['#2e7d32', '#f9d342'], ['#6a1b9a', '#f2c14e'], ['#ff8f00', '#212121'], ['#00897b', '#ffffff'], ['#283593', '#ff5252'], ['#c2185b', '#ffffff'], ['#455a64', '#ffca28'], ['#5d4037', '#ffe0b2'], ['#00acc1', '#0d1b2a'], ['#8bc34a', '#1b1b1e'], ['#f4511e', '#ffffff'], ['#3949ab', '#c0ca33'], ['#212121', '#e53935'], ['#7b1fa2', '#80deea']];
export const LOGOS = ['disc', 'bolt', 'wing', 'star', 'wave', 'peak', 'claw', 'flame'];
export const DIFFS = [
  { id: 'rookie', name: 'Rookie', stars: [0, 1, 1, 2], ai: 0.75 },
  { id: 'pro', name: 'Pro', stars: [1, 2, 2, 3], ai: 0.9 },
  { id: 'allstar', name: 'All-Star', stars: [2, 3, 3, 4], ai: 1.0 },
  { id: 'legend', name: 'Legend', stars: [3, 4, 4, 5], ai: 1.12 },
];
export function genTeam(i, diff, used = new Set()) {
  let ci = i % CITY.length, ni = (i * 7 + 3) % NICK.length;
  let name = CITY[ci] + ' ' + NICK[ni], k = 0;
  while (used.has(name) && k < 50) { ci = ri(0, CITY.length - 1); ni = ri(0, NICK.length - 1); name = CITY[ci] + ' ' + NICK[ni]; k++; }
  used.add(name);
  const col = COLORS[(ci + ni) % COLORS.length];
  const d = DIFFS.find((x) => x.id === diff) || DIFFS[1];
  const roster = [];
  const posPlan = ['H', 'H', 'C', 'C', 'C', 'D', 'D', 'Y', 'H', 'C', 'D', 'Y'];
  for (let j = 0; j < 12; j++) roster.push(genCard(pick(d.stars), { pos: posPlan[j] }));
  roster.sort((a, b) => b.ovr - a.ovr);
  return { id: 'cpu' + i + '_' + uid(), name, abbr: (CITY[ci].slice(0, 2) + NICK[ni][0]).toUpperCase(), c1: col[0], c2: col[1], logo: LOGOS[(ci + ni) % LOGOS.length], roster, cpu: true, ai: d.ai };
}
export function teamOvr(roster, n) {
  const top = roster.slice(0, n); if (!top.length) return 0;
  return Math.round(top.reduce((s, c) => s + c.ovr, 0) / top.length);
}
