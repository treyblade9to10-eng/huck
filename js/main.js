// HUCK - app shell + screens
import { load, save, S, card as getCard, addCards, removeCard, myTeamObj, addCoins, lineupCards, fillLineup, reset } from './store.js';
import { PACKS, openPack, STAR_LABEL, STAR_COLOR, STAT_KEYS, STAT_NAMES, POS, STARUP_COST, starUp, cardValue, genTeam, DIFFS, teamOvr, fullName } from './data.js';
import { cardHTML, starsHTML, logoSVG, LOGO_IDS, coinHTML, toast, modal, h, fmt, timeLeft } from './ui.js';
import { tickMarket, placeBid, buyNow, listCard, nextBidAmt } from './market.js';
import { createLeague, teamById, standings, myGame, finishWeek, recordGame, newSeason, currentPlayoffGames, seasonPrize } from './league.js';
import { teamPhoto } from './model.js';

load();
const app = document.getElementById('app');
const gameEl = document.getElementById('game');
let route = 'home', sub = {};

const NAV = [['home', 'HOME'], ['play', 'PLAY'], ['league', 'LEAGUE'], ['packs', 'PACKS'], ['team', 'MY TEAM'], ['cards', 'CARDS'], ['market', 'AUCTION']];
function go(r, s = {}) { if (r !== route) document.querySelectorAll('.modal,.reveal').forEach((m) => m.remove()); route = r; sub = s; render(); app.scrollTop = 0; }
window.addEventListener('hashchange', () => { const r = location.hash.slice(2) || 'home'; if (r !== route && NAV.some((n) => n[0] === r)) go(r); });

function shell(inner) {
  return `<div class="top"><div class="in"><div class="brand" data-go="home">${logoSVG({ logo: 'disc', c1: '#f2c14e', c2: '#d7263d' }, 30)}<span>HU<i>CK</i></span></div>
    <div class="coins"><span class="coin"></span><span id="coinv">${fmt(S.coins)}</span></div></div>
    <div class="nav">${NAV.map(([k, l]) => `<button data-go="${k}" class="${route === k ? 'on' : ''}"><span>${l}</span></button>`).join('')}</div></div>
    <div class="wrapc">${inner}</div>`;
}
function bindGo(root) { root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { location.hash = '#/' + b.dataset.go; go(b.dataset.go); })); }
function updCoins() { const c = document.getElementById('coinv'); if (c) c.textContent = fmt(S.coins); }

function render() {
  const fn = SCREENS[route] || SCREENS.home;
  app.innerHTML = shell(fn());
  bindGo(app);
  (AFTER[route] || (() => {}))();
}
const SCREENS = {}, AFTER = {};

// ---------------- HOME ----------------
SCREENS.home = () => {
  const L = S.league, mine = myTeamObj();
  return `<div class="hero" id="hero"><div class="txt"><div class="pill" style="background:var(--gold);color:#111">ULTIMATE FRISBEE</div>
    <h1>HU<b>CK</b></h1><div class="muted" style="max-width:420px;margin-top:6px">${h(mine.name)} &middot; team rating ${teamOvr(mine.roster, 10)} &middot; ${S.record.w}-${S.record.l}</div>
    <div class="row" style="margin-top:12px"><button class="btn" data-go="play">QUICK GAME</button><button class="btn ghost" data-go="league">${L ? 'MY LEAGUE' : 'START A LEAGUE'}</button></div></div></div>
    <div class="grid tiles">
      ${tile('play', 'PLAY NOW', '3v3 all the way up to 10v10. Pick the size, the opponent and go.')}
      ${tile('league', 'LEAGUE', L ? `${h(L.name)} - Season ${L.season}` : 'Start a league, play a season, win the title.')}
      ${tile('packs', 'PACKS', 'Pull new players. 0 to 5 stars. Legends glow.')}
      ${tile('team', 'MY TEAM', 'Name, colors, logo and your starting lineup.')}
      ${tile('cards', 'CARDS', `${S.cards.length} players. Star them up.`)}
      ${tile('market', 'AUCTION HOUSE', 'Bid on players or sell yours.')}
    </div>`;
};
const tile = (k, t, p) => `<div class="tile" data-go="${k}"><h3>${t}</h3><p>${p}</p></div>`;
AFTER.home = () => {
  const hero = document.getElementById('hero');
  try {
    const url = teamPhoto(lineupCards().slice(0, 5), myTeamObj(), 1100, 420);
    if (url) { const im = document.createElement('img'); im.className = 'bg'; im.src = url; hero.prepend(im); }
  } catch (e) { console.warn(e); }
};

