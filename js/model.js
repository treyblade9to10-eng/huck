// HUCK - 3D athlete models + disc + card portraits
import * as THREE from './lib/three.min.js';
import { SKINS, HAIRC } from './data.js';

const geoCache = new Map();
function G(key, make) { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); }
const matCache = new Map();
export function M(color, rough = 0.7, extra = {}) {
  const k = color + '|' + rough + '|' + JSON.stringify(extra);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra }));
  return matCache.get(k);
}
// limb hanging from its pivot (top at origin, extends down -y)
function limbGeo(r, len) {
  return G('limb' + r + '_' + len, () => { const g = new THREE.CapsuleGeometry(r, len, 4, 10); g.translate(0, -len / 2, 0); return g; });
}
function cyl(r1, r2, h, seg = 14) {
  return G('cyl' + r1 + '_' + r2 + '_' + h, () => { const g = new THREE.CylinderGeometry(r1, r2, h, seg, 1, true); g.translate(0, -h / 2, 0); return g; });
}
function sph(r, ws = 16, hs = 12, tl = Math.PI) { return G('s' + r + '_' + tl, () => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, tl)); }

const torsoGeo = () => G('torso', () => {
  const p = [[0, 0], [0.15, 0], [0.155, 0.06], [0.148, 0.18], [0.162, 0.3], [0.188, 0.42], [0.198, 0.5], [0.175, 0.565], [0.09, 0.61], [0.05, 0.62], [0, 0.62]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(p, 28);
  g.scale(1.12, 1, 0.68);
  return g;
});
const hipsGeo = () => G('hips', () => {
  const p = [[0, -0.13], [0.11, -0.135], [0.16, -0.1], [0.165, 0.0], [0.155, 0.07], [0, 0.07]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(p, 24); g.scale(1.1, 1, 0.75); return g;
});
const shoeGeo = () => G('shoe', () => {
  const g = new THREE.CapsuleGeometry(0.05, 0.13, 4, 10); g.rotateX(Math.PI / 2); g.scale(1, 0.75, 1); g.translate(0, 0, 0.04); return g;
});

const jerseyTex = new Map();
function jersey(c1, c2, num) {
  const k = c1 + c2 + num;
  if (jerseyTex.has(k)) return jerseyTex.get(k);
  const W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  x.fillStyle = c1; x.fillRect(0, 0, W, H);
  // subtle mesh texture
  x.globalAlpha = 0.06; x.fillStyle = '#000';
  for (let i = 0; i < W; i += 6) for (let j = (i / 6) % 2 * 3; j < H; j += 6) x.fillRect(i, j, 2, 2);
  x.globalAlpha = 1;
  // side panels at u=.25 / .75 (sides)
  x.fillStyle = c2; x.fillRect(W * 0.22, 0, W * 0.06, H); x.fillRect(W * 0.72, 0, W * 0.06, H);
  // shoulder yoke
  x.fillRect(0, 0, W, H * 0.07);
  // numbers
  x.font = '900 italic 120px "Barlow Condensed", Arial Black, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 8; x.strokeStyle = c2 === '#ffffff' ? '#111' : '#fff';
  const n = String(num);
  // u=.5 faces the front on this lathe; back number (seam) is the big one
  x.fillStyle = c2;
  for (const px of [0, W]) { x.strokeText(n, px, H * 0.42); x.fillText(n, px, H * 0.42); }
  x.font = '900 italic 64px "Barlow Condensed", Arial Black, sans-serif'; x.lineWidth = 5;
  x.font = '900 italic 120px "Barlow Condensed", Arial Black, sans-serif'; x.lineWidth = 8;
  x.strokeText(n, W * 0.5, H * 0.42); x.fillText(n, W * 0.5, H * 0.42);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.78 });
  jerseyTex.set(k, m); return m;
}

