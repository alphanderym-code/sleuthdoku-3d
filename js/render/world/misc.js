// Snow (cabin, ski lift, snowmen) and airport (apron, runway, planes, tower) worlds.
import * as THREE from 'three';
import { GY, EXT, PAL, fbm, smooth, lerpHex, organicPoly } from './ctx.js';
import { CYL, SPH, BOX, CONE, CAPS, toonVC, toon } from '../models/kit.js';
import { lamp, cornerLamps, bench, frame, crate, drifters, traffic, fliers, planter, bin } from './props.js';
import { ringSpots, ringTrees, ringFill, ringK, soil } from './ring.js';

const _c = new THREE.Color(), _d = new THREE.Color();

function smoke(c, x, y, z) {
  const n = 5, im = new THREE.InstancedMesh(SPH(0.5, 8, 6), toon('#fff6ee'), n), m = new THREE.Matrix4(), e = m.elements;
  im.frustumCulled = false; c.group.add(im);
  c.anims.push((t) => {
    for (let i = 0; i < n; i++) { const ph = (t * 0.25 + i / n) % 1, s = 0.08 + ph * 0.3 * (1 - ph * 0.4); m.makeScale(s, s * 0.9, s); e[12] = x + ph * 0.9 + Math.sin(t + i) * 0.05; e[13] = y + ph * 1.6; e[14] = z - ph * 0.3; im.setMatrixAt(i, m); }
    im.instanceMatrix.needsUpdate = true;
  });
}
const snowTint = '#f2f1ff';

