// HUCK - 3D field, stadium, lights
import * as THREE from './lib/three.min.js';
import { M } from './model.js';

export function fieldDims(n) {
  const t = (n - 3) / 7; // 3v3 -> 0, 10v10 -> 1
  return { L: Math.round(32 + t * 32), W: Math.round(22 + t * 15), E: Math.round(10 + t * 8) };
}

function grassTexture(L, E, W) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
  const x = cv.getContext('2d');
  const stripes = 14;
  for (let i = 0; i < stripes; i++) { x.fillStyle = i % 2 ? '#3f8f3a' : '#47993f'; x.fillRect(i * 1024 / stripes, 0, 1024 / stripes + 1, 512); }
  // grain
  const img = x.getImageData(0, 0, 1024, 512), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 18; d[i] += n * 0.6; d[i + 1] += n; d[i + 2] += n * 0.4; }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function crowdTexture() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const x = cv.getContext('2d');
  x.fillStyle = '#2a2f3a'; x.fillRect(0, 0, 512, 128);
  const cols = ['#e53935', '#1e88e5', '#fdd835', '#ffffff', '#43a047', '#8e24aa', '#fb8c00', '#212121', '#90a4ae', '#f48fb1'];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 64; c++) {
    if (Math.random() < 0.18) continue;
    const px = c * 8 + 1 + Math.random() * 2, py = r * 16 + 3;
    x.fillStyle = cols[Math.floor(Math.random() * cols.length)]; x.fillRect(px, py + 5, 6, 9);
    x.fillStyle = ['#f1c9a5', '#c99872', '#8d5a3b', '#5b3a24'][Math.floor(Math.random() * 4)]; x.beginPath(); x.arc(px + 3, py + 3, 2.6, 0, 7); x.fill();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}

export function buildWorld(scene, dims, homeTeam, awayTeam, quality) {
  const { L, W, E } = dims, half = L / 2, tot = half + E;
  scene.background = new THREE.Color('#9cc9ec');
  scene.fog = new THREE.Fog('#b9d8ee', 90, 240);

  const hemi = new THREE.HemisphereLight('#dff1ff', '#3b5d2a', 1.15); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3dc', 2.6);
  sun.position.set(-25, 55, -30);
  if (quality === 'high') {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = sun.shadow.camera; s.left = -tot - 4; s.right = tot + 4; s.top = W / 2 + 12; s.bottom = -W / 2 - 12; s.near = 10; s.far = 160;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  }
  scene.add(sun); scene.add(sun.target);

  // outer ground
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 300), M('#3a7a35', 1));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; outer.receiveShadow = true; scene.add(outer);
  // field grass
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(tot * 2 + 12, W + 12), new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.95 }));
  grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; scene.add(grass);
  // end zones tinted with defending team colors (home defends -x)
  const ez = (cx, color) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(E, W), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.22, roughness: 1, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.006, 0); m.receiveShadow = true; scene.add(m);
  };
  ez(-half - E / 2, homeTeam.c1); ez(half + E / 2, awayTeam.c1);
  // lines
  const lineM = M('#f5f5f0', 0.8);
  const line = (x1, z1, x2, z2, w = 0.12) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, w), lineM);
    m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(z2 - z1, x2 - x1);
    m.position.set((x1 + x2) / 2, 0.012, (z1 + z2) / 2); m.receiveShadow = true; scene.add(m);
  };
  line(-tot, -W / 2, tot, -W / 2); line(-tot, W / 2, tot, W / 2);
  line(-tot, -W / 2, -tot, W / 2); line(tot, -W / 2, tot, W / 2);
  line(-half, -W / 2, -half, W / 2, 0.16); line(half, -W / 2, half, W / 2, 0.16);
  // brick marks
  for (const bx of [-half + E * 0.9, half - E * 0.9]) { line(bx - 0.5, -0.5, bx + 0.5, 0.5, 0.1); line(bx - 0.5, 0.5, bx + 0.5, -0.5, 0.1); }
  // cones
  const coneG = new THREE.ConeGeometry(0.18, 0.42, 14);
  for (const cx of [-tot, -half, half, tot]) for (const cz of [-W / 2, W / 2]) {
    const c = new THREE.Mesh(coneG, M('#ff6d1f', 0.6)); c.position.set(cx, 0.21, cz); c.castShadow = true; scene.add(c);
  }
  // stands (far side) + low bleachers near side ends
  const ct = crowdTexture();
  const standLen = tot * 2 + 10;
  for (let row = 0; row < 7; row++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(standLen, 0.5, 1.2), M(row % 2 ? '#9aa4b1' : '#8a94a1', 0.9));
    step.position.set(0, 0.25 + row * 0.5, W / 2 + 7 + row * 1.2); step.receiveShadow = true; scene.add(step);
  }
  const ctex = ct.clone(); ctex.repeat.set(standLen / 16, 1); ctex.needsUpdate = true;
  const crowd = new THREE.Mesh(new THREE.PlaneGeometry(standLen, 3.6), new THREE.MeshStandardMaterial({ map: ctex, roughness: 1, transparent: false }));
  crowd.position.set(0, 2.7, W / 2 + 10.4);
  crowd.lookAt(0, 2.7 + 2.2, W / 2 + 10.4 - 5); scene.add(crowd);
  // back wall + banner in team colors
  const wall = new THREE.Mesh(new THREE.BoxGeometry(standLen, 6, 0.4), M('#2b3240', 0.9)); wall.position.set(0, 3, W / 2 + 15.4); scene.add(wall);
  for (let i = -3; i <= 3; i++) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(standLen / 7 - 0.4, 1.1), M(i % 2 ? homeTeam.c1 : awayTeam.c1, 0.8));
    b.position.set(i * standLen / 7, 0.6, W / 2 + 4.3); scene.add(b);
  }
  // light towers
  for (const lx of [-tot - 6, tot + 6]) for (const lz of [W / 2 + 16, -W / 2 - 14]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 22, 8), M('#6d7682', 0.6)); p.position.set(lx, 11, lz); scene.add(p);
    const h = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 0.6), M('#e9eef3', 0.4, { emissive: '#ffffff', emissiveIntensity: 0.25 })); h.position.set(lx, 22.5, lz); h.lookAt(0, 0, 0); scene.add(h);
  }
  // trees in the distance
  const trunkG = new THREE.CylinderGeometry(0.25, 0.35, 3, 6), topG = new THREE.IcosahedronGeometry(2.6, 0);
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2, rx = tot + 30 + Math.random() * 25, rz = W / 2 + 30 + Math.random() * 20;
    const x = Math.cos(a) * rx, z = Math.sin(a) * rz;
    if (z > W / 2 + 8 && Math.abs(x) < standLen / 2 + 3) continue;
    const g = new THREE.Group();
    const tr = new THREE.Mesh(trunkG, M('#5b4130', 1)); tr.position.y = 1.5; g.add(tr);
    const tp = new THREE.Mesh(topG, M(['#2f6b2a', '#3a7d33', '#2a5f2a'][i % 3], 0.95)); tp.position.y = 4.4; tp.scale.y = 1.25; g.add(tp);
    g.position.set(x, 0, z); g.scale.setScalar(0.9 + Math.random() * 0.8); scene.add(g);
  }
  return { sun };
}

// blob shadow (used when quality is low)
let blobTex = null;
export function blobShadow(r = 0.45) {
  if (!blobTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); blobTex = new THREE.CanvasTexture(cv);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.02; return m;
}
export function ring(color, r = 0.55, w = 0.07) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r - w, r, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.03; return m;
}
