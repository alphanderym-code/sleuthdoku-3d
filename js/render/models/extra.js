// Extra models for the Extreme scenes (golf course + zoo) in the "sunny vinyl-toy" look. Same conventions as objects.js:
// each fits a 1x1 cell, rests on y=0, front faces +z. Occupiable types (tee, flag, bunker, cart, shallows) keep their
// middle clear so a figurine can stand on them. Plush animals are merged vertex-coloured parts with a few animated bits.
import * as THREE from 'three';
import { EXTRA2_BUILDERS, EXTRA2_STAND, pick, sp, cp, rb, cy, co, tr, grp, vc, eyes, blink, flick, waterPad, rippleIdle } from './extra2.js';
import { add, addMerged, toonOwn, glowMat, shade, mix, SPH, TOR } from './kit.js';

const PI = Math.PI;

/** Figurine stand height / forward offset for the occupiable extra types (merged into standInfo). */
export const EXTRA_STAND = {
  tee: { y: 0.045, dz: 0 }, flag: { y: 0.05, dz: 0.04 }, bunker: { y: 0.03, dz: 0 },
  cart: { y: 0.3, dz: 0.06 }, shallows: { y: 0.03, dz: 0 },
  ...EXTRA2_STAND,
};

const DARK = '#3a3550', CREAM = '#fff8ea', PINK = '#f4a0a8';