// ---------------------------------------------------------------------------------------------------------------- SNOW
function snowman(c, x, z, ry) {
  const F = frame(c, x, z, ry);
  F.sph(0, GY + 0.28, 0, 0.3, '#fbfbff', { ws: 10, hs: 8, grad: 0.1 }); F.sph(0, GY + 0.68, 0, 0.22, '#fbfbff', { ws: 10, hs: 8 }); F.sph(0, GY + 0.98, 0, 0.16, '#ffffff', { ws: 10, hs: 8 });
  F.cone(0, GY + 0.95, 0.2, 0.04, 0.22, '#ee7a3a', { seg: 6, rot: [Math.PI / 2, 0, 0], dy: 0.1 });
  F.cyl(0, GY + 1.1, 0, 0.17, 0.17, 0.2, PAL.plum, { seg: 8, grad: 0 }); F.cyl(0, GY + 1.1, 0, 0.23, 0.23, 0.04, PAL.plum, { seg: 8, grad: 0 });
  F.cyl(0, GY + 0.82, 0, 0.19, 0.19, 0.07, PAL.coral, { seg: 8, grad: 0 });
  for (let i = 0; i < 2; i++) F.sph((i - 0.5) * 0.1, GY + 1.0, 0.14, 0.022, PAL.ink, { ws: 4, hs: 4, grad: 0 });
  c.blob(x + 0.3, z - 0.2, 0.5, 0.4, 0.6);
}
export function buildSnow(c) {
  const H = c.H, cabX = -(H + 3.7), cabZ = -(H + 3.2), ck = 0.7;
  const base = (x, z, col) => { const k = (fbm(x * 0.07, z * 0.07, 9) - 0.5) * 1.8 + 0.5; col.set('#d7d9f2').lerp(_c.set('#f1f1fb'), smooth(0.3, 0.55, k)).lerp(_d.set('#ffffff'), smooth(0.6, 0.9, k) * 0.8); };
  const pond = organicPoly(H + 3.9, H * 0.3 + 0.4, 1.5, 1.9, 20, 0.12, c.r() * 9);
  c.buildGround({
    base, farBase: base, farTint: '#f4f4ff', hill: 1.4,
    paint(P) {
      for (let i = 0; i < 28; i++) P.blot(c.rr(-EXT, EXT), c.rr(-EXT, EXT), c.rr(2, 5), c.pick(['#b9bfe6', '#c8cdee', '#ffffff']), 0.3);
      for (let i = 0; i < 22; i++) P.blot(c.rr(-(H + 7), H + 7), c.rr(-(H + 7), H + 6), c.rr(0.9, 2.0), c.pick(['#a9b2e4', '#bcc3ee', '#9ea8dc', '#ffffff']), 0.35);
      P.line([[-EXT, H + 7], [-(H + 5), H + 4], [-(H + 3.4), 0], [-(H + 3.0), -(H + 1.6)]], 1.3, '#d3cbe6', { a: 0.9 });
      P.line([[H + 3.4, -(H + 7)], [H + 3.0, -2], [H + 2.8, 2], [H + 5, H + 6], [EXT, H + 9]], 1.2, '#d3cbe6', { a: 0.9 });
      for (const o of [-0.35, 0.35]) P.line([[H + 3.4 + o, -(H + 6)], [H + 3.0 + o, -2], [H + 2.8 + o, 2]], 0.07, '#a3acd9', { a: 0.8 });
      P.poly(pond.map(([x, z]) => [x, z]), '#cfe7f4', 1); P.line(pond, 0.18, '#ffffff', { a: 0.9, close: true });
      P.ell(cabX, cabZ + 1.3, 2.2, 1.1, '#e6e0f0', 0.9);
    },
  });
  c.claim(H + 3.9, H * 0.3 + 0.4, 2.4); c.claim(cabX, cabZ, 2.0);
  // log cabin
  const C = frame(c, cabX, cabZ, 0.25, ck), logC = '#b87a48';
  for (let r = 0; r < 7; r++) {
    const y = GY + 0.14 + r * 0.24;
    C.p(CYL(0.12, 0.12, 3.0, 8), 0, y, 1.1, logC, { rot: [0, 0, Math.PI / 2], top: '#d29860' }); C.p(CYL(0.12, 0.12, 3.0, 8), 0, y, -1.1, logC, { rot: [0, 0, Math.PI / 2], top: '#d29860' });
    C.p(CYL(0.12, 0.12, 2.4, 8), 1.5, y, 0, logC, { rot: [Math.PI / 2, 0, 0], top: '#d29860' }); C.p(CYL(0.12, 0.12, 2.4, 8), -1.5, y, 0, logC, { rot: [Math.PI / 2, 0, 0], top: '#d29860' });
  }
  C.box(0, GY + 0.1, 0, 2.9, 1.65, 2.1, '#9c6238', { plain: true });
  for (const s of [-1, 1]) C.box(s * 0.95, GY + 1.5, 0, 1.9, 0.14, 3.0, '#f4f4ff', { plain: true, rot: [0, 0, -s * 0.58], dy: 0.25 });
  C.box(0, GY + 1.2, 1.15, 3.2, 0.1, 0.2, '#8a5632', { plain: true });
  C.gbox('win', -0.8, GY + 0.6, 1.2, 0.55, 0.5, 0.06); C.box(0.75, GY + 0.1, 1.2, 0.55, 1.0, 0.08, '#4a8f86', { plain: true });
  C.box(-1.0, GY + 1.5, -0.4, 0.4, 1.0, 0.4, '#d9c9a6', { plain: true }); C.box(-1.0, GY + 2.5, -0.4, 0.5, 0.1, 0.5, '#f4f4ff', { plain: true });
  const [sx, sz] = C.T(-1.0, -0.4); smoke(c, sx, GY + 1.9, sz);
  c.blob(cabX + 0.7, cabZ - 0.5, 2.4, 1.8, 0.5);
  // ski lift: pylons, cable, moving chairs
  const lz = -(H + 4.4), cy = GY + 3.0, X0 = -EXT + 2, X1 = EXT - 2;
  for (let x = -28; x <= 28; x += 8) {
    c.cyl(x, GY, lz, 0.11, 0.17, 3.1, PAL.tealD, { seg: 8 }); c.box(x, GY + 2.9, lz, 0.16, 0.1, 1.5, PAL.tealD, { plain: true }); c.blob(x + 0.5, lz - 0.4, 0.5, 0.4, 0.6);
  }
  for (const s of [-0.7, 0.7]) c.box(0, cy, lz + s, X1 - X0, 0.07, 0.07, '#4a4560', { plain: true, grad: 0, far: true });
  const chairGeo = (() => {
    const g = [], add = (geo, x, y, z, col) => { const q = geo.index ? geo.toNonIndexed() : geo.clone(); for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k); q.translate(x, y, z); const a = new Float32Array(q.attributes.position.count * 3), cc = new THREE.Color(col); for (let i = 0; i < a.length; i += 3) { a[i] = cc.r; a[i + 1] = cc.g; a[i + 2] = cc.b; } q.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.push(q); };
    add(BOX(0.05, 0.8, 0.05), 0, -0.4, 0, '#4a4560'); add(BOX(0.8, 0.09, 0.4), 0, -0.85, 0.1, PAL.coral); add(BOX(0.8, 0.4, 0.07), 0, -0.62, -0.1, PAL.coral); add(BOX(0.8, 0.05, 0.05), 0, -0.7, 0.3, '#4a4560');
    return mergeG(g);
  })();
  const NCH = 12, ch = new THREE.InstancedMesh(chairGeo, toonVC(), NCH), mm = new THREE.Matrix4(), me = mm.elements, Lc = X1 - X0;
  ch.frustumCulled = false; c.group.add(ch);
  c.anims.push((t) => {
    for (let i = 0; i < NCH; i++) {
      const up = i < NCH / 2, s = ((t * 1.2 + i * Lc / (NCH / 2)) % Lc + Lc) % Lc, x = up ? X0 + s : X1 - s;
      mm.makeRotationY(up ? 0 : Math.PI); me[12] = x; me[13] = cy + Math.sin(t * 1.5 + i) * 0.03; me[14] = lz + (up ? -0.7 : 0.7); ch.setMatrixAt(i, mm);
    }
    ch.instanceMatrix.needsUpdate = true;
  });
  // furniture
  cornerLamps(c, (cc, x, z, o) => lamp(cc, x, z, o), 1.4);
  bench(c, H + 4.4, H * 0.05, -Math.PI / 2); crate(c, -(H + 1.9), -(H * 0.7) - 1.6, 0.3);
  for (const [x, z, ry] of [[H + 2.4, -H * 0.55, 0.4], [-(H + 2.5), H * 0.4, -0.5], [H + 5.2, -(H + 1.4), 0.2]]) { snowman(c, x, z, ry); c.claim(x, z, 0.7); }
  const sledge = (x, z, ry, col) => { const F = frame(c, x, z, ry); F.box(0, GY + 0.1, 0, 0.5, 0.07, 1.0, col, { plain: true }); for (const q of [-0.2, 0.2]) F.box(q, GY, 0, 0.05, 0.1, 1.2, '#7b6f8f', { plain: true }); F.box(0, GY + 0.17, -0.3, 0.4, 0.1, 0.25, '#fff8ea', { r: 0.04 }); c.blob(x + 0.2, z - 0.15, 0.5, 0.6, 0.4); c.claim(x, z, 0.7); };
  sledge(-(H + 2.4), -H * 0.3, 0.3, PAL.coral); sledge(H + 2.3, H * 0.5, -0.3, PAL.sky); sledge(-(H + 3.5), -(H * 0.7) - 0.4, 1.2, PAL.sun);
  c.tree('snowpine', -(H + 4.6), -(H + 4.6), 1.1); c.tree('snowpine', H + 4.4, -(H + 4.2), 1.2); c.tree('snowpine', H * 0.3, -(H + 3.4), 1.0); c.tree('snowpine', -H * 0.35, -(H + 3.0), 0.9);
  ringTrees(c, ['snowpine', 'snowpine', 'snowpine', 'pine'], 12, { s0: 0.8, s1: 1.15 });
  const bankCols = [['#bcc4ec', '#f6f6ff'], ['#c5cbf0', '#ffffff'], ['#b2bbe8', '#eef0ff']];
  ringSpots(c, Math.round(26 * ringK(H)), (x, z) => { const [lo, hi] = c.pick(bankCols); c.sph(x, GY, z, c.rr(0.3, 0.6), lo, { s: [1.5, 0.45, 1.1], ws: 8, hs: 5, top: hi }); }, { r: 0.45 });
  ringSpots(c, Math.round(8 * ringK(H)), (x, z) => c.rock(x, z, c.rr(0.35, 0.7), GY, '#d9dbf4'), { r: 0.45 });
  ringSpots(c, Math.round(30 * ringK(H)), (x, z) => c.tuft(x, z, c.rr(0.7, 1.1)), { r: 0.25 });
  c.scatter(26, 6.6, 22, (x, z) => c.tree(c.r() < 0.8 ? 'snowpine' : 'pine', x, z, c.rr(0.9, 1.35)), { r: 1.2, tall: true });
  c.scatter(8, 6.2, 22, (x, z) => c.rock(x, z, c.rr(0.5, 1.0), GY, '#e6e6fb'), { r: 0.5 });
  c.scatter(14, 6.2, 20, (x, z) => { c.sph(x, GY, z, c.rr(0.35, 0.6), '#c5cbf0', { s: [1.4, 0.45, 1.1], ws: 8, hs: 5, top: '#f6f6ff' }); }, { r: 0.4 });
  drifters(c, 70, ['#ffffff', '#eef2ff'], { size: 0.09, fall: 0.5, top: 5, sway: 0.8, area: 20 });
}
function mergeG(list) { return import_merge(list); }
import { mergeGeometries as import_merge } from 'three/addons/utils/BufferGeometryUtils.js';

