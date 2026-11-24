// Models for the large-board scenes (amusement park, cruise ship, ski resort, airport) in the "sunny vinyl-toy" look.
// Each fits a 1x1 cell, rests on y=0, front faces +z. Occupiable types (carhorse, ferriscab, deckchair, liftchair)
// keep their middle clear for a figurine. Also exports small part helpers shared with extra.js.
import * as THREE from 'three';
import { add, addVC, addMerged, shade, mix, glowMat, toon, RB, CYL, SPH, CONE, TOR, CAPS } from './kit.js';

const PI = Math.PI;
export const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

/** Figurine stand height / forward offset for the occupiable types below (merged into standInfo). */
export const EXTRA2_STAND = {
  carhorse: { y: 0.06, dz: 0.02 }, ferriscab: { y: 0.14, dz: 0.02 }, deckchair: { y: 0.2, dz: 0.02 }, liftchair: { y: 0.28, dz: 0.04 },
};

// --- part helpers (all return {geo,color,pos,rot,scale} for addVC) -----------------------------
export const sp = (r, color, pos, scale, rot) => ({ geo: r >= 0.24 ? SPH(r, 16, 12) : r >= 0.12 ? SPH(r, 12, 9) : SPH(r, 8, 6), color, pos, scale, rot });
export const cp = (r, l, color, pos, rot, scale) => ({ geo: CAPS(r, l, 3, 8), color, pos, rot, scale });
export const rb = (w, h, d, rad, color, pos, rot) => ({ geo: RB(w, h, d, rad, rad >= 0.05 ? 3 : rad >= 0.025 ? 2 : 1), color, pos, rot });
export const cy = (rt, rbm, h, color, pos, rot, seg = 14) => ({ geo: CYL(rt, rbm, h, seg), color, pos, rot });
export const co = (r, h, color, pos, rot, scale, seg = 8) => ({ geo: CONE(r, h, seg), color, pos, rot, scale });
export const tr = (R, t, color, pos, rot, arc = PI * 2, scale) => ({ geo: TOR(R, t, 6, arc < 6 ? 10 : 26, arc), color, pos, rot, scale });
export const grp = (parent, x = 0, y = 0, z = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; };
export const vc = (parent, parts, x, y, z) => { const m = addVC(parent, parts); if (x !== undefined) m.position.set(x, y, z); return m; };
/** Glossy bead eyes (blinkable mesh); parts are relative to (x,y,z). */
export function eyes(parent, x, y, z, r = 0.035, gap = 0.09) {
  const parts = [];
  for (const s of [-1, 1]) {
    parts.push({ geo: SPH(r, 10, 8), color: '#2e2a45', pos: [s * gap, 0, 0], scale: [0.9, 1.1, 0.7] });
    parts.push({ geo: SPH(r * 0.38, 6, 5), color: '#fff8ea', pos: [s * gap + r * 0.3, r * 0.45, r * 0.5] });
  }
  return vc(parent, parts, x, y, z);
}
export const blink = (m, t, ph) => { m.scale.y = (t + ph * 2.3) % 4.6 < 0.14 ? 0.12 : 1; };
/** 0..1 pulse that happens once per `period` seconds (for ear flicks and the like). */
export const flick = (t, ph, period = 5, len = 0.35) => { const k = (t + ph * 1.7) % period; return k < len ? Math.sin((k / len) * PI) : 0; };
/** Teal water pad: returns the three ripple rings. */
export function waterPad(g, R, y0, ph) {
  const w = add(g, CYL(R, R, 0.05, 28), toon('#3fbfcf', { rough: 0.3 }), { pos: [0, y0 + 0.025, 0], shadow: false });
  w.receiveShadow = true;
  vc(g, [tr(R * 0.62, 0.012, '#7fe0e0', [0, y0 + 0.052, 0], [PI / 2, 0, 0], 3.2), tr(R * 0.8, 0.012, '#9ae8e6', [0, y0 + 0.052, 0], [PI / 2, 0, 0], 2.4, undefined)]);
  const mat = toon('#c8f6f2', { rough: 0.5 });
  return [0.14, 0.27, 0.4].map((rad) => add(g, TOR(rad, 0.011, 4, 28), mat, { pos: [0, y0 + 0.054, 0], rot: [PI / 2, 0, 0], shadow: false }));
}
export function rippleIdle(rings, t, ph) {
  rings.forEach((rg, i) => { const k = (t * 0.35 + ph + i * 0.33) % 1; rg.scale.setScalar(0.7 + 0.5 * k); rg.visible = k < 0.92; });
}