// ---------------- PLAY (quick game) ----------------
SCREENS.play = () => {
  const st = S.settings;
  return `<h1>QUICK GAME</h1><div class="sub">Your top ${st.size} from your lineup play. Wins pay coins.</div>
  <div class="panel grid" style="gap:16px">
    <label class="f">TEAM SIZE <div class="row" id="sizes">${[3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<button class="btn small ${n === st.size ? '' : 'ghost'}" data-n="${n}">${n}v${n}</button>`).join('')}</div></label>
    <div class="row" style="gap:16px">
      <label class="f">GAME TO <select id="to">${[3, 5, 7, 11, 15].map((x) => `<option ${x === st.to ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="f">OPPONENT <select id="diff">${DIFFS.map((d) => `<option value="${d.id}" ${d.id === st.diff ? 'selected' : ''}>${d.name}</option>`).join('')}</select></label>
      <label class="f">GRAPHICS <select id="q"><option value="high" ${st.quality === 'high' ? 'selected' : ''}>High</option><option value="low" ${st.quality === 'low' ? 'selected' : ''}>Fast</option></select></label>
    </div>
    <div><button class="btn" id="go">START GAME</button></div>
  </div>`;
};
AFTER.play = () => {
  const st = S.settings;
  app.querySelectorAll('#sizes [data-n]').forEach((b) => (b.onclick = () => { st.size = +b.dataset.n; save(); render(); }));
  app.querySelector('#to').onchange = (e) => { st.to = +e.target.value; save(); };
  app.querySelector('#diff').onchange = (e) => { st.diff = e.target.value; save(); };
  app.querySelector('#q').onchange = (e) => { st.quality = e.target.value; save(); };
  app.querySelector('#go').onclick = () => {
    const opp = genTeam(Math.floor(Math.random() * 16), st.diff);
    playMatch(opp, st.size, st.to, (res) => reward(res, st.diff));
  };
};
function reward(res, diff) {
  const mult = { rookie: 0.7, pro: 1, allstar: 1.3, legend: 1.7 }[diff] || 1;
  const win = res.score[0] > res.score[1];
  const coins = res.quit ? 0 : Math.round(((win ? 500 : 150) + res.score[0] * 20) * mult);
  if (!res.quit) { if (win) S.record.w++; else S.record.l++; }
  addCoins(coins);
  return coins;
}

let matchMod = null;
async function playMatch(opp, n, to, after) {
  const mine = myTeamObj();
  if (mine.roster.length < n) return toast(`You need ${n} players. Open some packs.`);
  app.style.display = 'none'; gameEl.classList.add('on');
  gameEl.innerHTML = '<div class="loading">LOADING FIELD...</div>';
  matchMod ||= await import('./game.js');
  // CPU should not look like you
  if (opp.c1.toLowerCase() === mine.c1.toLowerCase()) { opp.c1 = '#ffffff'; opp.c2 = '#222222'; }
  const api = matchMod.startMatch({
    container: gameEl, home: mine, away: opp, n, to, quality: S.settings.quality,
    onEnd: (res) => {
      const coins = after(res) || 0;
      showFinal(res, mine, opp, coins);
    },
  });
  const coarse = matchMedia('(pointer: coarse)').matches;
  gameEl.querySelector('.hud').classList.add(coarse ? 'coarse' : 'fine');
}
function showFinal(res, mine, opp, coins) {
  const win = res.score[0] > res.score[1];
  const my = res.stats.filter((s) => s.t === 0).sort((a, b) => (b.g * 3 + b.a * 2 + b.d * 2 + b.cmp * 0.2) - (a.g * 3 + a.a * 2 + a.d * 2 + a.cmp * 0.2));
  const mvp = my[0];
  const f = document.createElement('div'); f.className = 'final';
  f.innerHTML = `<div class="box">
    <div class="pill">${res.quit ? 'GAME ENDED' : 'FINAL'}</div>
    <div class="row" style="justify-content:center;gap:18px;margin:10px 0">${logoSVG(mine, 54)}<div class="big ${res.quit ? '' : win ? 'w' : 'l'}">${res.score[0]} - ${res.score[1]}</div>${logoSVG(opp, 54)}</div>
    <h2>${res.quit ? 'QUIT' : win ? 'VICTORY' : 'DEFEAT'}</h2>
    ${mvp ? `<div class="muted" style="margin:6px 0 12px">MVP: <b style="color:#fff">${h(mvp.name)}</b> &middot; ${mvp.g} G &middot; ${mvp.a} A &middot; ${mvp.d} D</div>` : ''}
    <table class="t" style="text-align:left"><tr><th>PLAYER</th><th>G</th><th>A</th><th>D</th><th>CMP</th></tr>
    ${my.map((s) => `<tr><td>${h(s.name)}</td><td>${s.g}</td><td>${s.a}</td><td>${s.d}</td><td>${s.cmp}/${s.th}</td></tr>`).join('')}</table>
    <div style="margin:14px 0">${coins ? '+' + coinHTML(coins) : ''}</div>
    <button class="btn" id="fin">CONTINUE</button></div>`;
  gameEl.appendChild(f);
  f.querySelector('#fin').onclick = () => { gameEl.classList.remove('on'); gameEl.innerHTML = ''; app.style.display = ''; render(); };
}

// ---------------- PACKS ----------------
SCREENS.packs = () => `<h1>PACKS</h1><div class="sub">Earn coins by playing. Stars go from 0 (Rookie) to 5 (Legend).</div>
  <div class="grid packs">${PACKS.map((p) => `<div class="pack" style="--pc:${p.color}55">
    <div class="art">${packArt(p)}</div><h3>${p.name.toUpperCase()}</h3><div class="muted" style="font-size:14px">${p.blurb}</div>
    <div class="odds">${p.odds.map((o, s) => (o ? `<span style="color:${STAR_COLOR[s]}">${s}&#9733; ${o}%</span>` : '')).join('')}</div>
    <div style="margin-top:auto" class="row"><button class="btn" data-buy="${p.id}" ${S.coins < p.price ? 'disabled' : ''}>OPEN &middot; ${fmt(p.price)}</button></div></div>`).join('')}</div>`;
function packArt(p) {
  return `<svg viewBox="0 0 100 110" width="90" height="100"><defs><linearGradient id="g${p.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.color}"/><stop offset="1" stop-color="#1a1f29"/></linearGradient></defs>
  <rect x="14" y="6" width="72" height="98" rx="6" fill="url(#g${p.id})" stroke="${p.color}" stroke-width="2"/><path d="M14 22h72M14 88h72" stroke="rgba(0,0,0,.35)" stroke-width="3" stroke-dasharray="4 3"/>
  <ellipse cx="50" cy="58" rx="22" ry="9" fill="#fff" opacity=".9"/><ellipse cx="50" cy="56" rx="11" ry="4.4" fill="none" stroke="#d7263d" stroke-width="2"/></svg>`;
}
AFTER.packs = () => app.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => {
  const p = PACKS.find((x) => x.id === b.dataset.buy);
  if (S.coins < p.price) return toast('Not enough coins');
  S.coins -= p.price; const got = openPack(p); addCards(got); save(); updCoins();
  revealPack(got, p);
}));
function revealPack(cards, p) {
  const team = myTeamObj();
  const r = document.createElement('div'); r.className = 'reveal';
  r.innerHTML = `<h2 style="color:${p.color}">${p.name.toUpperCase()}</h2><div class="row2">${cards.map((c, i) => `<div class="flip ${c.stars >= 5 ? 'h5' : c.stars >= 4 ? 'h4' : ''} ${i === 0 ? 'hint' : ''}" data-i="${i}"><div class="back">${packArt(p)}</div><div class="front">${cardHTML(c, team)}</div></div>`).join('')}</div>
    <div class="row"><button class="btn ghost" id="all">REVEAL ALL</button><button class="btn" id="done" style="display:none">DONE</button></div>`;
  document.body.appendChild(r);
  let opened = 0;
  const flips = [...r.querySelectorAll('.flip')];
  const open = (el) => {
    if (el.classList.contains('open')) return;
    el.classList.add('open'); el.classList.remove('hint'); opened++;
    const c = cards[+el.dataset.i];
    if (c.stars >= 5) { const b = document.createElement('div'); b.className = 'burst'; document.body.appendChild(b); setTimeout(() => b.remove(), 1300); r.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-8px,4px)' }, { transform: 'translate(8px,-4px)' }, { transform: 'translate(0,0)' }], { duration: 350 }); toast('LEGEND PULL: ' + fullName(c)); }
    else if (c.stars >= 4) toast('ELITE PULL: ' + fullName(c));
    const nx = flips.find((f) => !f.classList.contains('open')); if (nx) nx.classList.add('hint');
    if (opened === cards.length) { r.querySelector('#done').style.display = ''; r.querySelector('#all').style.display = 'none'; }
  };
  flips.forEach((f) => (f.onclick = () => open(f)));
  r.querySelector('#all').onclick = () => flips.forEach((f, i) => setTimeout(() => open(f), i * 260));
  r.querySelector('#done').onclick = () => { r.remove(); render(); };
}