const EXTRA_BUILDERS = {
  ...EXTRA2_BUILDERS,
  // --- golf ---------------------------------------------------------------------------------
  tee(g, r) {
    const turf = '#9fd864', turf2 = '#b4e374', wood = '#c28a52', woodD = '#a56e3c';
    const p = [
      rb(0.72, 0.05, 0.72, 0.03, turf, [0, 0.025, 0]),
      rb(0.86, 0.07, 0.07, 0.03, wood, [0, 0.035, 0.4]), rb(0.86, 0.07, 0.07, 0.03, wood, [0, 0.035, -0.4]),
      rb(0.07, 0.07, 0.74, 0.03, woodD, [-0.4, 0.035, 0]), rb(0.07, 0.07, 0.74, 0.03, woodD, [0.4, 0.035, 0]),
      rb(0.66, 0.006, 0.12, 0.003, turf2, [0, 0.052, 0.18]), rb(0.66, 0.006, 0.12, 0.003, turf2, [0, 0.052, -0.06]),
    ];
    for (const [x, c] of [[-0.28, '#4f86c6'], [0.28, '#e8585a']]) p.push(cp(0.022, 0.07, CREAM, [x, 0.1, -0.28]), sp(0.065, c, [x, 0.19, -0.28]), sp(0.02, shade(c, 1.4), [x + 0.02, 0.215, -0.245]));
    // sign post between the markers
    p.push(cp(0.028, 0.22, wood, [0, 0.19, -0.32]), rb(0.24, 0.15, 0.045, 0.025, CREAM, [0, 0.36, -0.32]), rb(0.24, 0.045, 0.05, 0.02, '#e8585a', [0, 0.31, -0.32]), cy(0.03, 0.03, 0.012, '#4f86c6', [0, 0.38, -0.293], [PI / 2, 0, 0]));
    // a ball on a tee, front left
    p.push(cy(0.007, 0.012, 0.06, '#f2c14e', [-0.28, 0.08, 0.28], undefined, 8), cy(0.026, 0.01, 0.02, '#f2c14e', [-0.28, 0.12, 0.28], undefined, 10), sp(0.042, CREAM, [-0.28, 0.16, 0.28]));
    vc(g, p);
  },

  flag(g, r, ph) {
    vc(g, [
      { geo: SPH(0.47, 24, 4), color: '#86c85a', pos: [0, 0, 0], scale: [1, 0.09, 1] },
      cy(0.43, 0.45, 0.02, '#a3dc6c', [0, 0.04, 0], undefined, 28), cy(0.34, 0.36, 0.016, '#bdea80', [0, 0.056, 0], undefined, 28),
      tr(0.22, 0.012, '#aadf72', [0, 0.066, 0], [PI / 2, 0, 0]), tr(0.14, 0.012, '#cdf08c', [0, 0.066, 0], [PI / 2, 0, 0]),
      cy(0.062, 0.062, 0.02, DARK, [0.14, 0.066, 0.1]), tr(0.064, 0.012, CREAM, [0.14, 0.074, 0.1], [PI / 2, 0, 0]),
      sp(0.04, CREAM, [0.3, 0.1, 0.22]), sp(0.012, '#d8d4c8', [0.31, 0.12, 0.25]),
      // chunky pole at the back corner with a red band and a gold ball
      cy(0.05, 0.06, 0.05, '#e8e4d8', [-0.28, 0.08, -0.28], undefined, 12), cp(0.022, 0.78, CREAM, [-0.28, 0.5, -0.28]), cy(0.024, 0.024, 0.1, '#e8585a', [-0.28, 0.7, -0.28], undefined, 10),
      sp(0.04, '#f2c14e', [-0.28, 0.94, -0.28]),
    ]);
    // fluttering pennant: plane geometry deformed every frame
    const W = 0.36, H = 0.2, NX = 10, NY = 3;
    const geo = new THREE.PlaneGeometry(W, H, NX, NY);
    const pos = geo.attributes.position, base = Float32Array.from(pos.array);
    for (let i = 0; i < pos.count; i++) { const u = base[i * 3] / W + 0.5; base[i * 3] = u * W; base[i * 3 + 1] = base[i * 3 + 1] * (1 - 0.7 * u); pos.setXYZ(i, base[i * 3], base[i * 3 + 1], 0); }
    const cloth = new THREE.Mesh(geo, toonOwn('#ec5a5a', { double: true }));
    cloth.position.set(-0.265, 0.84, -0.28); cloth.castShadow = true; g.add(cloth);
    const wave = (t) => {
      for (let i = 0; i < pos.count; i++) {
        const u = base[i * 3] / W;
        pos.setXYZ(i, base[i * 3], base[i * 3 + 1] + 0.01 * u * Math.sin(t * 4 + ph + u * 6), 0.045 * u * Math.sin(t * 5 + ph - u * 7));
      }
      pos.needsUpdate = true; geo.computeVertexNormals();
    };
    wave(0);
    g.userData.idle = wave;
  },

  bunker(g, r) {
    const sand = '#f4dd9c', sandL = '#fae9b4', sandD = '#e2c27c', rim = '#d8b46c';
    const p = [
      tr(0.42, 0.065, rim, [0, 0.05, 0], [PI / 2, 0, 0]), tr(0.44, 0.05, shade(rim, 1.12), [0, 0.04, 0], [PI / 2, 0, 0]),
      cy(0.42, 0.42, 0.04, sand, [0, 0.012, 0], undefined, 28),
    ];
    // rake lines in the sand
    for (let i = 0; i < 4; i++) p.push(tr(0.12 + i * 0.07, 0.008, i % 2 ? sandL : sandD, [0, 0.034, 0], [PI / 2, 0, 0], 2.2 + (i % 2) * 0.5, undefined));
    for (const [x, z, s] of [[-0.25, 0.26, 0.07], [0.3, 0.12, 0.05], [-0.33, -0.1, 0.055], [0.12, 0.34, 0.045]]) p.push(sp(s, sandL, [x, 0.035, z], [1.3, 0.4, 1]));
    // rake leaning on the rim (back right)
    p.push(cp(0.02, 0.4, '#a8703a', [0.3, 0.26, -0.37], [-0.55, 0, -0.35]), rb(0.18, 0.04, 0.05, 0.02, '#7a4a2c', [0.38, 0.06, -0.24], [0, 0.5, 0]), sp(0.03, '#f2c14e', [0.22, 0.46, -0.43]));
    vc(g, p);
  },

  cart(g, r) {
    const body = pick(r, ['#fff8ea', '#f6efdc', '#d6ecff']);
    const trim = pick(r, ['#3fae6a', '#4f86c6', '#e8585a']);
    const seat = '#e0c690', steel = '#c8cfdf';
    const p = [];
    for (const [x, z] of [[-0.32, -0.28], [0.32, -0.28], [-0.32, 0.28], [0.32, 0.28]]) p.push({ geo: TOR(0.07, 0.048, 6, 14), color: '#3e3a58', pos: [x, 0.12, z], rot: [0, PI / 2, 0] }, cy(0.06, 0.06, 0.07, steel, [x, 0.12, z], [0, 0, PI / 2], 10));
    p.push(
      rb(0.64, 0.14, 0.9, 0.06, body, [0, 0.18, 0]), rb(0.66, 0.11, 0.3, 0.05, body, [0, 0.26, 0.34]), rb(0.66, 0.05, 0.9, 0.02, trim, [0, 0.14, 0.0]),
      rb(0.7, 0.06, 0.07, 0.03, '#4a4668', [0, 0.14, 0.5]), rb(0.7, 0.06, 0.07, 0.03, '#4a4668', [0, 0.14, -0.5]),
      rb(0.5, 0.07, 0.3, 0.035, seat, [0, 0.25, 0.04]), rb(0.5, 0.22, 0.06, 0.03, seat, [0, 0.4, -0.14]),
      tr(0.065, 0.014, '#4a4668', [0, 0.47, 0.29], [-0.9, 0, 0]), cp(0.014, 0.12, '#4a4668', [0, 0.38, 0.32], [-0.9, 0, 0]),
      rb(0.8, 0.065, 0.88, 0.05, trim, [0, 0.82, 0.0]), rb(0.74, 0.03, 0.8, 0.02, shade(trim, 1.3), [0, 0.79, 0.0]),
    );
    for (const [x, z] of [[-0.34, 0.33], [0.34, 0.33], [-0.34, -0.3], [0.34, -0.3]]) p.push(cp(0.026, 0.46, CREAM, [x, 0.55, z]));
    // golf bag at the back
    p.push(cp(0.08, 0.2, '#3f5f9a', [0.18, 0.42, -0.34], [-0.12, 0, 0.1]), cp(0.082, 0.05, '#e8585a', [0.18, 0.5, -0.335], [-0.12, 0, 0.1]), tr(0.08, 0.016, DARK, [0.2, 0.6, -0.355], [PI / 2 - 0.12, 0, 0.1]));
    [['#f2c14e', 0.12], ['#e8585a', 0.19], ['#fff8ea', 0.26]].forEach(([c, x], i) => p.push(cp(0.017, 0.2, steel, [x + 0.02, 0.68 + i * 0.015, -0.355], [-0.12, 0, 0.1]), sp(0.036, c, [x + 0.03, 0.79 + i * 0.015, -0.35])));
    vc(g, p);
    addMerged(g, [{ geo: SPH(0.042, 8, 6), pos: [-0.22, 0.27, 0.485], scale: [1, 1, 0.6] }, { geo: SPH(0.042, 8, 6), pos: [0.22, 0.27, 0.485], scale: [1, 1, 0.6] }], glowMat('#fff2b8', '#ffe27a', { night: 2.2 }), { shadow: false });
    addMerged(g, [{ geo: SPH(0.03, 8, 6), pos: [-0.24, 0.23, -0.46], scale: [1, 1, 0.6] }, { geo: SPH(0.03, 8, 6), pos: [0.24, 0.23, -0.46], scale: [1, 1, 0.6] }], glowMat('#ff8a80', '#ff4a40', { night: 1.6 }), { shadow: false });
  },

  // --- zoo water (occupiable) ---------------------------------------------------------------------
  shallows(g, r, ph) {
    const rings = waterPad(g, 0.46, 0, ph);
    const p = [tr(0.46, 0.04, '#e8d4a8', [0, 0.03, 0], [PI / 2, 0, 0]), tr(0.5, 0.025, '#d6bd8c', [0, 0.02, 0], [PI / 2, 0, 0])];
    // pebbles around the edge and a lily pad with a flower
    for (let i = 0; i < 7; i++) { const a = 0.5 + i * 0.85; p.push(sp(0.035 + 0.02 * r(), i % 2 ? '#d9c8a8' : '#b9a98c', [Math.cos(a) * 0.45, 0.04, Math.sin(a) * 0.45], [1.2, 0.7, 1])); }
    p.push(cy(0.09, 0.09, 0.01, '#5fb85f', [-0.2, 0.058, -0.24], undefined, 14), cy(0.06, 0.06, 0.012, '#7ccc6c', [0.26, 0.058, -0.2], undefined, 12),
      sp(0.04, '#f6a0c0', [-0.2, 0.09, -0.24], [1, 0.7, 1]), sp(0.02, '#f2c14e', [-0.2, 0.105, -0.24]));
    vc(g, p);
    g.userData.idle = (t) => rippleIdle(rings, t, ph);
  },

  // --- zoo animals (blocking) ---------------------------------------------------------------------
  bear(g, r, ph) {
    const fur = pick(r, ['#a06e48', '#80563c', '#b98d5e']), dark = shade(fur, 0.74), light = mix(fur, '#f8e0b8', 0.6);
    const body = grp(g);
    const b = [sp(0.3, fur, [0, 0.31, -0.04], [1.02, 1.04, 0.95]), sp(0.2, light, [0, 0.3, 0.15], [0.9, 1.05, 0.5]), sp(0.075, fur, [0, 0.17, -0.31])];
    for (const s of [-1, 1]) b.push(sp(0.12, fur, [s * 0.22, 0.1, 0.14], [1, 0.8, 1.25]), sp(0.07, dark, [s * 0.22, 0.11, 0.27], [1, 0.9, 0.35]), cp(0.075, 0.13, fur, [s * 0.29, 0.32, 0.1], [-0.35, 0, s * 0.28]));
    vc(body, b);
    const head = grp(body, 0, 0.64, 0.1);
    const h = [sp(0.25, fur, [0, 0, 0], [1.08, 0.96, 1]), sp(0.115, light, [0, -0.065, 0.19], [1, 0.82, 0.85]), sp(0.04, DARK, [0, -0.025, 0.272], [1.2, 0.8, 0.8]),
      tr(0.035, 0.008, DARK, [0, -0.095, 0.275], [0, 0, PI], PI)];
    for (const s of [-1, 1]) { h.push(sp(0.04, PINK, [s * 0.15, -0.045, 0.19], [1, 0.8, 0.4])); if (s < 0) h.push(sp(0.085, fur, [-0.18, 0.2, -0.02]), sp(0.05, PINK, [-0.18, 0.195, 0.04], [1, 1, 0.5])); }
    vc(head, h);
    const ear = grp(head, 0.18, 0.2, -0.02);
    vc(ear, [sp(0.085, fur, [0, 0, 0]), sp(0.05, PINK, [0, -0.005, 0.06], [1, 1, 0.5])]);
    const eyeM = eyes(head, 0, 0.04, 0.228, 0.036, 0.095);
    g.userData.idle = (t) => {
      const k = 1 + 0.02 * Math.sin(t * 1.8 + ph); body.scale.y = k; head.position.y = 0.64 * k;
      head.rotation.z = 0.05 * Math.sin(t * 0.9 + ph); head.rotation.y = 0.12 * Math.sin(t * 0.6 + ph * 2);
      ear.rotation.z = -0.5 * flick(t, ph, 5.3); blink(eyeM, t, ph);
    };
  },

  lion(g, r, ph) {
    const fur = '#eab45c', light = '#f8e2ac', mane = pick(r, ['#a8622c', '#c27a38', '#8a4a26']), mane2 = shade(mane, 1.18);
    const body = grp(g);
    const b = [sp(0.27, fur, [0, 0.29, -0.05], [1, 1, 1.1]), sp(0.19, light, [0, 0.28, 0.13], [0.85, 1.05, 0.5])];
    for (const s of [-1, 1]) b.push(sp(0.115, fur, [s * 0.2, 0.1, 0.14], [1, 0.8, 1.25]), sp(0.065, '#d9906a', [s * 0.2, 0.11, 0.26], [1, 0.9, 0.35]), cp(0.07, 0.13, fur, [s * 0.26, 0.3, 0.1], [-0.35, 0, s * 0.25]));
    vc(body, b);
    const head = grp(body, 0, 0.6, 0.1);
    const h = [sp(0.32, mane, [0, 0, -0.06], [1, 1, 0.72]), sp(0.2, fur, [0, -0.01, 0.1], [1.05, 0.95, 0.9]), sp(0.1, light, [0, -0.075, 0.22], [1.1, 0.8, 0.8]),
      sp(0.035, '#c0604a', [0, -0.035, 0.282], [1.2, 0.8, 0.8]), tr(0.032, 0.008, DARK, [0, -0.1, 0.275], [0, 0, PI], PI)];
    for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2 + 0.3; h.push(sp(0.1, i % 2 ? mane : mane2, [Math.cos(a) * 0.27, Math.sin(a) * 0.27, -0.07 - 0.02 * (i % 2)])); }
    for (const s of [-1, 1]) h.push(sp(0.04, PINK, [s * 0.13, -0.06, 0.2], [1, 0.8, 0.4]), sp(0.07, fur, [s * 0.15, 0.22, 0.05]), sp(0.04, PINK, [s * 0.15, 0.215, 0.1], [1, 1, 0.5]));
    vc(head, h);
    const eyeM = eyes(head, 0, 0.035, 0.258, 0.034, 0.085);
    const tail = grp(body, 0.1, 0.2, -0.32);
    vc(tail, [cp(0.03, 0.2, fur, [0, 0.12, 0]), sp(0.065, mane, [0, 0.27, 0], [1, 1.3, 1])]);
    tail.rotation.set(-0.8, 0, 0.35);
    g.userData.idle = (t) => {
      const k = 1 + 0.02 * Math.sin(t * 1.7 + ph); body.scale.y = k; head.position.y = 0.6 * k;
      head.rotation.z = 0.05 * Math.sin(t * 0.8 + ph); head.rotation.y = 0.1 * Math.sin(t * 0.55 + ph * 2);
      tail.rotation.z = 0.35 + 0.3 * Math.sin(t * 1.9 + ph); blink(eyeM, t, ph);
    };
  },

  elephant(g, r, ph) {
    const hide = pick(r, ['#a4aec6', '#b3adb6', '#98a4c4']), dk = shade(hide, 0.84), inner = mix(hide, '#f4b0c0', 0.5), lt = shade(hide, 1.12);
    const body = grp(g);
    const b = [sp(0.34, hide, [0, 0.42, -0.08], [0.98, 0.96, 1.08]), sp(0.2, lt, [0, 0.36, 0.2], [1, 1.1, 0.5]), sp(0.06, dk, [0, 0.4, -0.45], [1, 1, 1.2])];
    for (const [x, z] of [[-0.2, 0.17], [0.2, 0.17], [-0.2, -0.28], [0.2, -0.28]]) b.push(cy(0.11, 0.12, 0.24, dk, [x, 0.12, z], undefined, 12), sp(0.045, '#f6ecd8', [x, 0.04, z + 0.1], [1.7, 0.8, 0.7]));
    vc(body, b);
    const head = grp(body, 0, 0.56, 0.27);
    const h = [sp(0.235, hide, [0, 0, 0], [1, 1, 0.95]), sp(0.06, lt, [0, 0.19, 0.05], [1.3, 0.7, 1])];
    for (const s of [-1, 1]) h.push(co(0.034, 0.15, '#fff6df', [s * 0.12, -0.12, 0.2], [1.9, 0, s * 0.25], undefined, 8), sp(0.04, PINK, [s * 0.15, -0.04, 0.17], [1, 0.8, 0.4]));
    vc(head, h);
    const eyeM = eyes(head, 0, 0.06, 0.2, 0.034, 0.125);
    const trunk = grp(head, 0, -0.03, 0.2);
    vc(trunk, [sp(0.095, hide, [0, -0.04, 0.03]), sp(0.088, hide, [0, -0.14, 0.07]), sp(0.08, hide, [0, -0.23, 0.12]), sp(0.073, hide, [0, -0.3, 0.2]), sp(0.068, hide, [0, -0.31, 0.29]), sp(0.04, dk, [0, -0.28, 0.34], [1.6, 0.8, 0.8])]);
    const ears = [-1, 1].map((s) => {
      const e = grp(head, s * 0.19, 0.02, -0.04);
      vc(e, [sp(0.21, dk, [s * 0.12, 0, 0], [0.2, 1, 0.88]), sp(0.15, inner, [s * 0.135, -0.01, 0.01], [0.16, 0.9, 0.8])]);
      return e;
    });
    g.userData.idle = (t) => {
      const k = 1 + 0.018 * Math.sin(t * 1.6 + ph); body.scale.y = k; head.position.y = 0.56 * k;
      head.rotation.y = 0.12 * Math.sin(t * 0.5 + ph * 2); trunk.rotation.x = 0.18 * Math.sin(t * 1.5 + ph); trunk.rotation.y = 0.12 * Math.sin(t * 0.9 + ph);
      ears[0].rotation.y = 0.25 * Math.sin(t * 2.4 + ph) - 0.15 + 0.3 * flick(t, ph, 6); ears[1].rotation.y = -0.25 * Math.sin(t * 2.4 + ph + 0.8) + 0.15; blink(eyeM, t, ph);
    };
  },

  penguin(g, r, ph) {
    const navy = '#2f3556', belly = '#fff8ea', orange = '#f5a040', red = '#e8585a';
    const pg = grp(g);
    const b = [sp(0.24, navy, [0, 0.3, -0.01], [1, 1.2, 0.95]), sp(0.2, belly, [0, 0.29, 0.1], [0.92, 1.18, 0.6]),
      sp(0.2, navy, [0, 0.64, 0], [1.05, 0.95, 1]), sp(0.09, belly, [-0.075, 0.63, 0.15], [1, 1.15, 0.5]), sp(0.09, belly, [0.075, 0.63, 0.15], [1, 1.15, 0.5]),
      sp(0.045, orange, [0, 0.6, 0.2], [1.4, 0.7, 1]), sp(0.012, shade(orange, 0.8), [0, 0.595, 0.235], [3, 0.4, 1]),
      tr(0.185, 0.045, red, [0, 0.5, 0.0], [PI / 2, 0, 0.0]), rb(0.07, 0.14, 0.04, 0.02, red, [0.1, 0.4, 0.17], [0, 0, 0.1])];
    for (const s of [-1, 1]) b.push(sp(0.07, orange, [s * 0.09, 0.03, 0.12], [1, 0.35, 1.4]), sp(0.035, PINK, [s * 0.15, 0.58, 0.16], [1, 0.8, 0.4]));
    vc(pg, b);
    const eyeM = eyes(pg, 0, 0.67, 0.178, 0.034, 0.075);
    const flippers = [-1, 1].map((s) => { const f = grp(pg, s * 0.23, 0.5, 0); vc(f, [sp(0.075, navy, [s * 0.05, -0.1, 0], [0.4, 1.6, 1])]); return f; });
    g.userData.idle = (t) => {
      pg.rotation.z = 0.06 * Math.sin(t * 1.8 + ph); pg.position.y = 0.012 * (1 + Math.sin(t * 3.6 + ph));
      const fl = 0.2 + 0.25 * Math.max(0, Math.sin(t * 2.4 + ph)) + 0.9 * flick(t, ph, 7, 0.8);
      flippers[0].rotation.z = fl; flippers[1].rotation.z = -fl; blink(eyeM, t, ph);
    };
  },

  croc(g0, r, ph) {
    const g = grp(g0, 0, 0, 0.02); g.scale.setScalar(0.72);
    const hide = pick(r, ['#68b85c', '#56a85a', '#78c86c']), dk = shade(hide, 0.78), lt = shade(hide, 1.2), belly = '#f4eab0';
    const b = [cp(0.15, 0.34, hide, [0, 0.17, -0.05], [PI / 2, 0, 0], [1.1, 1, 0.95]), sp(0.14, belly, [0, 0.09, 0.0], [1, 0.55, 2.0])];
    for (let i = 0; i < 5; i++) b.push(sp(0.045 - i * 0.002, lt, [0, 0.315 - (i > 3 ? 0.01 : 0), 0.15 - i * 0.1], [0.8, 1, 1.3]));
    for (const s of [-1, 1]) for (const z of [0.12, -0.22]) b.push(sp(0.07, dk, [s * 0.2, 0.07, z], [1, 0.8, 1.4]), sp(0.03, '#f6ecd0', [s * 0.2, 0.045, z + 0.09]));
    vc(g, b);
    const tail = grp(g, 0, 0.14, -0.34);
    vc(tail, [sp(0.12, hide, [0, 0, -0.07], [0.9, 0.8, 1.3]), sp(0.09, hide, [0, -0.01, -0.2], [0.85, 0.8, 1.4]), sp(0.062, hide, [0, -0.02, -0.33], [0.8, 0.8, 1.4]), sp(0.036, dk, [0, -0.03, -0.44], [0.8, 0.8, 1.4]),
      sp(0.04, lt, [0, 0.09, -0.07], [0.8, 1, 1.3]), sp(0.034, lt, [0, 0.07, -0.2], [0.8, 1, 1.3])]);
    tail.rotation.y = 0.7;
    const head = grp(g, 0, 0.15, 0.3);
    const h = [rb(0.3, 0.13, 0.27, 0.055, hide, [0, 0.04, 0.02]), rb(0.22, 0.09, 0.32, 0.04, lt, [0, 0.01, 0.2]), sp(0.016, DARK, [-0.05, 0.062, 0.36]), sp(0.016, DARK, [0.05, 0.062, 0.36])];
    for (const s of [-1, 1]) {
      h.push(sp(0.055, hide, [s * 0.1, 0.11, 0.04]), sp(0.042, '#f6d84a', [s * 0.1, 0.125, 0.075]), sp(0.03, PINK, [s * 0.15, 0.03, 0.1], [1, 0.8, 0.4]));
      for (let i = 0; i < 3; i++) h.push(co(0.014, 0.035, CREAM, [s * 0.1, -0.04, 0.12 + i * 0.09], [PI, 0, 0], undefined, 5));
    }
    vc(head, h);
    const eyeM = eyes(head, 0, 0.13, 0.108, 0.026, 0.1);
    const jaw = grp(head, 0, -0.02, 0.06);
    const j = [rb(0.24, 0.05, 0.34, 0.03, belly, [0, -0.04, 0.14])];
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) j.push(co(0.012, 0.03, CREAM, [s * 0.1, -0.005, 0.1 + i * 0.09], undefined, undefined, 5));
    vc(jaw, j);
    g.userData.idle = (t) => {
      tail.rotation.y = 0.7 + 0.3 * Math.sin(t * 1.6 + ph); jaw.rotation.x = 0.04 + 0.12 * Math.max(0, Math.sin(t * 0.9 + ph)) ** 2 + 0.2 * flick(t, ph, 6, 0.8);
      head.rotation.y = 0.12 * Math.sin(t * 0.7 + ph); blink(eyeM, t, ph);
    };
  },

  shark(g, r, ph) {
    const rings = waterPad(g, 0.44, 0, ph);
    vc(g, [tr(0.45, 0.04, '#e8d4a8', [0, 0.03, 0], [PI / 2, 0, 0]), tr(0.49, 0.025, '#d6bd8c', [0, 0.02, 0], [PI / 2, 0, 0])]);
    const blue = '#7f9cc8', fin = shade(blue, 0.82), white = '#f4f6ff';
    const sk = grp(g, 0, 0, 0);
    const b = [sp(0.17, blue, [0, 0.07, 0], [0.9, 0.85, 1.7]), sp(0.15, white, [0, 0.03, 0.05], [0.85, 0.5, 1.5]),
      sp(0.1, fin, [0, 0.27, -0.02], [0.13, 1.35, 0.9], [-0.28, 0, 0]), sp(0.055, shade(fin, 0.85), [0, 0.37, -0.08], [0.14, 1.2, 0.9], [-0.28, 0, 0]),
      tr(0.07, 0.011, DARK, [0, 0.09, 0.265], [0.35, 0, PI], PI)];
    for (const s of [-1, 1]) {
      b.push(sp(0.07, fin, [s * 0.16, 0.08, 0.07], [1.5, 0.22, 0.8], [0, 0, s * 0.35]), sp(0.036, PINK, [s * 0.125, 0.1, 0.19], [1, 0.8, 0.4]));
      for (let i = 0; i < 2; i++) b.push(co(0.012, 0.03, CREAM, [s * (0.02 + i * 0.03), 0.075, 0.28 - i * 0.01], [PI, 0, 0], undefined, 5));
    }
    vc(sk, b);
    const eyeM = eyes(sk, 0, 0.14, 0.205, 0.032, 0.083);
    const tail = grp(sk, 0, 0.07, -0.27);
    vc(tail, [sp(0.09, blue, [0, 0, -0.1], [0.7, 0.7, 1.2]), sp(0.09, fin, [0, 0.1, -0.22], [0.12, 1.2, 0.8], [0.45, 0, 0]), sp(0.065, fin, [0, -0.01, -0.22], [0.12, 1.1, 0.8], [-0.5, 0, 0])]);
    g.userData.idle = (t) => {
      const a = t * 0.55 + ph; sk.position.set(0.09 * Math.cos(a), 0.012 * Math.sin(t * 2 + ph), 0.09 * Math.sin(a)); sk.rotation.y = -a;
      tail.rotation.y = 0.45 * Math.sin(t * 3.2 + ph); sk.rotation.z = 0.04 * Math.sin(t * 2 + ph); blink(eyeM, t, ph); rippleIdle(rings, t, ph);
    };
  },
};

/** Builds an extra type into group g. Returns true when handled, false for an unknown type. */
export function buildExtra(type, g, r, ph) {
  const b = EXTRA_BUILDERS[type];
  if (!b) return false;
  b(g, r, ph);
  return true;
}
export const hasExtra = (type) => type in EXTRA_BUILDERS;
