// Chunky "vinyl toy" furniture / prop builders. Each fits a 1x1 cell, rests on y=0, front faces +z.
// Most bodies are merged vertex-coloured parts (addVC); glowing bits (screens, flames, lamps, windows) use glowMat so they shine at night.
import * as THREE from 'three';
import {
  add, addVC, addMerged, toon, toonOwn, glowMat, texToon, rng, shade, mix,
  RB, BOX, CYL, SPH, ICO, CONE, TOR, CAPS,
} from './kit.js';
import { PI, C, T, BOOKS, PAINTS, makeSteam, makeFireGlow, legs4, pick } from './common.js';
import { NATURE_BUILDERS } from './nature.js';
import { buildExtra, hasExtra, EXTRA_STAND } from './extra.js';

/** Height a figurine stands at when on this object type, plus a small forward offset. */
const STAND = {
  chair: { y: 0.24, dz: 0.05 }, sofa: { y: 0.24, dz: 0.05 }, bed: { y: 0.27, dz: 0.04 },
  rug: { y: 0.04, dz: 0 }, bench: { y: 0.225, dz: 0 }, towel: { y: 0.04, dz: 0 }, stool: { y: 0.5, dz: 0 },
  car: { y: 0.34, dz: -0.02 }, boat: { y: 0.25, dz: 0 }, bathtub: { y: 0.53, dz: 0 },
};
export function standInfo(type) { return STAND[type] || EXTRA_STAND[type] || { y: 0, dz: 0 }; }

// ---------------------------------------------------------------------------
// Textures (shared, cached)
// ---------------------------------------------------------------------------
const CLOTHS = ['#ef6f5e', '#4fa8d9', '#3fb8af'];
const clothTex = (v = 0) => texToon(`gingham${v}`, 128, 128, (x, w, h) => {
  x.fillStyle = '#fff8ee'; x.fillRect(0, 0, w, h);
  x.fillStyle = CLOTHS[v] + '88';
  const n = 8, s = w / n;
  for (let i = 0; i < n; i += 2) { x.fillRect(i * s, 0, s, h); x.fillRect(0, i * s, w, s); }
  x.strokeStyle = CLOTHS[v]; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6);
});
const brickTex = () => texToon('brick2', 128, 128, (x, w, h) => {
  x.fillStyle = '#f0dcc0'; x.fillRect(0, 0, w, h);
  const rows = 6, bh = h / rows;
  for (let j = 0; j < rows; j++) {
    const off = (j % 2) * (w / 8);
    for (let i = -1; i < 4; i++) {
      x.fillStyle = ['#d9715a', '#e48464', '#cf6650', '#ea9068'][(i * 3 + j * 5 + 8) % 4];
      x.fillRect(i * (w / 4) + off + 3, j * bh + 3, w / 4 - 6, bh - 6);
    }
  }
});
const RUGS = [
  ['#ef6f5e', '#fbefd2', '#2f8fa8', '#f7c948'], ['#3fb8af', '#fbefd2', '#ef6f5e', '#f7e07a'], ['#9a63b5', '#f7e4f2', '#f2994a', '#fff2a8'],
];
const rugTex = (v) => texToon(`rug${v}`, 256, 256, (x, w, h) => {
  const [a, b, c, d] = RUGS[v];
  x.fillStyle = a; x.fillRect(0, 0, w, h);
  x.strokeStyle = b; x.lineWidth = 12; x.strokeRect(16, 16, w - 32, h - 32);
  x.strokeStyle = c; x.lineWidth = 7; x.strokeRect(36, 36, w - 72, h - 72);
  for (let i = 0; i < 12; i++) { // border triangles
    const p = 40 + i * ((w - 80) / 11);
    x.fillStyle = d;
    x.beginPath(); x.moveTo(p - 8, 22); x.lineTo(p + 8, 22); x.lineTo(p, 36); x.fill();
    x.beginPath(); x.moveTo(p - 8, h - 22); x.lineTo(p + 8, h - 22); x.lineTo(p, h - 36); x.fill();
    x.beginPath(); x.moveTo(22, p - 8); x.lineTo(22, p + 8); x.lineTo(36, p); x.fill();
    x.beginPath(); x.moveTo(w - 22, p - 8); x.lineTo(w - 22, p + 8); x.lineTo(w - 36, p); x.fill();
  }
  x.save(); x.translate(w / 2, h / 2);
  for (const [s, col] of [[84, b], [62, c], [42, d], [22, a]]) { x.fillStyle = col; x.rotate(PI / 4); x.fillRect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4); }
  x.restore();
});
const TOWELS = [['#ff7b7b', '#fff6e0'], ['#4fb3d9', '#fff6e0'], ['#f7c948', '#fffdf6']];
const towelTex = (v) => texToon(`towel${v}`, 128, 256, (x, w, h) => {
  const [a, b] = TOWELS[v];
  x.fillStyle = b; x.fillRect(0, 0, w, h);
  const n = 9, s = h / n;
  for (let i = 0; i < n; i += 2) { x.fillStyle = a; x.fillRect(0, i * s, w, s); }
  x.fillStyle = shade(a, 0.85); x.fillRect(0, 0, w, 10); x.fillRect(0, h - 10, w, 10);
});
const pageTex = () => texToon('page', 64, 64, (x, w, h) => {
  x.fillStyle = '#fffdf6'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#9aa0b8';
  for (let i = 0; i < 6; i++) x.fillRect(8, 8 + i * 9, w - 16 - (i % 3) * 8, 3);
});

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
/** A merge part: geometry + colour + position (+ rot / scale / ry in `o`). */
const p = (geo, color, pos, o) => ({ geo, color, pos, ...o });
const MET = '#d3d7e2', GOLD = '#f2c14e', DARK = '#3a3550';
const glossy = (c) => toon(c, { rough: 0.3 });
/** Shared teardrop flame (lathe), height 1 unit, base at y=0. */
let _flame = null;
const flameGeo = () => _flame || (_flame = new THREE.LatheGeometry([[0, 0], [0.45, 0.03], [0.8, 0.18], [0.82, 0.38], [0.6, 0.6], [0.3, 0.82], [0, 1]].map(([x, y]) => new THREE.Vector2(x, y)), 12));
/** Own (animatable) emissive material whose strength follows the shared glow level; call set(f) with a flicker factor. */
function flickMat(color, emissive, opts) {
  const ref = glowMat(color, emissive, opts);
  const m = toonOwn(color, { emissive, rough: 0.5 });
  m.emissiveIntensity = ref.emissiveIntensity;
  return { m, set: (f) => { m.emissiveIntensity = ref.emissiveIntensity * f; } };
}