function addHair(head, look) {
  const hc = HAIRC[look.hairC], hm = M(hc, 0.9);
  const R = 0.118, s = look.hair;
  const cap = (scale = 1.06, tl = Math.PI * 0.52) => {
    const m = new THREE.Mesh(sph(R * scale, 18, 12, tl), hm); m.rotation.x = -0.25; m.position.set(0, 0.012, -0.006); head.add(m); return m;
  };
  if (s === 'bald') return;
  if (s === 'buzz') { cap(1.025, Math.PI * 0.5); return; }
  if (s === 'short' || s === 'crop' || s === 'headband') {
    cap(1.07); const f = new THREE.Mesh(sph(0.05), hm); f.scale.set(1.6, 0.6, 0.9); f.position.set(0, 0.09, 0.075); head.add(f);
  }
  if (s === 'curly') {
    cap(1.05);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, b = 0.35 + (i % 3) * 0.25;
      const m = new THREE.Mesh(sph(0.042, 8, 6), hm);
      m.position.set(Math.sin(a) * R * Math.sin(b + .6), R * Math.cos(b) * 0.95 + 0.03, Math.cos(a) * R * Math.sin(b + .6) * 0.9 - 0.01); head.add(m);
    }
  }
  if (s === 'afro') { const m = new THREE.Mesh(sph(0.165, 20, 14), hm); m.position.set(0, 0.06, -0.025); m.scale.set(1, 0.92, 1); head.add(m); }
  if (s === 'long') {
    cap(1.08); const m = new THREE.Mesh(G('longhair', () => { const g = new THREE.CylinderGeometry(0.11, 0.1, 0.2, 14, 1, true, Math.PI * 0.5, Math.PI); g.translate(0, -0.08, 0); return g; }), hm);
    m.position.set(0, 0, -0.01); m.material.side = THREE.DoubleSide; head.add(m);
  }
  if (s === 'bun') { cap(1.06); const b = new THREE.Mesh(sph(0.055), hm); b.position.set(0, 0.11, -0.09); head.add(b); }
  if (s === 'mohawk') {
    cap(1.015, Math.PI * 0.45);
    const m = new THREE.Mesh(G('mohawk', () => new THREE.BoxGeometry(0.03, 0.045, 0.2)), hm); m.position.set(0, 0.118, -0.01); m.rotation.x = -0.15; head.add(m);
  }
  if (s === 'headband' || look.band >= 0) {
    const cols = ['#ffffff', '#e53935', '#1e88e5', '#111111', '#f2c14e', '#43a047'];
    const b = new THREE.Mesh(G('band', () => new THREE.TorusGeometry(0.121, 0.016, 6, 24)), M(cols[Math.max(0, look.band)], 0.8));
    b.rotation.x = Math.PI / 2 - 0.25; b.position.set(0, 0.045, -0.005); head.add(b);
  }
}

