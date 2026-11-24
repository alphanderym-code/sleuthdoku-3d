// Park, farm and forest worlds. Set pieces live inside the ring the player sees (see ring.js).
import { GY, WY, EXT, PAL, lawnBase, organicPoly, scaledPoly } from './ctx.js';
import { CYL, SPH, BOX, CONE, CAPS } from '../models/kit.js';
import { lamp, cornerLamps, bench, bin, fence, hedgeRow, fliers, drifters, frame, lantern, traffic, crate } from './props.js';
import { ringFill, ringTrees, soil } from './ring.js';

const FLOWERS = [PAL.coral, PAL.sun, '#ffffff', '#ff9ec0', PAL.sky, '#c08ae0'];

function bed(P, x, z, w, d) { // painted flower bed
  P.rect(x - w / 2 - 0.12, z - d / 2 - 0.12, x + w / 2 + 0.12, z + d / 2 + 0.12, '#e9d2a8', 0.3);
  P.rect(x - w / 2, z - d / 2, x + w / 2, z + d / 2, '#b98862', 0.25);
}
function bedFlowers(c, x, z, w, d, n, cols) {
  for (let i = 0; i < n; i++) c.flower(x + c.rr(-w / 2 + 0.15, w / 2 - 0.15), z + c.rr(-d / 2 + 0.15, d / 2 - 0.15), cols[i % cols.length], c.rr(1.0, 1.5));
}
function butterflies(c, n, cols, dmin = 3, dmax = 12) {
  const pts = []; for (let i = 0; i < n; i++) { const a = c.r() * 6.28, d = c.rr(c.H + dmin, c.H + dmax); pts.push([Math.cos(a) * d, Math.sin(a) * d]); }
  fliers(c, 'bf', pts, cols, { rad: 1.8, h: 0.9 });
}
function duck(c, x, z, ry) {
  const parts = [
    c.mk(SPH(0.16, 8, 6), 0, 0.07, 0, '#fff6e0', { s: [1, 0.75, 1.4], top: '#ffffff' }), c.mk(SPH(0.095, 7, 5), 0, 0.2, 0.16, '#3f8f62'),
    c.mk(BOX(0.07, 0.035, 0.08), 0, 0.19, 0.27, '#ffb23a', { grad: 0 }), c.mk(SPH(0.07, 6, 5), 0, 0.12, -0.2, '#e8dcc0', { s: [1, 0.8, 1.2] }),
  ];
  c.bobber(parts, x, WY + 0.05, z, { ry, amp: 0.012, speed: 1.4, drift: 0.35 });
}
function pad(c, x, z, r = 0.28) { c.cyl(x, WY + 0.01, z, r, r, 0.03, '#86a851', { seg: 8, grad: 0 }); }