export const EXTRA2_BUILDERS = {
  // --- amusement park ---------------------------------------------------------------------------
  carhorse(g, r, ph) {
    const coat = pick(r, ['#fff0dc', '#f0b98a', '#ea9fbd', '#9fd0f0']), mane = pick(r, ['#e8585a', '#f2c14e', '#4f86c6']);
    const base = pick(r, ['#e8585a', '#4f86c6', '#8a5fc8']), gold = '#f2c14e', goldD = '#cf9a2e', dark = '#4a3a5a';
    const plat = [cy(0.46, 0.48, 0.07, base, [0, 0.035, 0], undefined, 28), cy(0.41, 0.41, 0.012, '#f6e7b4', [0, 0.066, 0], undefined, 28),
      tr(0.44, 0.024, gold, [0, 0.072, 0], [PI / 2, 0, 0]), tr(0.27, 0.012, mix(base, '#fff8ea', 0.5), [0, 0.074, 0], [PI / 2, 0, 0])];
    for (let i = 0; i < 14; i++) { const a = (i / 14) * PI * 2; plat.push(sp(0.03, '#fff8ea', [Math.cos(a) * 0.475, 0.04, Math.sin(a) * 0.475])); }
    vc(g, plat);
    const pole = [];
    for (let i = 0; i < 6; i++) pole.push(cy(0.026, 0.026, 0.121, i % 2 ? '#fff8ea' : base, [-0.27, 0.13 + i * 0.12, -0.02], undefined, 10));
    pole.push(sp(0.045, gold, [-0.27, 0.8, -0.02]));
    vc(g, pole);
    add(g, SPH(0.034, 8, 6), glowMat('#ffe9a0', '#ffd45a'), { pos: [-0.27, 0.86, -0.02], shadow: false });
    const horse = grp(g, -0.27, 0.1, -0.02);
    const h = [
      cp(0.115, 0.2, coat, [0, 0.34, 0], [PI / 2, 0, 0]), sp(0.125, coat, [0, 0.355, 0.14]), sp(0.11, shade(coat, 0.93), [0, 0.34, -0.15]),
      cp(0.07, 0.15, coat, [0, 0.5, 0.2], [0.55, 0, 0]), sp(0.085, coat, [0, 0.63, 0.29], [0.88, 1, 1.25], [0.4, 0, 0]),
      sp(0.06, shade(coat, 0.9), [0, 0.595, 0.385]), sp(0.017, '#e8808a', [0, 0.6, 0.435], [1.4, 0.8, 0.6]),
      co(0.028, 0.08, coat, [-0.045, 0.72, 0.26]), co(0.028, 0.08, coat, [0.045, 0.72, 0.26]),
      sp(0.042, mane, [0, 0.715, 0.32]),
      rb(0.22, 0.03, 0.22, 0.014, mane, [0, 0.455, 0]), rb(0.16, 0.045, 0.17, 0.02, goldD, [0, 0.475, 0.0]),
      sp(0.05, mane, [0, 0.33, -0.27], [0.7, 1.5, 0.8], [0.4, 0, 0]), sp(0.04, mane, [0, 0.2, -0.31], [0.7, 1.4, 0.8], [0.4, 0, 0]),
      tr(0.07, 0.014, gold, [0, 0.61, 0.33], [0, PI / 2, 0]),
    ].filter(Boolean);
    [[0.058, 0.43], [0.052, 0.38], [0.046, 0.33], [0.044, 0.28]].forEach(([rad, y], i) => h.push(sp(rad, mane, [0, 0.7 - i * 0.07 - 0.0, 0.24 - i * 0.06 - 0.0], [0.6, 1, 1])));
    for (const s of [-1, 1]) {
      h.push(sp(0.016, '#2e2a45', [s * 0.06, 0.65, 0.33]), sp(0.007, '#fff8ea', [s * 0.065, 0.658, 0.345]));
      h.push(cp(0.036, 0.1, coat, [s * 0.075, 0.2, 0.18], [-0.5, 0, 0]), sp(0.042, dark, [s * 0.075, 0.12, 0.225], [1, 0.8, 1.2]));
      h.push(cp(0.036, 0.1, coat, [s * 0.075, 0.2, -0.17], [0.5, 0, 0]), sp(0.042, dark, [s * 0.075, 0.12, -0.215], [1, 0.8, 1.2]));
    }
    vc(horse, h);
    g.userData.idle = (t) => { horse.position.y = 0.1 + 0.05 * Math.sin(t * 2 + ph); horse.rotation.x = 0.04 * Math.cos(t * 2 + ph); };
  },

  ferriscab(g, r, ph) {
    const col = pick(r, ['#e8585a', '#f2c14e', '#4f86c6', '#3fae6a', '#a07be0']), dk = shade(col, 0.82), lt = shade(col, 1.2);
    const rim = '#cfd6ee';
    // slice of the wheel behind (static), chunky rim and spokes
    vc(g, [tr(0.46, 0.028, rim, [0, 0.5, -0.46], [0, 0, 0]), cy(0.05, 0.05, 0.05, '#b8c2e6', [0, 0.5, -0.46], [PI / 2, 0, 0], 10),
      ...[0, PI / 3, 2 * PI / 3].map((a) => rb(0.9, 0.03, 0.03, 0.012, rim, [0, 0.5, -0.46], [0, 0, a]))]);
    const cab = grp(g, 0, 0, 0);
    const p = [
      rb(0.74, 0.08, 0.64, 0.035, dk, [0, 0.1, 0.02]),
      rb(0.74, 0.16, 0.06, 0.03, col, [0, 0.22, -0.28]), rb(0.74, 0.03, 0.06, 0.012, '#fff8ea', [0, 0.31, -0.28]),
      rb(0.82, 0.06, 0.74, 0.04, col, [0, 0.72, 0.01]), sp(0.2, lt, [0, 0.74, 0.01], [1.5, 0.45, 1.6]), sp(0.05, '#fff8ea', [0, 0.82, 0.01]),
      rb(0.5, 0.03, 0.03, 0.01, rim, [0, 0.9, -0.22], [0, 0, 0]),
      cp(0.025, 0.3, rim, [0, 0.9, -0.3], [-0.9, 0, 0]),
    ];
    for (const s of [-1, 1]) {
      p.push(rb(0.06, 0.16, 0.56, 0.03, col, [s * 0.34, 0.22, 0.02]), rb(0.07, 0.03, 0.58, 0.012, '#fff8ea', [s * 0.34, 0.31, 0.02]));
      for (const z of [-0.26, 0.3]) p.push(cp(0.026, 0.5, '#fff8ea', [s * 0.34, 0.47, z]));
    }
    p.push(rb(0.74, 0.07, 0.05, 0.02, col, [0, 0.14, 0.32]));
    vc(cab, p);
    const bulbs = [];
    for (let i = 0; i < 6; i++) bulbs.push({ geo: SPH(0.024, 6, 5), pos: [-0.35 + i * 0.14, 0.68, 0.39] });
    addMerged(cab, bulbs, glowMat('#fff2b0', '#ffd45a'), { shadow: false });
    g.userData.idle = (t) => { g.rotation.z = 0.02 * Math.sin(t * 1.3 + ph); };
  },

  foodstall(g, r, ph) {
    const a = pick(r, ['#e8585a', '#4f86c6', '#3fb08a', '#f2a03e']), a2 = shade(a, 0.82);
    const cream = '#f6e8c8', wood = '#b9824a', woodD = '#946236';
    const p = [
      rb(0.84, 0.42, 0.58, 0.07, cream, [0, 0.21, 0.04]), rb(0.86, 0.17, 0.04, 0.02, a, [0, 0.14, 0.34]),
      rb(0.94, 0.05, 0.68, 0.025, wood, [0, 0.445, 0.07]), rb(0.94, 0.02, 0.06, 0.01, woodD, [0, 0.43, 0.4]),
      rb(0.84, 0.5, 0.06, 0.03, a2, [0, 0.69, -0.24]),
      cp(0.032, 0.46, '#fff8ea', [-0.42, 0.7, 0.33]), cp(0.032, 0.46, '#fff8ea', [0.42, 0.7, 0.33]),
    ];
    // sloped striped awning with scalloped front edge
    for (let i = 0; i < 7; i++) {
      const c = i % 2 ? '#fff8ea' : a, x = -0.36 + i * 0.12;
      p.push(rb(0.125, 0.035, 0.5, 0.014, c, [x, 0.99, 0.1], [0.3, 0, 0]));
      p.push(sp(0.062, c, [x, 0.9, 0.34], [1, 0.8, 0.5]));
    }
    // food on the counter: ice-cream cones in a rack, donut stack, cupcake
    for (const [x, c1, c2] of [[-0.3, '#f6a8c0', '#f6e8c8'], [-0.17, '#a8e8c8', '#f2c14e']]) {
      p.push(rb(0.1, 0.03, 0.1, 0.012, woodD, [x, 0.5, 0.2]), co(0.04, 0.12, '#e0a050', [x, 0.57, 0.2], [PI, 0, 0], undefined, 8), sp(0.052, c1, [x, 0.65, 0.2]), sp(0.036, c2, [x, 0.7, 0.2]), sp(0.012, '#e8585a', [x, 0.74, 0.2]));
    }
    p.push(cy(0.1, 0.1, 0.012, '#fff8ea', [0.22, 0.485, 0.22]));
    [['#f6a8c0', 0.51], ['#f2c14e', 0.545], ['#8fd0f0', 0.58]].forEach(([c, y], i) => p.push(tr(0.062, 0.03, i === 1 ? '#c98a4a' : c, [0.22 + (i - 1) * 0.012, y, 0.22], [PI / 2, 0, 0])));
    p.push(cy(0.04, 0.03, 0.05, '#f2c14e', [0.07, 0.495, 0.1], undefined, 10), sp(0.05, '#f6a8c0', [0.07, 0.535, 0.1], [1, 0.8, 1]), sp(0.015, '#e8585a', [0.07, 0.575, 0.1]));
    vc(g, p);
    const bulbs = [];
    for (let i = 0; i < 7; i++) bulbs.push({ geo: SPH(0.022, 6, 5), pos: [-0.36 + i * 0.12, 0.86, 0.4] });
    addMerged(g, bulbs, glowMat('#fff2b0', '#ffd45a', { night: 2.2 }), { shadow: false });
    // glowing scoop sign on the roof, gently swinging
    const sign = grp(g, 0, 1.04, -0.06);
    vc(sign, [rb(0.26, 0.05, 0.05, 0.02, woodD, [0, 0.0, 0]), cp(0.02, 0.1, wood, [0, 0.07, 0])]);
    const scoop = [{ geo: CONE(0.065, 0.14, 8), pos: [0, 0.02, 0.0], rot: [PI, 0, 0] }, { geo: SPH(0.08, 12, 9), pos: [0, 0.17, 0] }];
    addMerged(sign, scoop, glowMat('#ffb0c8', '#ff7aa8', { day: 0.25, night: 1.4 }), { shadow: false }).position.set(0, 0.04, 0);
    g.userData.idle = (t) => { sign.rotation.z = 0.1 * Math.sin(t * 1.8 + ph); };
  },

  // --- cruise ship ------------------------------------------------------------------------------
  deckchair(g, r) {
    const cloth = pick(r, ['#4f86c6', '#e8585a', '#f2a03e', '#3fae6a']), cloth2 = '#fff8ea';
    const wood = '#c28a52', woodD = '#a56e3c';
    const p = [];
    for (const s of [-1, 1]) {
      p.push(rb(0.06, 0.06, 0.8, 0.03, wood, [s * 0.27, 0.15, 0.02]), rb(0.06, 0.24, 0.06, 0.025, woodD, [s * 0.27, 0.1, 0.34]), rb(0.06, 0.24, 0.06, 0.025, woodD, [s * 0.27, 0.1, -0.1]));
      p.push(rb(0.07, 0.04, 0.12, 0.018, woodD, [s * 0.27, 0.02, 0.36]), rb(0.07, 0.04, 0.12, 0.018, woodD, [s * 0.27, 0.02, -0.1]));
      p.push(rb(0.06, 0.04, 0.32, 0.018, wood, [s * 0.27, 0.34, -0.2], [-0.78, 0, 0]));
    }
    for (let i = 0; i < 4; i++) p.push(rb(0.46, 0.05, 0.12, 0.022, i % 2 ? cloth2 : cloth, [0, 0.185, 0.3 - i * 0.12 + 0.02]));
    for (let i = 0; i < 4; i++) p.push(rb(0.46, 0.05, 0.12, 0.022, i % 2 ? cloth : cloth2, [0, 0.27 + i * 0.075, -0.24 - i * 0.07 + 0.04 - 0.0], [-0.78, 0, 0]));
    p.push(rb(0.34, 0.1, 0.14, 0.045, '#fff3dc', [0, 0.54, -0.42], [-0.78, 0, 0]));
    // little side table with a drink and a straw umbrella
    p.push(cy(0.1, 0.1, 0.03, wood, [0.42, 0.22, 0.2]), cy(0.03, 0.04, 0.2, woodD, [0.42, 0.11, 0.2]), cy(0.07, 0.08, 0.02, woodD, [0.42, 0.01, 0.2]));
    p.push(cy(0.032, 0.026, 0.07, '#ffb85a', [0.42, 0.275, 0.2]), sp(0.035, '#ff7a4a', [0.42, 0.315, 0.2], [1, 0.5, 1]), cp(0.006, 0.08, '#fff8ea', [0.43, 0.35, 0.2], [0, 0, -0.3]));
    vc(g, p);
  },

  lifebuoy(g, r, ph) {
    const red = '#e8585a', cream = '#fff3dc';
    const p = [cy(0.2, 0.23, 0.07, '#7d8aa8', [0, 0.035, 0], undefined, 18), cy(0.14, 0.16, 0.03, '#98a5c4', [0, 0.085, 0], undefined, 18),
      cp(0.038, 0.6, cream, [0, 0.43, -0.14]), sp(0.06, '#f2c14e', [0, 0.78, -0.14]),
      rb(0.44, 0.05, 0.05, 0.02, '#98a5c4', [0, 0.36, -0.1]), rb(0.07, 0.07, 0.14, 0.025, '#98a5c4', [-0.2, 0.55, -0.05]), rb(0.07, 0.07, 0.14, 0.025, '#98a5c4', [0.2, 0.55, -0.05])];
    vc(g, p);
    const ring = grp(g, 0, 0.55, 0.04);
    const q = [];
    for (let i = 0; i < 8; i++) q.push({ geo: TOR(0.215, 0.075, 8, 6, PI / 4 + 0.001), color: i % 2 ? '#fff8ea' : red, rot: [0, 0, (i * PI) / 4] });
    q.push(tr(0.215, 0.013, '#c9a66b', [0, 0, 0.07], undefined, PI * 2, undefined), tr(0.215, 0.013, '#c9a66b', [0, 0, -0.07]));
    vc(ring, q);
    vc(g, [cp(0.016, 0.1, '#c9a66b', [0.21, 0.4, 0.06], [0, 0, 0.2]), sp(0.03, '#c9a66b', [0.22, 0.34, 0.06])]);
    g.userData.idle = (t) => { ring.rotation.z = 0.06 * Math.sin(t * 1.5 + ph); };
  },

  // --- ski resort ---------------------------------------------------------------------------------
  liftchair(g, r) {
    const col = pick(r, ['#e8585a', '#4f86c6', '#f2a03e']), dk = shade(col, 0.82), steel = '#9aa3c0';
    const p = [
      rb(0.88, 0.08, 0.84, 0.04, '#e8f0fa', [0, 0.04, 0]), sp(0.1, '#f6faff', [-0.3, 0.07, 0.3], [1.6, 0.5, 1.4]), sp(0.08, '#f6faff', [0.33, 0.07, -0.28], [1.5, 0.5, 1.3]),
      rb(0.62, 0.08, 0.38, 0.04, col, [0, 0.25, 0.04]), rb(0.62, 0.36, 0.08, 0.04, dk, [0, 0.45, -0.16]), rb(0.5, 0.03, 0.3, 0.012, shade(col, 1.2), [0, 0.3, 0.04]),
      rb(0.5, 0.2, 0.03, 0.012, shade(col, 1.2), [0, 0.46, -0.115]),
      cp(0.03, 0.55, steel, [0, 0.8, -0.22]), rb(0.22, 0.07, 0.07, 0.03, '#4a4668', [0, 1.1, -0.22]),
    ];
    for (const s of [-1, 1]) p.push(rb(0.06, 0.06, 0.42, 0.025, '#4a4668', [s * 0.32, 0.4, 0.02]), rb(0.06, 0.24, 0.06, 0.022, '#4a4668', [s * 0.32, 0.27, 0.2]), rb(0.06, 0.08, 0.08, 0.025, steel, [s * 0.32, 0.18, -0.12]));
    vc(g, p);
    vc(g, [rb(1.0, 0.06, 0.06, 0.025, '#707a98', [0, 1.18, -0.22])]);
    const wheel = add(g, TOR(0.06, 0.02, 5, 12), toon('#4a4668'), { pos: [0, 1.18, -0.22], rot: [0, PI / 2, 0], shadow: false });
    g.userData.idle = (t) => { wheel.rotation.x = t * 2; };
  },

  snowman(g, r, ph) {
    const snow = '#fdfeff', snowD = '#dde8f8', red = '#e8585a', dark = '#3a3458';
    const body = grp(g, 0, 0, 0);
    vc(body, [
      sp(0.3, snowD, [0, 0.27, 0], [1, 0.95, 1]), sp(0.285, snow, [0, 0.3, 0.01], [1, 0.95, 1]),
      sp(0.21, snow, [0, 0.62, 0]),
      ...[[0.5, 0.172], [0.58, 0.2], [0.66, 0.206]].map(([y, z]) => ({ geo: SPH(0.026, 8, 6), color: dark, pos: [0, y, z], scale: [1, 1, 0.7] })),
    ]);
    const head = grp(body, 0, 0.9, 0.0);
    vc(head, [
      sp(0.17, snow, [0, 0, 0]),
      co(0.035, 0.17, '#f08a2e', [0, -0.01, 0.2], [PI / 2, 0, 0]),
      sp(0.03, '#f6a8b0', [-0.1, -0.04, 0.12], [1, 0.8, 0.4]), sp(0.03, '#f6a8b0', [0.1, -0.04, 0.12], [1, 0.8, 0.4]),
      ...[-0.07, -0.035, 0, 0.035, 0.07].map((x, i) => sp(0.011, dark, [x, -0.08 + (i === 0 || i === 4 ? 0.01 : 0) - (i === 2 ? 0.012 : 0), 0.155])),
      // red bobble beanie
      sp(0.17, red, [0, 0.07, -0.01], [1.02, 0.8, 1.02]), tr(0.15, 0.04, '#fff8ea', [0, 0.04, 0], [PI / 2, 0, 0]), sp(0.06, '#fff8ea', [0, 0.22, 0]),
    ]);
    const eyeM = eyes(head, 0, 0.035, 0.14, 0.03, 0.065);
    vc(body, [tr(0.15, 0.05, red, [0, 0.77, 0], [PI / 2, 0, 0]), tr(0.155, 0.012, '#fff8ea', [0, 0.77, 0.0], [PI / 2, 0, 0]),
      cp(0.03, 0.34, '#8a5a35', [-0.34, 0.6, 0.02], [0, 0, 1.05]), cp(0.03, 0.34, '#8a5a35', [0.34, 0.6, 0.02], [0, 0, -1.05]),
      cp(0.012, 0.07, '#8a5a35', [-0.45, 0.72, 0.02], [0, 0, 0.3]), cp(0.012, 0.07, '#8a5a35', [0.45, 0.72, 0.02], [0, 0, -0.3])]);
    const tail = grp(body, 0.09, 0.73, 0.13);
    vc(tail, [rb(0.07, 0.2, 0.035, 0.016, red, [0, -0.1, 0], [0, 0, 0.1]), rb(0.07, 0.03, 0.04, 0.012, '#fff8ea', [0, -0.17, 0.0], [0, 0, 0.1])]);
    g.userData.idle = (t) => {
      tail.rotation.z = 0.25 * Math.sin(t * 2.4 + ph); tail.rotation.x = 0.1 * Math.sin(t * 1.7 + ph);
      body.rotation.z = 0.025 * Math.sin(t * 1.2 + ph); head.rotation.z = 0.05 * Math.sin(t * 1.2 + ph + 0.6); blink(eyeM, t, ph);
    };
  },

  // --- airport ------------------------------------------------------------------------------------
  luggage(g, r) {
    const c1 = pick(r, ['#e8585a', '#8a5fc8']), c2 = '#35b3b8', c3 = '#f2b53e', dk = '#4a4668', steel = '#8f9ab4';
    const p = [
      rb(0.74, 0.07, 0.54, 0.03, steel, [0, 0.12, 0]),
      cp(0.03, 0.62, steel, [-0.34, 0.46, -0.24]), cp(0.03, 0.62, steel, [0.34, 0.46, -0.24]), rb(0.74, 0.05, 0.05, 0.02, '#e8585a', [0, 0.8, -0.24]),
    ];
    for (const [x, z] of [[-0.28, -0.2], [0.28, -0.2], [-0.28, 0.2], [0.28, 0.2]]) p.push({ geo: TOR(0.04, 0.03, 6, 12), color: dk, pos: [x, 0.07, z], rot: [0, PI / 2, 0] }, cy(0.035, 0.035, 0.06, '#d8dcec', [x, 0.07, z], [0, 0, PI / 2], 8));
    // cases: [colour, size, pos]
    const cases = [[c1, [0.5, 0.28, 0.38], [0, 0.29, 0.0]], [c2, [0.4, 0.24, 0.32], [0.02, 0.55, 0.0]], [c3, [0.26, 0.2, 0.24], [-0.1, 0.77, 0.02]]];
    cases.forEach(([c, [w, h, d], [x, y, z]], i) => {
      const dkc = shade(c, 0.78);
      p.push(rb(w, h, d, 0.07, c, [x, y, z + 0.04]), rb(w + 0.012, 0.032, d + 0.012, 0.014, dkc, [x, y, z + 0.04]));   // body + seam
      for (const s of [-1, 1]) p.push(rb(0.03, h * 0.78, 0.012, 0.005, shade(c, 0.88), [x + s * w * 0.22, y, z + 0.04 + d / 2 + 0.003]));  // ribs
      p.push(rb(0.1 + i * 0.0, 0.04, 0.04, 0.018, dk, [x, y + h / 2 + 0.02, z + 0.04]));                                // handle
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) p.push(sp(0.03, dk, [x + sx * (w / 2 - 0.02), y - h / 2 + 0.03, z + 0.04 + sz * (d / 2 - 0.02)]));
    });
    // stickers + strap + tag
    p.push(cy(0.05, 0.05, 0.012, '#fff8ea', [0.12, 0.31, 0.248], [PI / 2, 0, 0]), cy(0.032, 0.032, 0.014, '#f2c14e', [0.12, 0.31, 0.25], [PI / 2, 0, 0]),
      rb(0.09, 0.06, 0.012, 0.01, '#3fae6a', [-0.14, 0.34, 0.248]), cy(0.04, 0.04, 0.012, '#4f86c6', [-0.1, 0.25, 0.248], [PI / 2, 0, 0]),
      rb(0.07, 0.05, 0.012, 0.01, '#e8585a', [0.1, 0.55, 0.208]), cy(0.035, 0.035, 0.012, '#fff8ea', [-0.1, 0.56, 0.208], [PI / 2, 0, 0]),
      rb(0.04, 0.3, 0.4, 0.015, '#fff3dc', [-0.2, 0.29, 0.04]));
    p.push(rb(0.06, 0.08, 0.012, 0.012, '#fff8ea', [0.2, 0.22, 0.255]), cp(0.006, 0.04, '#e8585a', [0.2, 0.28, 0.25]));
    vc(g, p.filter(Boolean));
  },
};