// Build an athlete. Faces +z. Feet at y=0.
export function makeAthlete(card, team, opts = {}) {
  const look = card.look, skin = M(SKINS[look.skin], 0.55), c1 = team.c1, c2 = team.c2;
  const jm = jersey(c1, c2, card.num);
  const shortsM = M(c2 === '#ffffff' ? '#1d2230' : c2, 0.8), sockM = M('#f4f4f4', 0.9), shoeM = M(opts.shoe || '#202226', 0.5);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const P = { root, body };
  const all = [];
  const mesh = (g, m, parent) => { const x = new THREE.Mesh(g, m); x.castShadow = true; parent.add(x); all.push(x); return x; };

  body.position.y = 0.93;
  const hips = new THREE.Group(); body.add(hips); P.hips = hips;
  mesh(hipsGeo(), shortsM, hips);
  const torso = new THREE.Group(); torso.position.y = 0.03; hips.add(torso); P.torso = torso;
  const tm = mesh(torsoGeo(), jm, torso); tm.scale.x = look.build;
  // neck + head
  mesh(cyl(0.05, 0.055, 0.1), skin, torso).position.y = 0.67;
  const head = new THREE.Group(); head.position.y = 0.72; torso.add(head); P.head = head;
  const hd = mesh(sph(0.118, 22, 16), skin, head); hd.scale.set(0.93, 1.1, 1); hd.position.y = 0.0;
  const jaw = mesh(sph(0.09, 14, 10), skin, head); jaw.position.set(0, -0.05, 0.025); jaw.scale.set(1, 0.8, 1);
  for (const sx of [-1, 1]) {
    const ear = mesh(sph(0.026, 8, 6), skin, head); ear.position.set(sx * 0.108, 0, 0); ear.scale.set(0.5, 1, 0.8);
    const eye = new THREE.Mesh(sph(0.017, 10, 8), M('#ffffff', 0.3)); eye.position.set(sx * 0.04, 0.012, 0.1); head.add(eye);
    const iris = new THREE.Mesh(sph(0.0105, 8, 6), M('#1a120c', 0.2)); iris.position.set(sx * 0.04, 0.012, 0.114); head.add(iris);
    const brow = new THREE.Mesh(G('brow', () => new THREE.BoxGeometry(0.04, 0.009, 0.012)), M(HAIRC[look.hairC], 0.9)); brow.position.set(sx * 0.041, 0.042, 0.104); brow.rotation.z = sx * -0.12; head.add(brow);
  }
  const nose = new THREE.Mesh(sph(0.018, 8, 6), skin); nose.position.set(0, -0.012, 0.118); nose.scale.set(0.9, 1.1, 1); head.add(nose);
  const mouth = new THREE.Mesh(G('mouth', () => new THREE.BoxGeometry(0.036, 0.007, 0.01)), M('#6b2f2a', 0.6)); mouth.position.set(0, -0.055, 0.103); head.add(mouth);
  if (look.beard) {
    const bd = new THREE.Mesh(sph(0.093, 14, 10, Math.PI * 0.55), M(HAIRC[look.hairC], 0.95)); bd.rotation.x = Math.PI; bd.position.set(0, -0.035, 0.018); bd.scale.set(1.02, 0.85, 1.02); head.add(bd);
  }
  addHair(head, look);

  // arms
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    const sh = new THREE.Group(); sh.position.set(sx * 0.205 * look.build, 0.53, 0); torso.add(sh);
    const sleeve = mesh(cyl(0.068, 0.062, 0.15), jm, sh); sleeve.material.side = THREE.DoubleSide;
    const cap = mesh(sph(0.068, 12, 8), jm, sh); cap.scale.y = 0.8;
    const up = mesh(limbGeo(0.046 * look.build, 0.2), look.sleeve ? M('#111', 0.7) : skin, sh);
    const el = new THREE.Group(); el.position.y = -0.27; sh.add(el);
    mesh(limbGeo(0.04, 0.2), skin, el);
    const hand = mesh(sph(0.045, 10, 8), skin, el); hand.position.y = -0.28; hand.scale.set(0.8, 1.15, 0.6);
    P['sh' + side] = sh; P['el' + side] = el; P['hand' + side] = hand;
  }
  // legs
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    const hip = new THREE.Group(); hip.position.set(sx * 0.095, -0.06, 0); hips.add(hip);
    mesh(cyl(0.092, 0.085, 0.27), shortsM, hip).material.side = THREE.DoubleSide;
    mesh(limbGeo(0.068, 0.33), skin, hip);
    const kn = new THREE.Group(); kn.position.y = -0.42; hip.add(kn);
    mesh(limbGeo(0.055, 0.3), skin, kn);
    const sock = mesh(cyl(0.058, 0.05, 0.18), sockM, kn); sock.position.y = -0.2;
    const ft = new THREE.Group(); ft.position.y = -0.42; kn.add(ft);
    mesh(shoeGeo(), shoeM, ft).position.y = -0.02;
    P['hip' + side] = hip; P['kn' + side] = kn; P['ft' + side] = ft;
  }
  root.scale.setScalar(look.h);
  P.meshes = all;
  P.anim = { phase: Math.random() * 6, blend: 0 };
  return P;
}

