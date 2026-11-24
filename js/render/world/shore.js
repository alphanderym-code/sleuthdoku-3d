// Coast (beach, sea, pier, lighthouse) and sea (ship deck on open water) worlds.
import * as THREE from 'three';
import { GY, WY, EXT, PAL, fbm, smooth, lerpHex } from './ctx.js';
import { CYL, SPH, BOX, CONE, CAPS, TOR, softMat, canvasTex } from '../models/kit.js';
import { lamp, cornerLamps, house, fliers, frame, crate, bin } from './props.js';
import { ringSpots, ringK } from './ring.js';

const SAND = '#e8cd96', SAND_D = '#d6b97c', SAND_L = '#f0dcab';
const sandAt = (x, z, c) => { const k = fbm(x * 0.12, z * 0.12, 2); c.set(SAND_D).lerp(new THREE.Color(SAND), smooth(0.3, 0.55, k)).lerp(new THREE.Color(SAND_L), smooth(0.55, 0.85, k)); };

function sailboat(c, x, z, ry, hull = '#ee6a5a') {
  const P = [c.mk(CAPS(0.3, 0.9, 4, 8), 0, 0.12, 0, hull, { rot: [Math.PI / 2, 0, 0], s: [1, 1, 0.55], top: lerpHex(hull, '#ffffff', 0.3) }),
    c.mk(CYL(0.035, 0.04, 1.8, 5), 0, 1.0, 0.05, PAL.woodD), c.mk(BOX(0.04, 1.4, 0.9), 0, 1.05, -0.4, '#fff8ea', { grad: 0 }), c.mk(BOX(0.04, 0.9, 0.5), 0, 0.8, 0.5, PAL.sun, { rot: [0, 0, 0], grad: 0 })];
  c.bobber(P, x, WY + 0.05, z, { ry, amp: 0.04, drift: 2.5, speed: 0.8 });
}
function buoy(c, x, z) {
  c.bobber([c.mk(SPH(0.28, 8, 6), 0, 0.1, 0, PAL.coral, { s: [1, 0.9, 1] }), c.mk(CYL(0.29, 0.29, 0.12, 8), 0, 0.12, 0, '#fff8ea', { grad: 0 }), c.mk(CONE(0.14, 0.4, 6), 0, 0.5, 0, PAL.coral)], x, WY + 0.04, z, { amp: 0.06, speed: 1.2 });
}
function islands(c, n, dmin, dmax, north = false) {
  for (let i = 0; i < n; i++) {
    const a = c.rr(-2.8, -0.35) + (i % 2 && !north ? 3.1 : 0), d = c.rr(dmin, dmax), x = Math.cos(a) * d, z = Math.sin(a) * d, r = c.rr(3, 6);
    c.p(SPH(1, 12, 8), x, WY - 0.2, z, '#e6cc94', { s: [r, r * 0.35, r], far: true, grad: 0 });
    c.p(SPH(1, 10, 7), x, WY + 0.1, z, '#9fbf4a', { s: [r * 0.78, r * 0.34, r * 0.78], far: true, top: '#c9d15a' });
    c.cone(x + r * 0.2, WY + r * 0.2, z, r * 0.3, r * 0.7, '#3f8a56', { far: true, seg: 7 });
    c.cone(x - r * 0.25, WY + r * 0.2, z + r * 0.1, r * 0.22, r * 0.55, '#3f8a56', { far: true, seg: 7 });
  }
}
function gulls(c, n) { const pts = []; for (let i = 0; i < n; i++) pts.push([c.rr(-14, 14) + c.H * 0.6, c.rr(-14, 8)]); fliers(c, 'bird', pts, ['#fff8ea', '#f3efe4'], { rad: 7, h: 4.2, speed: 0.8 }); }