// ---------------------------------------------------------------------------------------------------------------- PARK
export function buildPark(c) {
  const H = c.H;
  const px = -(H + 4.7), pz = 0.6;
  const pond = organicPoly(px, pz, 2.0, 2.6, 22, 0.1, c.r() * 9);
  const bz = -(H + 3.6), gx = -H * 0.55, gk = 0.72, fx = H * 0.62 + 0.4, fk = 0.66, pathZ = -(H + 1.55);
  const path = [[-EXT - 1, H + 9], [-(H + 8), H + 5.5], [-(H + 3), H + 3.2], [0, H + 3.5], [H + 3, H + 3.2], [H + 3.3, 0], [H + 3.1, pathZ], [H * 0.3, pathZ], [-(H + 3), pathZ], [-(H + 8), -(H + 3)], [-EXT - 1, -(H + 6)]];
  const beds = [[H + 1.9, -H * 0.55, 0.8, 2.2], [H + 1.9, H * 0.45, 0.8, 1.8], [-H * 0.35, H + 1.9, 2.2, 0.7], [H * 0.45, H + 1.9, 1.8, 0.7]];
  const blx = -(H + 3.4), blz = H + 1.9; // picnic blanket
  c.buildGround({
    base: lawnBase(c.r() * 40, {}),
    holes: [pond],
    water: { color: '#4cc3bc', golden: '#58bda8', night: '#3a5db0', size: 90 },
    farBase: lawnBase(7),
    paint(P) {
      for (let i = 0; i < 30; i++) P.blot(c.rr(-EXT, EXT), c.rr(-EXT, EXT), c.rr(2.5, 6), c.pick([PAL.lawnL, PAL.lawnD, '#a8a64e']), 0.22);
      for (let i = 0; i < 16; i++) P.blot(c.rr(-(H + 7), H + 7), c.rr(-(H + 7), H + 6), c.rr(0.9, 1.8), c.pick([PAL.lawnL, PAL.lawnD, '#c9bf62']), 0.3);
      P.poly(scaledPoly(pond, 1.2), '#d9bd8a', 0.9);
      P.line(path, 1.9, '#c4a572', { cap: 'round' }); P.line(path, 1.5, '#dcbf8f');
      P.circ(fx, bz + 0.2, 2.3, '#c4a572'); P.circ(fx, bz + 0.2, 2.05, '#dcbf8f');
      P.circ(gx, bz + 0.2, 1.7, '#c4a572'); P.circ(gx, bz + 0.2, 1.5, '#dcbf8f');
      for (const b of beds) bed(P, ...b);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) P.rect(blx + i * 0.4 - 1.2, blz + j * 0.4 - 1, blx + i * 0.4 - 0.8, blz + j * 0.4 - 0.6, (i + j) % 2 ? '#fff3dc' : PAL.coral, 0.02);
    },
  });
  c.claim(px, pz, 3.2);
  for (let i = 0; i < 7; i++) pad(c, px + c.rr(-1.5, 1.5), pz + c.rr(-2, 2));
  for (const [dx, dz] of [[-0.6, -0.8], [0.5, 0.5], [-0.2, 1.5]]) duck(c, px + dx, pz + dz, c.r() * 6.28);
  const F = frame(c, fx, bz + 0.2, 0, fk); // fountain
  F.cyl(0, GY, 0, 2.1, 2.2, 0.38, PAL.cream, { seg: 20 }); F.cyl(0, GY + 0.3, 0, 1.85, 1.85, 0.07, '#58c8c0', { seg: 20, grad: 0 });
  F.cyl(0, GY + 0.3, 0, 0.3, 0.4, 0.9, PAL.cream, { seg: 10 }); F.sph(0, GY + 1.3, 0, 0.75, PAL.cream, { s: [1, 0.42, 1], ws: 14, hs: 8 });
  F.cyl(0, GY + 1.3, 0, 0.12, 0.16, 0.5, PAL.cream, { seg: 8 }); F.sph(0, GY + 1.95, 0, 0.26, '#bff0ee', { ws: 8, hs: 6, grad: 0 });
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; F.sph(Math.cos(a) * 1.0, GY + 0.45 + 0.1 * (i % 2), Math.sin(a) * 1.0, 0.08, '#e6fbfa', { ws: 5, hs: 4, grad: 0 }); }
  c.claim(fx, bz + 0.2, 2.3); c.blob(fx + 0.3, bz, 2.0, 1.8, 0.5);
  const Gz = frame(c, gx, bz + 0.2, 0, gk); // gazebo
  Gz.cyl(0, GY, 0, 1.75, 1.85, 0.2, '#f1e3c6', { seg: 8 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + 0.52; Gz.cyl(Math.cos(a) * 1.4, GY + 0.2, Math.sin(a) * 1.4, 0.08, 0.09, 1.55, PAL.cream, { seg: 7 }); }
  Gz.cone(0, GY + 1.7, 0, 2.15, 1.0, PAL.coral, { seg: 8, top: '#ff9a82' }); Gz.sph(0, GY + 2.75, 0, 0.14, PAL.sun, { ws: 6, hs: 5 });
  Gz.glow('lamp', SPH(0.14, 8, 6), 0, GY + 1.5, 0); Gz.box(0, GY + 0.2, 0.9, 0.9, 0.3, 0.3, PAL.wood, { plain: true });
  c.claim(gx, bz + 0.2, 1.9); c.blob(gx + 0.5, bz, 1.9, 1.7, 0.5);
  cornerLamps(c, (cc, x, z, o) => lamp(cc, x, z, o), 1.4);
  // benches facing the board on both sides, bins, lamps
  bench(c, H + 4.4, -H * 0.2, -Math.PI / 2); bin(c, H + 4.5, H * 0.3); bench(c, H + 4.4, H * 0.5 - 0.2, -Math.PI / 2);
  bench(c, -(H + 1.9), H * 0.55, Math.PI / 2); bin(c, -(H + 1.9), H * 0.55 + 0.9);
  bench(c, H * 0.1, H + 2.6, 0); lamp(c, -(H + 1.9), -(H + 0.9)); lamp(c, H + 4.2, -(H + 3)); lamp(c, H + 4.2, H + 1.3);
  hedgeRow(c, H + 5.5, -H * 0.9, H + 5.5, H * 0.9); hedgeRow(c, -(H + 5.9), -(H * 0.9) - 3, -(H + 5.9), -H - 0.4);
  c.box(blx, GY, blz - 0.2, 0.34, 0.3, 0.26, '#c88d55', { r: 0.05 }); c.sph(blx, GY + 0.3, blz - 0.2, 0.1, '#fff3dc');
  c.claim(blx, blz, 1.6);
  const sets = [FLOWERS.slice(0, 3), FLOWERS.slice(2, 5), FLOWERS.slice(1, 6)];
  for (const b of beds) { c.claim(b[0], b[1], Math.max(b[2], b[3]) * 0.6); bedFlowers(c, b[0], b[1], b[2], b[3], Math.round(b[2] * b[3] * 5) + 3, c.pick(sets)); }
  c.tree('cherry', gx - 1.9, bz + 0.6, 0.95); c.tree('cherry', fx + 2.2, bz + 0.6, 0.95); c.tree('cherry', -(H + 3.4), -(H + 3.2), 0.9);
  ringTrees(c, ['round', 'tall', 'cherry', 'round', 'autumn'], 9);
  ringFill(c, { bushes: ['round', 'flower', 'grass'], bushN: 20, tufts: 90, flowers: 36, cols: FLOWERS });
  const kinds = ['round', 'tall', 'cherry', 'round', 'autumn'];
  c.scatter(26, 6.4, 21, (x, z) => c.tree(c.pick(kinds), x, z, c.rr(0.85, 1.25)), { r: 1.3, tall: true });
  c.scatter(8, 6.2, 18, (x, z) => c.bush(c.pick(['round', 'flower', 'grass']), x, z, c.rr(0.8, 1.2)), { r: 0.5 });
  c.scatter(26, 6.2, 22, (x, z) => (c.r() < 0.5 ? c.tuft(x, z, c.rr(0.8, 1.3)) : c.flower(x, z, c.pick(FLOWERS), c.rr(0.9, 1.3))), { r: 0.25 });
  butterflies(c, 7, ['#ff9ec0', PAL.sun, '#ffffff', PAL.sky, PAL.coral, '#c08ae0'], 2, 7);
  drifters(c, 22, ['#ffc2d4', '#ffe0ea', '#ffffff'], { size: 0.12, fall: 0.22 });
}

