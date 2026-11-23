// Extra cartoon models for the Extreme scenes (golf course + zoo). Same conventions as objects.js:
// each fits a 1x1 cell, rests on y=0, front faces +z; outlines are added by the caller (createObject).
// Occupiable types (tee, flag, bunker, cart, shallows) keep their middle clear so a figurine can stand on them.
import * as THREE from 'three';
import { add, toon, toonOwn, shade, RB, BOX, CYL, SPH, ICO, CONE, TOR, CAPS } from './kit.js';

const PI = Math.PI;
const T = { noOutline: true, shadow: false };

/** Figurine stand height / forward offset for the occupiable extra types (merged into standInfo). */
export const EXTRA_STAND = {
  tee: { y: 0.03, dz: 0 }, flag: { y: 0.03, dz: 0.04 }, bunker: { y: 0.0, dz: 0 },
  cart: { y: 0.3, dz: 0.06 }, shallows: { y: 0.02, dz: 0 },
};

const GREEN = { turf: '#7fd47a', turfDark: '#5fb85f', sand: '#f2dca0', sandDark: '#dcc080', white: '#fffdf6', dark: '#3a3550', red: '#e06060' };

const EXTRA_BUILDERS = {
  // --- golf ---------------------------------------------------------------------------------
  tee(g, r) {
    add(g, RB(0.8, 0.04, 0.8, 0.05), GREEN.turf, { pos: [0, 0.02, 0] });
    add(g, RB(0.6, 0.012, 0.6, 0.03), GREEN.turfDark, { pos: [0, 0.046, 0], ...T });
    // two tee markers (little coloured balls on pegs) at the back corners, plus a tee with a ball at the front
    for (const [x, c] of [[-0.3, '#4f86c6'], [0.3, '#e06060']]) {
      add(g, CYL(0.012, 0.012, 0.06, 6), GREEN.white, { pos: [x, 0.08, -0.3], ...T });
      add(g, SPH(0.05, 10, 8), c, { pos: [x, 0.13, -0.3] });
    }
    add(g, CYL(0.008, 0.008, 0.07, 6), '#f2c14e', { pos: [-0.28, 0.08, 0.3], ...T });
    add(g, CYL(0.025, 0.006, 0.02, 8), '#f2c14e', { pos: [-0.28, 0.12, 0.3], ...T });
    add(g, SPH(0.035, 10, 8), GREEN.white, { pos: [-0.28, 0.155, 0.3] });
  },

  flag(g, r, ph) {
    add(g, CYL(0.46, 0.48, 0.04, 20), '#8fe08a', { pos: [0, 0.02, 0] });
    add(g, CYL(0.3, 0.3, 0.012, 18), '#a6ec9f', { pos: [0, 0.046, 0], ...T });
    add(g, CYL(0.05, 0.05, 0.012, 12), GREEN.dark, { pos: [0.12, 0.052, 0.1], ...T }); // the cup
    add(g, CYL(0.012, 0.012, 0.9, 6), GREEN.white, { pos: [-0.3, 0.47, -0.3], ...T }); // pole (back corner)
    const flagG = new THREE.Group(); flagG.position.set(-0.3, 0.8, -0.3); g.add(flagG);
    add(flagG, BOX(0.24, 0.15, 0.012), '#e84a4a', { pos: [0.12, 0, 0], noOutline: false, shadow: false });
    add(g, SPH(0.022, 6, 5), '#f2c14e', { pos: [-0.3, 0.93, -0.3], ...T });
    g.userData.idle = (t) => { flagG.rotation.y = 0.25 * Math.sin(t * 2.2 + ph); };
  },

  bunker(g, r) {
    // A shallow sand pit: dark lip ring, pale sand floor, a few ripples and a rake leaning in the back corner.
    add(g, CYL(0.47, 0.49, 0.035, 22), GREEN.sandDark, { pos: [0, 0.0175, 0] });
    add(g, CYL(0.4, 0.4, 0.02, 22), GREEN.sand, { pos: [0, 0.04, 0], ...T });
    for (let i = 0; i < 3; i++) add(g, BOX(0.5 - i * 0.06, 0.006, 0.014), GREEN.sandDark, { pos: [0, 0.052, -0.1 + i * 0.12], ...T });
    add(g, CYL(0.01, 0.01, 0.34, 5), '#9b6238', { pos: [0.3, 0.14, -0.33], rot: [0.5, 0, -0.3], ...T });
    add(g, BOX(0.14, 0.02, 0.03), '#7a4a2c', { pos: [0.34, 0.01, -0.22], rot: [0, 0.4, 0] });
  },

  cart(g, r) {
    const body = pick(r, ['#fffdf6', '#f6f1e6', '#d6ecff']);
    const trim = pick(r, ['#3fae6a', '#4f86c6', '#e06060']);
    for (const [x, z] of [[-0.3, -0.27], [0.3, -0.27], [-0.3, 0.27], [0.3, 0.27]]) {
      add(g, CYL(0.09, 0.09, 0.07, 14), GREEN.dark, { pos: [x, 0.09, z], rot: [0, 0, PI / 2] });
      add(g, CYL(0.04, 0.04, 0.075, 8), '#cfd3dc', { pos: [x, 0.09, z], rot: [0, 0, PI / 2], ...T });
    }
    add(g, RB(0.66, 0.1, 0.9, 0.04), body, { pos: [0, 0.16, 0] });          // chassis
    add(g, RB(0.7, 0.05, 0.28, 0.03), trim, { pos: [0, 0.2, 0.42] });       // front nose
    add(g, RB(0.6, 0.12, 0.14, 0.03), trim, { pos: [0, 0.27, -0.36] });     // rear panel
    add(g, RB(0.52, 0.05, 0.3, 0.02), '#d9c9a8', { pos: [0, 0.23, 0.06] }); // bench seat
    add(g, RB(0.52, 0.18, 0.05, 0.02), '#d9c9a8', { pos: [0, 0.32, -0.1] }); // seat back
    for (const [x, z] of [[-0.3, 0.3], [0.3, 0.3], [-0.3, -0.3], [0.3, -0.3]]) add(g, CYL(0.012, 0.012, 0.52, 5), GREEN.white, { pos: [x, 0.5, z], ...T });
    add(g, RB(0.74, 0.04, 0.78, 0.02), trim, { pos: [0, 0.77, 0] });        // canopy
    add(g, RB(0.2, 0.34, 0.14, 0.04), '#3a3550', { pos: [0.18, 0.4, -0.38], rot: [-0.15, 0, 0.1] }); // golf bag
    for (const x of [0.13, 0.19, 0.25]) add(g, CYL(0.012, 0.012, 0.22, 5), '#cfd3dc', { pos: [x, 0.64, -0.36], rot: [-0.15, 0, 0.1], ...T });
  },

  // --- zoo water (occupiable) ---------------------------------------------------------------------
  shallows(g, r, ph) {
    const m = toonOwn('#6ec6f2'); m.transparent = true; m.opacity = 0.82;
    add(g, CYL(0.48, 0.48, 0.045, 24), m, { pos: [0, 0.0225, 0], ...T });
    const m2 = toonOwn('#bfeaff'); m2.transparent = true; m2.opacity = 0.7;
    const rings = [0.12, 0.26, 0.38].map((rad, i) => add(g, TOR(rad, 0.008, 4, 24), m2, { pos: [0.04 * (i - 1), 0.048, 0.03 * (1 - i)], rot: [PI / 2, 0, 0], ...T }));
    g.userData.idle = (t) => rings.forEach((rg, i) => rg.scale.setScalar(1 + 0.06 * Math.sin(t * 1.4 + ph + i * 1.7)));
  },

  // --- zoo animals (blocking) ---------------------------------------------------------------------
  bear(g, r) {
    const fur = pick(r, ['#8a5a3a', '#6e4630', '#a77a52']), dark = shade(fur, 0.8);
    add(g, SPH(0.3, 14, 10), fur, { pos: [0, 0.32, -0.04], scale: [1.05, 0.95, 1.2] });             // body
    for (const [x, z] of [[-0.18, 0.18], [0.18, 0.18], [-0.18, -0.24], [0.18, -0.24]]) add(g, CYL(0.09, 0.1, 0.24, 10), dark, { pos: [x, 0.12, z] });
    add(g, SPH(0.2, 14, 10), fur, { pos: [0, 0.55, 0.26] });                                          // head
    for (const x of [-0.14, 0.14]) add(g, SPH(0.06, 8, 6), dark, { pos: [x, 0.71, 0.22] });           // ears
    add(g, SPH(0.1, 10, 8), '#d9b48a', { pos: [0, 0.5, 0.42], scale: [1, 0.8, 0.9] });                // muzzle
    add(g, SPH(0.03, 6, 5), GREEN.dark, { pos: [0, 0.54, 0.5], ...T });
    for (const x of [-0.07, 0.07]) add(g, SPH(0.025, 6, 5), GREEN.dark, { pos: [x, 0.6, 0.4], ...T });
  },

  lion(g, r) {
    const fur = '#e6b45a', mane = pick(r, ['#9b5a2a', '#b06a30', '#7a4a2c']);
    add(g, SPH(0.26, 14, 10), fur, { pos: [0, 0.3, -0.08], scale: [0.9, 0.9, 1.45] });
    for (const [x, z] of [[-0.14, 0.14], [0.14, 0.14], [-0.14, -0.3], [0.14, -0.3]]) add(g, CYL(0.07, 0.08, 0.22, 8), shade(fur, 0.9), { pos: [x, 0.11, z] });
    add(g, ICO(0.27, 1), toon(mane, { flat: true }), { pos: [0, 0.5, 0.24] });                          // mane
    add(g, SPH(0.17, 12, 10), fur, { pos: [0, 0.48, 0.34] });                                          // face
    add(g, SPH(0.07, 8, 6), '#f6d79a', { pos: [0, 0.43, 0.46], scale: [1, 0.8, 0.9] });
    add(g, SPH(0.025, 6, 5), GREEN.dark, { pos: [0, 0.47, 0.52], ...T });
    for (const x of [-0.08, 0.08]) add(g, SPH(0.02, 6, 5), GREEN.dark, { pos: [x, 0.53, 0.49], ...T });
    add(g, CAPS(0.025, 0.3, 4, 6), fur, { pos: [0.02, 0.32, -0.47], rot: [1.1, 0, 0.1] });              // tail + tuft
    add(g, SPH(0.055, 8, 6), mane, { pos: [0.03, 0.46, -0.6] });
  },

  elephant(g, r) {
    const hide = pick(r, ['#9aa3b5', '#a8a39c', '#8f98ad']), dark = shade(hide, 0.82);
    add(g, SPH(0.34, 14, 10), hide, { pos: [0, 0.46, -0.06], scale: [1.0, 0.95, 1.25] });
    for (const [x, z] of [[-0.2, 0.2], [0.2, 0.2], [-0.2, -0.3], [0.2, -0.3]]) add(g, CYL(0.1, 0.11, 0.3, 10), dark, { pos: [x, 0.15, z] });
    add(g, SPH(0.22, 12, 10), hide, { pos: [0, 0.62, 0.3] });                                          // head
    for (const s of [-1, 1]) add(g, SPH(0.2, 10, 8), shade(hide, 0.92), { pos: [s * 0.3, 0.6, 0.24], scale: [0.25, 1, 0.9] }); // ears
    add(g, CAPS(0.065, 0.3, 4, 8), hide, { pos: [0, 0.4, 0.5], rot: [0.35, 0, 0] });                   // trunk
    add(g, SPH(0.07, 8, 6), hide, { pos: [0, 0.22, 0.58] });
    for (const s of [-1, 1]) add(g, CONE(0.03, 0.18, 6), '#fff6df', { pos: [s * 0.11, 0.46, 0.5], rot: [1.9, 0, s * 0.2] }); // tusks
    for (const s of [-1, 1]) add(g, SPH(0.022, 6, 5), GREEN.dark, { pos: [s * 0.12, 0.68, 0.46], ...T });
  },

  penguin(g, r, ph) {
    const body = new THREE.Group(); g.add(body);
    add(body, CAPS(0.17, 0.26, 6, 12), '#2f3350', { pos: [0, 0.34, 0] });
    add(body, SPH(0.15, 12, 10), '#fffdf6', { pos: [0, 0.33, 0.07], scale: [0.95, 1.35, 0.7] });         // belly
    add(body, SPH(0.13, 12, 10), '#2f3350', { pos: [0, 0.66, 0] });                                      // head
    add(body, CONE(0.035, 0.1, 6), '#f2994a', { pos: [0, 0.65, 0.14], rot: [PI / 2, 0, 0] });            // beak
    for (const s of [-1, 1]) {
      add(body, SPH(0.022, 6, 5), '#ffffff', { pos: [s * 0.055, 0.69, 0.115], ...T });
      add(body, SPH(0.011, 5, 4), GREEN.dark, { pos: [s * 0.055, 0.69, 0.13], ...T });
      add(body, SPH(0.07, 8, 6), '#2f3350', { pos: [s * 0.2, 0.36, 0], scale: [0.4, 1.4, 0.8], rot: [0, 0, -s * 0.25] }); // flippers
      add(g, SPH(0.07, 8, 6), '#f2994a', { pos: [s * 0.08, 0.025, 0.1], scale: [1, 0.35, 1.4] });          // feet
    }
    g.userData.idle = (t) => { body.rotation.z = 0.07 * Math.sin(t * 2.4 + ph); };
  },

  croc(g0, r) {
    const g = new THREE.Group(); g.scale.setScalar(0.74); g.position.z = 0.05; g0.add(g); // long animal: shrink to fit the cell
    const hide = pick(r, ['#5fae5a', '#4f9a52', '#6fbf6a']), dark = shade(hide, 0.78);
    add(g, RB(0.34, 0.16, 0.56, 0.07), hide, { pos: [0, 0.14, -0.02] });                                // body
    add(g, RB(0.2, 0.1, 0.4, 0.05), hide, { pos: [0, 0.1, -0.4], rot: [0, 0.2, 0] });                   // tail
    add(g, RB(0.1, 0.06, 0.28, 0.03), dark, { pos: [0.04, 0.08, -0.66], rot: [0, 0.35, 0] });
    add(g, RB(0.24, 0.1, 0.22, 0.05), hide, { pos: [0, 0.15, 0.3] });                                   // head
    add(g, RB(0.18, 0.07, 0.24, 0.04), shade(hide, 1.08), { pos: [0, 0.13, 0.5] });                     // snout
    add(g, RB(0.18, 0.025, 0.22, 0.01), '#fffdf6', { pos: [0, 0.095, 0.5], ...T });                     // teeth strip
    for (const s of [-1, 1]) {
      add(g, SPH(0.04, 8, 6), '#f6d84a', { pos: [s * 0.09, 0.22, 0.28] });
      add(g, SPH(0.018, 6, 5), GREEN.dark, { pos: [s * 0.09, 0.235, 0.31], ...T });
      add(g, RB(0.07, 0.06, 0.14, 0.03), dark, { pos: [s * 0.22, 0.06, 0.12], rot: [0, s * 0.5, 0] });  // legs
      add(g, RB(0.07, 0.06, 0.14, 0.03), dark, { pos: [s * 0.22, 0.06, -0.24], rot: [0, -s * 0.5, 0] });
    }
    for (let i = 0; i < 5; i++) add(g, CONE(0.03, 0.06, 4), dark, { pos: [0, 0.24, 0.1 - i * 0.14], ...T });  // back ridges
  },

  shark(g, r, ph) {
    const m = toonOwn('#7fd0f5'); m.transparent = true; m.opacity = 0.8;
    add(g, CYL(0.48, 0.48, 0.04, 24), m, { pos: [0, 0.02, 0], ...T });                                   // the pool under it
    const fin = new THREE.Group(); fin.position.set(0, 0.04, 0); g.add(fin);
    add(fin, SPH(0.2, 12, 8), '#6a7a96', { pos: [0, 0.03, 0], scale: [0.7, 0.35, 1.7] });                // back hump
    add(fin, CONE(0.14, 0.5, 4), '#6a7a96', { pos: [0, 0.3, -0.04], rot: [-0.2, PI / 4, 0], scale: [0.32, 1, 1] }); // dorsal fin
    add(fin, CONE(0.09, 0.3, 4), '#6a7a96', { pos: [0, 0.16, -0.38], rot: [-0.5, PI / 4, 0], scale: [0.3, 1, 1] });  // tail fin
    add(g, TOR(0.4, 0.012, 4, 28), '#ffffff', { pos: [0, 0.045, 0], rot: [PI / 2, 0, 0], ...T });         // wake ring
    g.userData.idle = (t) => { fin.rotation.y = 0.5 * Math.sin(t * 0.8 + ph); fin.position.y = 0.04 + 0.012 * Math.sin(t * 2 + ph); };
  },
};

function pick(r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; }

/** Builds an extra type into group g. Returns true when handled, false for an unknown type. */
export function buildExtra(type, g, r, ph) {
  const b = EXTRA_BUILDERS[type];
  if (!b) return false;
  b(g, r, ph);
  return true;
}
export const hasExtra = (type) => type in EXTRA_BUILDERS;
