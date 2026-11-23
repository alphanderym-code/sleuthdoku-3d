// Cartoon models for the large-board scenes (amusement park, cruise ship, ski resort, airport).
// Same conventions as extra.js: each fits a 1x1 cell, rests on y=0, front faces +z; outlines are added by the
// caller. Occupiable types (carhorse, ferriscab, deckchair, liftchair) keep their middle clear for a figurine.
import * as THREE from 'three';
import { add, shade, RB, BOX, CYL, SPH, CONE, TOR } from './kit.js';

const PI = Math.PI;
const T = { noOutline: true, shadow: false };
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

/** Figurine stand height / forward offset for the occupiable types below (merged into standInfo). */
export const EXTRA2_STAND = {
  carhorse: { y: 0.06, dz: 0.02 }, ferriscab: { y: 0.14, dz: 0.02 }, deckchair: { y: 0.2, dz: 0.02 }, liftchair: { y: 0.28, dz: 0.04 },
};

export const EXTRA2_BUILDERS = {
  // --- amusement park ---------------------------------------------------------------------------
  carhorse(g, r, ph) {
    const coat = pick(r, ['#fffdf6', '#e9b27a', '#d98aa8', '#8fc7f0']), mane = pick(r, ['#e06060', '#f2c14e', '#4f86c6']);
    add(g, CYL(0.46, 0.48, 0.06, 22), pick(r, ['#e06060', '#4f86c6', '#8a5fc8']), { pos: [0, 0.03, 0] });  // platform
    add(g, CYL(0.4, 0.4, 0.012, 22), '#f6e7b4', { pos: [0, 0.066, 0], ...T });
    add(g, TOR(0.43, 0.014, 4, 28), '#f2c14e', { pos: [0, 0.06, 0], rot: [PI / 2, 0, 0], ...T });
    const horse = new THREE.Group(); horse.position.set(-0.27, 0.1, -0.02); g.add(horse);
    add(g, CYL(0.016, 0.016, 0.74, 8), '#f2c14e', { pos: [-0.27, 0.43, -0.02] });                       // brass pole
    add(g, SPH(0.03, 8, 6), '#f2c14e', { pos: [-0.27, 0.81, -0.02], ...T });
    add(horse, SPH(0.13, 12, 9), coat, { pos: [0, 0.3, 0], scale: [0.78, 0.82, 1.55] });                  // body
    add(horse, CYL(0.05, 0.07, 0.2, 8), coat, { pos: [0, 0.42, 0.2], rot: [0.5, 0, 0] });                  // neck
    add(horse, SPH(0.075, 10, 8), coat, { pos: [0, 0.54, 0.29], scale: [0.85, 0.9, 1.25] });               // head
    add(horse, SPH(0.04, 8, 6), shade(coat, 0.9), { pos: [0, 0.51, 0.37] });                                 // muzzle
    for (const x of [-0.035, 0.035]) add(horse, CONE(0.02, 0.06, 5), coat, { pos: [x, 0.62, 0.26] });       // ears
    add(horse, BOX(0.03, 0.14, 0.05), mane, { pos: [0, 0.48, 0.15], rot: [0.5, 0, 0], ...T });             // mane
    add(horse, SPH(0.045, 8, 6), mane, { pos: [0, 0.3, -0.24], scale: [0.7, 1.2, 0.8] });                   // tail
    add(horse, RB(0.2, 0.03, 0.2, 0.01), '#a8742f', { pos: [0, 0.4, 0.0] });                                // saddle
    for (const [x, z] of [[-0.07, 0.12], [0.07, 0.12], [-0.07, -0.12], [0.07, -0.12]]) add(horse, CYL(0.022, 0.018, 0.2, 6), coat, { pos: [x, 0.12, z], ...T });
    g.userData.idle = (t) => { const b = 0.04 * Math.sin(t * 2 + ph); horse.position.y = 0.1 + b; };
  },

  ferriscab(g, r, ph) {
    const col = pick(r, ['#e06060', '#f2c14e', '#4f86c6', '#3fae6a', '#a07be0']);
    add(g, TOR(0.42, 0.02, 5, 28), '#d7dbe6', { pos: [0, 0.5, -0.46], rot: [0, 0, 0], ...T });             // slice of wheel rim behind
    for (const a of [0, PI / 3, 2 * PI / 3]) add(g, BOX(0.84, 0.014, 0.014), '#d7dbe6', { pos: [0, 0.5, -0.46], rot: [0, 0, a], ...T });
    add(g, RB(0.74, 0.08, 0.62, 0.03), shade(col, 0.85), { pos: [0, 0.1, 0.02] });                          // floor
    for (const [x, z] of [[-0.34, -0.26], [0.34, -0.26], [-0.34, 0.3], [0.34, 0.3]]) add(g, CYL(0.014, 0.014, 0.54, 5), '#fffdf6', { pos: [x, 0.4, z], ...T });
    add(g, RB(0.74, 0.12, 0.04, 0.02), col, { pos: [0, 0.2, -0.28] });                                       // back wall
    for (const s of [-1, 1]) add(g, RB(0.04, 0.12, 0.54, 0.02), col, { pos: [s * 0.35, 0.2, 0.02] });      // side rails
    add(g, RB(0.82, 0.05, 0.72, 0.03), col, { pos: [0, 0.7, 0.01] });                                        // roof
    add(g, SPH(0.1, 10, 7), shade(col, 1.15), { pos: [0, 0.74, 0.01], scale: [1, 0.5, 1] });
    add(g, CYL(0.012, 0.012, 0.3, 5), '#d7dbe6', { pos: [0, 0.88, -0.2], rot: [-0.55, 0, 0], ...T });      // hanger to the rim
    g.userData.idle = (t) => { g.rotation.z = 0.018 * Math.sin(t * 1.3 + ph); };
  },

  foodstall(g, r, ph) {
    const a = pick(r, ['#e06060', '#4f86c6', '#3fae6a', '#f2a03e']);
    add(g, RB(0.84, 0.46, 0.6, 0.04), '#f1e2c4', { pos: [0, 0.23, 0.04] });                                 // booth
    add(g, RB(0.9, 0.05, 0.66, 0.02), '#a8742f', { pos: [0, 0.48, 0.08] });                                  // serving ledge
    for (const x of [-0.4, 0.4]) add(g, CYL(0.018, 0.018, 0.55, 6), '#fffdf6', { pos: [x, 0.72, 0.34], ...T });
    for (let i = 0; i < 6; i++) {                                                                             // striped awning
      add(g, BOX(0.15, 0.03, 0.5), i % 2 ? '#fffdf6' : a, { pos: [-0.375 + i * 0.15, 0.97 - 0.0, 0.1], rot: [0.28, 0, 0] });
    }
    add(g, RB(0.5, 0.14, 0.03, 0.01), '#3a3550', { pos: [0, 0.65, -0.18] });                                 // menu board
    add(g, SPH(0.035, 8, 6), '#f2c14e', { pos: [-0.12, 0.65, -0.15], ...T });
    add(g, BOX(0.16, 0.02, 0.012), '#fffdf6', { pos: [0.08, 0.66, -0.158], ...T });
    add(g, BOX(0.12, 0.02, 0.012), '#fffdf6', { pos: [0.1, 0.62, -0.158], ...T });
    const sign = new THREE.Group(); sign.position.set(0, 0.86, 0.38); g.add(sign);
    add(sign, SPH(0.07, 10, 8), '#f2c14e', { pos: [0, -0.07, 0], scale: [1.6, 0.8, 0.5] });                 // hanging pretzel/bun
    add(sign, CYL(0.006, 0.006, 0.06, 4), '#d7dbe6', { pos: [0, 0.0, 0], ...T });
    add(g, CYL(0.05, 0.05, 0.05, 10), '#f2c14e', { pos: [0.26, 0.53, 0.2] });                                // a pile of snacks
    add(g, CONE(0.05, 0.08, 8), '#e06060', { pos: [0.26, 0.6, 0.2], ...T });
    g.userData.idle = (t) => { sign.rotation.z = 0.12 * Math.sin(t * 1.8 + ph); };
  },

  // --- cruise ship ------------------------------------------------------------------------------
  deckchair(g, r) {
    const cloth = pick(r, ['#4f86c6', '#e06060', '#f2a03e', '#3fae6a']);
    const wood = '#b9824a';
    for (const s of [-1, 1]) {
      add(g, BOX(0.04, 0.04, 0.78), wood, { pos: [s * 0.24, 0.14, 0.0], rot: [0.0, 0, 0], ...T });         // side rails
      add(g, BOX(0.04, 0.2, 0.04), wood, { pos: [s * 0.24, 0.1, 0.3], ...T });                               // front legs
      add(g, BOX(0.04, 0.2, 0.04), wood, { pos: [s * 0.24, 0.1, -0.1], ...T });                              // rear legs
    }
    add(g, RB(0.42, 0.03, 0.46, 0.012), cloth, { pos: [0, 0.17, 0.1] });                                      // seat
    add(g, RB(0.42, 0.03, 0.4, 0.012), cloth, { pos: [0, 0.3, -0.24], rot: [-0.75, 0, 0] });                  // back
    add(g, RB(0.42, 0.03, 0.1, 0.012), '#fffdf6', { pos: [0, 0.2, -0.0], ...T });                              // stripe
    add(g, RB(0.3, 0.08, 0.1, 0.03), '#fffdf6', { pos: [0, 0.4, -0.37], rot: [-0.75, 0, 0], ...T });         // headrest pillow
  },

  lifebuoy(g, r, ph) {
    add(g, CYL(0.17, 0.2, 0.05, 14), '#7d8aa8', { pos: [0, 0.025, 0] });                                      // base
    add(g, CYL(0.025, 0.03, 0.8, 8), '#fffdf6', { pos: [0, 0.42, -0.12] });                                    // post
    add(g, BOX(0.5, 0.03, 0.03), '#fffdf6', { pos: [0, 0.8, -0.12], ...T });                                  // crossbar
    const ring = new THREE.Group(); ring.position.set(0, 0.55, 0.0); g.add(ring);
    add(ring, TOR(0.2, 0.07, 8, 22), '#fffdf6', { rot: [0, 0, 0] });
    for (let i = 0; i < 4; i++) {
      const a = (i * PI) / 2 + PI / 4;
      add(ring, BOX(0.1, 0.14, 0.15), '#e04a4a', { pos: [Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0], rot: [0, 0, a + PI / 2], ...T });
    }
    add(ring, TOR(0.2, 0.012, 4, 22), '#2b2b3a', { pos: [0, 0, 0.0], ...T });
    add(g, CYL(0.012, 0.012, 0.25, 5), '#c9a66b', { pos: [0.2, 0.67, -0.08], ...T });                          // rope
    g.userData.idle = (t) => { ring.rotation.z = 0.06 * Math.sin(t * 1.5 + ph); };
  },

  // --- ski resort ---------------------------------------------------------------------------------
  liftchair(g, r) {
    const col = pick(r, ['#e06060', '#4f86c6', '#f2a03e']);
    add(g, RB(0.84, 0.06, 0.8, 0.03), '#dfe7f2', { pos: [0, 0.03, 0] });                                      // loading mat (snow-white)
    add(g, RB(0.6, 0.05, 0.36, 0.02), col, { pos: [0, 0.25, 0.03] });                                         // seat
    add(g, RB(0.6, 0.34, 0.05, 0.02), shade(col, 0.88), { pos: [0, 0.43, -0.16] });                           // back
    for (const s of [-1, 1]) add(g, RB(0.04, 0.04, 0.36, 0.012), '#3a3550', { pos: [s * 0.3, 0.36, 0.0], ...T }); // arm rests
    for (const s of [-1, 1]) add(g, CYL(0.012, 0.012, 0.18, 5), '#3a3550', { pos: [s * 0.3, 0.16, 0.0], ...T });
    add(g, CYL(0.015, 0.015, 0.62, 6), '#3a3550', { pos: [0, 0.78, -0.2], ...T });                             // hanger pole
    add(g, BOX(1.0, 0.025, 0.025), '#9aa3b5', { pos: [0, 1.09, -0.2], ...T });                                // cable
    const wheel = add(g, TOR(0.05, 0.015, 5, 12), '#3a3550', { pos: [0, 1.09, -0.2], rot: [0, PI / 2, 0], ...T });
    g.userData.idle = (t) => { wheel.rotation.x = t * 2; };
  },

  snowman(g, r, ph) {
    const snow = '#fbfdff';
    add(g, SPH(0.28, 14, 10), snow, { pos: [0, 0.26, 0] });
    add(g, SPH(0.2, 14, 10), snow, { pos: [0, 0.6, 0] });
    add(g, SPH(0.14, 12, 9), snow, { pos: [0, 0.86, 0] });
    add(g, CONE(0.03, 0.14, 8), '#f08a2e', { pos: [0, 0.86, 0.19], rot: [PI / 2, 0, 0], ...T });             // carrot nose
    for (const x of [-0.05, 0.05]) add(g, SPH(0.016, 6, 5), '#2b2b3a', { pos: [x, 0.9, 0.125], ...T });
    for (const y of [0.55, 0.64]) add(g, SPH(0.017, 6, 5), '#2b2b3a', { pos: [0, y, 0.19], ...T });
    add(g, CYL(0.15, 0.15, 0.02, 14), '#2b2b3a', { pos: [0, 0.98, 0], ...T });                                // hat brim
    add(g, CYL(0.09, 0.09, 0.14, 12), '#2b2b3a', { pos: [0, 1.06, 0] });
    add(g, TOR(0.12, 0.035, 6, 14), '#d84a4a', { pos: [0, 0.74, 0], rot: [PI / 2, 0, 0] });                   // scarf
    const tail = add(g, BOX(0.06, 0.18, 0.025), '#d84a4a', { pos: [0.08, 0.64, 0.12], ...T });
    for (const s of [-1, 1]) add(g, CYL(0.01, 0.01, 0.3, 4), '#7a4a2c', { pos: [s * 0.26, 0.64, 0], rot: [0, 0, s * -1.0], ...T });
    g.userData.idle = (t) => { tail.rotation.z = 0.2 * Math.sin(t * 2.4 + ph); };
  },

  // --- airport ------------------------------------------------------------------------------------
  luggage(g, r) {
    const cases = [['#e06060', [0.5, 0.26, 0.34], [0, 0.31, 0.0]], ['#4f86c6', [0.4, 0.24, 0.3], [0.02, 0.56, 0.02]], ['#f2c14e', [0.26, 0.2, 0.2], [-0.12, 0.78, 0.0]]];
    add(g, RB(0.7, 0.04, 0.5, 0.015), '#8a93a6', { pos: [0, 0.14, 0] });                                      // trolley bed
    for (const [x, z] of [[-0.28, -0.2], [0.28, -0.2], [-0.28, 0.2], [0.28, 0.2]]) add(g, CYL(0.05, 0.05, 0.04, 10), '#2b2b3a', { pos: [x, 0.05, z], rot: [0, 0, PI / 2], ...T });
    add(g, CYL(0.012, 0.012, 0.64, 6), '#8a93a6', { pos: [-0.34, 0.46, -0.22], ...T });                       // push handle
    add(g, CYL(0.012, 0.012, 0.64, 6), '#8a93a6', { pos: [0.34, 0.46, -0.22], ...T });
    add(g, BOX(0.7, 0.02, 0.02), '#8a93a6', { pos: [0, 0.78, -0.22], ...T });
    cases.forEach(([c, [w, h, d], p], i) => {
      const col = i === 0 ? pick(r, ['#e06060', '#8a5fc8']) : c;
      add(g, RB(w, h, d, 0.04), col, { pos: [p[0], p[1], p[2] + 0.04] });
      add(g, BOX(w + 0.01, 0.018, d + 0.01), shade(col, 0.7), { pos: [p[0], p[1], p[2] + 0.04], ...T });
      add(g, BOX(0.1, 0.02, 0.02), '#2b2b3a', { pos: [p[0], p[1] + h / 2 + 0.02, p[2] + 0.04], ...T });
    });
    add(g, BOX(0.06, 0.05, 0.012), '#fffdf6', { pos: [0.1, 0.34, 0.215], ...T });                             // baggage tag
  },
};
