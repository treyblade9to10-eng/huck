// HUCK - match engine: rules, disc flight, AI, controls, camera
import * as THREE from './lib/three.min.js';
import { makeAthlete, animate, makeDisc } from './model.js';
import { buildWorld, fieldDims, blobShadow, ring } from './field.js';
import { shortName } from './data.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R = Math.random;
const gauss = () => (R() + R() + R() + R() - 2) / 1.15;

export function startMatch(opt) {
  const n = opt.n, to = opt.to, quality = opt.quality || 'high';
  const teams = [opt.home, opt.away];
  const D = fieldDims(n), half = D.L / 2, W = D.W, EZ = D.E, tot = half + EZ;
  const root = opt.container; root.innerHTML = '';
  const wrap = document.createElement('div'); wrap.className = 'match'; root.appendChild(wrap);

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: quality === 'high', powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = quality === 'high'; renderer.shadowMap.type = THREE.PCFShadowMap;
  wrap.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(42, 1, 0.5, 400);
  buildWorld(scene, D, teams[0], teams[1], quality);

  // ---------- HUD ----------
  const hud = document.createElement('div'); hud.className = 'hud'; wrap.appendChild(hud);
  hud.innerHTML = `
    <div class="bug"><div class="bt" style="--c:${teams[0].c1}"><b>${teams[0].abbr}</b><span id="s0">0</span></div>
      <div class="bmid">TO ${to}</div><div class="bt" style="--c:${teams[1].c1}"><span id="s1">0</span><b>${teams[1].abbr}</b></div></div>
    <div class="stall" id="stall"></div>
    <div class="banner" id="banner"></div>
    <div class="tip" id="tip"></div>
    <button class="hbtn pausebtn" id="pause" aria-label="Pause"><svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg></button>
    <div class="joy" id="joy"><div class="knob" id="knob"></div></div>
    <div class="acts">
      <button class="act" id="bHuck">HUCK</button>
      <button class="act" id="bSwitch">SWITCH</button>
      <button class="act big" id="bBid">BID</button>
    </div>
    <div class="pmenu" id="pmenu"><div class="pbox"><h2>PAUSED</h2>
      <button class="btn" id="pResume">RESUME</button><button class="btn ghost" id="pHelp">CONTROLS</button><button class="btn ghost" id="pQuit">QUIT GAME</button>
      <div class="help" id="help">
        <p><b>OFFENSE</b> - you control whoever has the disc. Tap/click a teammate to throw them a lead pass, or tap open grass to throw there. Hold the tap (or hold SHIFT, or turn on HUCK) for a high deep throw. 10 second stall count, you can't run with the disc.</p>
        <p><b>CATCHING</b> - your receiver runs to the disc on their own. Steer with the stick / WASD, press BID (SPACE) to jump or lay out.</p>
        <p><b>DEFENSE</b> - move your defender, SWITCH (Q) jumps to whoever is closest to the disc, BID (SPACE) to jump or lay out for a block.</p>
      </div></div></div>`;
  const $ = (id) => hud.querySelector('#' + id);

  // ---------- players ----------
  const P = []; // all players
  for (let t = 0; t < 2; t++) {
    const roster = teams[t].roster.slice(0, n);
    roster.forEach((card, i) => {
      const m = makeAthlete(card, teams[t]);
      scene.add(m.root);
      m.root.traverse((o) => { if (o.isMesh) o.castShadow = quality === 'high'; });
      if (quality !== 'high') { const b = blobShadow(0.5); scene.add(b); m.blob = b; }
      const rg = ring(t === 0 ? '#ffffff' : teams[1].c1, 0.5, 0.05); rg.material.opacity = t === 0 ? 0.35 : 0.0; scene.add(rg);
      const st = card.stats;
      P.push({
        card, t, i, m, rg, pos: V(), vel: V(), face: t === 0 ? Math.PI / 2 : -Math.PI / 2, goal: V(), smooth: V(),
        maxSp: 5.4 + st.spd / 99 * 3.2, acc: 14 + st.spd / 10, react: 0.7 - st.def / 99 * 0.34,
        reach: 2.08 * card.look.h, hop: 0.22 + st.jmp / 99 * 0.6,
        mode: 'run', jumpT: 0, jumpY: 0, layT: 0, downT: 0, role: 'cut', cutT: R() * 3, cutTarget: null, mark: null,
        stats: { g: 0, a: 0, d: 0, c: 0, th: 0, cmp: 0, to: 0 },
      });
    });
  }
  const side = (t) => P.filter((p) => p.t === t);
  const dir = (t) => (t === 0 ? 1 : -1); // attack direction along x

  // ---------- disc ----------
  const disc = { m: makeDisc(), state: 'held', holder: null, pos: V(), path: null, t: 0, tried: new Set(), lastThrower: null, intended: null, vel: V() };
  scene.add(disc.m);
  const discShadow = blobShadow(0.25); discShadow.material.opacity = 0.7; scene.add(discShadow);
  const target = ring('#ffd84a', 0.7, 0.08); target.visible = false; scene.add(target);
  // trail
  const TRAIL = 14, trailPos = new Float32Array(TRAIL * 3);
  const trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45 })); scene.add(trail);
  trail.frustumCulled = false;

  // ---------- state ----------
  const G = {
    score: [0, 0], off: 0, phase: 'setup', phaseT: 0, stall: 0, stallT: 0, holdT: 0, think: 1,
    ctrl: null, huck: false, paused: false, over: false, lastPuller: 0, msgT: 0, assistBy: null, throwPose: null, camX: 0, camZ: 0,
    ev: { drop: 0, block: 0, int: 0, inc: 0, oob: 0, stall: 0 }, keys: {}, joy: { x: 0, z: 0, on: false }, pDown: null, slow: 0,
  };
  const human = (p) => p && p.t === 0;

  function banner(txt, cls = '', ms = 1600) {
    const b = $('banner'); b.textContent = txt; b.className = 'banner show ' + cls;
    clearTimeout(banner.tm); banner.tm = setTimeout(() => (b.className = 'banner'), ms);
  }
  function tip(txt) { $('tip').textContent = txt || ''; }

  // ---------- point setup ----------
  function setupPoint(receiving) {
    G.off = receiving; G.stall = 0; G.phase = 'lineup'; G.phaseT = 0;
    disc.state = 'held'; disc.tried.clear(); disc.intended = null; disc.lastThrower = null; G.assistBy = null;
    const puller = 1 - receiving;
    for (const p of P) {
      const ts = side(p.t), k = ts.indexOf(p), spread = (k - (n - 1) / 2) * Math.min(3.2, (W - 4) / Math.max(1, n - 1));
      // each team lines up on the goal line it defends
      const gx = p.t === 0 ? -half : half;
      p.pos.set(gx + (p.t === 0 ? -0.5 : 0.5), 0, spread);
      p.vel.set(0, 0, 0); p.face = p.t === 0 ? Math.PI / 2 : -Math.PI / 2; p.mode = 'run'; p.layT = p.downT = p.jumpT = 0;
      p.goal.copy(p.pos); p.smooth.copy(p.pos); p.role = 'cut'; p.cutT = 1 + R() * 2;
    }
    const pull = side(puller); const pp = pull[Math.floor(pull.length / 2)];
    disc.holder = pp; G.puller = pp;
    banner(receiving === 0 ? 'RECEIVING' : 'PULLING', 'small', 1100);
    assignMarks();
    pickCtrl();
  }

  function assignMarks() {
    // defenders mark offense players by index (closest matching by sorted z)
    const off = side(G.off), def = side(1 - G.off);
    const used = new Set();
    for (const d of def) {
      let best = null, bd = 1e9;
      for (const o of off) { if (used.has(o)) continue; const dd = d.pos.distanceTo(o.pos); if (dd < bd) { bd = dd; best = o; } }
      d.mark = best; used.add(best);
    }
  }

  function pickCtrl() {
    if (G.off === 0) {
      if (disc.state === 'held' && human(disc.holder)) G.ctrl = disc.holder;
      else if (disc.state === 'air' && disc.intended && human(disc.intended)) G.ctrl = disc.intended;
      else if (!G.ctrl || G.ctrl.t !== 0) G.ctrl = closestTo(side(0), disc.pos);
    } else {
      G.ctrl = closestTo(side(0), disc.state === 'air' && disc.path ? disc.path.to : disc.pos);
    }
  }
  function closestTo(list, pt) { let b = null, bd = 1e9; for (const p of list) { const d = p.pos.distanceTo(pt); if (d < bd) { bd = d; b = p; } } return b; }

  // ---------- throwing ----------
  function throwRange(p, huck) { return (huck ? 26 : 16) + p.card.stats.thr / 99 * (huck ? 34 : 18); }
  function planThrow(p, tgt, huck, leadTo) {
    const from = V(p.pos.x, 1.25, p.pos.z);
    let to = tgt.clone(); to.y = 1.15;
    const dist0 = Math.hypot(to.x - from.x, to.z - from.z);
    const maxR = throwRange(p, huck);
    if (dist0 > maxR) { const k = maxR / dist0; to.x = from.x + (to.x - from.x) * k; to.z = from.z + (to.z - from.z) * k; }
    const dist = Math.hypot(to.x - from.x, to.z - from.z);
    const thr = p.card.stats.thr / 99;
    // accuracy: worse for long throws, low THROW, and a close mark
    const mk = side(1 - p.t).some((d) => d.pos.distanceTo(p.pos) < 2.2) ? 1.25 : 1;
    const err = (0.18 + dist * (0.048 - thr * 0.034)) * mk * (huck ? 1.25 : 1);
    to.x += gauss() * err; to.z += gauss() * err * 1.1;
    const speed = huck ? 10 + dist * 0.16 + thr * 2 : 12.5 + thr * 7 + Math.min(4, dist * 0.12);
    const dur = Math.max(0.35, dist / speed);
    const apex = huck ? 2.6 + dist * 0.11 : 0.35 + dist * 0.035;
    // curve: forehand/backhand bends opposite ways
    const fore = R() < 0.5;
    const bend = (huck ? 0.06 : 0.035) * dist * (fore ? 1 : -1);
    return { from, to, dur, apex, bend, huck, fore, dist, lead: leadTo || null };
  }
  function pathAt(path, u) {
    const { from, to, apex, bend } = path;
    const dx = to.x - from.x, dz = to.z - from.z, L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L, nz = dx / L;
    if (u <= 1) {
      const s = Math.sin(Math.PI * u);
      return V(from.x + dx * u + nx * bend * s, from.y + (to.y - from.y) * u + apex * 4 * u * (1 - u), from.z + dz * u + nz * bend * s);
    }
    // past the target: glide + fall
    const e = (u - 1) * path.dur, sp = path.dist / path.dur;
    const fall = path.huck ? 2.2 : 1.2;
    const glide = Math.min(e, 1.2) * sp * 0.55;
    return V(to.x + dx / L * glide, to.y - fall * e - 1.8 * e * e, to.z + dz / L * glide);
  }
  function doThrow(p, path, recv) {
    G.throwPose = { p, t: 0, path, recv };
    p.mode = 'throw';
    target.visible = human(p);
    target.position.set(path.to.x, 0.03, path.to.z);
    G.stall = 0; G.stallT = 0;
  }
  function releaseDisc(tp) {
    const { p, path, recv } = tp;
    disc.state = 'air'; disc.path = path; disc.t = 0; disc.holder = null; disc.tried.clear(); disc.id = (disc.id || 0) + 1;
    disc.tried.add(p); disc.lastThrower = p; disc.intended = recv || null;
    p.stats.th++;
    for (let i = 0; i < TRAIL; i++) { trailPos[i * 3] = path.from.x; trailPos[i * 3 + 1] = path.from.y; trailPos[i * 3 + 2] = path.from.z; }
    G.phase = 'air';
    pickCtrl();
  }
  function predictPos(r, t) {
    // where will this player be in t seconds? (heads to its goal, stops there)
    if (r === G.ctrl && (G.joy.on || anyKey())) return r.pos.clone().addScaledVector(r.vel, t);
    const to = V(r.goal.x - r.pos.x, 0, r.goal.z - r.pos.z), d = to.length();
    const sp = Math.max(r.vel.length(), Math.min(r.maxSp, d * 2.2));
    const go = Math.min(d, sp * t);
    return d > 0.01 ? r.pos.clone().addScaledVector(to, go / d) : r.pos.clone();
  }
  function leadPass(p, r, huck) {
    let tgt = r.pos.clone();
    for (let i = 0; i < 3; i++) {
      const dist = Math.hypot(tgt.x - p.pos.x, tgt.z - p.pos.z);
      const thr = p.card.stats.thr / 99;
      const speed = huck ? 10 + dist * 0.16 + thr * 2 : 12.5 + thr * 7 + Math.min(4, dist * 0.12);
      tgt = predictPos(r, Math.max(0.35, dist / speed) + 0.24);
    }
    tgt.x = clamp(tgt.x, -tot + 1.5, tot - 1.5); tgt.z = clamp(tgt.z, -W / 2 + 2.2, W / 2 - 2.2);
    return planThrow(p, tgt, huck, r);
  }

  // ---------- catching ----------
  function tryCatches(dt) {
    const dp = disc.pos;
    if (dp.y > 4.2) return;
    const cands = [];
    for (const p of P) {
      if (disc.tried.has(p) || p.downT > 0.25 && p.mode === 'down') continue;
      const hd = Math.hypot(p.pos.x - dp.x, p.pos.z - dp.z);
      const lay = p.mode === 'layout';
      const offT = disc.lastThrower ? disc.lastThrower.t : G.off;
      const rad = (lay ? 1.6 : p.jumpT > 0 ? 1.1 : 1.0) * (p.t === offT ? 1.12 : 0.85);
      const top = p.reach + p.jumpY + (lay ? -1.1 : 0), low = lay ? 0.02 : 0.25;
      if (hd < rad && dp.y < top && dp.y > low) cands.push({ p, hd });
    }
    if (!cands.length) return;
    cands.sort((a, b) => a.hd - b.hd);
    const off = disc.lastThrower ? disc.lastThrower.t : G.off;
    for (const { p } of cands) {
      disc.tried.add(p);
      const lay = p.mode === 'layout', jumping = p.jumpT > 0;
      if (p.t === off) {
        const near = side(1 - off).filter((d) => d.pos.distanceTo(p.pos) < 1.4);
        const press = near.reduce((s, d) => s + 0.06 + d.card.stats.def / 99 * 0.1, 0);
        const ch = 0.93 + p.card.stats.cat / 99 * 0.06 - press * 0.45 - (lay ? 0.1 : 0) - (disc.path.huck ? 0.03 : 0);
        if (R() < ch) return caught(p);
        G.ev.drop++; banner('DROP', 'red small', 900); return;
      } else {
        const nearThrow = !disc.knocked && Math.hypot(dp.x - disc.path.from.x, dp.z - disc.path.from.z) < 3.2;
        const ch = nearThrow ? 0.02 + p.card.stats.def / 99 * 0.05 : 0.1 + p.card.stats.def / 99 * 0.26 + (lay ? 0.16 : 0) + (jumping ? 0.06 : 0) + (disc.path.huck ? 0.05 : 0);
        if (R() < ch) {
          p.stats.d++;
          if (R() < 0.2 + p.card.stats.cat / 99 * 0.2) { G.ev.int++; banner('INTERCEPTED', 'red', 1300); return caught(p, true); }
          G.ev.block++; banner('BLOCKED', 'red', 1200);
          disc.path = { ...disc.path, from: dp.clone(), to: V(dp.x + (R() - 0.5) * 2, Math.max(0.3, dp.y - 1), dp.z + (R() - 0.5) * 2), dur: 0.35, apex: 0.2, bend: 0, huck: false, dist: 1.5 };
          disc.t = 0; disc.knocked = true;
          return;
        }
      }
    }
  }
  function inBounds(x, z) { return Math.abs(x) <= tot && Math.abs(z) <= W / 2; }
  function caught(p, intercept = false) {
    disc.state = 'held'; disc.holder = p; target.visible = false; disc.knocked = false;
    if (!inBounds(p.pos.x, p.pos.z)) { // out of bounds catch = turnover
      banner('OUT OF BOUNDS', 'red', 1300);
      return turnover(clamp(p.pos.x, -tot, tot), clamp(p.pos.z, -W / 2, W / 2), 1 - p.t);
    }
    const thrower = disc.lastThrower;
    if (p.t !== G.off || intercept) { // change of possession
      if (thrower) thrower.stats.to++;
      G.off = p.t; assignMarks(); G.assistBy = null;
    } else {
      p.stats.c++; if (thrower) thrower.stats.cmp++;
      G.assistBy = thrower;
    }
    // goal?
    const inEZ = dir(p.t) > 0 ? p.pos.x > half : p.pos.x < -half;
    if (inEZ && !intercept && p.t === G.off && thrower && thrower.t === p.t) return goal(p);
    // walk to goal line if caught/intercepted in own defending end zone
    const ownEZ = dir(p.t) > 0 ? p.pos.x < -half : p.pos.x > half;
    if (ownEZ) p.walkTo = V(dir(p.t) > 0 ? -half : half, 0, p.pos.z);
    if (inEZ && p.t === G.off && intercept) p.walkTo = null;
    G.phase = 'hold'; G.stall = 0; G.stallT = 0; G.holdT = 0; G.think = 0.7 + R() * 1.4;
    pickCtrl();
  }
  function turnover(x, z, newOff) {
    disc.state = 'ground'; disc.holder = null; target.visible = false;
    // can't start inside the end zone you defend
    if (dir(newOff) > 0 && x < -half) x = -half; if (dir(newOff) < 0 && x > half) x = half;
    disc.pos.set(x, 0.04, z);
    if (disc.lastThrower && disc.lastThrower.t !== newOff) disc.lastThrower.stats.to++;
    G.off = newOff; G.phase = 'pickup'; G.phaseT = 0; assignMarks();
    G.picker = closestTo(side(newOff), disc.pos);
    if (newOff === 0) banner('TURNOVER - YOUR DISC', 'small', 1300); else banner('TURNOVER', 'red', 1300);
    pickCtrl();
  }
  function goal(p) {
    G.score[p.t]++; p.stats.g++;
    if (G.assistBy && G.assistBy !== p) G.assistBy.stats.a++;
    $('s' + p.t).textContent = G.score[p.t];
    G.phase = 'goal'; G.phaseT = 0; G.scorer = p.t;
    banner(p.t === 0 ? 'GOAL' : teams[1].abbr + ' SCORES', p.t === 0 ? 'gold big' : 'red big', 2200);
    tip(shortName(p.card) + (G.assistBy && G.assistBy !== p ? '  from  ' + shortName(G.assistBy.card) : ''));
    setTimeout(() => tip(''), 2400);
    target.visible = false;
  }

  // ---------- AI ----------
  function offenseAI(p, dt) {
    const d = dir(p.t), h = disc.holder || null;
    const hx = h ? h.pos.x : disc.pos.x, hz = h ? h.pos.z : disc.pos.z;
    const offs = side(p.t).filter((q) => q !== h);
    const k = offs.indexOf(p);
    const nearGoal = d > 0 ? hx > half - 14 : hx < -half + 14;
    p.cutT -= dt;
    const handlers = n >= 5 ? 2 : 1;
    if (k < handlers) { // reset handler(s)
      const zSide = k === 0 ? (hz > 0 ? -1 : 1) : (hz > 0 ? 1 : -1) * 0.2;
      p.goal.set(hx - d * (k === 0 ? 4.5 : 1.5), 0, hz + zSide * (k === 0 ? 5.5 : 9));
      if (p.cutT < 0 && R() < 0.02) { p.goal.set(hx + d * 8, 0, hz + zSide * 6); p.cutT = 2.5; }
    } else {
      const ci = k - handlers, nc = Math.max(1, offs.length - handlers);
      if (nearGoal) { // spread in the end zone
        const ezX = d > 0 ? half + EZ * 0.45 : -half - EZ * 0.45;
        const zz = (ci - (nc - 1) / 2) * (W / (nc + 1));
        p.goal.set(ezX + (ci % 2 ? 2 : -2) * d, 0, zz);
        if (p.cutT < 0) { p.cutTarget = V(d > 0 ? half + 1.5 + R() * (EZ - 3) : -half - 1.5 - R() * (EZ - 3), 0, (R() - 0.5) * (W - 4)); p.cutT = 1.8 + R() * 2; }
        if (p.cutT > 0.4 && p.cutTarget) p.goal.copy(p.cutTarget);
      } else {
        const stackX = hx + d * (8 + ci * 3.2), stackZ = clamp(hz * 0.3, -W / 4, W / 4);
        p.goal.set(stackX, 0, stackZ);
        const cutting = offs.filter((q) => q.role === 'cutting').length;
        if (p.role !== 'cutting' && p.cutT < 0 && cutting < Math.max(1, Math.floor(nc / 2)) && R() < dt * 1.5) {
          p.role = 'cutting'; p.cutT = 1.6 + R() * 1.5;
          const deep = R() < 0.3;
          const zz = (R() < 0.5 ? -1 : 1) * (W / 2 - 4 - R() * 4);
          p.cutTarget = deep ? V(hx + d * (20 + R() * 16), 0, zz * 0.6) : V(hx + d * (5 + R() * 8), 0, zz);
        }
        if (p.role === 'cutting') { p.goal.copy(p.cutTarget); if (p.cutT < 0) { p.role = 'cut'; p.cutT = 1 + R() * 2.5; } }
      }
    }
    p.goal.x = clamp(p.goal.x, -tot + 0.8, tot - 0.8); p.goal.z = clamp(p.goal.z, -W / 2 + 0.8, W / 2 - 0.8);
  }
  function defenseAI(p, dt) {
    const o = p.mark; if (!o) return;
    const d = dir(o.t);
    if (disc.state === 'held' && disc.holder === o) { // the marker
      const forceZ = o.pos.z > 0 ? 0.9 : -0.9;
      p.goal.set(o.pos.x + d * 1.5, 0, o.pos.z - forceZ * 0.4);
      return;
    }
    // smooth (reaction delay) on the attacker's position
    const tau = p.react / (teams[p.t].ai || 1);
    p.smooth.lerp(o.pos, clamp(dt / Math.max(0.05, tau), 0, 1));
    const h = disc.holder ? disc.holder.pos : disc.pos;
    const toDisc = V(h.x - p.smooth.x, 0, h.z - p.smooth.z).normalize();
    p.goal.set(p.smooth.x + d * 1.1 + toDisc.x * 0.35, 0, p.smooth.z + toDisc.z * 0.45);
  }
  function chaseDisc(p) {
    // earliest point on the flight this player can actually reach in time (intercept), else where it comes down
    const path = disc.path, top = p.reach + p.hop * 0.7;
    let best = null, bu = 1, ok = false;
    for (let u = Math.max(disc.t, 0.05); u < 2.2; u += 0.03) {
      const q = pathAt(path, u); if (q.y < 0.15) { if (!best) { best = q; bu = u; } break; }
      if (q.y > top) continue;
      const tl = (u - disc.t) * path.dur;
      const d = Math.hypot(q.x - p.pos.x, q.z - p.pos.z) - 0.25;
      if (d / p.maxSp <= tl + 0.05) { best = q; bu = u; ok = true; break; }
      best = q; bu = u; // keep latest as fallback
    }
    if (!best) { best = disc.pos.clone(); bu = disc.t; }
    p.goal.set(best.x, 0, best.z);
    return { pt: best, timeLeft: (bu - disc.t) * path.dur, ok };
  }
  function cpuThink(dt) {
    const h = disc.holder; if (!h || (h.t === 0 && !opt.autoplay) || G.throwPose) return;
    G.think -= dt; if (G.think > 0) return;
    G.think = 0.22;
    const opts = [];
    for (const r of side(h.t)) {
      if (r === h || r.mode === 'down') continue;
      const huck = Math.abs(r.pos.x - h.pos.x) > 24;
      const path = leadPass(h, r, huck);
      const lt = path.to;
      if (Math.hypot(lt.x - h.pos.x, lt.z - h.pos.z) > throwRange(h, huck) * 0.9) continue;
      const need = Math.hypot(r.pos.x - lt.x, r.pos.z - lt.z) / (path.dur + 0.22);
      if (need > r.maxSp * 0.92) continue;
      let open = 99;
      for (const dd of side(1 - h.t)) {
        const dist = Math.hypot(dd.pos.x - lt.x, dd.pos.z - lt.z) - dd.maxSp * path.dur * 0.55;
        open = Math.min(open, dist);
        // lane check: defender near the throw line
        const ax = lt.x - h.pos.x, az = lt.z - h.pos.z, L2 = ax * ax + az * az || 1;
        const tt = clamp(((dd.pos.x - h.pos.x) * ax + (dd.pos.z - h.pos.z) * az) / L2, 0.15, 0.9);
        const lx = h.pos.x + ax * tt - dd.pos.x, lz = h.pos.z + az * tt - dd.pos.z;
        if (!path.huck) open = Math.min(open, Math.hypot(lx, lz) * 1.4);
      }
      const gain = (lt.x - h.pos.x) * dir(h.t);
      const inEZ = dir(h.t) > 0 ? lt.x > half + 0.5 : lt.x < -half - 0.5;
      const oob = Math.abs(lt.z) > W / 2 - 2 || Math.abs(lt.x) > tot - 1.5;
      if (oob) continue;
      const score = open * 1.4 + gain * 0.12 + (inEZ ? 4 : 0) + (gain < 0 ? -1 : 0);
      opts.push({ r, path, open, score });
    }
    if (!opts.length) return;
    opts.sort((a, b) => b.score - a.score);
    const best = opts[0], need = 3.0 - G.stall * 0.22;
    const ai = teams[h.t].ai || 1;
    if (best.open > need || G.stall >= 8) {
      const choice = R() < 0.1 / ai && opts[1] ? opts[1] : best;
      doThrow(h, choice.path, choice.r);
    }
  }

  // ---------- input ----------
  const keyMap = (e, v) => {
    G.keys[e.code] = v;
    if (v && (e.code === 'Space')) { e.preventDefault(); bid(G.ctrl); }
    if (v && (e.code === 'KeyQ' || e.code === 'KeyE' || e.code === 'Tab')) { e.preventDefault(); switchCtrl(); }
    if (v && e.code === 'KeyH') toggleHuck();
    if (v && (e.code === 'Escape' || e.code === 'KeyP')) togglePause();
  };
  const kd = (e) => keyMap(e, true), ku = (e) => keyMap(e, false);
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(V(0, 1, 0), 0);
  function groundAt(cx, cy) {
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera({ x: ((cx - r.left) / r.width) * 2 - 1, y: -((cy - r.top) / r.height) * 2 + 1 }, cam);
    const out = V(); return ray.ray.intersectPlane(plane, out) ? out : null;
  }
  const cv = renderer.domElement;
  cv.addEventListener('pointerdown', (e) => { G.pDown = { x: e.clientX, y: e.clientY, t: performance.now(), shift: e.shiftKey }; });
  cv.addEventListener('pointerup', (e) => {
    const pd = G.pDown; G.pDown = null; if (!pd || G.paused) return;
    const h = disc.holder;
    if (!(disc.state === 'held' && human(h) && G.phase === 'hold' && !G.throwPose)) return;
    const pt = groundAt(e.clientX, e.clientY); if (!pt) return;
    const huck = G.huck || pd.shift || e.shiftKey || performance.now() - pd.t > 380;
    // snap to a teammate if the tap is near one (screen space)
    let best = null, bd = 1e9;
    for (const r of side(0)) {
      if (r === h) continue;
      const sp = r.pos.clone().setY(1).project(cam), rc = cv.getBoundingClientRect();
      const sx = (sp.x + 1) / 2 * rc.width + rc.left, sy = (1 - sp.y) / 2 * rc.height + rc.top;
      const dd = Math.hypot(sx - e.clientX, sy - e.clientY);
      if (dd < bd) { bd = dd; best = r; }
    }
    const snapPx = Math.max(46, cv.getBoundingClientRect().width * 0.045);
    const path = best && bd < snapPx ? leadPass(h, best, huck) : planThrow(h, pt, huck, null);
    doThrow(h, path, best && bd < snapPx ? best : closestTo(side(0).filter((q) => q !== h), pt));
  });
  // joystick
  const joy = $('joy'), knob = $('knob');
  let joyId = null, joyC = null;
  joy.addEventListener('pointerdown', (e) => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); const r = joy.getBoundingClientRect(); joyC = { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; moveJoy(e); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) moveJoy(e); });
  const endJoy = (e) => { if (e.pointerId !== joyId) return; joyId = null; G.joy = { x: 0, z: 0, on: false }; knob.style.transform = ''; };
  joy.addEventListener('pointerup', endJoy); joy.addEventListener('pointercancel', endJoy);
  function moveJoy(e) {
    let dx = e.clientX - joyC.x, dy = e.clientY - joyC.y; const L = Math.hypot(dx, dy), mx = joyC.r * 0.8;
    if (L > mx) { dx *= mx / L; dy *= mx / L; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    const mag = Math.min(1, L / mx);
    G.joy = { x: (dx / (L || 1)) * mag, z: (-dy / (L || 1)) * mag, on: mag > 0.15 };
  }
  const tapBtn = (id, fn) => { const b = $(id); b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }); };
  tapBtn('bBid', () => bid(G.ctrl)); tapBtn('bSwitch', switchCtrl); tapBtn('bHuck', toggleHuck); tapBtn('pause', togglePause);
  $('pResume').onclick = togglePause; $('pQuit').onclick = () => end(true); $('pHelp').onclick = () => $('help').classList.toggle('show');
  function toggleHuck() { G.huck = !G.huck; $('bHuck').classList.toggle('on', G.huck); }
  function togglePause() { if (G.over) return; G.paused = !G.paused; $('pmenu').classList.toggle('show', G.paused); }
  function switchCtrl() {
    if (G.off === 0 && disc.state === 'held') return;
    const list = side(0).filter((p) => p !== G.ctrl);
    const pt = disc.state === 'air' ? disc.path.to : disc.pos;
    G.ctrl = closestTo(list, pt) || G.ctrl;
  }
  function bid(p) {
    if (!p || p.jumpT > 0 || p.mode === 'layout' || p.downT > 0 || p === disc.holder) return;
    if (disc.state === 'air') {
      const dp = disc.pos, hd = Math.hypot(dp.x - p.pos.x, dp.z - p.pos.z);
      // future disc position ~0.3s ahead
      const fut = pathAt(disc.path, disc.t + 0.3 / disc.path.dur);
      const fd = Math.hypot(fut.x - p.pos.x, fut.z - p.pos.z);
      if (Math.min(hd, fd) > 1.05 && Math.min(hd, fd) < 4.5 && dp.y < 2.6) {
        p.mode = 'layout'; p.layT = 0.55;
        const tx = fut.x - p.pos.x, tz = fut.z - p.pos.z, L = Math.hypot(tx, tz) || 1;
        p.vel.set(tx / L * (p.maxSp + 2.2), 0, tz / L * (p.maxSp + 2.2)); p.face = Math.atan2(tx, tz);
        return;
      }
    }
    p.jumpT = 0.6; p.mode = 'jump';
  }

  // ---------- update ----------
  const tmp = V();
  function movePlayer(p, dt) {
    if (p.downT > 0) { p.downT -= dt; p.vel.multiplyScalar(Math.max(0, 1 - dt * 6)); p.pos.addScaledVector(p.vel, dt); if (p.downT <= 0) p.mode = 'run'; return; }
    if (p.mode === 'layout') {
      p.layT -= dt; p.pos.addScaledVector(p.vel, dt); p.vel.multiplyScalar(1 - dt * 1.5);
      if (p.layT <= 0) { p.mode = 'down'; p.downT = 0.75; }
      return;
    }
    if (p.jumpT > 0) { p.jumpT -= dt; const u = 1 - p.jumpT / 0.6; p.jumpY = Math.sin(Math.PI * clamp(u, 0, 1)) * p.hop; if (p.jumpT <= 0) { p.jumpY = 0; p.mode = 'run'; } }
    let want = V();
    const isCtrl = p === G.ctrl && G.phase !== 'goal';
    let manual = false;
    if (isCtrl) {
      const k = G.keys; let x = 0, z = 0;
      if (k.KeyA || k.ArrowLeft) x -= 1; if (k.KeyD || k.ArrowRight) x += 1; if (k.KeyW || k.ArrowUp) z += 1; if (k.KeyS || k.ArrowDown) z -= 1;
      if (G.joy.on) { x = G.joy.x; z = G.joy.z; }
      if (G.portrait) { const t = x; x = z; z = t; }
      if (x || z) { manual = true; const L = Math.hypot(x, z); want.set(x / Math.max(1, L), 0, z / Math.max(1, L)).multiplyScalar(p.maxSp); }
    }
    if (p === disc.holder) {
      want.set(0, 0, 0);
      if (p.walkTo) { tmp.subVectors(p.walkTo, p.pos); tmp.y = 0; if (tmp.length() < 0.2) p.walkTo = null; else want.copy(tmp.normalize().multiplyScalar(3)); }
    } else if (!manual) {
      tmp.subVectors(p.goal, p.pos); tmp.y = 0; const d = tmp.length();
      const chasing = disc.state === 'air' && (p === disc.intended || p.t !== (disc.lastThrower ? disc.lastThrower.t : -1));
      const sp = d < 0.4 ? 0 : Math.min(p.maxSp * (chasing ? 1.08 : 1), d * 2.2) * (p.role === 'cutting' || G.phase === 'air' || G.phase === 'pickup' || G.phase === 'pull' ? 1 : 0.82);
      if (d > 0.01) want.copy(tmp.multiplyScalar(sp / d));
    }
    // accelerate
    tmp.subVectors(want, p.vel); const dl = tmp.length(), mx = p.acc * dt;
    if (dl > mx) tmp.multiplyScalar(mx / dl);
    p.vel.add(tmp);
    p.pos.addScaledVector(p.vel, dt);
    p.pos.x = clamp(p.pos.x, -tot - 4, tot + 4); p.pos.z = clamp(p.pos.z, -W / 2 - 3, W / 2 + 3);
    const s = p.vel.length();
    if (s > 0.4) p.face = Math.atan2(p.vel.x, p.vel.z);
    else if (disc.state !== 'ground') { const f = disc.holder && disc.holder !== p ? disc.holder.pos : disc.pos; p.face += angDiff(p.face, Math.atan2(f.x - p.pos.x, f.z - p.pos.z)) * Math.min(1, dt * 5); }
  }
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

  function separate() {
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const a = P[i], b = P[j]; const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.75 && d > 0.001) { const push = (0.75 - d) / 2; const nx = dx / d, nz = dz / d; if (a !== disc.holder) { a.pos.x -= nx * push; a.pos.z -= nz * push; } if (b !== disc.holder) { b.pos.x += nx * push; b.pos.z += nz * push; } }
    }
  }

  function step(dt) {
    G.phaseT += dt;
    if (G.phase === 'lineup') {
      if (G.phaseT > 1.4) { // pull
        const pp = G.puller, rx = -dir(pp.t) * (half - 4 - R() * 10) + 0, rz = (R() - 0.5) * (W - 8);
        const path = { from: V(pp.pos.x, 1.3, pp.pos.z), to: V(rx * 1 + (pp.t === 0 ? 0 : 0), 1.2, rz), dur: 2.6 + R() * 0.6, apex: 9 + R() * 3, bend: (R() - 0.5) * 6, huck: true, dist: 40 };
        path.to.x = dir(pp.t) * (half - 6 - R() * 10); // into receiving half
        path.dist = Math.abs(path.to.x - path.from.x);
        disc.state = 'air'; disc.path = path; disc.t = 0; disc.holder = null; disc.tried.clear(); disc.lastThrower = null; disc.intended = null;
        for (const p of side(pp.t)) disc.tried.add(p);
        G.phase = 'pull'; pp.mode = 'throw';
        G.pullCatcher = closestTo(side(G.off), V(path.to.x, 0, path.to.z));
      }
    }
    // disc flight
    if (disc.state === 'air') {
      disc.t += dt / disc.path.dur;
      const q = pathAt(disc.path, disc.t);
      disc.pos.copy(q);
      if (G.phase === 'pull') {
        if (G.pullCatcher) { G.pullCatcher.goal.set(disc.path.to.x, 0, disc.path.to.z); }
        if (disc.t >= 1) { const c = G.pullCatcher; disc.pos.set(disc.path.to.x, 1.2, disc.path.to.z); if (c && c.pos.distanceTo(V(disc.pos.x, 0, disc.pos.z)) < 3) { c.pos.set(disc.pos.x, 0, disc.pos.z); disc.lastThrower = null; G.off = c.t; caught(c); } else { disc.lastThrower = null; turnoverPull(); } }
      } else {
        tryCatches(dt);
        if (disc.state === 'air' && disc.pos.y <= 0.05) {
          const thrower = disc.lastThrower; if (!disc.knocked) G.ev[inBounds(disc.pos.x, disc.pos.z) ? 'inc' : 'oob']++; if (!disc.knocked) banner(inBounds(disc.pos.x, disc.pos.z) ? 'INCOMPLETE' : 'OUT OF BOUNDS', 'red small', 1100);
          turnover(clamp(disc.pos.x, -tot, tot), clamp(disc.pos.z, -W / 2, W / 2), 1 - (thrower ? thrower.t : G.off));
        }
      }
    }
    // throw animation -> release
    if (G.throwPose) {
      const tp = G.throwPose; tp.t += dt / 0.36;
      if (tp.t >= 0.62 && !tp.released) { tp.released = true; releaseDisc(tp); }
      if (tp.t >= 1) { tp.p.mode = 'run'; G.throwPose = null; }
    }
    // stall count
    if (disc.state === 'held' && G.phase === 'hold') {
      G.holdT += dt;
      const h = disc.holder, mk = side(1 - h.t).find((d) => d.mark === h);
      if (mk && mk.pos.distanceTo(h.pos) < 3.2 && !h.walkTo && !G.throwPose) {
        G.stallT += dt;
        if (G.stallT >= 0.95) { G.stallT = 0; G.stall++; if (G.stall >= 10) { G.ev.stall++; banner('STALL 10', 'red', 1300); disc.lastThrower = h; turnover(h.pos.x, h.pos.z, 1 - h.t); } }
      }
      cpuThink(dt);
    }
    // pickup after turnover
    if (G.phase === 'pickup') {
      const pk = G.picker; if (pk) { pk.goal.set(disc.pos.x, 0, disc.pos.z); }
      if (pk && (Math.hypot(pk.pos.x - disc.pos.x, pk.pos.z - disc.pos.z) < 0.7 || G.phaseT > 4)) {
        pk.pos.set(disc.pos.x, 0, disc.pos.z); disc.lastThrower = null; G.assistBy = null;
        disc.state = 'held'; disc.holder = pk; G.phase = 'hold'; G.stall = 0; G.stallT = 0; G.holdT = 0; G.think = 0.9 + R(); pickCtrl();
      }
    }
    // goal celebration -> next point
    if (G.phase === 'goal') {
      if (G.phaseT > 2.6) {
        if (G.score[0] >= to || G.score[1] >= to) return end(false);
        setupPoint(1 - G.scorer);
      }
    }
    // AI goals
    for (const p of P) {
      if (G.phase === 'goal') { p.goal.copy(p.pos); continue; }
      if (G.phase === 'lineup') { p.goal.copy(p.pos); continue; }
      if (G.phase === 'pull') {
        if (p === G.pullCatcher) continue;
        if (p.t === G.off) { const k = side(p.t).indexOf(p); p.goal.set(disc.path.to.x - dir(p.t) * 3 + dir(p.t) * k * 2, 0, (k - (n - 1) / 2) * 4); }
        else { const o = p.mark || closestTo(side(G.off), p.pos); p.goal.set(o.pos.x + dir(G.off) * 4, 0, o.pos.z); }
        continue;
      }
      if (G.phase === 'pickup') {
        if (p === G.picker) continue;
        if (p.t === G.off) offenseAI(p, 0); else defenseAI(p, dt);
        continue;
      }
      if (disc.state === 'air') {
        if (p === disc.intended) { chaseDisc(p); continue; }
        if (p.t !== (disc.lastThrower ? disc.lastThrower.t : G.off)) {
          // defenders: go for it if they can get there in time
          const c = chaseDisc(p), dist = p.pos.distanceTo(V(c.pt.x, 0, c.pt.z));
          if (dist / p.maxSp < c.timeLeft + 0.45 * (teams[p.t].ai || 1) || p.mark === disc.intended) { /* chase */ }
          else defenseAI(p, dt);
          // AI bids
          if (p !== G.ctrl || !(G.joy.on || anyKey())) aiBid(p);
          continue;
        }
        offenseAI(p, dt); continue;
      }
      if (p.t === G.off) offenseAI(p, dt); else defenseAI(p, dt);
    }
    if (disc.state === 'air' && disc.intended && (disc.intended !== G.ctrl || !(G.joy.on || anyKey()))) aiBid(disc.intended);
    for (const p of P) movePlayer(p, dt);
    separate();
    if (disc.state === 'held' && disc.holder) {
      const h = disc.holder, a = h.face;
      const hand = h.mode === 'throw' ? 0.25 : 0.45;
      disc.pos.set(h.pos.x + Math.sin(a + 1.2) * hand, 1.0 * h.card.look.h, h.pos.z + Math.cos(a + 1.2) * hand);
    }
    // face throw target
    if (G.throwPose) { const tp = G.throwPose; tp.p.face += angDiff(tp.p.face, Math.atan2(tp.path.to.x - tp.p.pos.x, tp.path.to.z - tp.p.pos.z)) * Math.min(1, dt * 12); }
    if (G.phase === 'hold' && disc.holder && !G.throwPose) { const h = disc.holder; h.face += angDiff(h.face, dir(h.t) > 0 ? Math.PI / 2 : -Math.PI / 2) * Math.min(1, dt * 4); }
  }
  function turnoverPull() { // pull landed untouched: receiving team picks up where it lands
    const x = clamp(disc.path.to.x, -tot, tot), z = clamp(disc.path.to.z, -W / 2, W / 2);
    disc.state = 'ground'; disc.pos.set(x, 0.04, z);
    G.phase = 'pickup'; G.phaseT = 0; G.picker = closestTo(side(G.off), disc.pos); assignMarks(); pickCtrl();
  }
  const anyKey = () => ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some((k) => G.keys[k]);
  function aiBid(p) {
    if (p.jumpT > 0 || p.mode === 'layout' || p.downT > 0 || disc.tried.has(p)) return;
    const dp = disc.pos, hd = Math.hypot(dp.x - p.pos.x, dp.z - p.pos.z);
    const isOff = disc.lastThrower && p.t === disc.lastThrower.t;
    if (hd < 1.1 && dp.y > p.reach - 0.05 && dp.y < p.reach + p.hop) { p.jumpT = 0.6; p.mode = 'jump'; return; }
    // only dive when running won't get there
    const c = chaseDisc(p); if (c.ok) return;
    const fut = pathAt(disc.path, disc.t + 0.25 / disc.path.dur), fd = Math.hypot(fut.x - p.pos.x, fut.z - p.pos.z);
    const willMiss = fd > 1.1 && fd < 3.4 && fut.y < 2 && fut.y > 0.15;
    const want = isOff ? 0.6 : 0.3 * (teams[p.t].ai || 1);
    if (!willMiss || p.bidFor === disc.id) return;
    p.bidFor = disc.id;
    if (R() < want) {
      p.mode = 'layout'; p.layT = 0.55;
      const tx = fut.x - p.pos.x, tz = fut.z - p.pos.z, L = Math.hypot(tx, tz) || 1;
      p.vel.set(tx / L * (p.maxSp + 2), 0, tz / L * (p.maxSp + 2)); p.face = Math.atan2(tx, tz);
    }
  }

  // ---------- render ----------
  function updateVisuals(dt) {
    for (const p of P) {
      const r = p.m.root;
      r.position.set(p.pos.x, p.jumpY, p.pos.z);
      r.rotation.y += angDiff(r.rotation.y, p.face) * Math.min(1, dt * 14);
      let mode = 'run';
      if (p.mode === 'layout') mode = 'layout'; else if (p.mode === 'down') mode = 'down'; else if (p.jumpT > 0) mode = 'jump';
      else if (G.throwPose && G.throwPose.p === p) mode = 'throw';
      else if (G.phase === 'goal') mode = p.t === G.scorer ? 'cheer' : 'idle';
      else if (disc.state === 'held' && p.mark === disc.holder && p.pos.distanceTo(disc.holder.pos) < 3) mode = 'mark';
      else if (disc.state === 'air' && Math.hypot(disc.pos.x - p.pos.x, disc.pos.z - p.pos.z) < 2.6 && disc.pos.y < 3.5) mode = 'reach';
      else if (p.vel.length() < 0.5) mode = 'idle';
      animate(p.m, { mode, speed: p.vel.length(), t: G.throwPose ? G.throwPose.t : 0, forehand: G.throwPose ? G.throwPose.path.fore : false, reachY: disc.pos.y }, dt);
      if (p.m.blob) p.m.blob.position.set(p.pos.x, 0.02, p.pos.z);
      p.rg.position.set(p.pos.x, 0.03, p.pos.z);
      const isC = p === G.ctrl;
      p.rg.material.color.set(isC ? '#ffd84a' : p.t === 0 ? '#ffffff' : teams[1].c1);
      p.rg.material.opacity = isC ? 0.95 : p.t === 0 ? 0.28 : 0.0;
      p.rg.scale.setScalar(isC ? 1.25 : 1);
    }
    // disc
    disc.m.position.copy(disc.pos);
    disc.m.rotation.y += dt * (disc.state === 'air' ? 28 : 0);
    if (disc.state === 'air') { disc.m.rotation.z = disc.path.bend > 0 ? 0.2 : -0.2; } else disc.m.rotation.z = 0;
    discShadow.position.set(disc.pos.x, 0.025, disc.pos.z); discShadow.visible = disc.state === 'air';
    // trail
    if (disc.state === 'air') { trailPos.copyWithin(3, 0, (TRAIL - 1) * 3); trailPos[0] = disc.pos.x; trailPos[1] = disc.pos.y; trailPos[2] = disc.pos.z; trail.visible = true; trailGeo.attributes.position.needsUpdate = true; }
    else trail.visible = false;
    target.material.opacity = 0.5 + Math.sin(performance.now() / 120) * 0.3;
    // camera: sideline view following the disc
    const asp = cv.clientWidth / Math.max(1, cv.clientHeight);
    G.portrait = asp < 0.9;
    if (G.portrait) {
      // end-zone camera: your team attacks up the screen
      const fx = clamp(disc.pos.x, -tot + 4, tot - 4), fz = clamp(disc.pos.z * 0.75, -W / 2 + 5, W / 2 - 5);
      G.camX += (fx - G.camX) * Math.min(1, dt * 2.6); G.camZ += (fz - G.camZ) * Math.min(1, dt * 2.4);
      const far = W * 0.32 + 11;
      cam.position.set(G.camX - far, far * 0.95, G.camZ);
      cam.lookAt(G.camX + 5, 0, G.camZ);
    } else {
      const fx = clamp(disc.pos.x, -tot + 6, tot - 6), fz = clamp(disc.pos.z * 0.45, -W / 4, W / 4);
      G.camX += (fx - G.camX) * Math.min(1, dt * 2.6); G.camZ += (fz - G.camZ) * Math.min(1, dt * 2);
      const far = (W * 0.42 + 9) * (asp < 1.4 ? 1.15 : 1);
      cam.position.set(G.camX, far * 0.62, G.camZ - far);
      cam.lookAt(G.camX, 0, G.camZ - W * 0.08);
    }
    // hud
    const sEl = $('stall');
    if (disc.state === 'held' && G.phase === 'hold' && G.stall > 0) { sEl.textContent = 'STALL ' + G.stall; sEl.className = 'stall show' + (G.stall >= 7 ? ' hot' : ''); }
    else sEl.className = 'stall';
    const onO = G.off === 0;
    $('bHuck').style.display = onO ? '' : 'none';
    $('bSwitch').style.display = onO && disc.state === 'held' ? 'none' : '';
    if (!G.tipDone && G.phase === 'hold' && human(disc.holder) && !G.throwPose) { tip('Tap a teammate to throw. Hold the tap for a deep huck.'); G.tipOn = true; }
    if (G.tipOn && G.phase !== 'hold') { tip(''); G.tipOn = false; G.tipDone = true; }
  }

  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    renderer.setSize(w, h, false); cam.aspect = w / Math.max(1, h);
    cam.fov = w / h < 0.9 ? 62 : 42; cam.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  let last = performance.now(), raf = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (G.paused || G.over) { renderer.render(scene, cam); return; }
    const sub = 2; for (let i = 0; i < sub && !G.over; i++) step(dt / sub);
    updateVisuals(dt);
    renderer.render(scene, cam);
  }

  function end(quit) {
    if (G.over) return; G.over = true;
    cancelAnimationFrame(raf);
    removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('resize', resize);
    const stats = P.map((p) => ({ id: p.card.id, t: p.t, name: shortName(p.card), ...p.stats }));
    renderer.dispose();
    opt.onEnd && opt.onEnd({ quit, score: G.score.slice(), stats });
  }

  resize();
  setupPoint(0);
  G.camX = -half;
  raf = requestAnimationFrame(frame);
  // test hooks
  const api = { G, P, disc, end, step, throwTo: (i, huck) => { const h = disc.holder; const r = side(0)[i]; if (h && r && r !== h) doThrow(h, leadPass(h, r, huck), r); }, dims: D, cam, renderer };
  window.__huck = api;
  return api;
}
