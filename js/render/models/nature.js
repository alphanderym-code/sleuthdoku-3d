// Natural scenery builders: (g, r, ph) => void. Each fits a 1x1 cell, rests on y=0, front faces +z.
import * as THREE from 'three';
import {
  add, addVC, addMerged, toon, toonOwn, texToon, rng, shade, mix,
  RB, BOX, CYL, SPH, ICO, CONE, TOR, CAPS,
} from './kit.js';
import { PI, C, T, flameMat, makeSteam, makeFireGlow, legs4, pick } from './common.js';

export const NATURE_BUILDERS = {
  tree(g, r, ph) {
    add(g, CYL(0.075, 0.12, 0.5, 10), C.woodDark, { pos: [0, 0.25, 0] });
    for (let i = 0; i < 3; i++) { // root flares
      const a = i * 2.1 + r();
      add(g, SPH(0.06, 8, 6), C.woodDark, { pos: [Math.cos(a) * 0.1, 0.03, Math.sin(a) * 0.1], scale: [1.2, 0.6, 1], ...T });
    }
    const fol = new THREE.Group(); fol.position.y = 0.45; g.add(fol);
    const blobs = [[0, 0.17, 0, 0.3, C.leaf], [0.19, 0.3, 0.05, 0.22, C.leaf2], [-0.18, 0.31, -0.06, 0.21, C.leaf3], [0.0, 0.5, -0.03, 0.19, C.leaf2], [-0.06, 0.2, 0.22, 0.18, C.leaf3], [0.1, 0.22, -0.21, 0.19, C.leaf]];
    for (const [x, y, z, s, c] of blobs) add(fol, ICO(s, 1), toon(c, { flat: true }), { pos: [x, y, z], rot: [r() * 3, r() * 3, 0] });
    const fruit = r() < 0.55;
    const parts = [];
    for (let i = 0; i < (fruit ? 5 : 8); i++) {
      const b = blobs[i % 4 === 3 ? 0 : i % 4];
      const a = r() * PI * 2, e = 0.15 + r() * 0.8;
      const dir = [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
      parts.push({ geo: SPH(fruit ? 0.035 : 0.03, 8, 6), pos: [b[0] + dir[0] * b[3] * 0.98, b[1] + dir[1] * b[3] * 0.98, b[2] + dir[2] * b[3] * 0.98], color: fruit ? '#e84a4a' : pick(r, ['#ffffff', '#ffc6e0', '#fff2a8']) });
    }
    addVC(fol, parts);
    g.userData.idle = (t) => { fol.rotation.z = 0.025 * Math.sin(t * 1.3 + ph); fol.rotation.x = 0.02 * Math.sin(t * 1.1 + ph * 2); };
  },

  bush(g, r, ph) {
    const fol = new THREE.Group(); g.add(fol);
    const blobs = [[0, 0.22, 0, 0.26, C.leaf3], [0.22, 0.19, 0.08, 0.2, C.leaf], [-0.21, 0.2, -0.04, 0.21, C.leaf], [0.03, 0.38, -0.08, 0.17, C.leaf2], [-0.08, 0.15, 0.24, 0.16, C.leaf2], [0.16, 0.16, -0.22, 0.17, C.leaf3]];
    for (const [x, y, z, s, c] of blobs) add(fol, ICO(s, 1), toon(c, { flat: true }), { pos: [x, y, z], rot: [r() * 3, r() * 3, 0] });
    const parts = [];
    const col = pick(r, ['#e0405a', '#5b6fd6', '#a06ad8']);
    for (let i = 0; i < 9; i++) {
      const b = blobs[i % blobs.length]; const a = r() * PI * 2, e = 0.1 + r() * 0.7;
      parts.push({ geo: SPH(0.028, 8, 6), pos: [b[0] + Math.cos(a) * Math.cos(e) * b[3], b[1] + Math.sin(e) * b[3], b[2] + Math.sin(a) * Math.cos(e) * b[3]], color: col });
    }
    for (let i = 0; i < 5; i++) { // light leaf accents
      const b = blobs[i]; parts.push({ geo: SPH(0.04, 6, 5), pos: [b[0] + 0.04, b[1] + b[3] * 0.85, b[2] + 0.03], scale: [1.4, 0.5, 1], color: C.leaf2 });
    }
    addVC(fol, parts);
    g.userData.idle = (t) => { fol.rotation.z = 0.02 * Math.sin(t * 1.5 + ph); const s = 1 + 0.012 * Math.sin(t * 1.9 + ph); fol.scale.set(s, 1, s); };
  },

  boulder(g, r) {
    add(g, new THREE.DodecahedronGeometry(0.36, 0), toon(C.stone, { flat: true }), { pos: [0, 0.2, 0], scale: [1, 0.62, 0.9], rot: [0.2, 0.5, 0.1] });
    add(g, new THREE.DodecahedronGeometry(0.2, 0), toon(C.stoneLight, { flat: true }), { pos: [-0.22, 0.12, 0.2], rot: [0.4, 0.2, 0], scale: [1, 0.8, 1] });
    add(g, new THREE.DodecahedronGeometry(0.13, 0), toon(C.stoneDark, { flat: true }), { pos: [0.28, 0.08, 0.22], rot: [0.4, 0.2, 0] });
    add(g, ICO(0.2, 1), toon('#79b866', { flat: true }), { pos: [0.02, 0.37, -0.02], scale: [1.2, 0.34, 0.95], rot: [0, 0.6, 0], noOutline: true });
    add(g, ICO(0.09, 1), toon('#8fcf7a', { flat: true }), { pos: [-0.17, 0.3, -0.1], scale: [1.2, 0.4, 1], noOutline: true });
    const parts = [];
    for (let i = 0; i < 4; i++) parts.push({ geo: CONE(0.018, 0.1 + r() * 0.05, 5), pos: [-0.2 + r() * 0.35, 0.43, -0.15 + r() * 0.25], rot: [0, 0, (r() - 0.5) * 0.5], color: C.leaf4 });
    parts.push({ geo: SPH(0.022, 6, 5), pos: [0.06, 0.41, 0.05], color: '#ffffff' }, { geo: SPH(0.02, 6, 5), pos: [-0.1, 0.38, 0.08], color: '#ffc6e0' });
    addVC(g, parts);
    for (let i = 0; i < 3; i++) add(g, new THREE.DodecahedronGeometry(0.04, 0), toon(C.stoneLight, { flat: true }), { pos: [0.3 - i * 0.17, 0.03, 0.38 - r() * 0.06], ...T });
  },

  plant(g, r, ph) {
    add(g, CYL(0.23, 0.17, 0.3, 16), '#d9805a', { pos: [0, 0.15, 0] });
    add(g, CYL(0.25, 0.25, 0.05, 16), '#e8946c', { pos: [0, 0.31, 0] });
    add(g, CYL(0.2, 0.2, 0.01, 14), '#5a3a28', { pos: [0, 0.335, 0], ...T });
    add(g, TOR(0.2, 0.012, 5, 20), '#b8603a', { pos: [0, 0.2, 0], rot: [PI / 2, 0, 0], ...T });
    const lf = new THREE.Group(); lf.position.y = 0.33; g.add(lf);
    const leaf = new THREE.SphereGeometry(1, 8, 6); leaf.translate(0, 0, 1);
    const parts = [];
    const rings = [[7, 0.55, 0.2, 0.09, 0.025], [6, 0.95, 0.17, 0.08, 0.022], [4, 1.25, 0.14, 0.07, 0.02]];
    rings.forEach(([n, elev, len, wd, th], ri) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * PI * 2 + ri * 0.5 + r() * 0.3;
        parts.push({ geo: leaf, scale: [wd, th, len + r() * 0.05], rot: [-elev, 0, 0], ry: a, pos: [0, 0.02 + ri * 0.03, 0], color: ri % 2 ? C.leaf : C.leaf3 });
      }
    });
    parts.push({ geo: SPH(0.045, 8, 6), pos: [0.0, 0.38, 0.0], color: '#ff7b9c' }, { geo: SPH(0.03, 8, 6), pos: [0.0, 0.43, 0.0], color: '#ffd84d' });
    addVC(lf, parts, { noOutline: true });
    g.userData.idle = (t) => { lf.rotation.z = 0.04 * Math.sin(t * 1.6 + ph); lf.rotation.x = 0.03 * Math.sin(t * 1.3 + ph * 1.7); };
  },

  flowers(g, r, ph) {
    add(g, RB(0.94, 0.14, 0.94, 0.03), C.woodDeep, { pos: [0, 0.07, 0] });
    add(g, RB(0.84, 0.06, 0.84, 0.02), '#6b4a34', { pos: [0, 0.15, 0], noOutline: true });
    const cols = ['#ff7b9c', '#ffd84d', '#ffffff', '#a06ad8', '#ff9a3c', '#6fb4f0'];
    const bl = [], fl = [];
    for (let i = 0; i < 16; i++) {
      const x = -0.34 + (i % 4) * 0.227 + (r() - 0.5) * 0.08, z = -0.34 + Math.floor(i / 4) * 0.227 + (r() - 0.5) * 0.08, h = 0.18 + r() * 0.14, c = pick(r, cols);
      bl.push({ geo: CYL(0.008, 0.008, h, 4), pos: [x, 0.17 + h / 2, z], color: C.leaf3 }, { geo: SPH(0.05, 6, 5), pos: [x + 0.04, 0.2 + h * 0.3, z], scale: [1, 0.35, 0.6], color: C.leaf2 });
      fl.push({ geo: SPH(0.058, 7, 5), pos: [x, 0.18 + h, z], scale: [1, 0.7, 1], color: c }, { geo: SPH(0.022, 5, 4), pos: [x, 0.21 + h, z], color: '#f2c14e' });
    }
    addVC(g, bl, T);
    const fm = addVC(g, fl, T);
    g.userData.idle = (t) => { fm.rotation.z = 0.02 * Math.sin(t * 1.4 + ph); fm.rotation.x = 0.015 * Math.sin(t * 1.1 + ph); };
  },

  water(g, r, ph) {
    // The floor is the water; just a few subtle ripple rings and an occasional lily pad.
    const rm = toonOwn('#ffffff', {}); rm.transparent = true; rm.opacity = 0.45; rm.depthWrite = false;
    for (let i = 0; i < 2; i++) {
      const ring = add(g, TOR(0.18 + i * 0.12, 0.008, 4, 22), rm, { pos: [(r() - 0.5) * 0.4, 0.012, (r() - 0.5) * 0.4], rot: [PI / 2, 0, 0], ...T });
      ring.userData.ph = ph + i;
    }
    if (r() < 0.35) {
      const x = (r() - 0.5) * 0.5, z = (r() - 0.5) * 0.5;
      add(g, CYL(0.1, 0.1, 0.012, 10), '#4fae5a', { pos: [x, 0.012, z], ...T });
      add(g, SPH(0.03, 6, 4), '#ff9ac0', { pos: [x + 0.02, 0.03, z], scale: [1, 0.7, 1], ...T });
    }
    const rings = g.children.filter((m) => m.userData.ph !== undefined);
    g.userData.idle = (t) => { for (let i = 0; i < rings.length; i++) { const m = rings[i]; const s = 1 + 0.12 * Math.sin(t * 1.2 + m.userData.ph); m.scale.set(s, s, 1); } };
  },

  haybale(g, r) {
    const hay = '#e6c35a', hayD = '#c9a23e';
    add(g, RB(0.84, 0.46, 0.6, 0.07), hay, { pos: [0, 0.23, 0] });
    add(g, RB(0.84, 0.44, 0.58, 0.07), hay, { pos: [0.02, 0.69, 0.02], rot: [0, 0.06, 0] });
    for (const x of [-0.22, 0.22]) for (const y of [0.23, 0.69]) add(g, RB(0.035, y > 0.5 ? 0.45 : 0.47, 0.64, 0.01, 1), '#a8793a', { pos: [x, y, 0.005], ...T });
    const st = [];
    for (let i = 0; i < 22; i++) st.push({ geo: CYL(0.006, 0.006, 0.14 + r() * 0.1, 4), pos: [(r() - 0.5) * 0.8, 0.0 + r() * 0.9, 0.31 + r() * 0.03], rot: [0.3, 0, (r() - 0.5) * 2.4], color: i % 3 ? hayD : '#f2d97a' });
    addVC(g, st, T);
  },

  campfire(g, r, ph) {
    add(g, CYL(0.4, 0.42, 0.01, 18), '#5a4a3a', { pos: [0, 0.005, 0], ...T });
    const stones = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * PI * 2;
      stones.push({ geo: new THREE.DodecahedronGeometry(0.075 + r() * 0.02, 0), pos: [Math.cos(a) * 0.32, 0.05, Math.sin(a) * 0.32], rot: [i, i * 2, 0], scale: [1.2, 0.8, 1], color: i % 2 ? C.stone : C.stoneLight, flat: true });
    }
    addVC(g, stones);
    for (let i = 0; i < 4; i++) { // logs leaning in
      const a = (i / 4) * PI * 2 + 0.4;
      add(g, CYL(0.05, 0.05, 0.4, 8), '#7a4a2c', { pos: [Math.cos(a) * 0.1, 0.1, Math.sin(a) * 0.1], rot: [Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0], noOutline: true });
    }
    add(g, CYL(0.15, 0.15, 0.015, 12), toon('#ff6a2a', { emissive: '#ff6a2a', emissiveIntensity: 1 }), { pos: [0, 0.015, 0], ...T });
    const flames = [
      add(g, CONE(0.17, 0.44, 7), flameMat(C.flameO), { pos: [0, 0.3, 0], ...T }),
      add(g, CONE(0.1, 0.3, 7), flameMat(C.flameY, 1), { pos: [0.03, 0.24, 0.07], ...T }),
      add(g, CONE(0.08, 0.24, 6), flameMat(C.flameO), { pos: [-0.11, 0.2, 0.02], ...T }),
      add(g, CONE(0.07, 0.2, 6), flameMat(C.flameY, 1), { pos: [0.1, 0.18, -0.08], ...T }),
    ];
    const base = flames.map((f) => f.position.y);
    const sparks = [0, 1, 2, 3].map(() => add(g, SPH(0.014, 5, 4), flameMat(C.flameY, 1.5), { ...T }));
    const glow = makeFireGlow(g, 0, 0.02, 0, 0.7);
    g.userData.idle = (t) => {
      for (let i = 0; i < flames.length; i++) {
        const f = flames[i];
        const k = 1 + 0.14 * Math.sin(t * 11 + i * 2.1 + ph) + 0.07 * Math.sin(t * 23 + i);
        const q = 1 / Math.sqrt(k);
        f.scale.set(q, k, q); f.position.y = base[i] + (k - 1) * 0.12;
        f.rotation.z = 0.06 * Math.sin(t * 7 + i * 1.7 + ph);
      }
      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        const u = ((t * 0.5 + i * 0.27 + ph) % 1);
        s.position.set(Math.sin(i * 2.4 + u * 3) * 0.12, 0.3 + u * 0.5, Math.cos(i * 1.7 + u * 3) * 0.12);
        s.scale.setScalar(Math.max(0.001, 1 - u));
      }
      glow(Math.sin(t * 11 + ph) * 0.6 + Math.sin(t * 23) * 0.4);
    };
  },
};