// ------------------------------------------------------------------------------------------------------------- AIRPORT
function jet(c, x, z, ry, k = 1) {
  const F = frame(c, x, z, ry, k), Y = GY + 0.75, white = '#f4efe8';
  F.p(CAPS(0.55, 3.4, 6, 12), 0, Y, 0, white, { rot: [Math.PI / 2, 0, 0], top: '#ffffff' });
  F.p(CAPS(0.5, 3.3, 4, 12), 0, Y - 0.1, 0, PAL.teal, { rot: [Math.PI / 2, 0, 0], s: [1.02, 1.0, 0.5], grad: 0 });
  F.p(CONE(0.45, 1.3, 10), 0, Y + 0.2, -2.7, white, { rot: [-Math.PI / 2, 0, 0] });
  for (const s of [-1, 1]) {
    F.box(s * 1.9, Y - 0.2, 0.2, 3.4, 0.12, 1.0, white, { rot: [0, -s * 0.35, s * 0.08], plain: true }); F.cyl(s * 1.5, Y - 0.6, 0.2, 0.26, 0.26, 0.8, '#d8d4dc', { seg: 10, rot: [Math.PI / 2, 0, 0] });
    F.box(s * 0.65, Y + 0.1, -2.25, 1.4, 0.09, 0.6, white, { rot: [0, -s * 0.3, 0], plain: true });
  }
  F.box(0, Y + 0.5, -2.3, 0.1, 1.3, 0.9, PAL.coral, { rot: [0.5, 0, 0], plain: true });
  for (let i = 0; i < 8; i++) { F.gbox('winC', 0.52, Y + 0.18, -1.6 + i * 0.34, 0.04, 0.16, 0.16); F.gbox('winC', -0.52, Y + 0.18, -1.6 + i * 0.34, 0.04, 0.16, 0.16); }
  c.blob(x + 0.8, z - 0.5, 3.4, 1.5, 0.5);
}
function prop(c, x, z, ry, k = 1) {
  const F = frame(c, x, z, ry, k), Y = GY + 0.5;
  F.p(CAPS(0.3, 1.5, 6, 10), 0, Y, 0, '#ffd34a', { rot: [Math.PI / 2, 0, 0], top: '#fff0a0' }); F.box(0, Y + 0.1, 0.0, 3.4, 0.1, 0.7, '#ffd34a', { plain: true });
  F.box(0, Y + 0.4, -1.1, 0.08, 0.7, 0.5, PAL.coral, { plain: true, rot: [0.4, 0, 0] }); F.box(0, Y + 0.12, -1.1, 1.2, 0.07, 0.4, '#ffd34a', { plain: true });
  F.glow('winC', BOX(0.5, 0.2, 0.5), 0, Y + 0.3, 0.45);
  const bl = [c.mk(BOX(0.12, 1.1, 0.04), 0, 0, 0, '#2e2a45', { grad: 0, s: k }), c.mk(BOX(1.1, 0.12, 0.04), 0, 0, 0, '#2e2a45', { grad: 0, s: k }), c.mk(SPH(0.12, 6, 5), 0, 0, 0.0, PAL.coral, { s: k })];
  const [px, pz] = F.T(0, 1.25); c.spinner(bl, px, GY + 0.5 * k, pz, { ry, speed: 22, axis: 'z' });
  c.blob(x + 0.6, z - 0.4, 2.0, 1.0, 0.5);
}
function cone(c, x, z) { c.cone(x, GY, z, 0.17, 0.38, '#ee7a3a', { seg: 8, grad: 0.1 }); c.cyl(x, GY + 0.16, z, 0.12, 0.13, 0.07, '#fff8ea', { seg: 8, grad: 0 }); c.box(x, GY, z, 0.4, 0.04, 0.4, '#ee7a3a', { plain: true, grad: 0 }); }
function cartTrain(c, x, z, ry = 0) {
  const P = [c.mk(BOX(0.9, 0.35, 0.6), 0, 0.3, 0, PAL.sky, { grad: 0.2 }), c.mk(BOX(0.45, 0.4, 0.55), 0.15, 0.62, 0, '#f4efe8')];
  for (let i = 1; i <= 3; i++) {
    P.push(c.mk(BOX(1.0, 0.2, 0.75), -i * 1.2, 0.3, 0, '#9a8c86')); P.push(c.mk(BOX(0.34, 0.26, 0.3), -i * 1.2 - 0.2, 0.55, 0.12, c.pick([PAL.coral, PAL.sun, PAL.teal, PAL.plum])));
    P.push(c.mk(BOX(0.3, 0.22, 0.28), -i * 1.2 + 0.25, 0.53, -0.12, c.pick([PAL.sky, PAL.coral, PAL.sun])));
  }
  for (let i = 0; i <= 3; i++) for (const s of [-1, 1]) P.push(c.mk(CYL(0.1, 0.1, 0.08, 8), -i * 1.2, 0.1, s * 0.34, '#3b3550', { rot: [Math.PI / 2, 0, 0], grad: 0 }));
  c.bobber(P, x, GY, z, { ry, amp: 0, drift: 3.0, speed: 0.5 });
}
function flood(c, x, z, o) {
  const h = 1.45;
  c.cyl(x, GY, z, 0.1, 0.14, h, '#6a6482', { seg: 8 }); c.box(x, GY + h - 0.05, z, 0.5, 0.3, 0.24, '#4a4560', { plain: true, ry: Math.atan2(x, z) });
  c.glow('lamp', BOX(0.42, 0.22, 0.05), x - Math.sign(x) * 0.04, GY + h + 0.0, z - Math.sign(z) * 0.14, { ry: Math.atan2(x, z) + Math.PI });
  if (!c.isNear(x, z)) c.blob(x + 0.2, z - 0.1, 0.3, 0.3, 0.5);
  if (o?.spot) c.lampSpots.push(new THREE.Vector3(x, h, z));
}
export function buildAirport(c) {
  const H = c.H, R = H + 15, TX = (x) => x;
  const base = (x, z, col) => {
    const d = Math.max(Math.abs(x), Math.abs(z)) - R, g = smooth(-2, 3, d + fbm(x * 0.12, z * 0.12, 4) * 4), k = fbm(x * 0.1, z * 0.1, 6);
    col.set('#a89a96').lerp(_c.set('#b9aba4'), smooth(0.4, 0.7, k)).lerp(_d.set('#9a8c8c'), smooth(0.3, 0.1, k) * 0.7);
    if (g > 0) col.lerp(_c.set('#b3ae50'), g);
  };
  const rz = -(H + 9.2);
  c.buildGround({
    base, farBase: (x, z, col) => col.set('#a9a650'), farTint: '#9a9f50', hill: 0.8,
    paint(P) {
      for (let i = 0; i < 26; i++) P.blot(c.rr(-R, R), c.rr(-R, R), c.rr(2, 5), c.pick(['#8f8380', '#b8aaa2', '#a29490']), 0.25);
      for (let i = 0; i < 40; i++) { const x = c.rr(-R, R), z = c.rr(-R, R); P.line([[x, z], [x + c.rr(-1, 1), z + c.rr(-1, 1)], [x + c.rr(-2, 2), z + c.rr(-2, 2)]], 0.025, '#6e5f5a', { a: 0.3 }); }
      P.rect(-EXT, rz - 3.2, EXT, rz + 3.2, '#8a7f84', 0); P.line([[-EXT, rz], [EXT, rz]], 0.18, '#d8cfc4', { dash: [1.4, 1.2], cap: 'butt' });
      P.line([[-EXT, rz - 2.9], [EXT, rz - 2.9]], 0.12, '#d8cfc4', { cap: 'butt' }); P.line([[-EXT, rz + 2.9], [EXT, rz + 2.9]], 0.12, '#d8cfc4', { cap: 'butt' });
      for (let i = 0; i < 6; i++) P.rect(-EXT + 3, rz - 2.4 + i * 0.8, -EXT + 5.5, rz - 2.0 + i * 0.8, '#d8cfc4', 0.02);
      const S = H + 2.5; // safety ring + taxi lines
      P.rect(-S, -S, S, S, '#d8cfc4', 0.5, 0); P.line([[-S, -S], [S, -S], [S, S], [-S, S], [-S, -S]], 0.1, '#e8c04a', { dash: [0.5, 0.35], cap: 'butt' });
      P.line([[-EXT, H + 7.5], [EXT, H + 7.5]], 0.14, '#e8c04a', { cap: 'butt' });
      P.line([[H + 5, -EXT], [H + 5, EXT]], 0.14, '#e8c04a', { cap: 'butt' });
      P.circ(-(H + 9), H + 11, 2.2, '#8a7f84'); P.line([[-(H + 9), H + 9.4], [-(H + 9), H + 12.6]], 0.3, '#d8cfc4'); P.line([[-(H + 10.1), H + 11], [-(H + 7.9), H + 11]], 0.3, '#d8cfc4', { a: 0 });
      P.ell(H + 4.2, -3, 2.0, 2.6, '#8f8380', 0.45); P.ell(-(H + 4.2), -(H + 2.6), 2.0, 1.4, '#8f8380', 0.45);
      for (let i = 0; i < 16; i++) P.blot(c.rr(-(H + 7), H + 7), c.rr(-(H + 7), H + 6), c.rr(0.8, 1.8), c.pick(['#c2b5ae', '#8f8380', '#b0a29c', '#a5a07a']), 0.3);
      const hz = (x0, z0, x1, z1) => { for (let t = 0; t < 14; t++) { const u = t / 14; P.line([[x0 + (x1 - x0) * u, z0], [x0 + (x1 - x0) * u + 0.35, z1]], 0.16, t % 2 ? '#e8c04a' : '#6a606c', { cap: 'butt' }); } };
      hz(H + 2.6, H * 0.35, H + 4.6, H * 0.35 + 1.0); hz(-(H + 4.6), -(H * 0.6) - 1.4, -(H + 2.6), -(H * 0.6) - 0.4); // hatched keep-clear areas
      P.circ(-(H + 3.8), H + 3.4, 1.5, '#8a7f84', 0.9); P.line([[-(H + 3.8) - 0.45, H + 3.4 - 0.7], [-(H + 3.8) - 0.45, H + 3.4 + 0.7]], 0.2, '#e8d58a'); P.line([[-(H + 3.8) + 0.45, H + 3.4 - 0.7], [-(H + 3.8) + 0.45, H + 3.4 + 0.7]], 0.2, '#e8d58a'); P.line([[-(H + 3.8) - 0.45, H + 3.4], [-(H + 3.8) + 0.45, H + 3.4]], 0.2, '#e8d58a'); // helipad
      P.line([[H * 0.2, -(H + 1.6)], [H * 0.2, H + 9]], 0.12, '#e8c04a', { a: 0.9 }); P.line([[-(H + 7), -(H * 0.1)], [H + 8, -(H * 0.1)]], 0.0, '#e8c04a', { a: 0 });
    },
  });
  c.claimRect(-EXT, rz - 3.5, EXT, rz + 3.5);
  // terminal (north), long low building with glowing glass, right behind the board
  const tz = -(H + 3.9), TW = H + 10;
  c.box(-1.5, GY, tz, TW * 2 - 3.0, 1.6, 2.6, '#e8d4b8', { r: 0.14, top: '#f4e6cc' }); c.box(-1.5, GY + 1.45, tz + 0.4, TW * 2 - 2.4, 0.18, 3.4, PAL.coral, { r: 0.05 });
  for (let x = -TW + 1.2; x < TW - 3.2; x += 1.7) c.gbox('winC', x, GY + 0.35, tz + 1.32, 1.2, 0.8, 0.06);
  c.box(-TW * 0.3, GY + 1.6, tz - 0.3, 3.2, 0.7, 1.6, '#e8d4b8', { plain: true });
  c.claimRect(-TW, tz - 1.8, TW, tz + 2.0);
  // control tower, back right corner
  const tx = H + 3.5, tzz = -(H + 3.5), T = frame(c, tx, tzz, 0, 0.5);
  T.cyl(0, GY, 0, 0.62, 0.8, 4.0, '#f4efe8', { seg: 12, top: '#ffffff' }); T.cyl(0, GY + 3.8, 0, 1.2, 0.75, 0.35, PAL.coral, { seg: 12, grad: 0 });
  T.glow('winC', CYL(1.24, 1.24, 0.6, 12), 0, GY + 4.3, 0); T.cyl(0, GY + 4.6, 0, 1.4, 1.2, 0.14, '#4a4560', { seg: 12, grad: 0 });
  T.cyl(0, GY + 4.7, 0, 0.04, 0.05, 0.9, '#4a4560', { seg: 5, grad: 0 }); T.glow('red', SPH(0.09, 6, 5), 0, GY + 5.65, 0);
  c.claim(tx, tzz, 1.4); c.blob(tx + 0.4, tzz - 0.3, 1.0, 0.8, 0.5);
  jet(c, H + 4.0, -(H * 0.3) - 0.9, 0, 0.62); c.claim(H + 4.0, -(H * 0.3) - 0.9, 2.2);
  prop(c, -(H + 3.4), -H * 0.45, Math.PI / 2 + 0.3, 0.7); c.claim(-(H + 3.4), -H * 0.45, 1.5);
  cartTrain(c, -(H + 2.4), H * 0.3, Math.PI / 2);
  for (let i = 0; i < 9; i++) cone(c, -(H + 1.7) + i * 0.5, H + 2.3);
  for (let i = 0; i < 4; i++) cone(c, H + 2.0, -(H * 0.5) + i * 0.55 + 2.0);
  c.cyl(-(H + 5.0), GY, H + 2.0, 0.04, 0.05, 1.0, '#d8cfc4', { seg: 5, grad: 0 }); c.cone(-(H + 4.9), GY + 0.75, H + 2.0, 0.14, 0.7, PAL.coral, { seg: 8, rot: [0, 0, -Math.PI / 2], dy: 0.0 });
  crate(c, H + 2.6, H + 1.6, 0.3, 0.45, PAL.sky); crate(c, -(H + 1.7), -(H + 1.6), 0.2, 0.45, PAL.sun); crate(c, -(H + 1.7), -(H + 2.1), 0.5, 0.4, PAL.sky);
  for (const q of [[H + 2.6, H + 1.6], [-(H + 1.7), -(H + 1.7)]]) c.claim(q[0], q[1], 0.7);
  planter(c, H + 2.2, -H * 0.9, Math.PI / 2, 0.8); planter(c, -(H + 2.2), H * 0.8, Math.PI / 2, 0.8); planter(c, H + 2.2, H * 0.7, Math.PI / 2, 0.8); bin(c, -(H + 1.7), -H * 0.9);
  // taxiway edge lights around the apron
  for (let i = 0; i <= 2 * H + 5; i++) { const t = -(H + 2.5) + i; for (const [x, z] of [[t, -(H + 2.5)], [t, H + 2.5], [-(H + 2.5), t], [H + 2.5, t]]) c.gbox('lamp', x, GY + 0.0, z, 0.1, 0.06, 0.1); }
  cornerLamps(c, (cc, x, z, o) => flood(cc, x, z, o), 1.5);
  const T2 = traffic(c); T2.mover('van', 'x', H + 4.0, 1, 1.8, -EXT - 1, EXT + 1, PAL.sun); T2.mover('car', 'x', H + 4.7, -1, 1.4, -EXT - 1, EXT + 1, PAL.coral); T2.finish();
  ringTrees(c, ['round', 'tall'], 3, { s0: 0.6, s1: 0.8 });
  c.scatter(14, 3.0, 22, (x, z) => c.tree(c.pick(['round', 'tall']), x, z, c.rr(0.8, 1.1)), { r: 1.0, tall: true, area: (x, z) => Math.max(Math.abs(x), Math.abs(z)) > R - 1 });
  c.scatter(12, 3, 22, (x, z) => c.tuft(x, z, c.rr(0.8, 1.2)), { r: 0.3, area: (x, z) => Math.max(Math.abs(x), Math.abs(z)) > R });
  const pts = []; for (let i = 0; i < 4; i++) pts.push([c.rr(-12, 12), c.rr(-14, 0)]);
  fliers(c, 'bird', pts, ['#fff8ea', '#e8e0f0'], { rad: 9, h: 5, speed: 0.8 });
}