// ---------------------------------------------------------------------------------------------------------------- COAST
export function buildCoast(c) {
  // The sea lies BEHIND the board (north), so boats, pier and lighthouse show above the board at the default camera.
  const H = c.H, cz = (x) => -(H + 2.3) + 0.3 * Math.sin(x * 0.45) + 0.25 * Math.sin(x * 1.1 + 1);
  const sea = []; for (let x = -EXT; x <= EXT; x += 2.5) sea.push([x, cz(x)]);
  sea.push([EXT, -EXT], [-EXT, -EXT]);
  const baseF = (x, z, col) => { sandAt(x, z, col); const g = smooth(H + 9, H + 20, z); if (g > 0) col.lerp(_g.set('#a9a850'), g * 0.9); };
  const towels = [[-(H + 3.3), H * 0.2, 0.3], [-(H + 4.4), -H * 0.35, -0.2], [H + 3.3, H * 0.4, 0.1], [H + 4.3, -H * 0.15, 0.4], [-(H + 3.0), H + 2.2, 0.2], [H * 0.6, H + 2.8, 0.0]];
  c.buildGround({
    base: baseF, farBase: baseF, farTint: '#a8a850', hill: 0.6, holes: [sea],
    isWater: (x, z) => z < cz(x) - 1,
    water: { color: '#3fc0c8', golden: '#4fb7b0', night: '#2f55a8', deep: '#2a8fb8', size: 400 },
    paint(P) {
      for (let i = 0; i < 30; i++) P.blot(c.rr(-EXT, EXT), c.rr(-EXT, EXT), c.rr(2, 5), c.pick([SAND_L, SAND_D, '#cfb274']), 0.25);
      for (let i = 0; i < 18; i++) P.blot(c.rr(-(H + 7), H + 7), c.rr(-(H + 6), H + 6), c.rr(0.8, 1.6), c.pick([SAND_L, '#cfb274', '#dcc58c']), 0.35);
      const pts = sea.slice(0, -2).map(([x, z]) => [x, z + 0.55]); // wet sand band along the shoreline
      P.line(pts, 1.5, '#b9a06a', { a: 0.55 }); P.line(pts.map(([x, z]) => [x, z + 0.55]), 0.9, '#cdb27a', { a: 0.5 });
      const S = H + 1.5; // boardwalk ring
      P.rect(-S - 0.1, -S - 0.1, S + 0.1, S + 0.1, '#9d6f45', 0.35);
      P.rect(-S, -S, S, S, '#c99a65', 0.3);
      for (let x = -S + 0.4; x < S; x += 0.4) P.line([[x, -S + 0.1], [x, S - 0.1]], 0.03, '#a77a4d', { a: 0.7, cap: 'butt' });
      for (const [tx, tz, r] of towels) { const col = c.pick(['#e08a78', '#8fc4dc', '#e6c15c', '#f0e4cc']); P.rect(tx - 0.4, tz - 0.8, tx + 0.4, tz + 0.8, col, 0.08, 0.95); P.rect(tx - 0.4, tz - 0.25, tx + 0.4, tz - 0.05, '#ffffff', 0.02, 0.6); }
      P.line([[-(H + 2.4), H * 0.9], [-(H + 4.4), H * 0.3], [-(H + 3.4), -H * 0.6]], 0.5, '#cfb274', { a: 0.6 });
    },
  });
  c.claimRect(-(H + 1.9), -(H + 1.9), H + 1.9, H + 1.9); c.claimRect(-EXT, -EXT, EXT, cz(0) - 0.2);
  for (const [tx, tz] of towels) c.claim(tx, tz, 0.9);
  // pier running out to sea behind the board
  const pxx = H * 0.45 + 0.3, pz0 = -(H + 1.5), pz1 = -(H + 11);
  for (let z = pz0; z > pz1; z -= 0.28) c.box(pxx, GY + 0.0, z, 1.4, 0.08, 0.24, ((z / 0.28) | 0) % 2 ? '#c99a65' : '#d6a870', { plain: true, grad: 0 });
  for (let z = pz0 - 0.5; z > pz1; z -= 1.8) for (const s of [-0.65, 0.65]) c.cyl(pxx + s, WY - 0.3, z, 0.09, 0.09, GY + 0.1 - WY + 0.3, PAL.woodD, { seg: 6 });
  lamp(c, pxx + 0.65, pz1 + 0.4, { h: 1.1 }); lamp(c, pxx - 0.65, -(H + 3.4), { h: 1.1 });
  c.claimRect(pxx - 1, pz1, pxx + 1, pz0);
  sailboat(c, pxx - 2.8, -(H + 3.6), 0.1); sailboat(c, -H * 0.5, -(H + 4.8), -0.15, PAL.sky); sailboat(c, pxx + 3.0, -(H + 5.6), 0.3, PAL.sun);
  c.bobber([c.mk(CAPS(0.3, 0.8, 4, 8), 0, 0.05, 0, '#f6c445', { rot: [0, 0, Math.PI / 2], s: [1, 0.55, 1] })], pxx - 1.5, WY + 0.04, -(H + 3.0), { amp: 0.03 });
  for (const [bx, bz] of [[-H * 0.2, -(H + 3.4)], [pxx + 2, -(H + 3.9)], [-(H + 3.2), -(H + 4.2)]]) buoy(c, bx, bz);
  // lighthouse on rocks, back left corner (scaled to fit under 3 high)
  const lx = -(H + 2.6), lz = -(H + 3.5), L = frame(c, lx, lz, 0, 0.62);
  c.rock(lx, lz, 1.9, GY - 0.2, '#c9c0cc'); c.rock(lx + 1.1, lz + 0.5, 0.9, GY - 0.1); c.rock(lx - 1.0, lz + 0.7, 0.7, GY - 0.1);
  for (let i = 0; i < 4; i++) L.cyl(0, GY + 0.4 + i * 0.85, 0, 0.78 - i * 0.07, 0.82 - i * 0.07, 0.85, i % 2 ? '#e8504a' : '#fff3e4', { seg: 12, grad: 0.1 });
  L.cyl(0, GY + 3.8, 0, 0.78, 0.78, 0.1, PAL.stone, { seg: 12 }); L.cyl(0, GY + 3.9, 0, 0.42, 0.42, 0.55, '#bfe9f2', { seg: 10 });
  L.glow('lamp', SPH(0.33, 10, 8), 0, GY + 4.18, 0); L.cone(0, GY + 4.45, 0, 0.56, 0.5, '#e8504a', { seg: 12 });
  L.gbox('win', 0, GY + 1.5, 0.72, 0.2, 0.3, 0.06);
  c.claim(lx, lz, 1.9); c.blob(lx + 0.6, lz - 0.4, 1.5, 1.2, 0.5);
  // beach life: parasols, hut, palms, rocks
  const para = (x, z, col) => { c.cyl(x, GY, z, 0.04, 0.04, 1.2, '#f4ead4', { seg: 5, grad: 0 }); c.cone(x, GY + 1.0, z, 0.8, 0.38, col, { seg: 10, top: lerpHex(col, '#ffffff', 0.4) }); c.sph(x, GY + 1.4, z, 0.06, '#f4ead4', { ws: 5, hs: 4 }); c.blob(x + 0.5, z - 0.4, 0.8, 0.7, 0.45); };
  [[-(H + 3.3), H * 0.2 - 0.9], [-(H + 4.4), -H * 0.35 + 1.0], [H + 3.3, H * 0.4 - 0.9], [H + 4.3, -H * 0.15 + 1.0]].forEach(([x, z], i) => { para(x, z, [PAL.coral, PAL.sky, PAL.sun, PAL.teal][i % 4]); c.claim(x, z, 0.8); });
  house(c, H + 3.4, -(H + 2.2), { w: 2.0, d: 1.6, h: 1.3, wall: '#bfe6e6', roof: PAL.coral, shop: true, awning: PAL.sun, barrel: true }); c.claim(H + 3.4, -(H + 2.2), 1.4);
  crate(c, H + 1.9, -(H + 1.8), 0.3, 0.38); bin(c, -(H + 1.9), -(H + 1.3));
  cornerLamps(c, (cc, x, z, o) => lamp(cc, x, z, o), 1.4);
  c.tree('palm', -(H + 4.6), -(H + 1.2), 0.8); c.tree('palm', H + 4.8, -(H + 1.6), 0.85); c.tree('palm', H + 5.0, H * 0.7, 0.6);
  ringSpots(c, Math.round(7 * ringK(H)), (x, z) => c.rock(x, z, c.rr(0.3, 0.6)), { r: 0.45, ok: (x, z) => z > cz(x) + 0.5 });
  ringSpots(c, Math.round(5 * ringK(H)), (x, z) => c.bush(c.pick(['grass', 'round']), x, z, c.rr(0.5, 0.8)), { r: 0.5, ok: (x, z) => z > cz(x) + 0.5 });
  ringSpots(c, Math.round(40 * ringK(H)), (x, z) => c.tuft(x, z, c.rr(0.8, 1.2)), { r: 0.3, ok: (x, z) => z > cz(x) + 0.5, reach: 7 });
  ringSpots(c, Math.round(10 * ringK(H)), (x, z) => c.flower(x, z, c.pick(['#ffffff', PAL.coral, PAL.sun]), c.rr(0.9, 1.2)), { r: 0.3, ok: (x, z) => z > cz(x) + 0.5 });
  c.scatter(8, 7, 18, (x, z) => c.tree('palm', x, z, c.rr(0.9, 1.25)), { r: 1.0, tall: true, area: (x, z) => z > cz(x) + 1.5 });
  c.scatter(14, 7, 22, (x, z) => c.tuft(x, z, c.rr(0.8, 1.2)), { r: 0.3, area: (x, z) => z > cz(x) + 1 });
  for (let i = 0; i < 6; i++) buoy(c, c.rr(-16, 16), cz(0) - c.rr(6, 18));
  sailboat(c, 10, cz(0) - 12, 0.6, PAL.plum); sailboat(c, -12, cz(0) - 16, 2.4, PAL.sun);
  islands(c, 3, 34, 55, true); gulls(c, 5);
}