// ---------------- CARDS ----------------
SCREENS.cards = () => {
  const sort = sub.sort || 'ovr', fpos = sub.pos || 'all';
  let list = [...S.cards];
  if (fpos !== 'all') list = list.filter((c) => c.pos === fpos);
  list.sort(sort === 'ovr' ? (a, b) => b.ovr - a.ovr : sort === 'new' ? () => 0 : (a, b) => b.stats[sort] - a.stats[sort]);
  if (sort === 'new') list.reverse();
  const team = myTeamObj(), lu = new Set(S.team.lineup);
  return `<h1>CARDS</h1><div class="sub">${S.cards.length} players. Tap a card to star it up, sell it or auction it.</div>
    <div class="row" style="margin-bottom:12px"><select id="sort">${[['ovr', 'Best overall'], ['new', 'Newest'], ...STAT_KEYS.map((k) => [k, STAT_NAMES[k]])].map(([v, l]) => `<option value="${v}" ${v === sort ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <select id="pos"><option value="all">All positions</option>${Object.entries(POS).map(([k, v]) => `<option value="${k}" ${k === fpos ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="cards">${list.map((c) => cardHTML(c, team, { badge: lu.has(c.id) ? 'STARTER ' + (S.team.lineup.indexOf(c.id) + 1) : '' })).join('')}</div>`;
};
AFTER.cards = () => {
  app.querySelector('#sort').onchange = (e) => go('cards', { ...sub, sort: e.target.value });
  app.querySelector('#pos').onchange = (e) => go('cards', { ...sub, pos: e.target.value });
  app.querySelectorAll('.pc').forEach((el) => (el.onclick = () => cardModal(getCard(el.dataset.id))));
};
function cardModal(c) {
  if (!c) return;
  const team = myTeamObj(), inLU = S.team.lineup.includes(c.id);
  const cost = STARUP_COST[c.stars];
  modal(`<div class="cardview"><div>${cardHTML(c, team)}</div><div>
    <h2>${h(fullName(c)).toUpperCase()}</h2><div class="muted">${POS[c.pos]} &middot; #${c.num} &middot; <span style="color:${STAR_COLOR[c.stars]}">${STAR_LABEL[c.stars]}</span></div>
    <div style="margin:10px 0">${STAT_KEYS.map((k) => `<div class="statrow"><span>${STAT_NAMES[k]}</span><div class="bar"><i style="width:${c.stats[k]}%;background:${c.stats[k] >= 90 ? '#ff7ad9' : c.stats[k] >= 80 ? '#7fd8ff' : c.stats[k] >= 70 ? '#f2c14e' : '#8792a3'}"></i></div><b>${c.stats[k]}</b></div>`).join('')}</div>
    <div class="grid" style="gap:8px">
      ${c.stars < 5 ? `<button class="btn" id="up">STAR UP TO ${c.stars + 1}&#9733; &middot; ${fmt(cost)}</button><div class="muted" style="font-size:13px">Costs coins and 2 other players with ${c.stars ? c.stars + '&#9733; or more' : 'any stars'}.</div>` : '<div class="pill" style="color:#ff7ad9">MAX STARS</div>'}
      <div class="row"><button class="btn ghost small" id="lu">${inLU ? 'BENCH' : 'ADD TO LINEUP'}</button><button class="btn ghost small" id="auc">AUCTION</button><button class="btn ghost small" id="sell">QUICK SELL ${fmt(cardValue(c) * 0.4)}</button></div>
    </div></div></div>`, (box, close) => {
    const up = box.querySelector('#up');
    if (up) up.onclick = () => { close(); starUpPicker(c); };
    box.querySelector('#lu').onclick = () => {
      if (inLU) { if (S.team.lineup.length <= 3) return toast('Need at least 3 in the lineup'); S.team.lineup = S.team.lineup.filter((x) => x !== c.id); }
      else { if (S.team.lineup.length >= 10) S.team.lineup.pop(); S.team.lineup.push(c.id); }
      save(); close(); render();
    };
    box.querySelector('#sell').onclick = () => {
      if (S.cards.length <= 3) return toast('Keep at least 3 players');
      if (!confirm(`Quick sell ${fullName(c)} for ${fmt(cardValue(c) * 0.4)} coins?`)) return;
      removeCard(c.id); addCoins(cardValue(c) * 0.4); close(); render();
    };
    box.querySelector('#auc').onclick = () => { close(); listModal(c); };
  });
}
function starUpPicker(c) {
  const team = myTeamObj(), need = c.stars;
  const pool = S.cards.filter((x) => x.id !== c.id && x.stars >= need).sort((a, b) => a.ovr - b.ovr);
  const cost = STARUP_COST[c.stars];
  if (pool.length < 2) return toast(`You need 2 other ${need ? need + '-star+ ' : ''}players to star up`);
  const picked = new Set();
  modal(`<h2>STAR UP ${h(fullName(c)).toUpperCase()}</h2><div class="sub">Pick 2 players to train with. They leave your collection. Cost ${fmt(cost)} coins.</div>
    <div class="cards" id="pool">${pool.map((x) => cardHTML(x, team, { badge: S.team.lineup.includes(x.id) ? 'STARTER' : '' })).join('')}</div>
    <div class="row" style="margin-top:14px"><button class="btn" id="ok" disabled>STAR UP</button><button class="btn ghost" id="cx">CANCEL</button></div>`, (box, close) => {
    const ok = box.querySelector('#ok');
    box.querySelectorAll('#pool .pc').forEach((el) => (el.onclick = () => {
      const id = el.dataset.id;
      if (picked.has(id)) picked.delete(id); else if (picked.size < 2) picked.add(id);
      box.querySelectorAll('#pool .pc').forEach((e) => e.classList.toggle('sel', picked.has(e.dataset.id)));
      ok.disabled = picked.size !== 2 || S.coins < cost;
    }));
    box.querySelector('#cx').onclick = close;
    ok.onclick = () => {
      if (S.coins < cost) return toast('Not enough coins');
      S.coins -= cost; for (const id of picked) removeCard(id);
      const before = c.stars; starUp(c); fillLineup(); save(); close();
      const r = document.createElement('div'); r.className = 'reveal';
      r.innerHTML = `<h2 style="color:${STAR_COLOR[c.stars]}">${before}&#9733; &rarr; ${c.stars}&#9733;</h2><div class="flip open" style="transition:none">${'<div class="front" style="transform:none">' + cardHTML(c, myTeamObj()) + '</div>'}</div><button class="btn">NICE</button>`;
      document.body.appendChild(r); r.querySelector('.btn').onclick = () => { r.remove(); render(); };
      if (c.stars >= 5) { const b = document.createElement('div'); b.className = 'burst'; document.body.appendChild(b); setTimeout(() => b.remove(), 1300); }
    };
  });
}

// ---------------- MY TEAM ----------------
const PALETTE = ['#d7263d', '#e53935', '#ff6d1f', '#f2c14e', '#fdd835', '#8bc34a', '#2e7d32', '#00897b', '#00acc1', '#1e88e5', '#283593', '#6a1b9a', '#c2185b', '#ff7ad9', '#5d4037', '#455a64', '#212121', '#ffffff'];
SCREENS.team = () => {
  const t = S.team, team = myTeamObj(), lu = lineupCards();
  return `<h1>MY TEAM</h1><div class="sub">The first players in your lineup start. In a 5v5 game, slots 1-5 play.</div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <div class="panel grid" style="gap:14px">
      <div class="row">${logoSVG(team, 64)}<div><h2>${h(t.name).toUpperCase()}</h2><div class="muted">${h(t.abbr)} &middot; rating ${teamOvr(team.roster, 7)}</div></div></div>
      <label class="f">TEAM NAME <input type="text" id="tn" maxlength="22" value="${h(t.name)}"></label>
      <label class="f">SHORT NAME (3 LETTERS) <input type="text" id="ta" maxlength="3" value="${h(t.abbr)}"></label>
      <label class="f">MAIN COLOR <div class="swatches" id="c1">${PALETTE.map((c) => `<div class="sw ${c === t.c1 ? 'on' : ''}" data-c="${c}" style="background:${c}"></div>`).join('')}</div></label>
      <label class="f">SECOND COLOR <div class="swatches" id="c2">${PALETTE.map((c) => `<div class="sw ${c === t.c2 ? 'on' : ''}" data-c="${c}" style="background:${c}"></div>`).join('')}</div></label>
      <label class="f">LOGO <div class="logos">${LOGO_IDS.map((l) => `<button data-l="${l}" class="${l === t.logo ? 'on' : ''}">${logoSVG({ ...team, logo: l }, 44)}</button>`).join('')}</div></label>
    </div>
    <div class="panel"><div class="row" style="justify-content:space-between;margin-bottom:10px"><h3>LINEUP</h3><button class="btn small ghost" id="auto">AUTO BEST</button></div>
      <div class="grid lineup">${lu.map((c, i) => `<div><div class="pill" style="margin-bottom:4px">${i + 1}</div>${cardHTML(c, team, { cls: sub.swap === c.id ? 'sel' : '' })}</div>`).join('')}
      ${Array.from({ length: Math.max(0, 10 - lu.length) }, (_, i) => `<div><div class="pill" style="margin-bottom:4px">${lu.length + i + 1}</div><div class="slot">EMPTY</div></div>`).join('')}</div>
      <div class="muted" style="font-size:13px;margin-top:10px">Tap two lineup cards to swap their order. Bench players from the Cards page.</div></div>
  </div>`;
};
AFTER.team = () => {
  const t = S.team;
  app.querySelector('#tn').onchange = (e) => { t.name = e.target.value.trim() || 'My Squad'; save(); render(); };
  app.querySelector('#ta').onchange = (e) => { t.abbr = (e.target.value.trim() || 'SQD').toUpperCase().slice(0, 3); save(); render(); };
  app.querySelectorAll('#c1 .sw').forEach((s) => (s.onclick = () => { t.c1 = s.dataset.c; save(); render(); }));
  app.querySelectorAll('#c2 .sw').forEach((s) => (s.onclick = () => { t.c2 = s.dataset.c; save(); render(); }));
  app.querySelectorAll('[data-l]').forEach((b) => (b.onclick = () => { t.logo = b.dataset.l; save(); render(); }));
  app.querySelector('#auto').onclick = () => { t.lineup = [...S.cards].sort((a, b) => b.ovr - a.ovr).slice(0, 10).map((c) => c.id); save(); render(); };
  app.querySelectorAll('.lineup .pc').forEach((el) => (el.onclick = () => {
    const id = el.dataset.id;
    if (!sub.swap) return go('team', { swap: id });
    if (sub.swap === id) return go('team', {});
    const L = t.lineup, a = L.indexOf(sub.swap), b = L.indexOf(id);
    [L[a], L[b]] = [L[b], L[a]]; save(); go('team', {});
  }));
};

// ---------------- AUCTION ----------------
SCREENS.market = () => {
  tickMarket();
  const tab = sub.tab || 'buy', M = S.market, team = myTeamObj();
  const tabs = `<div class="tabs">${[['buy', 'BUY'], ['sell', 'MY LISTINGS'], ['log', 'HISTORY']].map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  let body = '';
  if (tab === 'buy') body = `<div class="lst">${M.listings.map((l) => `<div class="it" data-l="${l.id}">${cardHTML(l.card, { ...team, c1: '#3a4558', c2: '#c9d2dc' })}
      <div class="meta"><span class="muted">${h(l.seller)}</span><span class="timer" data-end="${l.ends}">${timeLeft(l.ends - Date.now())}</span></div>
      <div class="meta"><span>${l.bid ? (l.bidder === 'you' ? '<span class="w">YOU</span> ' : h(l.bidder) + ' ') + fmt(l.bid) : 'Start ' + fmt(l.start)}</span><span class="muted">Buy ${fmt(l.buyNow)}</span></div>
      <div class="row" style="gap:6px"><button class="btn small" data-bid="${l.id}" ${l.bidder === 'you' ? 'disabled' : ''}>BID ${fmt(nextBidAmt(l))}</button><button class="btn small ghost" data-bn="${l.id}">BUY NOW</button></div></div>`).join('')}</div>`;
  if (tab === 'sell') body = M.mine.length ? `<div class="lst">${M.mine.map((m) => `<div class="it">${cardHTML(m.card, team)}
      <div class="meta"><span>${m.bid ? h(m.bidder) + ' ' + fmt(m.bid) : 'No bids yet'}</span><span class="timer" data-end="${m.ends}">${timeLeft(m.ends - Date.now())}</span></div>
      <div class="meta muted"><span>Start ${fmt(m.start)}</span><span>${m.buyNow ? 'Buy ' + fmt(m.buyNow) : ''}</span></div></div>`).join('')}</div>` : '<div class="panel muted">Nothing listed. Open a card on the Cards page and hit AUCTION.</div>';
  if (tab === 'log') body = `<div class="panel">${M.log.length ? M.log.map((x) => `<div style="padding:6px 0;border-bottom:1px solid #202836">${h(x.txt)}</div>`).join('') : '<span class="muted">Nothing yet.</span>'}</div>`;
  return `<h1>AUCTION HOUSE</h1><div class="sub">Bid against other managers, or list your own players. 5% house fee on sales. Coins you bid are held until you win or get outbid.</div>${tabs}${body}`;
};
AFTER.market = () => {
  app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => go('market', { tab: b.dataset.tab })));
  const find = (id) => S.market.listings.find((l) => l.id === id);
  app.querySelectorAll('[data-bid]').forEach((b) => (b.onclick = () => { const e = placeBid(find(b.dataset.bid)); toast(e || 'Bid placed'); render(); }));
  app.querySelectorAll('[data-bn]').forEach((b) => (b.onclick = () => {
    const l = find(b.dataset.bn); if (!confirm(`Buy ${fullName(l.card)} now for ${fmt(l.buyNow)}?`)) return;
    const e = buyNow(l); toast(e || 'Bought ' + fullName(l.card)); render();
  }));
};
function listModal(c) {
  if (S.cards.length <= 3) return toast('Keep at least 3 players');
  const v = cardValue(c);
  modal(`<h2>AUCTION ${h(fullName(c)).toUpperCase()}</h2><div class="sub">Worth about ${fmt(v)} coins. Price it right and someone bites.</div>
    <div class="grid" style="gap:12px"><label class="f">STARTING BID <input type="number" id="st" value="${Math.round(v * 0.6)}" min="10"></label>
    <label class="f">BUY NOW (0 = none) <input type="number" id="bn" value="${Math.round(v * 1.3)}" min="0"></label>
    <label class="f">LENGTH <select id="du"><option value="2">2 minutes</option><option value="5" selected>5 minutes</option><option value="15">15 minutes</option><option value="60">1 hour</option></select></label>
    <div class="row"><button class="btn" id="ok">LIST IT</button><button class="btn ghost" id="cx">CANCEL</button></div></div>`, (box, close) => {
    box.querySelector('#cx').onclick = close;
    box.querySelector('#ok').onclick = () => {
      const st = Math.max(10, +box.querySelector('#st').value || 10), bn = Math.max(0, +box.querySelector('#bn').value || 0);
      if (bn && bn < st) return toast('Buy now must be higher than the start');
      listCard(c, st, bn, +box.querySelector('#du').value); close(); toast('Listed'); go('market', { tab: 'sell' });
    };
  });
}
setInterval(() => {
  const ev = tickMarket();
  for (const e of ev) {
    if (e.type === 'outbid') toast(`Outbid on ${fullName(e.l.card)}`);
    if (e.type === 'won') toast(`You won ${fullName(e.l.card)}`);
    if (e.type === 'sold') toast(`Sold ${fullName(e.m.card)} for ${fmt(e.got)}`);
    if (e.type === 'unsold') toast(`${fullName(e.m.card)} did not sell`);
  }
  if (ev.length && route === 'market' && !gameEl.classList.contains('on')) render();
  else { document.querySelectorAll('.timer[data-end]').forEach((t) => (t.textContent = timeLeft(+t.dataset.end - Date.now()))); updCoins(); }
}, 1000);

// ---------------- LEAGUE ----------------
SCREENS.league = () => {
  const L = S.league;
  if (!L || sub.create) return `<h1>START A LEAGUE</h1><div class="sub">Pick the rules. Every other team is run by the computer. Play your games, sim the rest.</div>
    <div class="panel grid" style="gap:14px;max-width:560px">
      <label class="f">LEAGUE NAME <input type="text" id="ln" maxlength="26" value="${h(L ? L.name : 'Summer Huck League')}"></label>
      <div class="row" style="gap:14px">
      <label class="f">TEAMS <select id="lt">${[4, 6, 8, 10, 12].map((x) => `<option ${x === 8 ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="f">TEAM SIZE <select id="ls">${[3, 4, 5, 6, 7, 8, 9, 10].map((x) => `<option value="${x}" ${x === 5 ? 'selected' : ''}>${x}v${x}</option>`).join('')}</select></label>
      <label class="f">GAME TO <select id="lg">${[5, 7, 11].map((x) => `<option ${x === 7 ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="f">LEVEL <select id="ld">${DIFFS.map((d) => `<option value="${d.id}" ${d.id === 'pro' ? 'selected' : ''}>${d.name}</option>`).join('')}</select></label>
      <label class="f">SCHEDULE <select id="lr"><option value="1">Play everyone once</option><option value="2">Play everyone twice</option></select></label></div>
      <div class="row"><button class="btn" id="mk">CREATE LEAGUE</button>${L ? '<button class="btn ghost" id="cx">CANCEL</button>' : ''}</div>
      ${L ? '<div class="muted" style="font-size:13px">Creating a new league replaces your current one.</div>' : ''}</div>`;
  const tab = sub.tab || 'home', st = standings(L);
  const tabs = `<div class="tabs">${[['home', 'THIS WEEK'], ['table', 'STANDINGS'], ['sched', 'SCHEDULE'], ['leaders', 'LEADERS']].map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const tn = (id) => teamById(L, id), me = st.findIndex((s) => s.id === 'me');
  const head = `<div class="row" style="justify-content:space-between"><div><h1>${h(L.name).toUpperCase()}</h1><div class="sub">Season ${L.season} &middot; ${L.n}v${L.n} &middot; game to ${L.to} &middot; you are ${ord(me + 1)} (${st[me].w}-${st[me].l})</div></div><button class="btn ghost small" id="newl">NEW LEAGUE</button></div>`;
  let body = '';
  if (tab === 'home') body = weekView(L, tn);
  if (tab === 'table') body = `<div class="panel" style="overflow-x:auto"><table class="t"><tr><th>#</th><th>TEAM</th><th>W</th><th>L</th><th>PF</th><th>PA</th><th>+/-</th><th>OVR</th></tr>${st.map((s, i) => { const t = tn(s.id); return `<tr class="${s.id === 'me' ? 'me' : ''}"><td>${i + 1}</td><td>${logoSVG(t, 26).replace('<svg', '<svg class="tlogo"')}${h(t.name)}</td><td>${s.w}</td><td>${s.l}</td><td>${s.pf}</td><td>${s.pa}</td><td>${s.pf - s.pa > 0 ? '+' : ''}${s.pf - s.pa}</td><td>${teamOvr(t.roster, L.n)}</td></tr>`; }).join('')}</table>
    <div class="muted" style="font-size:13px;margin-top:8px">Top ${L.teams.length >= 6 ? 4 : 2} make the playoffs.</div></div>`;
  if (tab === 'sched') body = `<div class="panel">${L.weeks.map((w, i) => `<h3 style="margin:10px 0 4px">WEEK ${i + 1}</h3>${w.map((g) => gameRow(g, tn)).join('')}`).join('')}</div>`;
  if (tab === 'leaders') {
    const all = {}; for (const t of L.teams) for (const c of (t.id === 'me' ? myTeamObj().roster : t.roster)) all[c.id] = { c, t: tn(t.id) };
    const rows = Object.entries(L.pstats).filter(([id]) => all[id]).map(([id, s]) => ({ ...s, ...all[id] }));
    const top = (k) => rows.sort((a, b) => b[k] - a[k]).slice(0, 8);
    body = `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">${[['g', 'GOALS'], ['a', 'ASSISTS'], ['d', 'BLOCKS (D)']].map(([k, l]) => `<div class="panel"><h3>${l}</h3><table class="t">${top(k).map((r) => `<tr class="${r.t.id === 'me' ? 'me' : ''}"><td>${h(r.c.first[0] + '. ' + r.c.last)}</td><td class="muted">${h(r.t.abbr)}</td><td><b>${r[k]}</b></td></tr>`).join('') || '<tr><td class="muted">No games yet</td></tr>'}</table></div>`).join('')}</div>`;
  }
  return head + tabs + body;
};
const ord = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');
function gameRow(g, tn) {
  const A = tn(g.a), B = tn(g.b), mine = g.a === 'me' || g.b === 'me';
  let cls = '';
  if (g.score && mine) { const my = g.a === 'me' ? g.score[0] : g.score[1], th = g.a === 'me' ? g.score[1] : g.score[0]; cls = my > th ? 'w' : 'l'; }
  return `<div class="game" style="${mine ? 'background:rgba(242,193,78,.06)' : ''}">${logoSVG(A, 28)}<span style="flex:1">${h(A.name)}</span><span class="sc ${cls}">${g.score ? g.score[0] + ' - ' + g.score[1] : 'vs'}</span><span style="flex:1;text-align:right">${h(B.name)}</span>${logoSVG(B, 28)}</div>`;
}
function weekView(L, tn) {
  if (L.done) {
    const champ = tn(L.champ), prize = seasonPrize(L);
    return `<div class="panel" style="text-align:center">${logoSVG(champ, 90)}<h1 style="margin-top:6px">${h(champ.name).toUpperCase()}</h1><div class="sub">SEASON ${L.season} CHAMPIONS</div>
      ${L.champ === 'me' ? '<h2 class="w">YOU WON THE TITLE</h2>' : ''}
      <div style="margin:10px 0">${L.prized ? '' : 'Season reward: ' + coinHTML(prize)}</div>
      <button class="btn" id="nexts">${L.prized ? 'START SEASON ' + (L.season + 1) : 'COLLECT + NEXT SEASON'}</button>
      ${L.history.length ? `<div style="margin-top:16px;text-align:left"><h3>CHAMPIONS</h3>${L.history.map((x) => `<div class="muted">Season ${x.season}: ${h(x.champName)}</div>`).join('')}</div>` : ''}</div>`;
  }
  const games = L.playoffs ? currentPlayoffGames(L) : L.weeks[L.week];
  const label = L.playoffs ? (games.length === 1 ? 'FINAL' : 'SEMIFINALS') : `WEEK ${L.week + 1} OF ${L.weeks.length}`;
  const g = myGame(L);
  const out = L.playoffs && !g;
  let mine = '';
  if (g) {
    const opp = tn(g.a === 'me' ? g.b : g.a);
    mine = `<div class="panel" style="margin-bottom:12px"><div class="pill">YOUR GAME</div>
      <div class="row" style="margin:12px 0;gap:16px;justify-content:center">${logoSVG(myTeamObj(), 64)}<h2>VS</h2>${logoSVG(opp, 64)}</div>
      <div style="text-align:center"><h3>${h(opp.name).toUpperCase()}</h3><div class="muted">Team rating ${teamOvr(opp.roster, L.n)} vs your ${teamOvr(myTeamObj().roster, L.n)}</div>
      <div class="row" style="justify-content:center;margin-top:12px">${g.score ? `<div class="sc">${g.score[0]} - ${g.score[1]}</div>` : `<button class="btn" id="playg">PLAY GAME</button><button class="btn ghost" id="simg">SIM IT</button>`}</div></div></div>`;
  } else if (out) mine = `<div class="panel muted" style="margin-bottom:12px">You are out of the playoffs. Sim to see who wins it.</div>`;
  const allDone = games.every((x) => x.score || (x === g && false));
  return `${mine}<div class="panel"><div class="row" style="justify-content:space-between"><h3>${label}</h3>
    <button class="btn small ${g && !g.score ? 'ghost' : ''}" id="advance" ${g && !g.score ? 'disabled' : ''}>${L.playoffs ? 'FINISH ROUND' : 'NEXT WEEK'}</button></div>
    ${games.map((x) => gameRow(x, tn)).join('')}</div>`;
}
AFTER.league = () => {
  const L = S.league;
  const mk = app.querySelector('#mk');
  if (mk) {
    mk.onclick = () => {
      if (L && !confirm('Replace your current league?')) return;
      const n = +app.querySelector('#ls').value;
      if (S.cards.length < n) return toast(`You need ${n} players for ${n}v${n}`);
      createLeague({ name: app.querySelector('#ln').value.trim() || 'Huck League', size: +app.querySelector('#lt').value, n, to: +app.querySelector('#lg').value, diff: app.querySelector('#ld').value, rounds: +app.querySelector('#lr').value });
      go('league', {});
    };
    const cx = app.querySelector('#cx'); if (cx) cx.onclick = () => go('league', {});
    return;
  }
  app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => go('league', { tab: b.dataset.tab })));
  app.querySelector('#newl').onclick = () => go('league', { create: 1 });
  const g = myGame(L);
  const pg = app.querySelector('#playg');
  if (pg) pg.onclick = () => {
    const home = g.a === 'me', opp = teamById(L, home ? g.b : g.a);
    playMatch(opp, L.n, L.to, (res) => {
      if (res.quit) return 0;
      const sc = home ? res.score : [res.score[1], res.score[0]];
      recordGame(L, g, sc, res.stats.map((s) => ({ id: s.id, g: s.g, a: s.a, d: s.d })));
      return reward(res, L.diff);
    });
  };
  const sg = app.querySelector('#simg');
  if (sg) sg.onclick = () => {
    const r = simGameFor2(L, g); const win = (g.a === 'me' ? r.score[0] > r.score[1] : r.score[1] > r.score[0]);
    if (win) S.record.w++; else S.record.l++;
    addCoins(win ? 200 : 60); toast(win ? 'Simmed a win  +200' : 'Simmed a loss  +60'); render();
  };
  const adv = app.querySelector('#advance');
  if (adv) adv.onclick = () => { finishWeek(L); render(); };
  const nx = app.querySelector('#nexts');
  if (nx) nx.onclick = () => { if (!L.prized) { addCoins(seasonPrize(L)); L.prized = true; } newSeason(L); L.prized = false; save(); render(); };
};
import { simGameFor } from './league.js';
const simGameFor2 = (L, g) => simGameFor(L, g);

// first paint
const r0 = location.hash.slice(2); if (NAV.some((n) => n[0] === r0)) route = r0;
render();
window.__app = { S, go, render, reset: () => { reset(); render(); } };