const lerp = (a, b, t) => a + (b - a) * t;
// pose: {mode:'idle'|'run'|'throw'|'catch'|'jump'|'layout'|'mark'|'cheer'|'reach', speed, t, reachY}
export function animate(P, pose, dt) {
  const A = P.anim, sp = pose.speed || 0;
  const runAmt = Math.min(1, sp / 6);
  A.phase += dt * (4 + sp * 1.55);
  const ph = A.phase, s = Math.sin(ph), c = Math.cos(ph);
  const m = pose.mode;
  // defaults: athletic stance blended with run
  let hipL = s * 0.85 * runAmt - 0.12, hipR = -s * 0.85 * runAmt - 0.12;
  let knL = 0.25 + Math.max(0, -c) * 1.25 * runAmt + 0.15, knR = 0.25 + Math.max(0, c) * 1.25 * runAmt + 0.15;
  let shLx = -s * 0.8 * runAmt + 0.05, shRx = s * 0.8 * runAmt + 0.05, shLz = 0.12, shRz = -0.12;
  let elL = -0.4 - runAmt * 0.9, elR = -0.4 - runAmt * 0.9;
  let lean = 0.08 + runAmt * 0.28, bodyY = 0.93 - 0.03 - Math.abs(s) * 0.05 * runAmt, bodyRx = 0, torsoRy = 0, headRx = 0;
  if (m === 'idle' || m === 'mark') {
    const b = Math.sin(ph * 0.35) * 0.02;
    if (m === 'mark') { shLz = 1.0; shRz = -1.0; shLx = -0.5; shRx = -0.5; elL = elR = -0.2; hipL = hipR = -0.35; knL = knR = 0.7; lean = 0.35; bodyY = 0.8 + b; }
    else { lean += b; }
  }
  if (m === 'throw') { // t: 0..1 (0-.55 windup, .55-.75 release, then follow)
    const t = pose.t || 0, fh = pose.forehand;
    const wind = t < 0.55 ? t / 0.55 : Math.max(0, 1 - (t - 0.55) / 0.15);
    const rel = t < 0.55 ? 0 : Math.min(1, (t - 0.55) / 0.2);
    torsoRy = fh ? lerp(0, -0.9, wind) + rel * 0.9 : lerp(0, 1.1, wind) - rel * 1.4;
    shRx = -1.3; shRz = fh ? lerp(-0.4, -1.1, wind) : lerp(-0.2, 0.9, wind) - rel * 1.6;
    elR = fh ? -1.4 + rel * 1.2 : -1.6 + rel * 1.5;
    shLz = 0.6; shLx = -0.6; lean = 0.25; hipL = -0.5; hipR = 0.1; knL = 0.6; knR = 0.3; bodyY = 0.86;
  }
  if (m === 'catch' || m === 'reach') {
    const hy = pose.reachY ?? 1.4; // relative height of disc: low (<1) / chest / high
    const up = hy > 1.6 ? -2.9 : hy > 1.0 ? -1.6 : -0.9;
    shLx = lerp(shLx, up, 0.85); shRx = lerp(shRx, up, 0.85); shLz = 0.25; shRz = -0.25; elL = elR = -0.25;
  }
  if (m === 'jump') {
    hipL = -0.9; hipR = -0.3; knL = 1.4; knR = 0.6; shLx = shRx = -2.9; shLz = 0.25; shRz = -0.25; elL = elR = -0.1; lean = 0.05; bodyY = 0.93;
  }
  if (m === 'layout') {
    bodyRx = 1.35; bodyY = 0.42; hipL = 0.25; hipR = 0.1; knL = 0.5; knR = 0.2; shLx = shRx = -3.0; shLz = 0.1; shRz = -0.1; elL = elR = -0.05; lean = 0; headRx = -0.9;
  }
  if (m === 'cheer') {
    shLz = 2.6; shRz = -2.6; shLx = shRx = -0.2 + Math.sin(ph * 2) * 0.2; elL = elR = -0.3; hipL = hipR = -0.05; knL = knR = 0.1; lean = -0.05; bodyY = 0.93 + Math.max(0, Math.sin(ph * 1.4)) * 0.18;
  }
  if (m === 'down') { bodyRx = 1.45; bodyY = 0.16; hipL = hipR = 0.05; knL = knR = 0.2; shLx = shRx = -2.8; elL = elR = -0.2; lean = 0; headRx = -1; }
  const k = Math.min(1, dt * 14);
  const r = (o, prop, v) => { o.rotation[prop] = lerp(o.rotation[prop], v, k); };
  r(P.hipL, 'x', hipL); r(P.hipR, 'x', hipR); r(P.knL, 'x', knL); r(P.knR, 'x', knR);
  r(P.shL, 'x', shLx); r(P.shR, 'x', shRx); r(P.shL, 'z', shLz); r(P.shR, 'z', shRz);
  r(P.elL, 'x', elL); r(P.elR, 'x', elR); r(P.torso, 'x', lean); r(P.torso, 'y', torsoRy); r(P.body, 'x', bodyRx); r(P.head, 'x', headRx);
  P.ftL.rotation.x = -P.hipL.rotation.x * 0.3 - P.knL.rotation.x * 0.4; P.ftR.rotation.x = -P.hipR.rotation.x * 0.3 - P.knR.rotation.x * 0.4;
  P.body.position.y = lerp(P.body.position.y, bodyY, k);
}

