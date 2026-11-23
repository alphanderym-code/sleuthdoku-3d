// Held weapon props for suspect figurines. Each builder returns a THREE.Group with the grip at the
// origin and the weapon extending along +y (the figurine tilts it forward). Units match the figurine
// (head radius 0.22). Materials are created with toonOwn and pushed to `mats` for hit flashes.
import * as THREE from 'three';
import { add, toonOwn, addOutlines, BOX, CYL, SPH, CONE, TOR, CAPS } from './kit.js';

const T = { noOutline: true, shadow: false };
const PI = Math.PI;

const BUILDERS = {
  knife(g, m) {
    add(g, CYL(0.02, 0.02, 0.1, 8), m.wood, { pos: [0, 0.01, 0] });
    add(g, BOX(0.09, 0.02, 0.03), m.dark, { pos: [0, 0.065, 0] });
    add(g, BOX(0.045, 0.2, 0.014), m.steel, { pos: [0, 0.17, 0] });
    add(g, CONE(0.0225, 0.07, 4), m.steel, { pos: [0, 0.305, 0], rot: [0, PI / 4, 0], scale: [1, 1, 0.31] });
  },
  letteropener(g, m) {
    add(g, CYL(0.016, 0.016, 0.08, 8), m.gold, { pos: [0, 0.01, 0] });
    add(g, BOX(0.06, 0.016, 0.022), m.gold, { pos: [0, 0.055, 0] });
    add(g, BOX(0.03, 0.2, 0.01), m.steel, { pos: [0, 0.16, 0] });
    add(g, CONE(0.015, 0.07, 4), m.steel, { pos: [0, 0.295, 0], rot: [0, PI / 4, 0], scale: [1, 1, 0.33] });
  },
  shears(g, m) {
    for (const s of [-1, 1]) {
      add(g, CAPS(0.012, 0.09, 3, 6), m.red, { pos: [s * 0.03, 0.0, 0], rot: [0, 0, s * 0.3] });
      add(g, BOX(0.026, 0.2, 0.012), m.steel, { pos: [s * 0.015, 0.2, 0], rot: [0, 0, -s * 0.07] });
    }
    add(g, SPH(0.016, 8, 6), m.dark, { pos: [0, 0.095, 0], ...T });
  },
  pistol(g, m) {
    add(g, BOX(0.045, 0.12, 0.05), m.wood, { pos: [0, 0.0, 0], rot: [0, 0, 0.18] });
    add(g, BOX(0.055, 0.06, 0.2), m.dark, { pos: [0, 0.085, 0.07] });
    add(g, CYL(0.018, 0.018, 0.08, 8), m.steel, { pos: [0, 0.085, 0.2], rot: [PI / 2, 0, 0] });
    add(g, TOR(0.03, 0.006, 6, 10, PI), m.dark, { pos: [0, 0.045, 0.02], rot: [0, PI / 2, PI], ...T });
  },
  crossbow(g, m) {
    add(g, BOX(0.045, 0.045, 0.3), m.wood, { pos: [0, 0.07, 0.05] });
    add(g, BOX(0.3, 0.025, 0.03), m.wood, { pos: [0, 0.07, 0.19] });
    add(g, BOX(0.026, 0.02, 0.1), m.red, { pos: [0, 0.098, 0.12], ...T });
    add(g, CYL(0.006, 0.006, 0.28, 5), m.dark, { pos: [0, 0.07, 0.17], rot: [0, 0, PI / 2], ...T });
    add(g, BOX(0.04, 0.1, 0.04), m.wood, { pos: [0, 0.0, 0] });
  },
  rope(g, m) {
    for (let i = 0; i < 3; i++) add(g, TOR(0.07 - i * 0.005, 0.017, 6, 16), m.rope, { pos: [0, 0.05 + i * 0.03, 0.0], rot: [PI / 2, 0, i * 0.5] });
    add(g, CAPS(0.015, 0.1, 3, 6), m.rope, { pos: [0.06, -0.03, 0], rot: [0, 0, 0.4] });
  },
  scarf(g, m) {
    add(g, CAPS(0.032, 0.12, 4, 8), m.cloth, { pos: [0, 0.0, 0] });
    add(g, BOX(0.075, 0.2, 0.014), m.cloth, { pos: [0.0, -0.1, 0.02], rot: [0.2, 0, 0.12] });
    add(g, BOX(0.075, 0.16, 0.014), m.cloth2, { pos: [0.05, -0.08, -0.015], rot: [-0.15, 0, -0.1] });
    add(g, BOX(0.06, 0.02, 0.02), m.cloth2, { pos: [0, 0.02, 0.0], ...T });
  },
  candlestick(g, m) {
    add(g, CYL(0.05, 0.06, 0.02, 12), m.gold, { pos: [0, 0.0, 0] });
    add(g, CYL(0.013, 0.02, 0.16, 8), m.gold, { pos: [0, 0.1, 0] });
    add(g, SPH(0.03, 8, 6), m.gold, { pos: [0, 0.13, 0], scale: [1, 0.7, 1] });
    add(g, CYL(0.04, 0.03, 0.025, 10), m.gold, { pos: [0, 0.2, 0] });
    add(g, CYL(0.015, 0.015, 0.1, 8), m.candle, { pos: [0, 0.26, 0] });
    add(g, CONE(0.012, 0.04, 6), m.flame, { pos: [0, 0.33, 0], ...T });
  },
  wrench(g, m) {
    add(g, BOX(0.035, 0.26, 0.016), m.steel, { pos: [0, 0.09, 0] });
    add(g, TOR(0.045, 0.02, 6, 14, PI * 1.5), m.steel, { pos: [0, 0.255, 0], rot: [0, 0, PI * 0.75] });
    add(g, CYL(0.025, 0.025, 0.016, 8), m.steel, { pos: [0, -0.04, 0], rot: [PI / 2, 0, 0], ...T });
  },
  hammer(g, m) {
    add(g, CYL(0.016, 0.02, 0.28, 8), m.wood, { pos: [0, 0.08, 0] });
    add(g, BOX(0.14, 0.06, 0.06), m.steel, { pos: [0, 0.235, 0] });
    add(g, BOX(0.03, 0.05, 0.05), m.dark, { pos: [0.085, 0.235, 0], ...T });
  },
  golfclub(g, m) {
    add(g, CYL(0.014, 0.014, 0.1, 8), m.dark, { pos: [0, 0.02, 0] });
    add(g, CYL(0.008, 0.012, 0.32, 8), m.steel, { pos: [0, 0.23, 0] });
    add(g, BOX(0.06, 0.05, 0.09), m.steel, { pos: [0, 0.4, 0.035], rot: [0.35, 0, 0] });
  },
  mallet(g, m) {
    add(g, CYL(0.016, 0.016, 0.3, 8), m.wood, { pos: [0, 0.14, 0] });
    add(g, CYL(0.06, 0.06, 0.14, 12), m.red, { pos: [0, 0.34, 0], rot: [0, 0, PI / 2] });
    for (const s of [-1, 1]) add(g, CYL(0.064, 0.064, 0.015, 12), m.gold, { pos: [s * 0.065, 0.34, 0], rot: [0, 0, PI / 2], ...T });
  },
  flaregun(g, m) {
    add(g, BOX(0.04, 0.1, 0.05), m.red, { pos: [0, 0.02, 0], rot: [0.2, 0, 0] });
    add(g, CYL(0.032, 0.032, 0.16, 10), m.red, { pos: [0, 0.14, 0.03] });
    add(g, CYL(0.026, 0.026, 0.02, 10), m.flame, { pos: [0, 0.23, 0.03], ...T });
  },
  skipole(g, m) {
    add(g, CYL(0.016, 0.016, 0.07, 8), m.dark, { pos: [0, 0.0, 0] });
    add(g, CYL(0.009, 0.009, 0.36, 8), m.steel, { pos: [0, 0.2, 0] });
    add(g, TOR(0.045, 0.008, 6, 12), m.dark, { pos: [0, 0.3, 0], rot: [PI / 2, 0, 0], ...T });
    add(g, CONE(0.014, 0.06, 6), m.steel, { pos: [0, 0.41, 0] });
  },
  shovel(g, m) {
    add(g, CYL(0.016, 0.016, 0.34, 8), m.wood, { pos: [0, 0.12, 0] });
    add(g, BOX(0.07, 0.016, 0.03), m.wood, { pos: [0, 0.3, 0], ...T });
    add(g, BOX(0.11, 0.14, 0.015), m.steel, { pos: [0, 0.37, 0] });
    add(g, CONE(0.055, 0.05, 3), m.steel, { pos: [0, 0.465, 0], rot: [0, 0, PI], scale: [1, 1, 0.28] });
  },
  poison(g, m) {
    add(g, SPH(0.06, 12, 10), m.glass, { pos: [0, 0.07, 0] });
    add(g, SPH(0.047, 10, 8), m.liquid, { pos: [0, 0.065, 0], ...T });
    add(g, CYL(0.02, 0.025, 0.07, 8), m.glass, { pos: [0, 0.15, 0] });
    add(g, CYL(0.026, 0.022, 0.03, 8), m.wood, { pos: [0, 0.2, 0] });
  },
  syringe(g, m) {
    add(g, CYL(0.027, 0.027, 0.17, 10), m.glass, { pos: [0, 0.12, 0] });
    add(g, CYL(0.02, 0.02, 0.09, 8), m.liquid, { pos: [0, 0.1, 0], ...T });
    add(g, BOX(0.09, 0.012, 0.03), m.steel, { pos: [0, 0.21, 0] });
    add(g, CYL(0.007, 0.007, 0.08, 6), m.steel, { pos: [0, 0.01, 0], ...T });
    add(g, CYL(0.005, 0.005, 0.1, 6), m.steel, { pos: [0, 0.285, 0], ...T });
    add(g, BOX(0.05, 0.012, 0.025), m.red, { pos: [0, 0.0, 0], ...T });
  },
  // Generic fallback for unknown ids: a short club.
  _generic(g, m) {
    add(g, CYL(0.02, 0.025, 0.28, 8), m.wood, { pos: [0, 0.1, 0] });
    add(g, SPH(0.04, 8, 6), m.wood, { pos: [0, 0.26, 0] });
  },
};

const COLORS = {
  steel: ['#c9d3dc'], dark: ['#3a3d46'], wood: ['#8a5a32'], gold: ['#e3b73f'], red: ['#c4413a'],
  rope: ['#c9a66b'], cloth: ['#b04a8a'], cloth2: ['#8e3a70'], candle: ['#f4efe0'],
  flame: ['#ffb02e', { emissive: '#ff8a00', emissiveIntensity: 0.6 }],
  glass: ['#cfeee6'], liquid: ['#58c46b', { emissive: '#2f9a4a', emissiveIntensity: 0.25 }],
};

/** Builds a held weapon prop group (grip at origin, +y along the weapon). `mats` receives its materials. */
export function createWeapon3d(id, mats = []) {
  const g = new THREE.Group();
  g.name = `weapon:${id}`;
  const m = {};
  for (const k of Object.keys(COLORS)) { m[k] = toonOwn(COLORS[k][0], COLORS[k][1]); mats.push(m[k]); }
  (BUILDERS[id] || BUILDERS._generic)(g, m);
  addOutlines(g, 0.012);
  return g;
}

export const WEAPON3D_IDS = Object.keys(BUILDERS).filter((k) => k[0] !== '_');