// ------------------------------------------------------------------------------------------------------------------- SEA
let _plank = null;
function plankMat() {
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = '#d9a868'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#d1a060' : '#e0b074'; g.fillRect(0, i * 32, 256, 30); g.fillStyle = '#a97b48'; g.fillRect(0, i * 32 + 30, 256, 2); g.fillRect((i * 83) % 256, i * 32, 2, 30); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return softMat({ map: t, roughness: 0.9 });
}
export function buildSea(c) {
  const H = c.H, W = H + 2.7, zS = H + 2.6, zN = -(H + 3.2);
  // clean closed outline: right side from stern to bow, then left side back
  const right = [[W - 1.3, zS], [W - 0.4, zS - 0.4], [W, zS - 1.3], [W, zN + 2], [W - 0.3, zN - 0.2], [W * 0.82, zN - 1.8], [W * 0.5, zN - 3.4], [W * 0.2, zN - 4.3], [0, zN - 4.7]];
  const left = right.slice(0, -1).reverse().map(([x, z]) => [-x, z]);
  const poly = right.concat(left);
  c.buildGround({ noLand: true, water: { color: '#3db6d2', golden: '#4eb2b8', night: '#2c4ba2', deep: '#1f7fb4', size: 420 } });
  const G = c.group, DK = GY;
  // deck
  const shape = new THREE.Shape(); poly.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z))); shape.closePath();
  const dg = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), dp = dg.attributes.position, uv = dg.attributes.uv;
  for (let i = 0; i < dp.count; i++) uv.setXY(i, dp.getX(i) / 8, dp.getZ(i) / 8);
  dg.translate(0, DK, 0);
  const deck = new THREE.Mesh(dg, plankMat()); deck.receiveShadow = true; G.add(deck);
  // hull sides (white, red band, navy)
  const rows = [[DK, '#fff8ea'], [DK - 0.24, '#fff8ea'], [DK - 0.24, '#e8504a'], [DK - 0.4, '#e8504a'], [DK - 0.4, '#2f3f78'], [WY - 0.4, '#2f3f78']];
  const pos = [], col = [], idx = [], cc = new THREE.Color();
  poly.forEach(([x, z]) => rows.forEach(([y, h]) => { pos.push(x, y, z); cc.set(h); col.push(cc.r, cc.g, cc.b); }));
  const n = poly.length, R = rows.length;
  for (let i = 0; i < n; i++) for (let r = 0; r < R - 1; r++) { const a = i * R + r, b = ((i + 1) % n) * R + r; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); hg.setIndex(idx); hg.computeVertexNormals();
  const hull = new THREE.Mesh(hg, softMat({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 })); hull.receiveShadow = true; G.add(hull);
  c._shores([poly.slice().reverse()], { outward: true, walls: false });
  // rail: posts + bars, inset from the edge
  const inset = poly.map(([x, z]) => { const k = 0.2; return [x - Math.sign(x) * k * (Math.abs(x) > 0.3 ? 1 : 0), z - (z > 0 ? k : 0)]; });
  for (let i = 0; i < inset.length; i++) {
    const a = inset[i], b = inset[(i + 1) % inset.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(L / 0.9)), ry = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    for (let j = 0; j < k; j++) c.cyl(a[0] + (b[0] - a[0]) * j / k, DK, a[1] + (b[1] - a[1]) * j / k, 0.05, 0.06, 0.55, '#fff8ea', { seg: 6, grad: 0.05 });
    c.box((a[0] + b[0]) / 2, DK + 0.5, (a[1] + b[1]) / 2, L, 0.07, 0.07, '#fff8ea', { ry, plain: true, grad: 0 });
    c.box((a[0] + b[0]) / 2, DK + 0.25, (a[1] + b[1]) / 2, L, 0.04, 0.04, '#fff8ea', { ry, plain: true, grad: 0 });
  }
  for (const [x, z] of [[W - 0.25, 0], [-W + 0.25, 2], [W - 0.25, -H * 0.8], [-W + 0.25, -H * 0.9]]) { c.p(TOR(0.2, 0.07, 6, 12), x, DK + 0.3, z, '#e8504a', { rot: [0, Math.PI / 2, 0], grad: 0 }); }
  // funnel, mast, lifeboat, deck chairs, crates
  const fz = zN - 1.1;
  c.cyl(0, DK, fz, 0.95, 1.1, 2.7, PAL.teal, { seg: 16, top: '#4fc0b8' }); c.cyl(0, DK + 2.0, fz, 0.98, 0.98, 0.36, '#e8504a', { seg: 16, grad: 0 }); c.cyl(0, DK + 2.7, fz, 1.05, 0.95, 0.12, '#2e2a45', { seg: 16, grad: 0 });
  c.cyl(-1.5, DK, fz + 0.3, 0.26, 0.3, 1.4, '#fff8ea', { seg: 10 }); c.cyl(1.5, DK, fz + 0.3, 0.26, 0.3, 1.4, '#fff8ea', { seg: 10 });
  c.claim(0, fz, 3);
  c.cyl(0, DK, zN - 2.8, 0.07, 0.09, 2.6, PAL.woodD, { seg: 6 }); c.box(0.45, DK + 2.0, zN - 2.8, 0.9, 0.45, 0.04, PAL.coral, { plain: true });
  const lb = frame(c, -W + 1.0, -H * 0.2, Math.PI / 2);
  lb.p(CAPS(0.34, 1.5, 4, 8), 0, DK + 0.4, 0, '#fff8ea', { rot: [Math.PI / 2, 0, 0], s: [1, 1, 0.6], top: '#ffffff' }); lb.p(CAPS(0.3, 1.3, 4, 8), 0, DK + 0.48, 0, '#ee8a3a', { rot: [Math.PI / 2, 0, 0], s: [0.95, 1, 0.4], grad: 0 });
  for (const [x, z, ry] of [[W - 1.2, -H * 0.5, 0], [W - 1.2, H * 0.1, 0.1], [-W + 1.3, H * 0.55, 0], [W - 1.3, H * 0.65, 0.2]]) { // loungers
    const F = frame(c, x, z, ry); F.box(0, DK + 0.1, 0, 0.5, 0.1, 1.1, PAL.sky, { plain: true }); F.box(0, DK + 0.18, -0.55, 0.5, 0.08, 0.5, PAL.sky, { rot: [-0.7, 0, 0], plain: true }); F.box(-0.2, DK, 0.2, 0.06, 0.12, 0.06, PAL.woodD, { plain: true }); F.box(0.2, DK, 0.2, 0.06, 0.12, 0.06, PAL.woodD, { plain: true });
  }
  crate(c, W - 0.9, H + 1.9, 0.2); crate(c, -W + 0.9, H + 2.0, 0.6, 0.4); bin(c, W - 0.8, H + 1.0);
  cornerLamps(c, (cc, x, z, o) => lamp(cc, x, z, o), 1.45);
  // sea life
  for (let i = 0; i < 10; i++) { const a = c.r() * 6.28, d = c.rr(5, 24), x = Math.cos(a) * d * 1.2, z = Math.sin(a) * d - 1; if (Math.abs(x) < W + 0.9 && z > zN - 1.5 && z < zS + 0.9) continue; buoy(c, x, z); }
  sailboat(c, -(W + 2.2), 1.5, 0.5); sailboat(c, W + 2.4, -H * 0.6, 2.6, PAL.sun); sailboat(c, W + 4.2, H * 0.5, 1.2, PAL.teal); sailboat(c, -(W + 4.5), -H - 2, 0.2, PAL.plum); sailboat(c, -(W + 12), 8, 0.5); sailboat(c, W + 14, -8, 2.6, PAL.sky);
  islands(c, 5, 36, 62); gulls(c, 6);
}
const _g = new THREE.Color();