// ---------------------------------------------------------------------------------------------------------------- FARM
function hayBale(c, x, z, ry = 0, big = false) {
  const r = big ? 0.5 : 0.38, l = big ? 0.8 : 0.6;
  c.p(CYL(r, r, l, 12), x, GY + r, z, '#e8c25a', { rot: [0, 0, Math.PI / 2], ry, top: '#f6dc84', grad: 0.1 });
  c.p(CYL(r * 1.01, r * 1.01, 0.07, 12), x, GY + r, z, '#c99a3a', { rot: [0, 0, Math.PI / 2], ry, grad: 0 });
}
function sheep(c, x, z, ry, wool = '#fffaf0') {
  const F = frame(c, x, z, ry);
  F.sph(0, GY + 0.36, 0, 0.3, wool, { s: [0.85, 0.8, 1.2], ws: 9, hs: 7, top: '#ffffff' }); F.sph(0, GY + 0.46, 0.38, 0.17, '#5b4a62', { ws: 7, hs: 6 });
  for (const sx of [-0.12, 0.12]) for (const sz of [-0.2, 0.2]) F.cyl(sx, GY, sz, 0.04, 0.04, 0.2, '#5b4a62', { seg: 5 });
}
function produce(c, x, z, ry, cols) { // wooden crate heaped with veg
  crate(c, x, z, ry, 0.5);
  for (let i = 0; i < 5; i++) c.sph(x + c.rr(-0.14, 0.14), GY + 0.52 + c.rr(0, 0.05), z + c.rr(-0.14, 0.14), 0.09, cols[i % cols.length], { ws: 6, hs: 5 });
}
export function buildFarm(c) {
  const H = c.H, bx = -H * 0.55, bz = -(H + 2.7), wx = H * 0.7 + 0.6, wz = -(H + 2.9), bk = 0.62, wk = 0.72;
  const fieldA = [-(H + 21), -(H + 2), -(H + 12), H + 9], fieldB = [H + 6.0, -(H + 1), H + 21, H + 11], fieldC = [-(H + 3.5), H + 4.6, H + 3.5, H + 11];
  const fieldR = [H + 1.4, -(H * 0.75), H + 5.0, H * 0.65];
  const road = [[EXT + 1, -(H + 3.5)], [H + 16, -(H + 3)], [H + 9.5, H * 0.3 - 3], [H + 6.2, H + 3.3], [H * 0.4, H + 3.8], [-(H + 8), H + 4.4], [-EXT - 1, H + 3.8]];
  const paddock = [-(H + 5.0), -H * 0.5, -(H + 1.6), H * 0.55];
  c.buildGround({
    base: lawnBase(c.r() * 40, { dark: '#8a9a4c', mid: '#b8b250', light: '#d0c468' }),
    paint(P) {
      for (let i = 0; i < 26; i++) P.blot(c.rr(-EXT, EXT), c.rr(-EXT, EXT), c.rr(2.5, 6), c.pick(['#d6cb68', PAL.lawnD, '#a8a64e']), 0.2);
      for (let i = 0; i < 14; i++) P.blot(c.rr(-(H + 7), H + 7), c.rr(-(H + 7), H + 6), c.rr(0.9, 1.7), c.pick(['#d6cb68', PAL.lawnD, '#c4a36c']), 0.3);
      const crop = (r, cols, dir, sp = 0.62) => {
        P.rect(r[0] - 0.25, r[1] - 0.25, r[2] + 0.25, r[3] + 0.25, '#b88d5e', 0.5); P.rect(r[0], r[1], r[2], r[3], cols[0], 0.35);
        if (dir === 'x') for (let z = r[1] + 0.3, i = 0; z < r[3] - 0.1; z += sp, i++) P.line([[r[0] + 0.25, z], [r[2] - 0.25, z]], 0.32, cols[1 + i % (cols.length - 1)]);
        else for (let x = r[0] + 0.3, i = 0; x < r[2] - 0.1; x += sp, i++) P.line([[x, r[1] + 0.25], [x, r[3] - 0.25]], 0.32, cols[1 + i % (cols.length - 1)]);
      };
      crop(fieldA, ['#d5b365', '#f0cf68', '#e3bf58'], 'z');
      crop(fieldB, ['#a98660', '#7fb83a', '#97c93f', '#7fb83a'], 'x');
      crop(fieldC, ['#b58a5c', '#a57a50', '#c49968'], 'x', 0.55);
      crop(fieldR, ['#a98660', '#8cae48', '#c9c05a', '#d9703c', '#8cae48'], 'z', 0.5); // vegetable rows at the right side
      P.rect(paddock[0], paddock[1], paddock[2], paddock[3], '#b6bb58', 0.4, 0.8);
      P.line(road, 2.0, '#d3a273', { cap: 'butt' }); P.line(road, 1.5, '#e8c391', { cap: 'butt' });
      soil(P, bx, bz + 1.6, 2.6, 1.3, '#e8c391', 0.9); soil(P, wx, wz + 1.4, 1.8, 1.2, '#e8c391', 0.9);
      soil(P, -(H + 3.3), -(H + 1.8), 1.6, 0.8, '#d9b98a', 0.6); soil(P, H + 3.4, H + 1.6, 1.5, 0.8, '#d9b98a', 0.6);
    },
  });
  c.claimRect(...fieldA); c.claimRect(...fieldB); c.claimRect(...fieldC); c.claimRect(...paddock); c.claimRect(...fieldR);
  c.claim(bx, bz, 2.0); c.claim(bx - 1.5, bz, 1.0); c.claim(wx, wz, 1.4);
  const B = frame(c, bx, bz, 0, bk); // barn + silo
  B.box(0, GY, 0, 3.4, 1.75, 2.6, '#d9594c', { r: 0.12, top: '#ec7a60' });
  B.box(0, GY + 1.6, 0, 3.6, 0.1, 2.8, '#fff3dc', { plain: true });
  B.p(CONE(0.7, 0.7, 4), 0, GY + 2.35, 0, '#8d5a6e', { ry: Math.PI / 4, s: [3.8 / 0.99, 1.0, 3.0 / 0.99], top: '#b07a8a' });
  B.box(0, GY + 0.05, 1.32, 1.3, 1.25, 0.06, '#f7ecd6', { plain: true });
  for (const s of [-1, 1]) B.box(s * 0.32, GY + 0.1, 1.355, 0.05, 1.5, 0.04, '#d9594c', { plain: true, rot: [0, 0, s * 0.62] });
  B.gbox('win', 0, GY + 1.42, 1.32, 0.5, 0.4, 0.06);
  B.cyl(-2.45, GY, -0.5, 0.78, 0.8, 3.0, '#f4ead4', { seg: 14, top: '#ffffff' }); B.sph(-2.45, GY + 3.0, -0.5, 0.8, '#6aa3a8', { s: [1, 0.7, 1], ws: 14, hs: 8 });
  c.blob(bx + 0.5, bz - 0.4, 2.0, 1.4, 0.5);
  const W = frame(c, wx, wz, 0, wk); // windmill
  W.cyl(0, GY, 0, 0.5, 0.85, 2.9, '#f4ead4', { seg: 8, top: '#ffffff' }); W.cone(0, GY + 2.85, 0, 0.7, 0.8, '#d9594c', { seg: 8 });
  W.box(0, GY + 0.1, 0.62, 0.42, 0.7, 0.1, PAL.woodD, { plain: true }); W.gbox('win', 0, GY + 1.5, 0.52, 0.3, 0.34, 0.08);
  const bl = [];
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    bl.push(c.mk(BOX(0.42, 1.45, 0.07), Math.sin(a) * 0.82 * wk, Math.cos(a) * 0.82 * wk, 0, '#fff3dc', { rot: [0, 0, -a], grad: 0, s: wk }));
    bl.push(c.mk(BOX(0.12, 1.5, 0.1), Math.sin(a) * 0.78 * wk, Math.cos(a) * 0.78 * wk, 0.05, PAL.woodD, { rot: [0, 0, -a], grad: 0, s: wk }));
  }
  bl.push(c.mk(SPH(0.2, 8, 6), 0, 0, 0.02, '#d9594c', { s: wk }));
  c.spinner(bl, wx, GY + 2.6 * wk, wz + 0.85 * wk, { speed: -0.5, axis: 'z' });
  c.blob(wx + 0.4, wz - 0.3, 1.1, 0.9, 0.5);
  fence(c, paddock[0], paddock[1], paddock[2], paddock[1]); fence(c, paddock[0], paddock[3], paddock[2], paddock[3]); fence(c, paddock[0], paddock[1], paddock[0], paddock[3]); fence(c, paddock[2], paddock[1], paddock[2], paddock[3]);
  for (let i = 0; i < 4; i++) sheep(c, c.rr(paddock[0] + 0.7, paddock[2] - 0.7), c.rr(paddock[1] + 0.7, paddock[3] - 0.7), c.r() * 6.28);
  hayBale(c, -(H + 2.2), paddock[1] - 1.0, 0.3, true); hayBale(c, -(H + 3.1), paddock[1] - 1.2, -0.4); hayBale(c, -(H + 2.6), paddock[1] - 1.0, 0.1);
  hayBale(c, H + 5.6, -(H + 1.8), 0.4, true); hayBale(c, H + 4.7, -(H + 2.4), -0.3);
  c.claim(-(H + 2.6), paddock[1] - 1.1, 1.0); c.claim(H + 5.1, -(H + 2.1), 1.0);
  for (let i = 0; i < 3; i++) hayBale(c, c.rr(fieldA[0] + 1, fieldA[2] - 1), c.rr(fieldA[1] + 1, fieldA[3] - 1), c.r() * 3, true);
  const sx = H + 3.2, sz = -0.2; // scarecrow among the vegetable rows
  c.cyl(sx, GY, sz, 0.05, 0.05, 1.0, PAL.woodD, { seg: 5 }); c.box(sx, GY + 0.7, sz, 0.8, 0.07, 0.07, PAL.woodD); c.box(sx, GY + 0.45, sz, 0.34, 0.4, 0.2, PAL.teal, { r: 0.08 });
  c.sph(sx, GY + 1.05, sz, 0.14, '#f0c890'); c.cone(sx, GY + 1.1, sz, 0.2, 0.2, PAL.sun, { seg: 8 });
  c.claim(sx, sz, 0.6);
  cornerLamps(c, (cc, x, z, o) => lantern(cc, x, z, o), 1.4);
  produce(c, H + 5.4, -H * 0.2, 0.3, ['#e8504a', '#e8504a', '#f4a03a']); produce(c, H + 5.5, H * 0.25, -0.2, ['#8cc24a', '#a6d058', '#e8b03a']);
  produce(c, H + 5.1, -H * 0.5, 0.8, ['#f4a03a', '#e8504a']); crate(c, H + 4.7, -(H + 3.0), 0.5, 0.4); crate(c, H + 5.2, -(H + 3.0), 0.1, 0.4); crate(c, H + 4.95, -(H + 3.0), 0.3, 0.36);
  for (const q of [[H + 5.4, -H * 0.2], [H + 5.5, H * 0.25], [H + 5.1, -H * 0.5], [H + 4.95, -(H + 3.0)]]) c.claim(q[0], q[1], 0.6);
  c.box(-(H + 6.0), GY, -2.5, 0.3, 0.2, 1.2, '#7aa8b8', { r: 0.06 });
  const T = traffic(c); T.mover('van', 'x', H + 3.8 + 0.2, 1, 0.9, -EXT - 1, EXT + 1, PAL.coral); T.mover('car', 'x', H + 3.4, -1, 1.1, -EXT - 1, EXT + 1, PAL.sun); T.finish();
  c.tree('round', -(H + 3.8), -(H + 3.6), 1.15); c.tree('autumn', H + 4.2, -(H + 3.8), 1.05); c.tree('round', bx - 3.6, bz - 0.8, 1.0);
  ringTrees(c, ['round', 'tall', 'autumn'], 8);
  ringFill(c, { bushes: ['round', 'grass', 'flower'], bushN: 16, tufts: 100, flowers: 36, cols: FLOWERS, rocks: 4 });
  c.scatter(16, 6.4, 21, (x, z) => c.tree(c.pick(['round', 'tall', 'autumn']), x, z, c.rr(0.9, 1.2)), { r: 1.2, tall: true });
  c.scatter(8, 6.2, 20, (x, z) => c.bush(c.pick(['round', 'grass', 'flower']), x, z, c.rr(0.7, 1.1)), { r: 0.5 });
  c.scatter(26, 6.2, 22, (x, z) => (c.r() < 0.6 ? c.tuft(x, z, c.rr(0.8, 1.3)) : c.flower(x, z, c.pick(FLOWERS), c.rr(0.9, 1.3))), { r: 0.25 });
  butterflies(c, 4, ['#ffffff', PAL.sun, PAL.sky], 2, 8);
  const bp = []; for (let i = 0; i < 3; i++) bp.push([c.rr(-8, 8), c.rr(-8, 8)]);
  fliers(c, 'bird', bp, ['#fff8ea', '#f3e3c4'], { rad: 9, h: 4.5, speed: 0.8 });
  drifters(c, 16, ['#f6d27a', '#fff3dc', '#e8b050'], { size: 0.12, fall: 0.25 });
}