export function makeDisc(color = '#f7f7f2') {
  const g = new THREE.Group();
  const top = new THREE.Mesh(G('disctop', () => { const x = new THREE.SphereGeometry(0.135, 28, 8, 0, Math.PI * 2, 0, 0.55); x.scale(1, 0.32, 1); x.translate(0, -0.025, 0); return x; }), M(color, 0.35));
  const rim = new THREE.Mesh(G('discrim', () => new THREE.TorusGeometry(0.122, 0.014, 8, 32)), M(color, 0.4)); rim.rotation.x = Math.PI / 2; rim.position.y = -0.012;
  const ring = new THREE.Mesh(G('discring', () => new THREE.TorusGeometry(0.07, 0.006, 6, 24)), M('#d7263d', 0.5)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.012;
  for (const x of [top, rim, ring]) { x.castShadow = true; g.add(x); }
  return g;
}

// ---------- card portraits (rendered 3D heads) ----------
let pr = null;
const portraitCache = new Map();
function portraitRig() {
  if (pr) return pr;
  const cv = document.createElement('canvas'); cv.width = 240; cv.height = 280;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { return null; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#444455', 1.4));
  const key = new THREE.DirectionalLight('#fff4e0', 2.4); key.position.set(1.5, 2.5, 3); scene.add(key);
  const rim = new THREE.DirectionalLight('#9fd0ff', 1.6); rim.position.set(-2, 2, -2); scene.add(rim);
  const cam = new THREE.PerspectiveCamera(26, 240 / 280, 0.1, 20);
  pr = { renderer, scene, cam }; return pr;
}
export function portrait(card, team) {
  const key = card.id + team.c1 + team.c2 + card.num + card.look.hair + card.look.skin;
  if (portraitCache.has(key)) return portraitCache.get(key);
  const R = portraitRig(); if (!R) return '';
  const P = makeAthlete(card, team);
  animate(P, { mode: 'idle', speed: 0 }, 1);
  P.root.rotation.y = -0.38;
  R.scene.add(P.root);
  const h = card.look.h, y = 1.48 * h;
  R.cam.position.set(0.15, y + 0.06, 2.2); R.cam.lookAt(0, y - 0.16, 0);
  R.renderer.render(R.scene, R.cam);
  const url = R.renderer.domElement.toDataURL('image/png');
  R.scene.remove(P.root);
  portraitCache.set(key, url);
  return url;
}

// team photo for the home screen
let photoCache = null;
export function teamPhoto(cards, team, w, h) {
  const key = cards.map((c) => c.id).join() + team.c1 + team.c2 + w;
  if (photoCache && photoCache.key === key) return photoCache.url;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true }); } catch (e) { return ''; }
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#14202c'); scene.fog = new THREE.Fog('#14202c', 8, 22);
  scene.add(new THREE.HemisphereLight('#cfe6ff', '#2a4a22', 1.0));
  const key2 = new THREE.DirectionalLight('#ffe9c7', 3); key2.position.set(3, 6, 5); key2.castShadow = true; key2.shadow.mapSize.set(1024, 1024);
  Object.assign(key2.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 }); scene.add(key2);
  const rim = new THREE.DirectionalLight(team.c1, 2.2); rim.position.set(-4, 3, -4); scene.add(rim);
  const g = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshStandardMaterial({ color: '#3d8a37', roughness: 1 }));
  g.rotation.x = -Math.PI / 2; g.receiveShadow = true; scene.add(g);
  const k = cards.length;
  cards.forEach((c, i) => {
    const P = makeAthlete(c, team);
    const x = (i - (k - 1) / 2) * 0.95, z = -Math.abs(i - (k - 1) / 2) * 0.35;
    P.root.position.set(x, 0, z); P.root.rotation.y = -x * 0.12;
    const poses = ['idle', 'mark', 'idle', 'cheer', 'idle'];
    for (let j = 0; j < 30; j++) animate(P, { mode: i === Math.floor(k / 2) ? 'idle' : poses[i % 5] === 'cheer' ? 'idle' : poses[i % 5], speed: 0 }, 0.05);
    if (i === Math.floor(k / 2)) { P.shR.rotation.set(-1.4, 0, -0.3); P.elR.rotation.x = -1.2; const d = makeDisc(); d.position.set(-0.36, 1.2, 0.35); d.rotation.x = 0.3; P.root.add(d); }
    P.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(P.root);
  });
  const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
  cam.position.set(-1.6, 1.5, 6.6); cam.lookAt(-2.1, 1.0, 0);
  renderer.render(scene, cam);
  const url = cv.toDataURL('image/jpeg', 0.88);
  renderer.dispose(); renderer.forceContextLoss();
  photoCache = { key, url };
  return url;
}