// ---------------------------------------------------------------------------
// Builders: (g, r, ph) => void. r = seeded rng, ph = phase offset for idle.
// ---------------------------------------------------------------------------
const BUILDERS = {
  ...NATURE_BUILDERS,

  table(g, r) {
    const pc = pick(r, PAINTS), leg = r() < 0.55 ? pc : C.woodDark, v = Math.floor(r() * 3) % 3;
    const s = [];
    for (const [x, z] of legs4(0.36, 0.36)) {
      s.push(p(CYL(0.065, 0.042, 0.4, 10), leg, [x, 0.2, z]));
      s.push(p(SPH(0.05, 8, 6), shade(leg, 0.82), [x, 0.02, z], { scale: [1, 0.45, 1] }));
    }
    s.push(p(RB(0.8, 0.09, 0.8, 0.035, 2), C.woodDeep, [0, 0.365, 0]));
    s.push(p(RB(0.98, 0.05, 0.98, 0.02, 2), C.wood, [0, 0.41, 0]));
    s.push(p(RB(0.98, 0.065, 0.98, 0.04, 2), C.woodLight, [0, 0.4325, 0]));
    const plate = (x, z) => { s.push(p(CYL(0.1, 0.08, 0.022, 18), C.white, [x, 0.476, z]), p(CYL(0.062, 0.062, 0.01, 14), '#cfe4f7', [x, 0.484, z])); };
    plate(-0.2, 0.2); plate(0.2, 0.2);
    s.push(p(SPH(0.04, 8, 6), '#f2994a', [-0.2, 0.51, 0.2]), p(CAPS(0.032, 0.08, 3, 6), '#e6a85c', [0.2, 0.51, 0.2], { rot: [0, 0.5, PI / 2] }));
    // teacup + saucer
    s.push(p(CYL(0.07, 0.06, 0.012, 14), C.white, [0.22, 0.474, -0.2]), p(CYL(0.052, 0.04, 0.062, 14), pc, [0.22, 0.508, -0.2]), p(TOR(0.026, 0.009, 5, 10), pc, [0.275, 0.51, -0.2]));
    // vase with flowers
    s.push(p(SPH(0.06, 10, 8), '#5aa8e0', [-0.12, 0.51, -0.14], { scale: [1, 1.15, 1] }), p(CYL(0.03, 0.04, 0.03, 10), '#5aa8e0', [-0.12, 0.568, -0.14]));
    ['#ff7b9c', '#f7c948', '#ffffff'].forEach((c, i) => {
      const a = i * 2.1, x = -0.12 + Math.cos(a) * 0.05, z = -0.14 + Math.sin(a) * 0.05;
      s.push(p(CAPS(0.008, 0.08, 2, 4), '#4fae5a', [x * 0.5 - 0.06, 0.6, z * 0.5 - 0.07], { rot: [0, 0, 0] }));
      s.push(p(SPH(0.038, 8, 6), c, [x, 0.65 + i * 0.012, z]), p(SPH(0.016, 6, 5), '#f2994a', [x, 0.665 + i * 0.012, z + 0.03]));
    });
    addVC(g, s);
    add(g, new THREE.PlaneGeometry(0.66, 0.66), clothTex(v), { pos: [0, 0.4665, 0], rot: [-PI / 2, 0, PI / 4], ...T });
  },

  counter(g, r) {
    const pc = pick(r, [C.cream2, C.mint, C.sky, C.coral, C.teal]);
    const s = [
      p(RB(0.9, 0.09, 0.68, 0.035, 2), C.woodDeep, [0, 0.045, 0]),
      p(RB(0.96, 0.46, 0.74, 0.06, 2), pc, [0, 0.3, 0]),
      p(RB(1.0, 0.07, 0.82, 0.035, 2), '#fbf4e4', [0, 0.565, 0]),
      p(RB(0.42, 0.34, 0.03, 0.02, 1), C.woodLight, [-0.22, 0.3, 0.375]),
      p(RB(0.42, 0.15, 0.03, 0.02, 1), C.woodLight, [0.22, 0.38, 0.375]),
      p(RB(0.42, 0.15, 0.03, 0.02, 1), C.woodLight, [0.22, 0.2, 0.375]),
      p(SPH(0.022, 6, 5), GOLD, [-0.07, 0.3, 0.4]), p(SPH(0.022, 6, 5), GOLD, [0.22, 0.38, 0.4]), p(SPH(0.022, 6, 5), GOLD, [0.22, 0.2, 0.4]),
      // fruit bowl
      p(SPH(0.12, 12, 8), '#5aa8e0', [-0.26, 0.62, -0.08], { scale: [1, 0.55, 1] }), p(CYL(0.05, 0.06, 0.02, 10), '#4a90c8', [-0.26, 0.605, -0.08]),
      p(SPH(0.05, 8, 6), '#ef4a4a', [-0.3, 0.7, -0.08]), p(SPH(0.05, 8, 6), '#f2994a', [-0.22, 0.7, -0.05]),
      p(SPH(0.045, 8, 6), '#a8d84a', [-0.25, 0.73, -0.12]), p(SPH(0.042, 8, 6), '#ffd84d', [-0.24, 0.735, -0.04]),
      // cake on a stand
      p(CYL(0.03, 0.045, 0.07, 10), C.white, [0.26, 0.64, -0.2]), p(CYL(0.13, 0.12, 0.018, 16), C.white, [0.26, 0.68, -0.2]),
      p(CYL(0.095, 0.095, 0.075, 16), '#f59ab8', [0.26, 0.725, -0.2]), p(CYL(0.1, 0.1, 0.025, 16), '#fff6e8', [0.26, 0.77, -0.2]),
      p(SPH(0.03, 8, 6), '#e03a4a', [0.26, 0.805, -0.2]),
      // bread board + loaf, jar of cookies
      p(RB(0.28, 0.025, 0.2, 0.012, 1), C.woodLight, [0.22, 0.61, 0.14], { rot: [0, 0.2, 0] }),
      p(CAPS(0.05, 0.14, 4, 8), '#e6a24c', [0.22, 0.67, 0.14], { rot: [0, 0.2, PI / 2] }),
      p(CYL(0.065, 0.065, 0.14, 12), '#d8ecfb', [-0.3, 0.675, 0.2]), p(CYL(0.07, 0.07, 0.035, 12), C.coral, [-0.3, 0.77, 0.2]),
      p(SPH(0.04, 6, 5), '#b8763f', [-0.3, 0.66, 0.2]), p(SPH(0.036, 6, 5), '#d9965a', [-0.3, 0.72, 0.2]),
    ];
    addVC(g, s);
  },

  oven(g, r, ph) {
    const pc = pick(r, [C.cream2, C.mint, '#8cc8ef', '#ffb09a']);
    const s = [];
    for (const [x, z] of legs4(0.37, 0.3)) s.push(p(SPH(0.05, 8, 6), DARK, [x, 0.03, z], { scale: [1, 0.7, 1] }));
    s.push(
      p(RB(0.92, 0.58, 0.78, 0.07, 3), pc, [0, 0.34, 0]),
      p(RB(0.96, 0.07, 0.82, 0.035, 2), '#46405e', [0, 0.64, 0]),
      p(RB(0.96, 0.22, 0.09, 0.045, 2), shade(pc, 0.9), [0, 0.76, -0.36]),
      p(RB(0.84, 0.12, 0.05, 0.03, 1), shade(pc, 0.88), [0, 0.57, 0.4]),
      p(RB(0.78, 0.38, 0.06, 0.05, 2), '#4a4466', [0, 0.3, 0.41]),
      p(CAPS(0.018, 0.5, 3, 6), MET, [0, 0.5, 0.48], { rot: [0, 0, PI / 2] }),
      p(CYL(0.014, 0.014, 0.05, 6), MET, [-0.26, 0.5, 0.455], { rot: [PI / 2, 0, 0] }), p(CYL(0.014, 0.014, 0.05, 6), MET, [0.26, 0.5, 0.455], { rot: [PI / 2, 0, 0] }),
    );
    for (let i = 0; i < 4; i++) s.push(p(CYL(0.036, 0.036, 0.05, 10), C.coral, [-0.3 + i * 0.2, 0.57, 0.44], { rot: [PI / 2, 0, 0] }), p(SPH(0.014, 5, 4), C.cream, [-0.3 + i * 0.2, 0.6, 0.47]));
    for (const [x, z] of [[-0.22, -0.17], [0.22, -0.17], [-0.22, 0.17], [0.22, 0.17]]) s.push(p(TOR(0.08, 0.017, 6, 14), '#8a85a0', [x, 0.68, z], { rot: [PI / 2, 0, 0] }), p(CYL(0.045, 0.045, 0.012, 10), '#58546e', [x, 0.676, z]));
    // pot with lid
    s.push(p(CYL(0.105, 0.105, 0.13, 16), '#e0605a', [0.22, 0.755, -0.17]), p(CYL(0.11, 0.11, 0.025, 16), '#b84a46', [0.22, 0.832, -0.17]), p(SPH(0.03, 8, 6), MET, [0.22, 0.87, -0.17]));
    for (const sx of [-1, 1]) s.push(p(SPH(0.026, 6, 5), MET, [0.22 + sx * 0.125, 0.77, -0.17]));
    addVC(g, s);
    const win = flickMat('#ffc266', '#ff8a2a', { day: 0.45, night: 1.9 });
    add(g, RB(0.56, 0.22, 0.03, 0.05, 2), win.m, { pos: [0, 0.31, 0.445], ...T });
    const steam = makeSteam(g, 0.22, 0.93, -0.17, ph, 3, 0.32, 0.05);
    g.userData.idle = (t) => { win.set(1 + 0.22 * Math.sin(t * 2.6 + ph) + 0.1 * Math.sin(t * 7 + ph)); steam(t); };
  },

  shelf(g, r) {
    const pc = pick(r, [C.teal, C.coral, C.plum, C.sky, C.mint]);
    const H = 0.98;
    const s = [
      p(RB(0.94, H, 0.05, 0.02, 1), pc, [0, H / 2, -0.3]),
      p(RB(0.07, H, 0.48, 0.035, 2), C.wood, [-0.465, H / 2, -0.1]), p(RB(0.07, H, 0.48, 0.035, 2), C.wood, [0.465, H / 2, -0.1]),
      p(RB(1.0, 0.07, 0.52, 0.035, 2), C.woodLight, [0, H + 0.01, -0.1]),
    ];
    const levels = [0.05, 0.37, 0.69];
    for (const y of levels) s.push(p(RB(0.88, 0.045, 0.44, 0.02, 1), C.woodLight, [0, y, -0.09]));
    levels.forEach((y0, li) => {
      let x = -0.41 + r() * 0.02;
      const end = 0.41 - (li === 2 ? 0.3 : li === 1 ? 0.2 : 0);
      while (x < end - 0.06) {
        const w = 0.055 + r() * 0.04, h = 0.15 + r() * 0.12, d = 0.22 + r() * 0.06;
        const tilt = r() < 0.12 ? -0.3 : 0;
        s.push(p(RB(w, h, d, 0.018, 1), pick(r, BOOKS), [x + w / 2, y0 + 0.0225 + h / 2 - (tilt ? 0.01 : 0), -0.09], { rot: [0, 0, tilt] }));
        x += w + 0.005 + (tilt ? 0.07 : 0) + (r() < 0.12 ? 0.04 : 0);
      }
    });
    // mid shelf: flat stack of books + trinket;  low shelf: ball;  top: books + plant
    s.push(p(RB(0.22, 0.05, 0.26, 0.02, 1), pick(r, BOOKS), [0.3, 0.37 + 0.0225 + 0.025, -0.09], { rot: [0, 0.1, 0] }), p(RB(0.18, 0.045, 0.22, 0.02, 1), pick(r, BOOKS), [0.3, 0.37 + 0.0225 + 0.0725, -0.09], { rot: [0, -0.15, 0] }));
    s.push(p(SPH(0.055, 10, 8), '#5aa8e0', [0.3, 0.37 + 0.0225 + 0.15, -0.09]));
    s.push(p(RB(0.28, 0.06, 0.24, 0.025, 1), C.coral, [-0.25, H + 0.075, -0.1], { rot: [0, 0.2, 0] }), p(RB(0.23, 0.05, 0.2, 0.025, 1), C.sky, [-0.25, H + 0.13, -0.1], { rot: [0, -0.1, 0] }));
    s.push(p(CYL(0.07, 0.05, 0.09, 10), '#e08a5a', [0.25, H + 0.085, -0.1]), p(ICO(0.09, 1), '#86d67a', [0.25, H + 0.18, -0.1], { scale: [1, 0.9, 1] }), p(ICO(0.06, 1), '#a6e48a', [0.3, H + 0.23, -0.08]));
    // pots on the 3rd shelf
    s.push(p(CYL(0.055, 0.04, 0.07, 10), C.sun, [0.31, 0.69 + 0.0225 + 0.035, -0.09]), p(ICO(0.075, 1), '#6cc56a', [0.31, 0.69 + 0.0225 + 0.1, -0.09]));
    s.push(p(CYL(0.05, 0.038, 0.06, 10), C.teal, [0.2, 0.69 + 0.0225 + 0.03, -0.09]), p(ICO(0.05, 1), '#7fd86a', [0.2, 0.69 + 0.0225 + 0.085, -0.09]));
    addVC(g, s);
  },

  desk(g, r, ph) {
    const pc = pick(r, [C.teal, C.coral, C.plum, C.sky, C.mint]);
    const s = [
      p(RB(1.0, 0.08, 0.72, 0.04, 2), C.woodLight, [0, 0.46, 0]),
      p(RB(0.08, 0.42, 0.62, 0.03, 2), C.wood, [-0.43, 0.21, 0]),
      p(RB(0.38, 0.42, 0.64, 0.05, 2), pc, [0.29, 0.21, 0]),
      p(RB(0.5, 0.26, 0.04, 0.015, 1), C.woodDark, [-0.12, 0.28, -0.28]),
    ];
    for (let i = 0; i < 3; i++) s.push(p(RB(0.31, 0.11, 0.03, 0.025, 1), C.woodLight, [0.29, 0.08 + i * 0.125, 0.33]), p(SPH(0.02, 6, 5), GOLD, [0.29, 0.08 + i * 0.125, 0.36]));
    // laptop base + lid shell
    s.push(p(RB(0.3, 0.025, 0.21, 0.012, 1), '#c9d0e0', [-0.12, 0.5125, 0.1]), p(RB(0.3, 0.2, 0.025, 0.012, 1), '#c9d0e0', [-0.12, 0.61, -0.06], { rot: [-0.3, 0, 0] }));
    // papers, mug, pencil cup, cactus
    s.push(p(RB(0.19, 0.014, 0.25, 0.006, 1), '#fffdf6', [0.3, 0.507, 0.03], { rot: [0, 0.25, 0] }), p(RB(0.17, 0.014, 0.23, 0.006, 1), '#fff2a8', [0.31, 0.521, 0.04], { rot: [0, 0.05, 0] }), p(RB(0.16, 0.014, 0.22, 0.006, 1), '#cfe9ff', [0.305, 0.535, 0.03], { rot: [0, 0.35, 0] }));
    s.push(p(CYL(0.045, 0.04, 0.075, 12), C.coral, [0.1, 0.5375, 0.24]), p(TOR(0.024, 0.009, 5, 10), C.coral, [0.147, 0.54, 0.24]));
    s.push(p(CYL(0.045, 0.04, 0.1, 10), '#5aa8e0', [0.4, 0.55, -0.24]));
    [0, 1, 2].forEach((i) => s.push(p(CYL(0.009, 0.009, 0.1, 5), ['#ffd84d', '#ef6f5e', '#6cc56a'][i], [0.385 + i * 0.015, 0.63, -0.24 + i * 0.008], { rot: [0.1 * i - 0.1, 0, 0.14 * i - 0.14] })));
    s.push(p(CYL(0.04, 0.03, 0.05, 10), '#e08a5a', [0.03, 0.525, -0.25]), p(CAPS(0.035, 0.07, 3, 8), '#5cbf6a', [0.03, 0.59, -0.25]), p(CAPS(0.02, 0.04, 3, 6), '#5cbf6a', [0.075, 0.585, -0.25], { rot: [0, 0, -0.9] }));
    // lamp base + arms
    s.push(p(CYL(0.075, 0.085, 0.03, 12), DARK, [-0.38, 0.515, -0.24]), p(CAPS(0.014, 0.2, 3, 6), DARK, [-0.36, 0.63, -0.24], { rot: [0, 0, -0.35] }), p(CAPS(0.014, 0.14, 3, 6), DARK, [-0.3, 0.72, -0.24], { rot: [0, 0, 1.1] }));
    addVC(g, s);
    add(g, new THREE.PlaneGeometry(0.26, 0.16), glowMat('#bfe9ff', '#5fb8f0', { day: 0.5, night: 1.5 }), { pos: [-0.12, 0.6143, -0.0485], rot: [-0.3, 0, 0], ...T });
    const lamp = flickMat('#ffe08a', '#ffd04d', { day: 0.45, night: 2 });
    add(g, CONE(0.1, 0.11, 14), lamp.m, { pos: [-0.23, 0.74, -0.24], rot: [0, 0, PI + 0.1] });
    g.userData.idle = (t) => { lamp.set(1 + 0.06 * Math.sin(t * 3 + ph)); };
  },

  crate(g, r) {
    const pc = pick(r, [C.teal, C.coral, C.sun, C.sky]);
    const mk = (cx, cz, sz, ry, paint, open) => {
      const cg = new THREE.Group(); cg.position.set(cx, 0, cz); cg.rotation.y = ry; g.add(cg);
      const h = sz, hs = sz / 2, q = sz / 0.62;
      const s = [p(RB(sz, h, sz, 0.05, 2), paint || C.wood, [0, h / 2, 0])];
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) s.push(p(RB(0.1 * q, h + 0.02, 0.1 * q, 0.035, 1), C.woodDeep, [x * (hs - 0.02), h / 2, z * (hs - 0.02)]));
      for (const y of [0.12 * q, h - 0.12 * q]) {
        s.push(p(RB(sz - 0.1 * q, 0.09 * q, 0.04, 0.02, 1), C.woodLight, [0, y, hs + 0.005]), p(RB(sz - 0.1 * q, 0.09 * q, 0.04, 0.02, 1), C.woodLight, [0, y, -hs - 0.005]));
        s.push(p(RB(0.04, 0.09 * q, sz - 0.1 * q, 0.02, 1), C.woodLight, [hs + 0.005, y, 0]), p(RB(0.04, 0.09 * q, sz - 0.1 * q, 0.02, 1), C.woodLight, [-hs - 0.005, y, 0]));
      }
      const dl = Math.hypot(sz - 0.2 * q, h - 0.3 * q);
      s.push(p(RB(0.07 * q, dl, 0.035, 0.02, 1), C.woodDark, [0, h / 2, hs + 0.012], { rot: [0, 0, Math.atan2(sz - 0.2 * q, h - 0.3 * q)] }));
      if (open) { // open crate heaped with apples
        s.push(p(RB(sz - 0.06, 0.03, sz - 0.06, 0.012, 1), C.woodDeep, [0, h - 0.01, 0]));
        for (let i = 0; i < 6; i++) { const a = i * 1.05, d = i < 5 ? 0.07 : 0; s.push(p(SPH(0.07, 8, 6), ['#ef4a4a', '#f2994a', '#e8c84a', '#ef4a4a', '#a8d84a', '#e84a6a'][i], [Math.cos(a) * d, h + 0.025 + (i % 2) * 0.015, Math.sin(a) * d])); }
      } else {
        s.push(p(RB(sz + 0.04, 0.05, sz + 0.04, 0.025, 2), C.woodLight, [0, h + 0.02, 0]));
        s.push(p(RB(0.2 * q, 0.02, sz * 0.7, 0.008, 1), C.cream, [0, h + 0.05, 0]));
      }
      for (const [x, z] of [[-1, 1], [1, 1]]) for (const y of [0.12 * q, h - 0.12 * q]) s.push(p(SPH(0.016, 5, 4), '#e8ecf4', [x * (hs - 0.05), y, hs + 0.03]));
      addVC(cg, s);
    };
    mk(-0.12, -0.1, 0.62, 0.08, null, false);
    mk(0.3, 0.3, 0.34, -0.3, pc, true);
    add(g, TOR(0.07, 0.022, 6, 14), '#e6c88a', { pos: [-0.33, 0.022, 0.34], rot: [PI / 2, 0, 0], ...T });
  },

  statue(g) {
    const M = '#ebe5f3', M2 = '#d4cde4', cape = '#9a63b5';
    const s = [
      p(RB(0.8, 0.12, 0.8, 0.05, 2), M2, [0, 0.06, 0]),
      p(RB(0.6, 0.3, 0.6, 0.05, 2), M, [0, 0.27, 0]),
      p(RB(0.68, 0.07, 0.68, 0.035, 2), M2, [0, 0.455, 0]),
      p(RB(0.32, 0.11, 0.03, 0.015, 1), GOLD, [0, 0.27, 0.31]),
      p(RB(0.12, 0.06, 0.2, 0.03, 1), M2, [-0.09, 0.52, 0.03]), p(RB(0.12, 0.06, 0.2, 0.03, 1), M2, [0.09, 0.52, 0.03]),
      p(CYL(0.15, 0.21, 0.36, 14), M, [0, 0.7, 0]), p(CYL(0.12, 0.15, 0.3, 14), M, [0, 0.97, 0]),
      p(TOR(0.14, 0.024, 6, 16), GOLD, [0, 0.82, 0], { rot: [PI / 2, 0, 0] }),
      p(RB(0.28, 0.44, 0.05, 0.025, 2), cape, [0, 0.88, -0.16], { rot: [0.14, 0, 0] }),
      p(SPH(0.16, 16, 12), M, [0, 1.17, 0]),
      p(SPH(0.02, 6, 5), '#6a6580', [-0.06, 1.18, 0.14]), p(SPH(0.02, 6, 5), '#6a6580', [0.06, 1.18, 0.14]),
      p(TOR(0.14, 0.02, 6, 18), GOLD, [0, 1.26, 0], { rot: [PI / 2 - 0.15, 0, 0] }),
      p(CAPS(0.05, 0.2, 4, 8), M, [0.2, 1.08, 0], { rot: [0, 0, -0.5] }), p(CAPS(0.05, 0.2, 4, 8), M, [-0.18, 0.93, 0.02], { rot: [0, 0, 0.18] }),
    ];
    addVC(g, s);
    add(g, SPH(0.08, 12, 10), glowMat(GOLD, '#ffc83a', { day: 0.35, night: 1.8 }), { pos: [0.29, 1.27, 0] });
  },

  fireplace(g, r, ph) {
    const brick = brickTex();
    for (const sx of [-1, 1]) add(g, RB(0.22, 0.76, 0.4, 0.04, 2), brick, { pos: [sx * 0.37, 0.38, -0.28] });
    add(g, RB(0.6, 0.15, 0.4, 0.04, 2), brick, { pos: [0, 0.685, -0.28] });
    const s = [
      p(RB(0.92, 0.2, 0.3, 0.05, 2), '#e8a678', [0, 0.87, -0.34]),
      p(BOX(0.6, 0.62, 0.03), '#2a2238', [0, 0.32, -0.46]),
      p(RB(0.6, 0.03, 0.4, 0.012, 1), '#3a3348', [0, 0.015, -0.28]),
      p(RB(1.04, 0.09, 0.46, 0.04, 2), C.woodLight, [0, 0.8, -0.3]),
      p(RB(1.0, 0.06, 0.3, 0.03, 2), '#b9b4cc', [0, 0.03, 0.0]),
    ];
    for (const [x, y, z, ry, len] of [[-0.03, 0.09, -0.3, 0.1, 0.5], [0.05, 0.09, -0.2, -0.15, 0.44], [0.0, 0.2, -0.26, 1.45, 0.44]]) {
      s.push(p(CAPS(0.06, len - 0.12, 3, 8), '#7a4a2c', [x, y, z], { rot: [0, ry, PI / 2] }), p(CYL(0.052, 0.052, 0.012, 10), '#e0b078', [x + Math.cos(ry) * len / 2, y, z - Math.sin(ry) * len / 2], { rot: [0, ry, PI / 2] }));
    }
    // mantle decor: candles + framed picture
    for (const sx of [-1, 1]) s.push(p(CYL(0.034, 0.034, 0.11, 8), C.cream, [sx * 0.38, 0.905, -0.3]));
    s.push(p(RB(0.3, 0.19, 0.03, 0.012, 1), C.coral, [0, 0.95, -0.22]), p(RB(0.23, 0.13, 0.02, 0.01, 1), '#9fe0c0', [0, 0.95, -0.2]), p(CONE(0.05, 0.06, 3), '#4a9a6a', [0.03, 0.94, -0.188]), p(SPH(0.02, 6, 5), C.sun, [-0.05, 0.98, -0.185]));
    addVC(g, s);
    const gO = glowMat(C.flameO, C.flameO, { day: 0.8, night: 2.2 }), gY = glowMat(C.flameY, C.flameY, { day: 0.9, night: 2.4 }), gW = glowMat('#fff3b0', '#fff3b0', { day: 1, night: 2.6 });
    const fl = (geo, mat, pos, sc) => { const m = add(g, geo, mat, { pos, scale: sc, ...T }); m.userData.b = [pos[1], ...sc]; return m; };
    const fg = flameGeo();
    const flames = [
      fl(fg, gO, [0, 0.05, -0.3], [0.2, 0.46, 0.2]), fl(fg, gO, [-0.14, 0.05, -0.24], [0.12, 0.3, 0.12]), fl(fg, gO, [0.15, 0.05, -0.27], [0.11, 0.28, 0.11]),
      fl(fg, gY, [0.02, 0.05, -0.22], [0.13, 0.3, 0.13]), fl(fg, gW, [0.0, 0.05, -0.16], [0.07, 0.17, 0.07]),
    ];
    addMerged(g, [p(CONE(0.016, 0.045, 6), null, [-0.38, 0.985, -0.3]), p(CONE(0.016, 0.045, 6), null, [0.38, 0.985, -0.3]), p(SPH(0.03, 6, 5), null, [0.14, 0.06, -0.17]), p(SPH(0.026, 6, 5), null, [-0.17, 0.055, -0.19])], glowMat('#ff7a2a', '#ff6a2a', { day: 1, night: 2.4 }), T);
    const glow = makeFireGlow(g, 0, 0.006, 0.22, 0.45);
    g.userData.idle = (t) => {
      for (let i = 0; i < flames.length; i++) {
        const f = flames[i], b = f.userData.b;
        const k = 1 + 0.15 * Math.sin(t * 11 + i * 2.1 + ph) + 0.07 * Math.sin(t * 23 + i);
        const q = 1 / Math.sqrt(k);
        f.scale.set(b[1] * q, b[2] * k, b[3] * q);
        f.rotation.z = 0.08 * Math.sin(t * 7 + i * 1.7 + ph);
      }
      glow(Math.sin(t * 11 + ph) * 0.6 + Math.sin(t * 23) * 0.4);
    };
  },

  piano(g, r) {
    const pc = pick(r, ['#7a4f9a', '#2f7f98', '#d95b4a', '#3f4fa0']), pd = shade(pc, 0.82), pl = shade(pc, 1.18);
    const s = [
      p(RB(0.94, 0.72, 0.36, 0.06, 2), pc, [0, 0.4, -0.2]),
      p(RB(1.0, 0.07, 0.42, 0.035, 2), pl, [0, 0.78, -0.2]),
      p(RB(0.88, 0.05, 0.34, 0.02, 1), pd, [0, 0.44, 0.1]),
      p(RB(0.88, 0.14, 0.04, 0.02, 1), pd, [0, 0.4, 0.28]),
      p(RB(0.74, 0.22, 0.03, 0.015, 1), pd, [0, 0.62, -0.03], { rot: [-0.2, 0, 0] }),
      p(RB(0.34, 0.17, 0.014, 0.006, 1), '#fffdf6', [0, 0.625, -0.01], { rot: [-0.2, 0, 0] }),
      p(CYL(0.012, 0.012, 0.07, 6), GOLD, [-0.14, 0.4, 0.3], { rot: [PI / 2, 0, 0] }), p(CYL(0.012, 0.012, 0.07, 6), GOLD, [0.14, 0.4, 0.3], { rot: [PI / 2, 0, 0] }),
    ];
    for (const sx of [-1, 1]) s.push(p(RB(0.08, 0.4, 0.52, 0.035, 2), pc, [sx * 0.44, 0.2, -0.08]), p(RB(0.08, 0.08, 0.36, 0.035, 1), pd, [sx * 0.44, 0.42, 0.04]));
    for (let i = 0; i < 11; i++) {
      const x = -0.4 + 0.04 + i * 0.08;
      s.push(p(RB(0.074, 0.03, 0.2, 0.01, 1), '#fffdf6', [x, 0.475, 0.12]));
      if (i < 10 && i % 7 !== 2 && i % 7 !== 6) s.push(p(RB(0.04, 0.04, 0.12, 0.01, 1), '#2b2b3a', [x + 0.04, 0.495, 0.085]));
    }
    // metronome, little plant, sheet music; stool
    s.push(p(CONE(0.055, 0.13, 4), C.woodDark, [-0.3, 0.875, -0.22], { rot: [0, PI / 4, 0] }), p(SPH(0.02, 6, 5), C.sun, [-0.3, 0.95, -0.22]));
    s.push(p(RB(0.2, 0.014, 0.13, 0.006, 1), C.coral, [0.25, 0.82, -0.2], { rot: [0, 0.3, 0] }), p(CYL(0.045, 0.035, 0.06, 10), C.sun, [0.3, 0.85, -0.25]), p(ICO(0.05, 1), '#6cc56a', [0.3, 0.92, -0.25]));
    s.push(p(CYL(0.14, 0.14, 0.06, 16), '#d94a5a', [0, 0.29, 0.39]), p(TOR(0.14, 0.03, 6, 16), '#e66a78', [0, 0.29, 0.39], { rot: [PI / 2, 0, 0] }));
    for (const [x, z] of legs4(0.07, 0.07)) s.push(p(CYL(0.03, 0.02, 0.26, 6), C.woodDark, [x, 0.13, 0.39 + z]));
    addVC(g, s);
  },

  tent(g, r) {
    const W = 0.78, H = 0.6, D = 0.7, bs = 0.05;
    const tc = pick(r, [C.coral, C.sun, C.teal, C.sky, '#f2994a']);
    const shape = new THREE.Shape(); shape.moveTo(-W / 2, 0); shape.lineTo(W / 2, 0); shape.lineTo(0, H); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: true, bevelThickness: bs, bevelSize: bs, bevelSegments: 3, steps: 1 }); geo.translate(0, bs, -D / 2);
    add(g, geo, tc);
    const ang = Math.atan2(H, W / 2), sl = Math.hypot(W / 2, H);
    const s = [];
    const nx = H / sl, ny = (W / 2) / sl;
    for (const sx of [-1, 1]) for (const z of [-0.26, 0, 0.26]) {
      s.push(p(RB(sl * 0.9, 0.02, 0.1, 0.008, 1), '#fff2d6', [sx * (W / 4 + nx * (bs + 0.004)), bs + H / 2 + ny * (bs + 0.004), z], { rot: [0, 0, -sx * ang] }));
    }
    const fz = D / 2 + bs + 0.003;
    const mkS = (pts) => { const sh = new THREE.Shape(); sh.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) sh.lineTo(...pts[i]); sh.closePath(); return new THREE.ShapeGeometry(sh); };
    s.push(p(mkS([[-0.19, bs], [0.19, bs], [0, bs + 0.42]]), '#4a3358', [0, 0, fz]));
    s.push(p(mkS([[-0.2, bs], [-0.015, bs], [-0.2, bs + 0.4]]), shade(tc, 1.25), [0, 0, fz + 0.012]), p(mkS([[0.2, bs], [0.015, bs], [0.2, bs + 0.4]]), shade(tc, 1.25), [0, 0, fz + 0.012]));
    for (const sx of [-1, 1]) s.push(p(SPH(0.02, 6, 5), C.woodDeep, [sx * 0.16, 0.25, fz + 0.03]));
    s.push(p(CAPS(0.018, D + 0.08, 3, 6), C.woodDeep, [0, H + bs + 0.01, 0], { rot: [PI / 2, 0, 0] }), p(CYL(0.01, 0.01, 0.22, 5), C.woodDeep, [0, H + 0.17, 0]));
    s.push(p(mkS([[0, 0], [0.18, -0.05], [0, -0.1]]), C.coral, [0, H + 0.28, 0]), p(mkS([[0, 0], [-0.18, -0.05], [0, -0.1]]), C.coral, [0, H + 0.28, 0]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      s.push(p(CYL(0.006, 0.006, 0.18, 4), '#fff2d6', [sx * 0.46, 0.1, sz * 0.3], { rot: [0, 0, sx * 0.5] }), p(CONE(0.02, 0.06, 5), C.woodDeep, [sx * 0.52, 0.03, sz * 0.3], { rot: [PI, 0, 0] }));
    }
    addVC(g, s);
  },

  chair(g, r) {
    const pc = pick(r, PAINTS), fr = r() < 0.5 ? C.wood : pc;
    const cu = pick(r, [C.coral, C.sky, C.plum, C.teal, C.sun].filter((c) => c !== fr));
    const s = [];
    for (const [x, z] of legs4(0.19, 0.19)) s.push(p(CYL(0.04, 0.026, 0.17, 8), shade(fr, 0.85), [x, 0.085, z + 0.01]));
    s.push(
      p(RB(0.5, 0.05, 0.5, 0.025, 2), fr, [0, 0.17, 0]),
      p(RB(0.44, 0.05, 0.44, 0.04, 3), cu, [0, 0.215, 0.015]),
      p(RB(0.055, 0.4, 0.055, 0.025, 1), shade(fr, 0.9), [-0.205, 0.4, -0.22]), p(RB(0.055, 0.4, 0.055, 0.025, 1), shade(fr, 0.9), [0.205, 0.4, -0.22]),
      p(RB(0.5, 0.08, 0.06, 0.03, 2), fr, [0, 0.58, -0.22]),
      p(RB(0.38, 0.26, 0.06, 0.04, 3), cu, [0, 0.4, -0.2]),
    );
    addVC(g, s);
  },

  sofa(g, r) {
    const col = pick(r, [C.coral, C.teal, C.plum, C.sky, '#e8a838']);
    const dk = shade(col, 0.82), lt = shade(col, 1.15);
    const s = [];
    for (const [x, z] of legs4(0.4, 0.3)) s.push(p(CYL(0.04, 0.03, 0.08, 8), C.woodDark, [x, 0.04, z]));
    s.push(
      p(RB(0.96, 0.14, 0.78, 0.06, 2), dk, [0, 0.12, 0]),
      p(RB(0.38, 0.11, 0.52, 0.05, 3), col, [-0.2, 0.185, 0.07]), p(RB(0.38, 0.11, 0.52, 0.05, 3), col, [0.2, 0.185, 0.07]),
      p(RB(0.96, 0.38, 0.24, 0.1, 3), col, [0, 0.35, -0.28]),
      p(RB(0.17, 0.33, 0.8, 0.08, 3), lt, [-0.4, 0.26, 0.0]), p(RB(0.17, 0.33, 0.8, 0.08, 3), lt, [0.4, 0.26, 0.0]),
      p(RB(0.24, 0.24, 0.09, 0.045, 3), lt, [-0.25, 0.37, -0.15], { rot: [-0.25, 0.2, 0.1] }), p(RB(0.24, 0.24, 0.09, 0.045, 3), C.sun, [0.25, 0.37, -0.15], { rot: [-0.25, -0.25, -0.1] }),
    );
    for (let i = 0; i < 5; i++) s.push(p(SPH(0.016, 6, 5), dk, [-0.28 + i * 0.14, 0.43, -0.155]));
    addVC(g, s);
  },

  bed(g, r) {
    const col = pick(r, [C.sky, '#ef8a9a', C.mint, C.plum, C.sun]);
    const frame = r() < 0.5 ? C.wood : pick(r, [C.teal, C.coral, C.cream2]);
    const s = [];
    for (const [x, z] of legs4(0.42, 0.4)) s.push(p(CYL(0.045, 0.035, 0.1, 8), C.woodDeep, [x, 0.05, z]));
    s.push(
      p(RB(0.96, 0.1, 0.94, 0.04, 2), frame, [0, 0.1, 0]),
      p(RB(0.88, 0.11, 0.86, 0.05, 3), '#fff6e4', [0, 0.175, 0.0]),
      p(RB(1.0, 0.56, 0.08, 0.045, 2), shade(frame, 0.9), [0, 0.38, -0.44]),
      p(SPH(0.05, 8, 6), GOLD, [-0.46, 0.68, -0.44]), p(SPH(0.05, 8, 6), GOLD, [0.46, 0.68, -0.44]),
      p(RB(1.0, 0.2, 0.07, 0.035, 2), frame, [0, 0.19, 0.44]),
      p(RB(0.92, 0.06, 0.56, 0.03, 3), col, [0, 0.24, 0.16]),
      p(RB(0.92, 0.08, 0.14, 0.04, 3), shade(col, 1.3), [0, 0.265, -0.13]),
      p(RB(0.38, 0.1, 0.22, 0.05, 3), '#fffdf6', [-0.21, 0.28, -0.31], { rot: [-0.12, 0.05, 0] }), p(RB(0.34, 0.1, 0.2, 0.05, 3), pick(r, [C.coral, C.sun, C.mint]), [0.22, 0.28, -0.31], { rot: [-0.12, -0.06, 0] }),
    );
    for (let i = 0; i < 6; i++) s.push(p(SPH(0.02, 6, 5), shade(col, 1.6), [-0.28 + (i % 3) * 0.28, 0.27, 0.0 + Math.floor(i / 3) * 0.26], { scale: [1, 0.4, 1] }));
    addVC(g, s);
  },

  rug(g, r) {
    const v = Math.floor(r() * 3) % 3;
    add(g, RB(0.98, 0.04, 0.98, 0.018, 2), rugTex(v), { pos: [0, 0.02, 0], shadow: false });
  },

  bench(g, r) {
    const pc = pick(r, [C.teal, C.coral, C.plum, C.sky, C.sun]);
    const s = [];
    for (let i = 0; i < 4; i++) s.push(p(RB(0.94, 0.05, 0.11, 0.022, 1), i % 2 ? C.wood : C.woodLight, [0, 0.2, -0.19 + i * 0.125]));
    for (const sx of [-1, 1]) {
      s.push(p(RB(0.07, 0.19, 0.5, 0.03, 2), pc, [sx * 0.4, 0.095, -0.02]), p(RB(0.07, 0.07, 0.52, 0.035, 2), shade(pc, 0.85), [sx * 0.435, 0.31, -0.02]), p(RB(0.06, 0.3, 0.06, 0.03, 1), pc, [sx * 0.435, 0.2, -0.24]));
    }
    s.push(p(RB(0.8, 0.05, 0.05, 0.02, 1), shade(pc, 0.85), [0, 0.07, -0.02]));
    for (let i = 0; i < 2; i++) s.push(p(RB(0.86, 0.09, 0.04, 0.02, 1), i ? C.wood : C.woodLight, [0, 0.36 + i * 0.11, -0.245]));
    for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) s.push(p(SPH(0.014, 5, 4), MET, [sx * 0.437, 0.23, -0.15 + i * 0.25]));
    addVC(g, s);
  },

  towel(g, r) {
    const v = Math.floor(r() * 3) % 3;
    add(g, RB(0.64, 0.05, 0.94, 0.024, 2), towelTex(v), { pos: [0, 0.025, 0], shadow: false });
    const bc = ['#ef6f5e', '#ffffff', '#4f86c6', '#ffd84d'], s = [];
    for (let i = 0; i < 4; i++) s.push(p(new THREE.SphereGeometry(0.085, 10, 8, (i * PI) / 2, PI / 2), bc[i], [0.3, 0.13, -0.34]));
    s.push(p(TOR(0.03, 0.008, 5, 10), '#2b2b3a', [-0.2, 0.06, 0.38], { rot: [PI / 2, 0, 0] }), p(TOR(0.03, 0.008, 5, 10), '#2b2b3a', [-0.13, 0.06, 0.38], { rot: [PI / 2, 0, 0] }), p(BOX(0.05, 0.008, 0.01), '#2b2b3a', [-0.165, 0.06, 0.38]));
    s.push(p(CYL(0.035, 0.035, 0.1, 8), C.sun, [-0.25, 0.1, -0.36]), p(CYL(0.02, 0.02, 0.03, 8), C.coral, [-0.25, 0.165, -0.36]));
    addVC(g, s, { shadow: false });
  },

  tv(g, r, ph) {
    const pc = pick(r, [C.cream2, C.teal, C.coral, C.sky]);
    const s = [
      p(RB(0.5, 0.06, 0.34, 0.03, 2), DARK, [0, 0.03, 0]), p(RB(0.14, 0.2, 0.08, 0.035, 1), DARK, [0, 0.15, -0.02]),
      p(RB(0.94, 0.64, 0.18, 0.08, 3), pc, [0, 0.58, 0]),
      p(RB(0.84, 0.54, 0.04, 0.05, 2), '#2f2c42', [0, 0.58, 0.085]),
      p(CAPS(0.012, 0.22, 3, 6), MET, [-0.1, 0.99, -0.02], { rot: [0, 0, 0.5] }), p(CAPS(0.012, 0.22, 3, 6), MET, [0.1, 0.99, -0.02], { rot: [0, 0, -0.5] }),
      p(SPH(0.025, 6, 5), C.coral, [-0.17, 1.1, -0.02]), p(SPH(0.025, 6, 5), C.coral, [0.17, 1.1, -0.02]),
      p(SPH(0.02, 6, 5), C.sun, [0.4, 0.4, 0.09]),
    ];
    addVC(g, s);
    const scr = flickMat('#8be3f5', '#4fc8e8', { day: 0.55, night: 1.6 });
    add(g, RB(0.76, 0.46, 0.03, 0.05, 2), scr.m, { pos: [0, 0.58, 0.1], ...T });
    ['#ff6b6b', '#ffd84d', '#6cc56a', '#9a63b5'].forEach((c, i) => add(g, BOX(0.15, 0.3, 0.01), glowMat(c, c, { day: 0.5, night: 1.4 }), { pos: [-0.23 + i * 0.155, 0.6, 0.117], ...T }));
    g.userData.idle = (t) => { scr.set(1 + 0.2 * Math.sin(t * 3 + ph) + 0.1 * Math.sin(t * 11 + ph)); };
  },

  wardrobe(g, r) {
    const pc = pick(r, [C.plum, C.teal, C.coral, C.sky, C.mint]);
    const s = [
      p(RB(0.9, 0.08, 0.58, 0.035, 2), C.woodDeep, [0, 0.04, 0]),
      p(RB(0.92, 0.9, 0.6, 0.07, 3), pc, [0, 0.53, 0]),
      p(RB(1.0, 0.1, 0.66, 0.045, 2), C.woodLight, [0, 1.03, 0]),
      p(BOX(0.014, 0.8, 0.01), shade(pc, 0.7), [0, 0.52, 0.305]),
    ];
    for (const sx of [-1, 1]) {
      s.push(p(RB(0.4, 0.78, 0.04, 0.03, 2), shade(pc, 1.12), [sx * 0.21, 0.52, 0.3]), p(RB(0.3, 0.62, 0.02, 0.02, 1), pc, [sx * 0.21, 0.52, 0.32]), p(SPH(0.04, 8, 6), GOLD, [sx * 0.05, 0.5, 0.34]));
      s.push(p(CYL(0.045, 0.045, 0.012, 10), C.sun, [sx * 0.21, 0.67, 0.335], { rot: [PI / 2, 0, 0] }));
    }
    addVC(g, s);
  },

  register(g, r, ph) {
    const pc = pick(r, [C.coral, C.teal, C.plum, C.sun]);
    const s = [
      p(RB(0.94, 0.5, 0.64, 0.06, 2), C.woodLight, [0, 0.25, 0]),
      p(RB(1.0, 0.06, 0.7, 0.035, 2), C.woodDark, [0, 0.53, 0]),
      p(RB(0.7, 0.24, 0.03, 0.02, 1), C.wood, [0, 0.27, 0.325]),
      p(RB(0.54, 0.14, 0.4, 0.06, 2), pc, [0, 0.63, -0.06]),
      p(RB(0.5, 0.06, 0.34, 0.03, 2), shade(pc, 0.8), [0, 0.7, -0.04], { rot: [-0.15, 0, 0] }),
      p(RB(0.34, 0.16, 0.05, 0.025, 2), DARK, [0, 0.8, -0.2], { rot: [-0.25, 0, 0] }),
      p(RB(0.34, 0.025, 0.2, 0.01, 1), '#3a3550', [0, 0.57, 0.22]),
      p(CYL(0.02, 0.02, 0.14, 8), '#fffdf6', [0.22, 0.86, -0.2], { rot: [0, 0, PI / 2] }),
    ];
    for (let i = 0; i < 12; i++) s.push(p(RB(0.06, 0.025, 0.05, 0.01, 1), i % 5 === 4 ? C.coral : C.cream, [-0.14 + (i % 4) * 0.093, 0.74 + 0.012 * Math.floor(i / 4), 0.04 - Math.floor(i / 4) * 0.055]));
    for (let i = 0; i < 3; i++) s.push(p(CYL(0.045, 0.045, 0.014, 10), GOLD, [-0.09 + i * 0.09, 0.59 + (i % 2) * 0.014, 0.22]));
    s.push(p(RB(0.2, 0.05, 0.14, 0.02, 1), '#fffdf6', [0.26, 0.58, 0.18], { rot: [0, 0.3, 0] }), p(SPH(0.03, 6, 5), C.sun, [-0.3, 0.6, 0.22]));
    addVC(g, s);
    const sc = flickMat('#a8f0c8', '#6fe0a0', { day: 0.55, night: 1.7 });
    add(g, RB(0.27, 0.1, 0.02, 0.012, 1), sc.m, { pos: [0, 0.8, -0.168], rot: [-0.25, 0, 0], ...T });
    g.userData.idle = (t) => { sc.set(1 + 0.12 * Math.sin(t * 2 + ph)); };
  },

  barrel(g, r) {
    const prof = [[0.34, 0], [0.42, 0.1], [0.47, 0.3], [0.48, 0.46], [0.47, 0.62], [0.42, 0.82], [0.34, 0.92]].map(([x, y]) => new THREE.Vector2(x, y));
    add(g, new THREE.LatheGeometry(prof, 18), C.wood, { pos: [0, 0.02, 0] });
    const hoop = pick(r, ['#56658f', '#4a8a8a', '#8a5aa0']);
    const s = [p(CYL(0.35, 0.35, 0.04, 18), C.woodLight, [0, 0.94, 0]), p(CYL(0.37, 0.37, 0.02, 18), C.woodDark, [0, 0.925, 0])];
    for (const [y, rr] of [[0.14, 0.43], [0.34, 0.472], [0.64, 0.475], [0.82, 0.43]]) s.push(p(TOR(rr, 0.022, 5, 20), hoop, [0, y + 0.02, 0], { rot: [PI / 2, 0, 0] }));
    s.push(p(SPH(0.06, 8, 6), C.coral, [0, 0.5, 0.47], { scale: [1.2, 1.5, 0.3] }), p(CYL(0.035, 0.035, 0.05, 8), C.woodDeep, [0.2, 0.3, 0.45], { rot: [PI / 2, 0, 0] }));
    addVC(g, s);
  },

  arcade(g, r, ph) {
    const body = pick(r, [C.plum, C.teal, C.sky, C.coral]), bd = shade(body, 0.8);
    const s = [
      p(RB(0.72, 0.22, 0.62, 0.06, 2), body, [0, 0.11, -0.02]),
      p(RB(0.72, 0.64, 0.44, 0.07, 3), body, [0, 0.52, -0.1]),
      p(RB(0.78, 0.14, 0.52, 0.06, 2), bd, [0, 1.0, -0.1]),
      p(RB(0.74, 0.07, 0.34, 0.03, 2), '#34304a', [0, 0.57, 0.22], { rot: [0.2, 0, 0] }),
      p(CYL(0.014, 0.014, 0.1, 6), MET, [-0.19, 0.65, 0.22]), p(SPH(0.045, 8, 6), C.coral, [-0.19, 0.72, 0.22]),
      p(RB(0.56, 0.38, 0.04, 0.03, 2), DARK, [0, 0.79, 0.1], { rot: [-0.12, 0, 0] }),
      p(RB(0.1, 0.1, 0.02, 0.01, 1), '#34304a', [0, 0.3, 0.12]), p(BOX(0.02, 0.04, 0.01), GOLD, [0, 0.3, 0.135]),
      p(RB(0.04, 0.5, 0.01, 0.005, 1), shade(body, 1.35), [-0.36, 0.5, 0.0]), p(RB(0.04, 0.5, 0.01, 0.005, 1), shade(body, 1.35), [0.36, 0.5, 0.0]),
    ];
    [[C.sun, 0.05], ['#6cc56a', 0.15], [C.sky, 0.25]].forEach(([c, x], i) => s.push(p(CYL(0.038, 0.038, 0.025, 10), c, [x, 0.6 + (i % 2) * 0.012, 0.21], { rot: [0.2, 0, 0] })));
    addVC(g, s);
    const mq = flickMat('#ffe36a', '#ffc83a', { day: 0.5, night: 2 });
    add(g, RB(0.62, 0.08, 0.02, 0.03, 1), mq.m, { pos: [0, 1.0, 0.165], ...T });
    const scr = flickMat('#5a4ab0', '#8a5cff', { day: 0.6, night: 1.7 });
    add(g, RB(0.46, 0.3, 0.02, 0.04, 2), scr.m, { pos: [0, 0.79, 0.12], rot: [-0.12, 0, 0], ...T });
    [[-0.1, 0.86, '#6cff8a'], [0, 0.82, '#ff6b6b'], [0.1, 0.86, '#ffd84d'], [-0.05, 0.74, '#6fd3e8'], [0.08, 0.72, '#ffffff']].forEach(([x, y, c]) => add(g, BOX(0.055, 0.045, 0.01), glowMat(c, c, { day: 0.7, night: 1.6 }), { pos: [x, y, 0.134], rot: [-0.12, 0, 0], ...T }));
    g.userData.idle = (t) => { scr.set(1 + 0.3 * Math.sin(t * 5 + ph) + 0.15 * Math.sin(t * 13 + ph * 2)); mq.set(0.85 + 0.15 * Math.sin(t * 6 + ph)); };
  },

  heater(g, r, ph) {
    const s = [
      p(RB(0.72, 0.36, 0.72, 0.07, 3), '#5a5478', [-0.05, 0.18, 0]),
      p(RB(0.76, 0.05, 0.76, 0.03, 2), DARK, [-0.05, 0.385, 0]),
      p(RB(0.42, 0.26, 0.04, 0.04, 1), '#7a7592', [-0.05, 0.18, 0.36]),
      p(RB(0.6, 0.18, 0.6, 0.07, 2), '#7a7690', [-0.05, 0.49, 0]),
      p(CYL(0.03, 0.035, 0.5, 8), MET, [-0.3, 0.6, -0.3]), p(CYL(0.045, 0.035, 0.04, 8), '#9a95b0', [-0.3, 0.88, -0.3]),
      p(CYL(0.11, 0.09, 0.17, 12), C.wood, [0.37, 0.085, 0.28]), p(TOR(0.1, 0.014, 5, 12), '#56658f', [0.37, 0.05, 0.28], { rot: [PI / 2, 0, 0] }), p(TOR(0.108, 0.014, 5, 12), '#56658f', [0.37, 0.13, 0.28], { rot: [PI / 2, 0, 0] }),
      p(CYL(0.095, 0.095, 0.012, 12), '#7fc4e8', [0.37, 0.16, 0.28]), p(CAPS(0.016, 0.3, 3, 6), C.woodLight, [0.37, 0.22, 0.28], { rot: [0.2, 0, 0.9] }),
    ];
    for (let i = 0; i < 11; i++) { const a = r() * 6.28, d = r() * 0.2; s.push(p(ICO(0.08 + r() * 0.03, 1), pick(r, [C.stoneDark, C.stone, C.stoneLight, '#7a7690']), [-0.05 + Math.cos(a) * d, 0.6 + r() * 0.05, Math.sin(a) * d], { scale: [1, 0.75, 1] })); }
    addVC(g, s);
    const fm = flickMat('#ffb050', '#ff7a1c', { day: 0.7, night: 2.2 });
    add(g, RB(0.32, 0.16, 0.03, 0.05, 2), fm.m, { pos: [-0.05, 0.18, 0.385], ...T });
    const steam = makeSteam(g, -0.05, 0.72, 0, ph, 4, 0.4, 0.06);
    g.userData.idle = (t) => { fm.set(1 + 0.25 * Math.sin(t * 3.1 + ph) + 0.1 * Math.sin(t * 8 + ph)); steam(t); };
  },

  tractor(g, r, ph) {
    const red = pick(r, ['#e0503e', '#3fa89a', '#e8a838', '#5a8ad0']), redD = shade(red, 0.78), tire = '#3a3652';
    const s = [
      p(RB(0.52, 0.28, 0.76, 0.1, 3), red, [0, 0.4, 0.17]),
      p(RB(0.46, 0.06, 0.8, 0.03, 2), redD, [0, 0.26, 0.15]),
      p(RB(0.4, 0.22, 0.05, 0.03, 1), MET, [0, 0.4, 0.57]),
      p(CYL(0.04, 0.04, 0.22, 8), DARK, [0.14, 0.64, 0.3]), p(CYL(0.055, 0.04, 0.035, 8), '#7a7592', [0.14, 0.76, 0.3]),
      p(RB(0.58, 0.1, 0.42, 0.04, 2), redD, [0, 0.34, -0.3]),
      p(RB(0.38, 0.14, 0.07, 0.04, 2), '#6a5a8a', [0, 0.5, -0.46]), p(RB(0.34, 0.06, 0.3, 0.04, 2), '#6a5a8a', [0, 0.43, -0.3]),
      p(CYL(0.07, 0.07, 0.018, 12), DARK, [0, 0.58, -0.12], { rot: [-0.7, 0, 0] }),
      p(RB(0.66, 0.07, 0.5, 0.035, 2), red, [0, 0.9, -0.3]),
    ];
    for (let i = 0; i < 4; i++) s.push(p(RB(0.34, 0.016, 0.014, 0.006, 1), DARK, [0, 0.33 + i * 0.05, 0.6]));
    for (const [x, z] of [[-0.25, -0.5], [0.25, -0.5], [-0.25, -0.1], [0.25, -0.1]]) s.push(p(CYL(0.025, 0.025, 0.5, 8), '#4a4666', [x, 0.63, z]));
    for (const x of [-0.37, 0.37]) {
      s.push(p(TOR(0.19, 0.095, 8, 16), tire, [x, 0.285, -0.3], { rot: [0, PI / 2, 0] }), p(CYL(0.13, 0.13, 0.17, 14), C.sun, [x, 0.285, -0.3], { rot: [0, 0, PI / 2] }), p(SPH(0.05, 8, 6), MET, [x * 1.1, 0.285, -0.3]));
      s.push(p(TOR(0.09, 0.06, 8, 14), tire, [x * 0.8, 0.15, 0.4], { rot: [0, PI / 2, 0] }), p(CYL(0.07, 0.07, 0.1, 10), C.sun, [x * 0.8, 0.15, 0.4], { rot: [0, 0, PI / 2] }));
    }
    addVC(g, s);
    addMerged(g, [p(SPH(0.05, 8, 6), null, [-0.16, 0.48, 0.58], { scale: [1, 1, 0.5] }), p(SPH(0.05, 8, 6), null, [0.16, 0.48, 0.58], { scale: [1, 1, 0.5] })], glowMat('#fff0a0', '#ffe070', { day: 0.4, night: 2.2 }), T);
  },

  car(g, r) {
    const body = pick(r, [C.sky, C.coral, C.sun, C.teal, C.mint]), bodyD = shade(body, 0.78), seat = '#5a4a7a';
    const s = [
      p(RB(0.76, 0.22, 0.96, 0.1, 3), body, [0, 0.2, 0]),
      p(RB(0.74, 0.14, 0.36, 0.07, 2), body, [0, 0.33, 0.32]),
      p(RB(0.74, 0.16, 0.22, 0.07, 2), bodyD, [0, 0.35, -0.37]),
      p(RB(0.7, 0.04, 0.46, 0.02, 1), seat, [0, 0.31, 0.0]),
      p(RB(0.5, 0.18, 0.08, 0.04, 2), seat, [0, 0.43, -0.26]),
      p(RB(0.68, 0.04, 0.5, 0.02, 1), '#a8e4f0', [0, 0.46, 0.2], { rot: [-0.7, 0, 0] }),
      p(RB(0.78, 0.04, 0.05, 0.02, 1), MET, [0, 0.17, 0.5]), p(RB(0.78, 0.04, 0.05, 0.02, 1), MET, [0, 0.17, -0.5]),
      p(RB(0.8, 0.03, 0.4, 0.015, 1), shade(body, 1.3), [0, 0.3, 0.0]),
      p(CYL(0.045, 0.045, 0.014, 10), DARK, [-0.1, 0.42, 0.08], { rot: [-0.7, 0, 0] }),
    ];
    for (const x of [-0.24, 0.24]) s.push(p(SPH(0.035, 6, 5), C.coral, [x, 0.3, -0.48], { scale: [1, 1, 0.5] }));
    for (const [x, z] of legs4(0.4, 0.3)) s.push(p(TOR(0.085, 0.055, 8, 14), '#33304a', [x, 0.14, z], { rot: [0, PI / 2, 0] }), p(CYL(0.075, 0.075, 0.1, 10), MET, [x, 0.14, z], { rot: [0, 0, PI / 2] }));
    addVC(g, s);
    addMerged(g, [p(SPH(0.055, 8, 6), null, [-0.24, 0.3, 0.495], { scale: [1, 1, 0.5] }), p(SPH(0.055, 8, 6), null, [0.24, 0.3, 0.495], { scale: [1, 1, 0.5] })], glowMat('#fff0a0', '#ffe070', { day: 0.4, night: 2.2 }), T);
  },

  boat(g, r, ph) {
    const hull = new THREE.Group(); g.add(hull);
    const pc = pick(r, [C.coral, C.teal, C.sky, C.sun]), wd = C.woodDark, wl = C.woodLight;
    const s = [
      p(RB(0.64, 0.22, 0.76, 0.1, 3), wd, [0, 0.14, -0.05]),
      p(RB(0.42, 0.22, 0.42, 0.1, 3), wd, [0, 0.14, 0.2], { rot: [0, PI / 4, 0] }),
      p(RB(0.66, 0.05, 0.78, 0.025, 2), pc, [0, 0.215, -0.05]),
      p(RB(0.52, 0.03, 0.66, 0.015, 1), '#c88a4e', [0, 0.235, -0.04]),
      p(RB(0.6, 0.04, 0.08, 0.018, 1), wl, [0, 0.27, -0.2]), p(RB(0.5, 0.04, 0.08, 0.018, 1), wl, [0, 0.27, 0.12]),
      p(RB(0.07, 0.04, 0.7, 0.02, 1), wl, [-0.3, 0.255, -0.05]), p(RB(0.07, 0.04, 0.7, 0.02, 1), wl, [0.3, 0.255, -0.05]),
      p(RB(0.66, 0.04, 0.012, 0.006, 1), '#fffdf6', [0, 0.1, -0.435]),
    ];
    for (const sx of [-1, 1]) {
      s.push(p(CAPS(0.018, 0.3, 3, 6), wl, [sx * 0.42, 0.31, -0.1], { rot: [0, 0, sx * 1.15] }), p(RB(0.09, 0.025, 0.17, 0.012, 1), pc, [sx * 0.58, 0.2, -0.1]), p(SPH(0.03, 6, 5), MET, [sx * 0.3, 0.29, -0.1]));
    }
    s.push(p(TOR(0.07, 0.03, 6, 14), '#fffdf6', [0.24, 0.17, 0.32], { rot: [0.3, PI / 4 + 0.4, 0] }), p(TOR(0.07, 0.031, 6, 14, 1.6), C.coral, [0.24, 0.17, 0.32], { rot: [0.3, PI / 4 + 0.4, 0] }));
    addVC(hull, s);
    g.userData.idle = (t) => { hull.position.y = 0.012 * Math.sin(t * 1.6 + ph); hull.rotation.z = 0.025 * Math.sin(t * 1.3 + ph); hull.rotation.x = 0.015 * Math.sin(t * 1.1 + ph * 2); };
  },

  bathtub(g, r) {
    const cer = '#fffaf0', pc = pick(r, [C.sky, C.teal, C.coral, C.sun]);
    const s = [
      p(RB(0.74, 0.36, 1.02, 0.14, 3), cer, [0, 0.31, 0]),
      p(RB(0.1, 0.07, 1.06, 0.035, 2), cer, [-0.34, 0.52, 0]), p(RB(0.1, 0.07, 1.06, 0.035, 2), cer, [0.34, 0.52, 0]),
      p(RB(0.78, 0.07, 0.12, 0.035, 2), cer, [0, 0.52, -0.47]), p(RB(0.78, 0.07, 0.12, 0.035, 2), cer, [0, 0.52, 0.47]),
      p(RB(0.78, 0.04, 0.2, 0.02, 1), pc, [0, 0.305, 0.52]),
      p(RB(0.7, 0.03, 0.04, 0.012, 1), pc, [0, 0.37, 0.5]),
    ];
    for (const [x, z] of legs4(0.27, 0.4)) s.push(p(SPH(0.075, 8, 6), GOLD, [x, 0.07, z], { scale: [1, 1.1, 1] }), p(CYL(0.035, 0.05, 0.1, 8), GOLD, [x, 0.14, z]));
    // glossy tap
    s.push(p(CYL(0.03, 0.03, 0.2, 8), MET, [0, 0.7, -0.47]), p(TOR(0.055, 0.017, 6, 10, PI), MET, [0, 0.79, -0.42], { rot: [0, 0, 0] }), p(SPH(0.034, 6, 5), C.coral, [-0.08, 0.64, -0.47]), p(SPH(0.034, 6, 5), C.sky, [0.08, 0.64, -0.47]));
    // rubber duck + foam at the edges
    s.push(p(SPH(0.07, 10, 8), C.sun, [0.24, 0.585, -0.2], { scale: [1, 0.8, 1.2] }), p(SPH(0.045, 8, 6), C.sun, [0.24, 0.655, -0.15]), p(CONE(0.02, 0.04, 6), '#f2994a', [0.24, 0.65, -0.1], { rot: [PI / 2, 0, 0] }));
    [[-0.26, 0.58, 0.15], [-0.3, 0.6, -0.05], [-0.22, 0.6, -0.28], [0.28, 0.58, 0.32], [-0.18, 0.58, 0.36], [0.3, 0.6, 0.0]].forEach(([x, y, z], i) => s.push(p(SPH(0.045 + (i % 3) * 0.012, 8, 6), '#ffffff', [x, y, z])));
    addVC(g, s);
    add(g, RB(0.6, 0.06, 0.86, 0.025, 1), toon('#7fd0ee', { rough: 0.25 }), { pos: [0, 0.5, 0], ...T });
  },

  stool(g, r) {
    const pc = pick(r, [C.coral, C.teal, C.sun, C.plum, C.sky]);
    const s = [];
    for (const [x, z] of legs4(0.13, 0.13)) s.push(p(CYL(0.026, 0.02, 0.5, 8), MET, [x, 0.245, z], { rot: [-z * 1.9, 0, x * 1.9] }));
    s.push(p(TOR(0.15, 0.016, 5, 16), MET, [0, 0.16, 0], { rot: [PI / 2, 0, 0] }));
    s.push(p(CYL(0.19, 0.19, 0.05, 18), shade(pc, 0.8), [0, 0.435, 0]), p(CYL(0.2, 0.2, 0.06, 18), pc, [0, 0.47, 0]), p(TOR(0.2, 0.035, 6, 18), pc, [0, 0.47, 0], { rot: [PI / 2, 0, 0] }), p(CYL(0.17, 0.17, 0.02, 18), shade(pc, 1.15), [0, 0.5, 0]));
    addVC(g, s);
  },
};

export function buildObject(type, g, seed) {
  const b = BUILDERS[type];
  if (!b && hasExtra(type)) { buildExtra(type, g, rng(seed), (seed % 1000) / 1000 * PI * 2); return true; }
  if (!b) { add(g, RB(0.5, 0.5, 0.5, 0.06), '#cccccc', { pos: [0, 0.25, 0] }); return false; }
  const r = rng(seed);
  b(g, r, (seed % 1000) / 1000 * PI * 2);
  return true;
}