// ---------------------------------------------------------------------------------------------------------------- FOREST
export function buildForest(c) {
  const H = c.H, lx = -(H + 5.6), lz = -1.0;
  const lake = organicPoly(lx, lz, 3.0, 4.6, 24, 0.1, c.r() * 9);
  const tx = H + 4.4, tz = -H * 0.3 - 0.9, fx = tx - 1.9, fz = tz + 0.1;
  c.buildGround({
    base: lawnBase(c.r() * 40, { dark: '#98a652', mid: '#a9b058', light: '#bcbc68' }),
    holes: [lake],
    water: { color: '#4ab3b2', golden: '#4fae9c', night: '#35509e', size: 90 },
    farBase: lawnBase(5, { dark: '#8a9a4c', mid: '#a9b058', light: '#bcbc68' }),
    farTint: '#8fa050',
    paint(P) {
      for (let i = 0; i < 34; i++) P.blot(c.rr(-EXT, EXT), c.rr(-EXT, EXT), c.rr(1.5, 5), c.pick(['#d2b384', '#d2b384', '#a9b058', '#c8b868']), 0.2);
      for (let i = 0; i < 18; i++) soil(P, c.rr(-(H + 7), H + 7), c.rr(-(H + 7), H + 5), c.rr(0.5, 1.2), c.rr(0.4, 0.9), c.pick(['#d2b384', '#c8b868', '#b6b45c']), 0.55);
      P.poly(scaledPoly(lake, 1.16), '#d9bd8a', 0.9);
      P.poly(scaledPoly(lake, 1.07), '#c9a878', 0.7);
      P.line([[H + 2.4, H + 5], [H + 3.6, H * 0.4], [H + 3.3, -H * 0.3], [H + 5, -(H + 3)], [H + 10, -(H + 6)]], 1.1, '#dcc08c', { a: 0.9 });
      P.line([[-(H + 1.6), H + 4.5], [-(H + 1.8), H * 0.3], [-(H + 2.8), 0]], 0.9, '#dcc08c', { a: 0.85 });
      soil(P, tx - 0.6, tz, 2.8, 2.0, '#d8b88a', 0.8); soil(P, fx, fz, 1.0, 0.9, '#8a7f6a', 0.7);
    },
  });
  c.claim(lx, lz, 4.8); c.claim(tx, tz, 1.6); c.claim(fx, fz, 1.0);
  const dx0 = lx + 3.2, dz = lz + 0.3; // dock reaching into the lake from the board side
  for (let i = 0; i < 14; i++) c.box(dx0 - 0.1 - i * 0.2, GY - 0.03, dz, 0.17, 0.07, 1.1, i % 2 ? '#c88d55' : '#d89c62', { plain: true, grad: 0 });
  for (const sz of [-0.5, 0.5]) for (let i = 0; i < 3; i++) c.cyl(dx0 - 0.3 - i * 1.0, WY - 0.2, dz + sz, 0.07, 0.07, GY + 0.35 - WY + 0.2, PAL.woodD, { seg: 6 });
  const rb = [c.mk(CAPS(0.34, 0.9, 4, 8), 0, 0.02, 0, '#e8634f', { rot: [0, 0, Math.PI / 2], s: [1, 0.5, 1], top: '#f4856a' }), c.mk(CAPS(0.28, 0.85, 4, 8), 0, 0.1, 0, '#d9a56a', { rot: [0, 0, Math.PI / 2], s: [1, 0.35, 0.9], grad: 0 })];
  c.bobber(rb, dx0 - 2.0, WY + 0.04, dz + 1.3, { ry: 0.25, amp: 0.025, drift: 0.3 });
  for (let i = 1; i < lake.length; i += 3) { // reeds and rocks on the shore
    const [px, pz] = lake[i];
    for (let j = 0; j < 3; j++) { const x = lx + (px - lx) * 1.05 + c.rr(-0.3, 0.3), z = lz + (pz - lz) * 1.05 + c.rr(-0.3, 0.3), h = c.rr(0.7, 1.2); c.cyl(x, WY, z, 0.025, 0.03, h + (GY - WY) * 0.6, '#7fa83a', { seg: 4, grad: 0 }); c.sph(x, WY + h + (GY - WY) * 0.6, z, 0.07, '#8b5a3c', { s: [1, 2.2, 1], ws: 6, hs: 5, grad: 0 }); }
    if (i % 2) c.rock(lx + (px - lx) * 1.1, lz + (pz - lz) * 1.1, c.rr(0.4, 0.8));
  }
  for (let i = 0; i < 6; i++) pad(c, lx + c.rr(-2, 2), lz + c.rr(-3, 3));
  const Tn = frame(c, tx, tz, -Math.PI / 2, 0.95); // tent + campfire
  Tn.p(CONE(0.7, 0.7, 4), 0, GY + 0.6, 0, PAL.coral, { ry: Math.PI / 4, s: [2.2 / 0.99, 1.7, 2.6 / 0.99], top: '#ff9a82' });
  Tn.gbox('win', 0, GY + 0.02, 1.28, 0.46, 0.8, 0.05); Tn.sph(0, GY + 1.55, 0, 0.1, PAL.sun, { ws: 6, hs: 5 });
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; c.sph(fx + Math.cos(a) * 0.45, GY + 0.1, fz + Math.sin(a) * 0.45, 0.12, '#b3acc0', { ws: 6, hs: 5 }); }
  c.p(CYL(0.07, 0.07, 0.8, 6), fx, GY + 0.12, fz, PAL.woodD, { rot: [0, 0, Math.PI / 2], ry: 0.5 }); c.p(CYL(0.07, 0.07, 0.8, 6), fx, GY + 0.12, fz, PAL.woodD, { rot: [0, 0, Math.PI / 2], ry: -0.7 });
  c.glow('red', CONE(0.24, 0.5, 6), fx, GY + 0.4, fz); c.glow('lamp', CONE(0.13, 0.4, 6), fx, GY + 0.42, fz);
  const logs = (lgx, lgz) => { for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) c.p(CYL(0.17, 0.17, 1.2, 8), lgx, GY + 0.18 + r * 0.3, lgz + (i - (2 - r) / 2) * 0.36, '#a8703f', { rot: [0, 0, Math.PI / 2], top: '#c88d55' }); c.claim(lgx, lgz, 1.0); };
  logs(H + 3.3, -(H + 2.6)); logs(-(H + 2.4), -(H + 2.3));
  for (const [sx, sz] of [[fx - 0.3, fz + 1.1], [fx - 0.3, fz - 1.1], [H + 2.2, H * 0.55 + 0.4], [H + 2.8, -(H + 1.6)], [-(H + 1.9), H * 0.35]]) { c.claim(sx, sz, 0.5); c.cyl(sx, GY, sz, 0.28, 0.32, 0.3, '#a8703f', { seg: 9 }); c.cyl(sx, GY + 0.29, sz, 0.28, 0.28, 0.03, '#e0b078', { seg: 9, grad: 0 }); }
  for (let i = 0; i < 16; i++) {
    const mx = c.rr(-(H + 6), H + 6), mz = c.rr(-(H + 6), H + 4);
    if (c.free(mx, mz, 0.3)) { c.claim(mx, mz, 0.3); c.cyl(mx, GY, mz, 0.04, 0.05, 0.12, '#f4ead4', { seg: 5 }); c.sph(mx, GY + 0.14, mz, 0.1, '#e8504a', { s: [1, 0.6, 1], ws: 7, hs: 5 }); }
  }
  cornerLamps(c, (cc, x, z, o) => lantern(cc, x, z, o), 1.4);
  c.tree('pine', -(H + 3.6), -(H + 3.2), 1.15); c.tree('pine', -H * 0.4, -(H + 3.4), 1.3); c.tree('pine', H * 0.5, -(H + 3.2), 1.2); c.tree('autumn', H + 4.2, -(H + 3.4), 1.0);
  ringTrees(c, ['pine', 'pine', 'autumn', 'round'], 12, { s0: 0.85, s1: 1.2 });
  ringFill(c, { bushes: ['round', 'grass'], bushN: 12, tufts: 100, flowers: 24, cols: [PAL.sun, '#ffffff', '#ff9ec0'], rocks: 8 });
  c.scatter(26, 6.6, 22, (x, z) => c.tree('pine', x, z, c.rr(0.9, 1.35)), { r: 1.2, tall: true });
  c.scatter(14, 6.6, 22, (x, z) => c.tree(c.pick(['autumn', 'autumn', 'round']), x, z, c.rr(0.9, 1.25)), { r: 1.3, tall: true });
  c.scatter(6, 6.2, 18, (x, z) => c.bush(c.pick(['round', 'grass']), x, z, c.rr(0.7, 1.1)), { r: 0.5 });
  c.scatter(6, 6.2, 22, (x, z) => c.rock(x, z, c.rr(0.5, 1.0)), { r: 0.5 });
  c.scatter(24, 6.2, 22, (x, z) => (c.r() < 0.7 ? c.tuft(x, z, c.rr(0.8, 1.3)) : c.flower(x, z, c.pick([PAL.sun, '#ffffff', '#ff9ec0']), c.rr(0.9, 1.3))), { r: 0.25 });
  butterflies(c, 4, [PAL.sun, '#ffffff', PAL.sky, '#ff9ec0'], 2, 8);
  drifters(c, 26, ['#e8a23a', '#d9693a', '#f4c64a', '#b85a30'], { size: 0.13, fall: 0.3 });
}
