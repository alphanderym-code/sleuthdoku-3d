// Detailed cartoon furniture / scenery builders. Each fits a 1x1 cell, rests on y=0, front faces +z.
import * as THREE from 'three';
import {
  add, addVC, addMerged, toon, toonOwn, texToon, rng, shade, mix,
  RB, BOX, CYL, SPH, ICO, CONE, TOR, CAPS,
} from './kit.js';

const PI = Math.PI;
const C = {
  wood: '#c98b55', woodLight: '#dba570', woodDark: '#9b6238', woodDeep: '#7a4a2c',
  leaf: '#6cc56a', leaf2: '#86d67a', leaf3: '#4fae5a', leaf4: '#3d9a50',
  stone: '#aaa6b8', stoneLight: '#c8c4d4', stoneDark: '#8a869a', metal: '#cfd3dc', cream: '#f6f1e6', dark: '#3a3550', red: '#e06060',
  flameO: '#ff8a2a', flameY: '#ffd84d', gold: '#f2c14e', white: '#fffdf6',
};
const T = { noOutline: true, shadow: false };
const BOOKS = ['#e06060', '#4f86c6', '#6cc56a', '#f2c14e', '#a06ad8', '#f2994a', '#3fb8af', '#d95d92', '#7a4a2c', '#5b6fd6'];

/** Height a figurine stands at when on this object type, plus a small forward offset. */
const STAND = {
  chair: { y: 0.23, dz: 0.05 }, sofa: { y: 0.24, dz: 0.05 }, bed: { y: 0.27, dz: 0.04 },
  rug: { y: 0.025, dz: 0 }, bench: { y: 0.22, dz: 0 }, towel: { y: 0.02, dz: 0 }, stool: { y: 0.5, dz: 0 },
  car: { y: 0.34, dz: -0.02 }, boat: { y: 0.25, dz: 0 }, bathtub: { y: 0.53, dz: 0 },
};
export function standInfo(type) { return STAND[type] || { y: 0, dz: 0 }; }

const flameMat = (c, i = 0.9) => toon(c, { emissive: c, emissiveIntensity: i });
/** Four-way symmetric leg positions helper. */
const legs4 = (x, z) => [[-x, -z], [x, -z], [-x, z], [x, z]];
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

// ---------------------------------------------------------------------------
// Textures (shared, cached)
// ---------------------------------------------------------------------------
const clothTex = () => texToon('gingham', 128, 128, (x, w, h) => {
  x.fillStyle = '#fff8ee'; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(224,96,96,0.55)';
  const n = 8, s = w / n;
  for (let i = 0; i < n; i += 2) { x.fillRect(i * s, 0, s, h); x.fillRect(0, i * s, w, s); }
  x.strokeStyle = '#e06060'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6);
});
const brickTex = () => texToon('brick', 128, 128, (x, w, h) => {
  x.fillStyle = '#d9d2c4'; x.fillRect(0, 0, w, h);
  const rows = 6, bh = h / rows;
  for (let j = 0; j < rows; j++) {
    const off = (j % 2) * (w / 8);
    for (let i = -1; i < 4; i++) {
      x.fillStyle = ['#b9604a', '#c8705a', '#a85544', '#d07a5e'][(i * 3 + j * 5 + 8) % 4];
      x.fillRect(i * (w / 4) + off + 3, j * bh + 3, w / 4 - 6, bh - 6);
    }
  }
});
const RUGS = [
  ['#c8504e', '#f6e7c6', '#2f5d7c', '#f2c14e'], ['#3f7f9a', '#f6e7c6', '#c8504e', '#8fcf8f'], ['#7a5aa8', '#f2d9f0', '#f2994a', '#fff2a8'],
];
const rugTex = (v) => texToon(`rug${v}`, 256, 256, (x, w, h) => {
  const [a, b, c, d] = RUGS[v];
  x.fillStyle = a; x.fillRect(0, 0, w, h);
  x.strokeStyle = b; x.lineWidth = 10; x.strokeRect(14, 14, w - 28, h - 28);
  x.strokeStyle = c; x.lineWidth = 6; x.strokeRect(32, 32, w - 64, h - 64);
  for (let i = 0; i < 14; i++) { // border triangles
    const p = 30 + i * ((w - 60) / 13);
    x.fillStyle = d;
    x.beginPath(); x.moveTo(p - 7, 20); x.lineTo(p + 7, 20); x.lineTo(p, 33); x.fill();
    x.beginPath(); x.moveTo(p - 7, h - 20); x.lineTo(p + 7, h - 20); x.lineTo(p, h - 33); x.fill();
    x.beginPath(); x.moveTo(20, p - 7); x.lineTo(20, p + 7); x.lineTo(33, p); x.fill();
    x.beginPath(); x.moveTo(w - 20, p - 7); x.lineTo(w - 20, p + 7); x.lineTo(w - 33, p); x.fill();
  }
  x.fillStyle = b; // centre medallion
  x.save(); x.translate(w / 2, h / 2);
  for (const [s, col] of [[72, b], [54, c], [36, d], [18, a]]) { x.fillStyle = col; x.rotate(PI / 4); x.fillRect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4); }
  x.restore();
});
const TOWELS = [['#ff7b7b', '#fff6e0'], ['#4fb3d9', '#fff6e0'], ['#f2c14e', '#ffffff']];
const towelTex = (v) => texToon(`towel${v}`, 128, 256, (x, w, h) => {
  const [a, b] = TOWELS[v];
  x.fillStyle = b; x.fillRect(0, 0, w, h);
  const n = 9, s = h / n;
  for (let i = 0; i < n; i += 2) { x.fillStyle = a; x.fillRect(0, i * s, w, s); }
  x.fillStyle = shade(a, 0.8); x.fillRect(0, 0, w, 10); x.fillRect(0, h - 10, w, 10);
});
const pageTex = () => texToon('page', 64, 64, (x, w, h) => {
  x.fillStyle = '#fffdf6'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#9aa0b8';
  for (let i = 0; i < 6; i++) x.fillRect(8, 8 + i * 9, w - 16 - (i % 3) * 8, 3);
});

// ---------------------------------------------------------------------------
// Builders: (g, r, ph) => void. r = seeded rng, ph = phase offset for idle.
// ---------------------------------------------------------------------------
const BUILDERS = {
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

  table(g, r) {
    for (const [x, z] of legs4(0.36, 0.36)) add(g, CYL(0.045, 0.035, 0.4, 10), C.woodDark, { pos: [x, 0.2, z] });
    add(g, RB(0.76, 0.07, 0.76, 0.02), C.woodDeep, { pos: [0, 0.36, 0] , noOutline: true});
    add(g, RB(0.94, 0.07, 0.94, 0.03), C.wood, { pos: [0, 0.43, 0] });
    add(g, new THREE.PlaneGeometry(0.64, 0.64), clothTex(), { pos: [0, 0.4655, 0], rot: [-PI / 2, 0, PI / 4], ...T });
    const plate = (x, z) => {
      add(g, CYL(0.1, 0.075, 0.02, 20), C.white, { pos: [x, 0.476, z], noOutline: true });
      add(g, CYL(0.062, 0.062, 0.006, 16), '#d6e6f5', { pos: [x, 0.487, z], ...T });
    };
    plate(-0.2, 0.18); plate(0.2, 0.18);
    add(g, SPH(0.035, 8, 6), '#f2994a', { pos: [-0.2, 0.505, 0.18], ...T }); // orange on a plate
    add(g, CAPS(0.03, 0.08, 3, 6), '#e6b062', { pos: [0.2, 0.505, 0.18], rot: [0, 0.5, PI / 2], ...T }); // bread
    // teacup
    add(g, CYL(0.05, 0.038, 0.06, 14), C.white, { pos: [0.22, 0.51, -0.2] });
    add(g, TOR(0.025, 0.007, 5, 10), C.white, { pos: [0.272, 0.51, -0.2], ...T });
    add(g, CYL(0.04, 0.04, 0.004, 12), '#8a5a3a', { pos: [0.22, 0.54, -0.2], ...T });
    // vase with flowers
    add(g, CYL(0.04, 0.055, 0.1, 12), '#5aa0d6', { pos: [-0.1, 0.52, -0.12] });
    const parts = [];
    ['#ff7b9c', '#ffd84d', '#ffffff'].forEach((c, i) => {
      const a = i * 2.1; const x = -0.1 + Math.cos(a) * 0.04, z = -0.12 + Math.sin(a) * 0.04;
      parts.push({ geo: CAPS(0.006, 0.1, 2, 4), pos: [(x - 0.1) / 2 - 0.05, 0.6, (z - 0.12) / 2 - 0.06], color: '#4fae5a', rot: [0, 0, 0] });
      parts.push({ geo: SPH(0.032, 8, 6), pos: [x, 0.665, z], color: c });
    });
    addVC(g, parts);
  },

  counter(g, r) {
    add(g, RB(0.86, 0.06, 0.6, 0.015), C.woodDeep, { pos: [0, 0.03, 0], noOutline: true });
    add(g, RB(0.9, 0.44, 0.66, 0.025), '#dfae78', { pos: [0, 0.28, 0] });
    add(g, RB(0.98, 0.06, 0.74, 0.025), '#ebe7f2', { pos: [0, 0.53, 0] });
    const handles = [];
    const door = (x, y, w, h) => {
      add(g, RB(w, h, 0.02, 0.012, 1), C.woodLight, { pos: [x, y, 0.335], ...T });
      handles.push({ geo: CYL(0.011, 0.011, 0.09, 6), pos: [x, y + (h > 0.25 ? 0.1 : 0.0), 0.36], rot: [0, 0, PI / 2], color: C.metal });
    };
    door(-0.22, 0.28, 0.4, 0.36); door(0.22, 0.37, 0.4, 0.16); door(0.22, 0.19, 0.4, 0.16);
    addVC(g, handles);
    // fruit bowl
    add(g, new THREE.SphereGeometry(0.11, 14, 8, 0, PI * 2, PI / 2, PI / 2), toon('#4f86c6', { double: true }), { pos: [-0.2, 0.67, -0.02], noOutline: false });
    add(g, CYL(0.04, 0.05, 0.02, 10), '#4f86c6', { pos: [-0.2, 0.575, -0.02], ...T });
    addVC(g, [
      { geo: SPH(0.045, 8, 6), pos: [-0.23, 0.65, -0.02], color: '#e84a4a' }, { geo: SPH(0.045, 8, 6), pos: [-0.17, 0.65, 0.01], color: '#f2994a' },
      { geo: SPH(0.04, 8, 6), pos: [-0.2, 0.68, -0.05], color: '#a8d84a' }, { geo: SPH(0.04, 8, 6), pos: [-0.19, 0.69, 0.0], color: '#ffd84d' },
    ]);
    // cutting board + bread, jar
    add(g, RB(0.24, 0.018, 0.17, 0.008, 1), '#e0b070', { pos: [0.18, 0.569, 0.1], rot: [0, 0.2, 0] });
    add(g, CAPS(0.04, 0.12, 4, 8), '#e6a85c', { pos: [0.18, 0.61, 0.1], rot: [0, 0.2, PI / 2], ...T });
    add(g, CYL(0.06, 0.06, 0.13, 12), '#cfe8ff', { pos: [0.28, 0.63, -0.18] });
    add(g, CYL(0.065, 0.065, 0.03, 12), '#c98b55', { pos: [0.28, 0.71, -0.18], ...T });
    addVC(g, [{ geo: SPH(0.03, 6, 5), pos: [0.28, 0.62, -0.18], color: '#e06060' }, { geo: SPH(0.028, 6, 5), pos: [0.27, 0.66, -0.17], color: '#f2c14e' }]);
  },

  oven(g, r, ph) {
    for (const [x, z] of legs4(0.38, 0.3)) add(g, CYL(0.035, 0.04, 0.05, 8), C.dark, { pos: [x, 0.025, z], ...T });
    add(g, RB(0.86, 0.54, 0.74, 0.045), '#e4e8f0', { pos: [0, 0.32, 0] });
    add(g, RB(0.88, 0.05, 0.76, 0.02), C.dark, { pos: [0, 0.615, 0] });
    for (const [x, z] of [[-0.2, -0.17], [0.2, -0.17], [-0.2, 0.17], [0.2, 0.17]]) {
      add(g, TOR(0.075, 0.013, 6, 16), '#7a7590', { pos: [x, 0.645, z], rot: [PI / 2, 0, 0], ...T });
      add(g, CYL(0.04, 0.04, 0.01, 10), '#58546e', { pos: [x, 0.642, z], ...T });
    }
    // pot with lid
    add(g, CYL(0.1, 0.1, 0.13, 16), '#d9605a', { pos: [-0.2, 0.71, -0.17] });
    add(g, CYL(0.105, 0.105, 0.02, 16), '#b84a46', { pos: [-0.2, 0.785, -0.17], noOutline: true });
    add(g, SPH(0.025, 8, 6), C.metal, { pos: [-0.2, 0.815, -0.17], ...T });
    for (const sx of [-1, 1]) add(g, SPH(0.022, 6, 5), C.metal, { pos: [-0.2 + sx * 0.115, 0.73, -0.17], ...T });
    // control panel
    add(g, RB(0.78, 0.1, 0.03, 0.012, 1), '#c9ced9', { pos: [0, 0.54, 0.372], ...T });
    for (let i = 0; i < 4; i++) add(g, CYL(0.028, 0.028, 0.035, 10), '#3a3550', { pos: [-0.27 + i * 0.18, 0.54, 0.4], rot: [PI / 2, 0, 0], noOutline: true });
    // door + glowing window
    add(g, RB(0.74, 0.36, 0.03, 0.02), '#5b5670', { pos: [0, 0.27, 0.375] });
    const win = toonOwn('#3a3550', { emissive: '#ff9a3c', emissiveIntensity: 0.4 });
    add(g, RB(0.52, 0.2, 0.02, 0.02), win, { pos: [0, 0.28, 0.393], ...T });
    add(g, CAPS(0.014, 0.48, 3, 6), C.metal, { pos: [0, 0.455, 0.42], rot: [0, 0, PI / 2], noOutline: true });
    for (const sx of [-1, 1]) add(g, CYL(0.01, 0.01, 0.04, 6), C.metal, { pos: [sx * 0.24, 0.455, 0.4], rot: [PI / 2, 0, 0], ...T });
    g.userData.idle = (t) => { win.emissiveIntensity = 0.4 + 0.12 * Math.sin(t * 2.6 + ph) + 0.05 * Math.sin(t * 7 + ph); };
  },

  shelf(g, r) {
    const H = 0.98;
    add(g, RB(0.9, H, 0.03, 0.012, 1), C.woodDeep, { pos: [0, H / 2, -0.27], noOutline: true });
    for (const sx of [-1, 1]) add(g, RB(0.05, H, 0.4, 0.015), C.wood, { pos: [sx * 0.455, H / 2, -0.1] });
    add(g, RB(0.98, 0.05, 0.44, 0.02), C.woodDark, { pos: [0, H, -0.1] });
    const levels = [0.04, 0.35, 0.66];
    for (const y of levels) add(g, RB(0.86, 0.035, 0.38, 0.01, 1), C.woodLight, { pos: [0, y, -0.09], noOutline: y > 0.1 });
    const books = [];
    levels.forEach((y0, li) => {
      let x = -0.4 + r() * 0.03;
      const end = 0.4 - (li === 1 ? 0.22 : 0);
      while (x < end - 0.05) {
        const w = 0.04 + r() * 0.045, h = 0.14 + r() * 0.12, d = 0.2 + r() * 0.06;
        const tilt = r() < 0.12 ? -0.32 : 0;
        books.push({ geo: BOX(w, h, d), pos: [x + w / 2, y0 + 0.0175 + h / 2 - (tilt ? 0.01 : 0), -0.1], rot: [0, 0, tilt], color: pick(r, BOOKS) });
        x += w + 0.004 + (tilt ? 0.06 : 0) + (r() < 0.12 ? 0.04 : 0);
      }
      if (li === 1) { // horizontal stack on the open end + a little trinket
        books.push({ geo: BOX(0.2, 0.04, 0.24), pos: [0.31, y0 + 0.0375, -0.1], rot: [0, 0.1, 0], color: pick(r, BOOKS) });
        books.push({ geo: BOX(0.17, 0.035, 0.2), pos: [0.31, y0 + 0.075, -0.1], rot: [0, -0.15, 0], color: pick(r, BOOKS) });
        books.push({ geo: SPH(0.05, 10, 8), pos: [0.31, y0 + 0.13, -0.1], color: '#5aa0d6' });
      }
    });
    // top decoration: stack of books + small plant
    books.push({ geo: BOX(0.26, 0.05, 0.22), pos: [-0.25, H + 0.05, -0.1], rot: [0, 0.2, 0], color: '#e06060' }, { geo: BOX(0.22, 0.045, 0.19), pos: [-0.25, H + 0.0975, -0.1], rot: [0, -0.1, 0], color: '#4f86c6' });
    addVC(g, books);
    add(g, CYL(0.06, 0.045, 0.08, 10), '#d9805a', { pos: [0.25, H + 0.065, -0.1] });
    add(g, ICO(0.07, 1), toon(C.leaf2, { flat: true }), { pos: [0.25, H + 0.14, -0.1], ...T });
  },

  desk(g, r, ph) {
    add(g, RB(0.96, 0.06, 0.66, 0.02), C.woodLight, { pos: [0, 0.44, 0] });
    add(g, RB(0.05, 0.4, 0.58, 0.015), C.wood, { pos: [-0.42, 0.2, 0] });
    add(g, RB(0.34, 0.4, 0.58, 0.02), C.wood, { pos: [0.29, 0.2, 0] });
    add(g, RB(0.5, 0.26, 0.03, 0.01, 1), C.woodDark, { pos: [-0.12, 0.28, -0.28], noOutline: true });
    const hs = [];
    for (let i = 0; i < 3; i++) {
      add(g, RB(0.29, 0.11, 0.02, 0.012, 1), C.woodLight, { pos: [0.29, 0.07 + i * 0.125, 0.295], ...T });
      hs.push({ geo: SPH(0.016, 6, 5), pos: [0.29, 0.07 + i * 0.125, 0.315], color: C.gold });
    }
    addVC(g, hs);
    // laptop
    add(g, RB(0.27, 0.018, 0.19, 0.008, 1), '#aab0c0', { pos: [-0.1, 0.483, 0.08], noOutline: true });
    add(g, RB(0.27, 0.18, 0.014, 0.008, 1), '#aab0c0', { pos: [-0.1, 0.58, -0.04], rot: [-0.25, 0, 0], noOutline: true });
    add(g, new THREE.PlaneGeometry(0.24, 0.15), toon('#8fd3ff', { emissive: '#4fa8e0', emissiveIntensity: 0.6 }), { pos: [-0.1, 0.58, -0.031], rot: [-0.25, 0, 0], ...T });
    // papers
    add(g, RB(0.18, 0.012, 0.24, 0.004, 1), pageTex(), { pos: [0.28, 0.476, 0.0], rot: [0, 0.25, 0], ...T });
    add(g, RB(0.17, 0.012, 0.23, 0.004, 1), '#fff2a8', { pos: [0.29, 0.488, 0.01], rot: [0, 0.05, 0], ...T });
    add(g, RB(0.16, 0.012, 0.22, 0.004, 1), pageTex(), { pos: [0.285, 0.5, 0.0], rot: [0, 0.35, 0], ...T });
    // mug + pencil cup
    add(g, CYL(0.04, 0.035, 0.07, 12), '#e06060', { pos: [0.12, 0.505, 0.22], noOutline: true });
    add(g, TOR(0.022, 0.007, 5, 10), '#e06060', { pos: [0.16, 0.505, 0.22], ...T });
    add(g, CYL(0.04, 0.035, 0.09, 10), '#5aa0d6', { pos: [0.4, 0.525, -0.22] });
    addVC(g, [0, 1, 2].map((i) => ({ geo: CYL(0.007, 0.007, 0.1, 5), pos: [0.39 + i * 0.012, 0.6, -0.22 + i * 0.008], rot: [0.1 * i - 0.1, 0, 0.12 * i - 0.12], color: ['#ffd84d', '#e06060', '#6cc56a'][i] })));
    // lamp
    add(g, CYL(0.07, 0.08, 0.025, 12), C.dark, { pos: [-0.38, 0.4925 + 0.005, -0.22], noOutline: true });
    add(g, CAPS(0.011, 0.2, 3, 6), C.dark, { pos: [-0.36, 0.62, -0.22], rot: [0, 0, -0.35], ...T });
    add(g, CAPS(0.011, 0.14, 3, 6), C.dark, { pos: [-0.3, 0.7, -0.22], rot: [0, 0, 1.1], ...T });
    const shade_ = toonOwn('#ffd84d', { emissive: '#ffd84d', emissiveIntensity: 0.3, double: true });
    add(g, CONE(0.09, 0.1, 12), shade_, { pos: [-0.23, 0.67, -0.22], rot: [0, 0, PI + 0.1], noOutline: true });
    g.userData.idle = (t) => { shade_.emissiveIntensity = 0.3 + 0.04 * Math.sin(t * 3 + ph); };
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

  crate(g, r) {
    const bw = 0.62;
    const mk = (cx, cz, s, ry) => {
      const cg = new THREE.Group(); cg.position.set(cx, 0, cz); cg.rotation.y = ry; g.add(cg);
      const h = s;
      add(cg, RB(s, h, s, 0.02, 1), C.woodDark, { pos: [0, h / 2, 0] });
      const parts = [];
      const hs = s / 2;
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push({ geo: BOX(0.07 * s / bw, h + 0.01, 0.07 * s / bw), pos: [x * (hs - 0.025), h / 2, z * (hs - 0.025)], color: C.woodDeep });
      for (const y of [0.04, h - 0.04]) {
        parts.push({ geo: BOX(s + 0.01, 0.07 * s / bw, 0.05), pos: [0, y, hs], color: C.woodDeep }, { geo: BOX(s + 0.01, 0.07 * s / bw, 0.05), pos: [0, y, -hs], color: C.woodDeep });
        parts.push({ geo: BOX(0.05, 0.07 * s / bw, s + 0.01), pos: [hs, y, 0], color: C.woodDeep }, { geo: BOX(0.05, 0.07 * s / bw, s + 0.01), pos: [-hs, y, 0], color: C.woodDeep });
      }
      // planks (3 per side face) and X brace on front
      for (let i = 0; i < 3; i++) {
        const o = (i - 1) * (h - 0.16) / 3 * 1.0;
        parts.push({ geo: BOX(s - 0.1, (h - 0.16) / 3 - 0.012, 0.03), pos: [0, h / 2 + o, hs + 0.005], color: i % 2 ? C.wood : C.woodLight });
        parts.push({ geo: BOX(0.03, (h - 0.16) / 3 - 0.012, s - 0.1), pos: [hs + 0.005, h / 2 + o, 0], color: i % 2 ? C.woodLight : C.wood });
        parts.push({ geo: BOX(s - 0.1, (h - 0.16) / 3 - 0.012, 0.03), pos: [0, h / 2 + o, -hs - 0.005], color: C.wood });
        parts.push({ geo: BOX(0.03, (h - 0.16) / 3 - 0.012, s - 0.1), pos: [-hs - 0.005, h / 2 + o, 0], color: C.wood });
      }
      const dl = Math.hypot(s - 0.14, h - 0.14);
      parts.push({ geo: BOX(0.05, dl, 0.025), pos: [0, h / 2, hs + 0.02], rot: [0, 0, Math.atan2(s - 0.14, h - 0.14)], color: C.woodDeep });
      // lid slats
      for (let i = 0; i < 4; i++) parts.push({ geo: BOX(s - 0.04, 0.025, (s - 0.12) / 4 - 0.01), pos: [0, h + 0.0, -hs + 0.06 + i * ((s - 0.12) / 4 + 0.0) + (s - 0.12) / 8], color: i % 2 ? C.wood : C.woodLight });
      // nails
      for (const [x, z] of [[-1, 1], [1, 1]]) for (const y of [0.07, h - 0.07]) parts.push({ geo: CYL(0.012, 0.012, 0.012, 6), pos: [x * (hs - 0.04), y, hs + 0.035], rot: [PI / 2, 0, 0], color: '#c9ced9' });
      addVC(cg, parts);
    };
    mk(-0.12, -0.08, bw, 0.08);
    mk(0.3, 0.3, 0.32, -0.3);
    add(g, CYL(0.012, 0.012, 0.2, 6), '#e6c88a', { pos: [-0.3, 0.2, 0.28], rot: [0, 0, PI / 2], ...T }); // loose rope coil
    add(g, TOR(0.07, 0.016, 5, 14), '#e6c88a', { pos: [-0.33, 0.016, 0.34], rot: [PI / 2, 0, 0], ...T });
  },

  statue(g) {
    const M = '#e8e4f0', M2 = '#d6d1e4';
    add(g, RB(0.76, 0.1, 0.76, 0.03), M2, { pos: [0, 0.05, 0] });
    add(g, RB(0.58, 0.28, 0.58, 0.03), M, { pos: [0, 0.24, 0] });
    add(g, RB(0.66, 0.06, 0.66, 0.025), M2, { pos: [0, 0.41, 0] });
    add(g, RB(0.3, 0.1, 0.02, 0.01, 1), C.gold, { pos: [0, 0.24, 0.3], ...T });
    // hero figure
    for (const sx of [-1, 1]) add(g, RB(0.11, 0.05, 0.16, 0.02, 1), M2, { pos: [sx * 0.09, 0.47, 0.03], noOutline: true });
    add(g, CYL(0.13, 0.19, 0.34, 14), M, { pos: [0, 0.64, 0] });
    add(g, CYL(0.11, 0.13, 0.3, 14), M, { pos: [0, 0.9, 0] });
    add(g, TOR(0.125, 0.018, 6, 16), C.gold, { pos: [0, 0.76, 0], rot: [PI / 2, 0, 0], ...T });
    add(g, RB(0.25, 0.4, 0.03, 0.012, 1), '#b79ae0', { pos: [0, 0.82, -0.14], rot: [0.12, 0, 0] });
    add(g, SPH(0.14, 16, 12), M, { pos: [0, 1.09, 0] });
    for (const sx of [-1, 1]) add(g, SPH(0.017, 6, 5), '#6a6580', { pos: [sx * 0.055, 1.1, 0.125], ...T });
    add(g, TOR(0.125, 0.016, 6, 18), C.gold, { pos: [0, 1.17, 0], rot: [PI / 2 - 0.15, 0, 0], ...T });
    // raised arm holding a golden orb, other arm at the side
    add(g, CAPS(0.04, 0.2, 4, 8), M, { pos: [0.19, 1.0, 0.0], rot: [0, 0, -0.5] });
    add(g, SPH(0.07, 12, 10), toon(C.gold, { emissive: '#f2c14e', emissiveIntensity: 0.25 }), { pos: [0.27, 1.17, 0] });
    add(g, CAPS(0.04, 0.2, 4, 8), M, { pos: [-0.16, 0.86, 0.02], rot: [0, 0, 0.18] });
  },

  fireplace(g, r, ph) {
    const brick = brickTex();
    for (const sx of [-1, 1]) add(g, RB(0.2, 0.74, 0.38, 0.02), brick, { pos: [sx * 0.37, 0.37, -0.28] });
    add(g, RB(0.58, 0.14, 0.38, 0.02), brick, { pos: [0, 0.67, -0.28] });
    add(g, RB(0.9, 0.22, 0.26, 0.02), brick, { pos: [0, 0.85, -0.34] });
    add(g, BOX(0.56, 0.6, 0.02), '#262033', { pos: [0, 0.3, -0.46], noOutline: true });
    add(g, BOX(0.56, 0.02, 0.36), '#3a3348', { pos: [0, 0.01, -0.28], noOutline: true });
    add(g, RB(1.0, 0.07, 0.42, 0.02), C.stoneLight, { pos: [0, 0.76, -0.3] });
    add(g, RB(0.96, 0.05, 0.28, 0.02), C.stone, { pos: [0, 0.025, 0.0] });
    // logs
    for (const [x, y, z, ry, len] of [[-0.03, 0.08, -0.3, 0.1, 0.46], [0.05, 0.08, -0.22, -0.15, 0.4], [0.0, 0.16, -0.27, 1.45, 0.4]]) {
      add(g, CYL(0.055, 0.055, len, 10), '#7a4a2c', { pos: [x, y, z], rot: [0, ry, PI / 2], noOutline: true });
      add(g, CYL(0.0565, 0.0565, 0.01, 10), '#d9a56a', { pos: [x + Math.cos(ry) * len / 2, y, z - Math.sin(ry) * len / 2], rot: [0, ry, PI / 2], ...T });
    }
    const flames = [
      add(g, CONE(0.12, 0.3, 7), flameMat(C.flameO), { pos: [0, 0.3, -0.27], ...T }),
      add(g, CONE(0.07, 0.2, 7), flameMat(C.flameY, 1), { pos: [0.05, 0.27, -0.23], ...T }),
      add(g, CONE(0.07, 0.22, 7), flameMat(C.flameO), { pos: [-0.1, 0.27, -0.28], ...T }),
    ];
    const base = flames.map((f) => f.position.y);
    flames.forEach((f, i) => { f.geometry.computeBoundingBox(); f.userData.h = i; });
    add(g, SPH(0.03, 6, 5), flameMat('#ff6a2a', 1.2), { pos: [0.12, 0.12, -0.2], ...T });
    add(g, SPH(0.025, 6, 5), flameMat('#ff6a2a', 1.2), { pos: [-0.15, 0.11, -0.22], ...T });
    // mantle decor: two candles + framed picture
    for (const sx of [-1, 1]) {
      add(g, CYL(0.03, 0.03, 0.1, 8), C.cream, { pos: [sx * 0.38, 0.84, -0.3] });
      add(g, CONE(0.014, 0.04, 6), flameMat(C.flameY, 1), { pos: [sx * 0.38, 0.91, -0.3], ...T });
    }
    add(g, RB(0.26, 0.17, 0.025, 0.01, 1), C.woodDeep, { pos: [0, 0.89, -0.2] });
    add(g, new THREE.PlaneGeometry(0.2, 0.11), toon('#8fd3a8'), { pos: [0, 0.89, -0.186], ...T });
    add(g, CONE(0.04, 0.05, 3), toon('#5a9a6a'), { pos: [0.02, 0.88, -0.185], ...T });
    g.userData.idle = (t) => {
      flames.forEach((f, i) => {
        const k = 1 + 0.14 * Math.sin(t * 11 + i * 2.1 + ph) + 0.07 * Math.sin(t * 23 + i);
        f.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k)); f.position.y = base[i] + (k - 1) * 0.1;
      });
    };
  },

  piano(g, r) {
    const BK = '#34304a', BK2 = '#47425f';
    add(g, RB(0.92, 0.7, 0.34, 0.03), BK, { pos: [0, 0.4, -0.22] });
    add(g, RB(0.96, 0.05, 0.38, 0.02), BK2, { pos: [0, 0.76, -0.22] });
    for (const sx of [-1, 1]) {
      add(g, RB(0.07, 0.42, 0.5, 0.02), BK, { pos: [sx * 0.43, 0.21, -0.1] });
      add(g, RB(0.07, 0.07, 0.3, 0.02), BK2, { pos: [sx * 0.43, 0.46, 0.0], noOutline: true });
    }
    add(g, RB(0.82, 0.04, 0.3, 0.012, 1), BK2, { pos: [0, 0.44, 0.1] }); // key slip
    const keys = [], blacks = [];
    for (let i = 0; i < 12; i++) {
      keys.push({ geo: BOX(0.057, 0.025, 0.19), pos: [-0.4 + 0.0615 + i * 0.0615, 0.475, 0.12], color: '#fffdf6' });
      if (i % 7 !== 2 && i % 7 !== 6 && i < 11) blacks.push({ geo: BOX(0.032, 0.03, 0.12), pos: [-0.4 + 0.0615 + i * 0.0615 + 0.03, 0.49, 0.085], color: '#2b2b3a' });
    }
    addVC(g, keys.concat(blacks));
    add(g, RB(0.7, 0.2, 0.025, 0.01, 1), BK, { pos: [0, 0.58, -0.03], rot: [-0.18, 0, 0], noOutline: true }); // music desk
    add(g, new THREE.PlaneGeometry(0.34, 0.17), pageTex(), { pos: [0, 0.6, -0.015], rot: [-0.18, 0, 0], ...T });
    add(g, CYL(0.009, 0.009, 0.06, 6), C.gold, { pos: [-0.12, 0.43, 0.27], ...T });
    add(g, CYL(0.009, 0.009, 0.06, 6), C.gold, { pos: [0.12, 0.43, 0.27], ...T });
    // stool
    add(g, CYL(0.13, 0.13, 0.05, 16), '#c94a5a', { pos: [0, 0.27, 0.4] });
    add(g, CYL(0.12, 0.12, 0.012, 16), '#e06a78', { pos: [0, 0.2, 0.4], noOutline: true });
    for (const [x, z] of legs4(0.07, 0.07)) add(g, CYL(0.016, 0.016, 0.24, 6), C.woodDeep, { pos: [x, 0.12, 0.4 + z], ...T });
    // metronome + candle holder on top
    add(g, CONE(0.05, 0.12, 4), C.woodDeep, { pos: [-0.3, 0.84, -0.22], rot: [0, PI / 4, 0] });
    add(g, RB(0.2, 0.01, 0.12, 0.004, 1), '#e06060', { pos: [0.25, 0.79, -0.2], rot: [0, 0.3, 0], ...T });
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
    g.userData.idle = (t) => {
      flames.forEach((f, i) => {
        const k = 1 + 0.14 * Math.sin(t * 11 + i * 2.1 + ph) + 0.07 * Math.sin(t * 23 + i);
        f.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k)); f.position.y = base[i] + (k - 1) * 0.12;
      });
      sparks.forEach((s, i) => {
        const u = ((t * 0.5 + i * 0.27 + ph) % 1);
        s.position.set(Math.sin(i * 2.4 + u * 3) * 0.12, 0.3 + u * 0.5, Math.cos(i * 1.7 + u * 3) * 0.12);
        s.scale.setScalar(1 - u);
      });
    };
  },

  tent(g, r) {
    const W = 0.86, H = 0.7, D = 0.82;
    const shape = new THREE.Shape(); shape.moveTo(-W / 2, 0); shape.lineTo(W / 2, 0); shape.lineTo(0, H); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false }); geo.translate(0, 0, -D / 2);
    add(g, geo, toon('#f2994a', { flat: true }));
    // stripes down both slopes
    const ang = Math.atan2(H, W / 2), sl = Math.hypot(W / 2, H);
    const stripes = [];
    for (const sx of [-1, 1]) for (const z of [-0.28, 0, 0.28]) {
      stripes.push({ geo: BOX(sl * 0.98, 0.012, 0.09), pos: [sx * W / 4 + sx * 0.01 * Math.sin(ang), H / 2 + 0.01 * Math.cos(ang), z], rot: [0, 0, -sx * ang], color: '#fff2d6' });
    }
    addVC(g, stripes);
    const fz = D / 2 + 0.002;
    const door = new THREE.Shape(); door.moveTo(-0.18, 0); door.lineTo(0.18, 0); door.lineTo(0, 0.46); door.closePath();
    add(g, new THREE.ShapeGeometry(door), toon('#3a2a3a'), { pos: [0, 0.002, fz], ...T });
    const flap = (sx) => { const s = new THREE.Shape(); s.moveTo(sx * 0.2, 0); s.lineTo(sx * 0.01, 0); s.lineTo(sx * 0.2, 0.43); s.closePath(); return s; };
    add(g, new THREE.ShapeGeometry(flap(-1)), toon('#f7b267'), { pos: [0, 0.002, fz + 0.012], ...T });
    add(g, new THREE.ShapeGeometry(flap(1)), toon('#f7b267'), { pos: [0, 0.002, fz + 0.012], ...T });
    for (const sx of [-1, 1]) add(g, SPH(0.016, 6, 5), '#7a4a2c', { pos: [sx * 0.15, 0.22, fz + 0.03], ...T });
    // ridge pole, flag, ropes & pegs
    add(g, CAPS(0.015, D + 0.1, 3, 6), C.woodDeep, { pos: [0, H, 0], rot: [PI / 2, 0, 0], ...T });
    add(g, CYL(0.008, 0.008, 0.2, 5), C.woodDeep, { pos: [0, H + 0.1, 0], ...T });
    add(g, new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.16, -0.04); s.lineTo(0, -0.09); return s; })()), toon('#e06060', { double: true }), { pos: [0, H + 0.2, 0], ...T });
    const ropes = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      ropes.push({ geo: CYL(0.005, 0.005, 0.3, 4), pos: [sx * 0.5, 0.11, sz * 0.4], rot: [sz * 0.2, 0, sx * 0.9 - 0.0], color: '#e6c88a' });
      ropes.push({ geo: CONE(0.014, 0.05, 5), pos: [sx * 0.58, 0.02, sz * 0.4], rot: [PI, 0, 0], color: '#7a4a2c' });
    }
    addVC(g, ropes);
  },

  chair(g, r) {
    for (const [x, z] of legs4(0.19, 0.19)) add(g, CYL(0.026, 0.02, 0.2, 8), C.woodDark, { pos: [x, 0.1, z + 0.01], noOutline: true });
    add(g, RB(0.5, 0.05, 0.5, 0.02), C.wood, { pos: [0, 0.195, 0] });
    add(g, RB(0.42, 0.04, 0.42, 0.02, 3), pick(r, ['#e06060', '#4f86c6', '#7a5aa8', '#3fb8af']), { pos: [0, 0.225, 0.0], noOutline: true });
    for (const sx of [-1, 1]) add(g, RB(0.045, 0.34, 0.045, 0.015), C.woodDark, { pos: [sx * 0.21, 0.37, -0.22] });
    add(g, RB(0.46, 0.07, 0.04, 0.015), C.wood, { pos: [0, 0.53, -0.22] });
    for (let i = -1; i <= 1; i++) add(g, RB(0.045, 0.2, 0.025, 0.01, 1), C.woodLight, { pos: [i * 0.1, 0.38, -0.22], noOutline: true });
  },

  sofa(g, r) {
    const col = pick(r, ['#c0504d', '#3f7f9a', '#7a8f3a', '#8f5aa8']);
    const dk = shade(col, 0.82), lt = shade(col, 1.15);
    for (const [x, z] of legs4(0.4, 0.28)) add(g, CYL(0.03, 0.022, 0.08, 6), C.woodDeep, { pos: [x, 0.04, z], noOutline: true });
    add(g, RB(0.94, 0.13, 0.72, 0.04), dk, { pos: [0, 0.14, 0] });
    for (const sx of [-1, 1]) add(g, RB(0.4, 0.1, 0.52, 0.04, 3), col, { pos: [sx * 0.2, 0.19, 0.07], noOutline: true });
    add(g, RB(0.94, 0.34, 0.2, 0.06, 3), col, { pos: [0, 0.34, -0.3] });
    for (const sx of [-1, 1]) add(g, RB(0.14, 0.26, 0.7, 0.05, 3), col, { pos: [sx * 0.44, 0.25, 0.0] });
    const pillow = (x, c, ry) => add(g, RB(0.2, 0.2, 0.07, 0.03, 3), c, { pos: [x, 0.36, -0.14], rot: [-0.25, ry, 0.1], noOutline: true });
    pillow(-0.28, lt, 0.2); pillow(0.28, '#ffd84d', -0.25);
    const btn = []; for (let i = 0; i < 6; i++) btn.push({ geo: SPH(0.014, 6, 5), pos: [-0.36 + i * 0.145, 0.38, -0.198], color: dk });
    addVC(g, btn);
  },

  bed(g, r) {
    const col = pick(r, ['#5aa0d6', '#e07a8a', '#7ab87a', '#9a7ad6']);
    for (const [x, z] of legs4(0.42, 0.39)) add(g, CYL(0.035, 0.03, 0.1, 6), C.woodDeep, { pos: [x, 0.05, z], noOutline: true });
    add(g, RB(0.94, 0.1, 0.9, 0.025), C.wood, { pos: [0, 0.13, 0] });
    add(g, RB(0.88, 0.1, 0.84, 0.04, 3), '#fff6e4', { pos: [0, 0.22, 0.0] });
    add(g, RB(0.96, 0.34, 0.07, 0.03), C.woodDark, { pos: [0, 0.3, -0.435] });
    add(g, RB(0.96, 0.1, 0.07, 0.03), C.wood, { pos: [0, 0.14, 0.435], noOutline: true });
    add(g, RB(0.9, 0.06, 0.5, 0.03, 3), col, { pos: [0, 0.258, 0.17] });
    add(g, RB(0.9, 0.075, 0.13, 0.035, 3), shade(col, 1.3), { pos: [0, 0.28, -0.1] }); // folded flap
    for (const sx of [-1, 1]) add(g, RB(0.36, 0.09, 0.2, 0.04, 3), '#ffffff', { pos: [sx * 0.2, 0.3, -0.31], rot: [-0.12, sx * 0.05, 0] });
    const dots = []; for (let i = 0; i < 6; i++) dots.push({ geo: SPH(0.018, 6, 5), pos: [-0.3 + (i % 3) * 0.3, 0.292, 0.06 + Math.floor(i / 3) * 0.24], scale: [1, 0.3, 1], color: shade(col, 1.6) });
    addVC(g, dots);
  },

  rug(g, r) {
    const v = Math.floor(r() * 3) % 3;
    add(g, RB(0.94, 0.03, 0.94, 0.012, 1), RUGS[v][1], { pos: [0, 0.015, 0], shadow: false, noOutline: true });
    add(g, new THREE.PlaneGeometry(0.9, 0.9), rugTex(v), { pos: [0, 0.0315, 0], rot: [-PI / 2, 0, 0], ...T });
    const fr = []; for (let i = 0; i < 12; i++) { const x = -0.44 + i * 0.08; fr.push({ geo: BOX(0.03, 0.015, 0.04), pos: [x, 0.008, 0.47], color: RUGS[v][1] }, { geo: BOX(0.03, 0.015, 0.04), pos: [x, 0.008, -0.47], color: RUGS[v][1] }); }
    addVC(g, fr, { shadow: false });
  },

  bench(g, r) {
    const slats = [];
    for (let i = 0; i < 4; i++) slats.push({ geo: RB(0.9, 0.04, 0.1, 0.015, 1), pos: [0, 0.2, -0.19 + i * 0.125], color: i % 2 ? C.wood : C.woodLight });
    for (let i = 0; i < 4; i++) add(g, RB(0.9, 0.04, 0.1, 0.015, 1), i % 2 ? C.wood : C.woodLight, { pos: [0, 0.2, -0.19 + i * 0.125] });
    void slats;
    for (const sx of [-1, 1]) {
      add(g, RB(0.06, 0.2, 0.46, 0.02), C.woodDeep, { pos: [sx * 0.38, 0.1, -0.02] });
      add(g, RB(0.06, 0.07, 0.5, 0.02), C.woodDark, { pos: [sx * 0.43, 0.32, -0.02], noOutline: true }); // arm rest
      add(g, RB(0.05, 0.28, 0.05, 0.015), C.woodDeep, { pos: [sx * 0.43, 0.2, -0.22], noOutline: true });
    }
    add(g, RB(0.82, 0.045, 0.045, 0.015, 1), C.woodDark, { pos: [0, 0.07, -0.02], noOutline: true });
    for (let i = 0; i < 2; i++) add(g, RB(0.86, 0.075, 0.03, 0.012, 1), i ? C.wood : C.woodLight, { pos: [0, 0.36 + i * 0.1, -0.235] });
    const bolts = []; for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) bolts.push({ geo: SPH(0.01, 5, 4), pos: [sx * 0.42, 0.22, -0.19 + i * 0.125], color: C.metal });
    addVC(g, bolts);
  },

  towel(g, r) {
    const v = Math.floor(r() * 3) % 3;
    add(g, RB(0.62, 0.02, 0.9, 0.008, 1), TOWELS[v][1], { pos: [0, 0.01, 0], shadow: false, noOutline: true });
    add(g, new THREE.PlaneGeometry(0.6, 0.88), towelTex(v), { pos: [0, 0.0215, 0], rot: [-PI / 2, 0, 0], ...T });
    const fr = []; for (let i = 0; i < 9; i++) { const x = -0.27 + i * 0.0675; fr.push({ geo: BOX(0.02, 0.012, 0.05), pos: [x, 0.006, 0.47], color: TOWELS[v][1] }, { geo: BOX(0.02, 0.012, 0.05), pos: [x, 0.006, -0.47], color: TOWELS[v][1] }); }
    // beach ball + sunglasses at the edge
    const bc = ['#e06060', '#ffffff', '#4f86c6', '#ffd84d'];
    for (let i = 0; i < 4; i++) fr.push({ geo: new THREE.SphereGeometry(0.075, 10, 8, (i * PI) / 2, PI / 2), pos: [0.33, 0.095, -0.36], color: bc[i] });
    fr.push({ geo: TOR(0.025, 0.006, 5, 10), pos: [-0.27, 0.025, 0.36], rot: [PI / 2, 0, 0], color: '#2b2b3a' }, { geo: TOR(0.025, 0.006, 5, 10), pos: [-0.21, 0.025, 0.36], rot: [PI / 2, 0, 0], color: '#2b2b3a' });
    addVC(g, fr, { shadow: false });
  },

  tv(g, r, ph) {
    add(g, RB(0.5, 0.05, 0.3, 0.02), C.dark, { pos: [0, 0.025, 0] }); // stand base
    add(g, RB(0.1, 0.22, 0.06, 0.02), C.dark, { pos: [0, 0.14, -0.02], noOutline: true });
    add(g, RB(0.9, 0.58, 0.08, 0.03), '#2f2c42', { pos: [0, 0.6, 0] });
    const scr = toonOwn('#6fd3e8', { emissive: '#4fb8d8', emissiveIntensity: 0.5 });
    add(g, RB(0.8, 0.48, 0.02, 0.02), scr, { pos: [0, 0.6, 0.045], ...T });
    const bars = [];
    ['#ff6b6b', '#ffd84d', '#6cc56a', '#4f86c6', '#a06ad8'].forEach((c, i) => bars.push({ geo: BOX(0.12, 0.34, 0.004), pos: [-0.24 + i * 0.12, 0.6, 0.057], color: c }));
    bars.push({ geo: SPH(0.014, 6, 5), pos: [0.34, 0.39, 0.05], color: '#6cc56a' });
    addVC(g, bars, T);
    g.userData.idle = (t) => { scr.emissiveIntensity = 0.5 + 0.12 * Math.sin(t * 3 + ph) + 0.06 * Math.sin(t * 11 + ph); };
  },

  wardrobe(g, r) {
    add(g, RB(0.9, 0.06, 0.56, 0.02), C.woodDeep, { pos: [0, 0.03, 0] });
    add(g, RB(0.88, 0.9, 0.54, 0.03), C.wood, { pos: [0, 0.51, 0] });
    add(g, RB(0.94, 0.07, 0.6, 0.025), C.woodDark, { pos: [0, 0.99, 0] });
    for (const sx of [-1, 1]) {
      add(g, RB(0.4, 0.78, 0.03, 0.02), C.woodLight, { pos: [sx * 0.215, 0.5, 0.275] });
      add(g, RB(0.3, 0.62, 0.012, 0.015), C.wood, { pos: [sx * 0.215, 0.5, 0.294], ...T });
      add(g, SPH(0.03, 8, 6), C.gold, { pos: [sx * 0.05, 0.5, 0.3], ...T });
    }
    add(g, BOX(0.012, 0.8, 0.012), C.woodDeep, { pos: [0, 0.5, 0.29], ...T });
  },

  register(g, r, ph) {
    add(g, RB(0.9, 0.5, 0.6, 0.035), C.woodLight, { pos: [0, 0.25, 0] });
    add(g, RB(0.94, 0.05, 0.64, 0.02), C.woodDark, { pos: [0, 0.525, 0] });
    add(g, RB(0.7, 0.22, 0.01, 0.01, 1), C.wood, { pos: [0, 0.27, 0.305], ...T });
    add(g, RB(0.5, 0.1, 0.36, 0.03), '#d9605a', { pos: [0, 0.6, -0.04] });
    add(g, RB(0.46, 0.04, 0.3, 0.015), '#b84a46', { pos: [0, 0.67, -0.02], rot: [-0.15, 0, 0], noOutline: true });
    const sc = toonOwn('#9fe8c0', { emissive: '#6fd8a0', emissiveIntensity: 0.5 });
    add(g, RB(0.3, 0.14, 0.03, 0.012), C.dark, { pos: [0, 0.76, -0.16], rot: [-0.25, 0, 0] });
    add(g, RB(0.24, 0.08, 0.01, 0.008, 1), sc, { pos: [0, 0.76, -0.14], rot: [-0.25, 0, 0], ...T });
    const k = [];
    for (let i = 0; i < 12; i++) k.push({ geo: BOX(0.05, 0.015, 0.04), pos: [-0.12 + (i % 4) * 0.08, 0.665 + 0.012 * Math.floor(i / 4), 0.03 - Math.floor(i / 4) * 0.045], color: i % 5 === 4 ? C.red : C.cream });
    addVC(g, k, T);
    add(g, RB(0.3, 0.02, 0.18, 0.01, 1), '#3a3550', { pos: [0, 0.56, 0.2], ...T }); // coin tray
    for (let i = 0; i < 3; i++) add(g, CYL(0.04, 0.04, 0.012, 10), C.gold, { pos: [-0.08 + i * 0.07, 0.575 + (i % 2) * 0.012, 0.2], ...T });
    g.userData.idle = (t) => { sc.emissiveIntensity = 0.5 + 0.08 * Math.sin(t * 2 + ph); };
  },

  barrel(g, r) {
    const prof = [[0.3, 0], [0.38, 0.12], [0.43, 0.38], [0.43, 0.5], [0.38, 0.76], [0.3, 0.88]].map(([x, y]) => new THREE.Vector2(x, y));
    add(g, new THREE.LatheGeometry(prof, 14), C.woodDark, { pos: [0, 0.03, 0] });
    add(g, CYL(0.3, 0.3, 0.02, 14), C.woodLight, { pos: [0, 0.91, 0], noOutline: true });
    for (const [y, rr] of [[0.14, 0.37], [0.34, 0.425], [0.62, 0.425], [0.8, 0.36]]) add(g, TOR(rr, 0.018, 5, 18), '#6a6880', { pos: [0, y, 0], rot: [PI / 2, 0, 0], ...T });
    add(g, CYL(0.04, 0.04, 0.03, 8), '#6a4a2c', { pos: [0, 0.45, 0.43], rot: [PI / 2, 0, 0], ...T }); // tap bung
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

  arcade(g, r, ph) {
    const body = '#4f5fd6';
    add(g, RB(0.7, 0.2, 0.6, 0.03), body, { pos: [0, 0.1, -0.02] });
    add(g, RB(0.7, 0.62, 0.42, 0.04), body, { pos: [0, 0.5, -0.1] });
    add(g, RB(0.76, 0.1, 0.5, 0.03), '#3a3f9e', { pos: [0, 0.98, -0.1] }); // marquee box
    add(g, RB(0.6, 0.07, 0.01, 0.01, 1), C.flameY, { pos: [0, 0.98, 0.16], ...T });
    add(g, RB(0.7, 0.05, 0.3, 0.02), '#2f2c42', { pos: [0, 0.54, 0.22], rot: [0.2, 0, 0] }); // control deck
    add(g, CYL(0.012, 0.012, 0.1, 6), C.metal, { pos: [-0.17, 0.62, 0.22], ...T });
    add(g, SPH(0.04, 8, 6), C.red, { pos: [-0.17, 0.69, 0.22], ...T });
    [['#ffd84d', 0.05], ['#6cc56a', 0.15], ['#4fb3d9', 0.25]].forEach(([c, x], i) => add(g, CYL(0.035, 0.035, 0.02, 10), c, { pos: [x, 0.58 + (i % 2) * 0.01, 0.2], rot: [0.2, 0, 0], ...T }));
    const scr = toonOwn('#2a2850', { emissive: '#8a5cff', emissiveIntensity: 0.6 });
    add(g, RB(0.52, 0.34, 0.03, 0.02), C.dark, { pos: [0, 0.78, 0.1], rot: [-0.12, 0, 0] });
    add(g, RB(0.44, 0.27, 0.01, 0.01, 1), scr, { pos: [0, 0.78, 0.117], rot: [-0.12, 0, 0], ...T });
    const px = [];
    [[-0.1, 0.84], [0, 0.8], [0.1, 0.84], [-0.05, 0.72], [0.08, 0.7]].forEach(([x, y], i) => px.push({ geo: BOX(0.05, 0.04, 0.004), pos: [x, y, 0.126], rot: [-0.12, 0, 0], color: ['#6cff8a', '#ff6b6b', '#ffd84d', '#6fd3e8', '#ffffff'][i] }));
    addVC(g, px, T);
    add(g, RB(0.1, 0.1, 0.02, 0.01, 1), '#2f2c42', { pos: [0, 0.3, 0.12], ...T }); // coin slot
    add(g, BOX(0.02, 0.04, 0.01), C.gold, { pos: [0, 0.3, 0.135], ...T });
    g.userData.idle = (t) => { scr.emissiveIntensity = 0.55 + 0.2 * Math.sin(t * 5 + ph) + 0.12 * Math.sin(t * 13 + ph * 2); };
  },

  heater(g, r, ph) {
    add(g, RB(0.7, 0.34, 0.7, 0.04), '#4a4660', { pos: [-0.05, 0.17, 0] });
    add(g, RB(0.74, 0.04, 0.74, 0.02), C.dark, { pos: [-0.05, 0.36, 0] });
    const fm = toonOwn('#ff9a3c', { emissive: '#ff7a1c', emissiveIntensity: 0.8 });
    add(g, RB(0.38, 0.22, 0.03, 0.02), '#5b5670', { pos: [-0.05, 0.17, 0.355], noOutline: true });
    add(g, RB(0.3, 0.14, 0.02, 0.02), fm, { pos: [-0.05, 0.16, 0.378], ...T });
    add(g, RB(0.58, 0.16, 0.58, 0.04), '#6a6880', { pos: [-0.05, 0.46, 0] }); // stone basket
    const st = [];
    for (let i = 0; i < 11; i++) { const a = r() * 6.28, d = r() * 0.2; st.push({ geo: ICO(0.075 + r() * 0.03, 1), pos: [-0.05 + Math.cos(a) * d, 0.55 + r() * 0.06, Math.sin(a) * d], scale: [1, 0.75, 1], color: pick(r, [C.stoneDark, C.stone, C.stoneLight, '#7a7690']) }); }
    addVC(g, st);
    add(g, CYL(0.025, 0.03, 0.4, 8), C.metal, { pos: [-0.3, 0.55, -0.3] }); // chimney pipe
    add(g, CYL(0.1, 0.085, 0.16, 12), C.wood, { pos: [0.37, 0.08, 0.28] }); // wooden bucket
    add(g, TOR(0.1, 0.012, 5, 12), '#6a6880', { pos: [0.37, 0.12, 0.28], rot: [PI / 2, 0, 0], ...T });
    add(g, CYL(0.085, 0.085, 0.01, 12), '#7fc4e8', { pos: [0.37, 0.15, 0.28], ...T });
    add(g, CAPS(0.012, 0.3, 3, 6), C.woodLight, { pos: [0.37, 0.2, 0.28], rot: [0.2, 0, 0.9], noOutline: true });
    g.userData.idle = (t) => { fm.emissiveIntensity = 0.8 + 0.25 * Math.sin(t * 3.1 + ph) + 0.1 * Math.sin(t * 8 + ph); };
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
    g.userData.idle = (t) => { g.children.forEach((m) => { if (m.userData.ph !== undefined) { const s = 1 + 0.12 * Math.sin(t * 1.2 + m.userData.ph); m.scale.set(s, s, 1); } }); };
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

  tractor(g, r, ph) {
    const red = '#d94a3a', redD = '#a8372c', tire = '#2f2c3d';
    add(g, RB(0.5, 0.26, 0.82, 0.05), red, { pos: [0, 0.38, 0.1] }); // hood
    add(g, RB(0.5, 0.05, 0.82, 0.02), redD, { pos: [0, 0.255, 0.1], noOutline: true });
    add(g, RB(0.4, 0.22, 0.05, 0.02), C.metal, { pos: [0, 0.38, 0.52], ...T }); // grille
    for (let i = 0; i < 4; i++) add(g, BOX(0.32, 0.012, 0.01), C.dark, { pos: [0, 0.31 + i * 0.05, 0.54], ...T });
    for (const x of [-0.16, 0.16]) add(g, SPH(0.045, 8, 6), C.flameY, { pos: [x, 0.46, 0.53], scale: [1, 1, 0.5], ...T });
    add(g, CYL(0.035, 0.035, 0.2, 8), C.dark, { pos: [0.14, 0.6, 0.3] }); // exhaust
    add(g, CYL(0.045, 0.035, 0.03, 8), '#6a6880', { pos: [0.14, 0.71, 0.3], ...T });
    // cab
    add(g, RB(0.56, 0.1, 0.4, 0.03), redD, { pos: [0, 0.34, -0.3] });
    for (const [x, z] of [[-0.24, -0.46], [0.24, -0.46], [-0.24, -0.14], [0.24, -0.14]]) add(g, CYL(0.016, 0.016, 0.42, 6), C.dark, { pos: [x, 0.62, z], noOutline: true });
    add(g, RB(0.6, 0.05, 0.44, 0.02), red, { pos: [0, 0.85, -0.3] }); // roof
    add(g, RB(0.34, 0.12, 0.06, 0.03), '#5a4a6a', { pos: [0, 0.5, -0.45] }); // seat back
    add(g, RB(0.32, 0.05, 0.28, 0.03), '#5a4a6a', { pos: [0, 0.43, -0.3] }); // seat
    add(g, CYL(0.07, 0.07, 0.015, 10), C.dark, { pos: [0, 0.58, -0.1], rot: [-0.7, 0, 0], ...T }); // wheel
    // wheels
    for (const x of [-0.36, 0.36]) {
      add(g, CYL(0.27, 0.27, 0.14, 18), tire, { pos: [x, 0.27, -0.3], rot: [0, 0, PI / 2] });
      add(g, CYL(0.12, 0.12, 0.15, 12), C.gold, { pos: [x, 0.27, -0.3], rot: [0, 0, PI / 2], ...T });
      add(g, CYL(0.15, 0.15, 0.1, 14), tire, { pos: [x * 0.94, 0.15, 0.4], rot: [0, 0, PI / 2] });
      add(g, CYL(0.07, 0.07, 0.11, 10), C.gold, { pos: [x * 0.94, 0.15, 0.4], rot: [0, 0, PI / 2], ...T });
    }
  },

  car(g, r) {
    const body = '#4f9be8', bodyD = '#3a78c0', glass = '#bfe6f5';
    // open-top cartoon convertible so a figurine can sit inside
    add(g, RB(0.74, 0.2, 0.92, 0.07), body, { pos: [0, 0.22, 0] });
    add(g, RB(0.72, 0.1, 0.3, 0.05), body, { pos: [0, 0.4, 0.3] }); // hood
    add(g, RB(0.72, 0.14, 0.2, 0.05), bodyD, { pos: [0, 0.38, -0.36] }); // trunk
    add(g, RB(0.7, 0.04, 0.46, 0.02), '#5a4a6a', { pos: [0, 0.33, -0.02], noOutline: true }); // seat floor
    add(g, RB(0.5, 0.1, 0.06, 0.03), '#5a4a6a', { pos: [0, 0.42, -0.22] }); // seat back
    add(g, RB(0.66, 0.1, 0.04, 0.02), glass, { pos: [0, 0.52, 0.16], rot: [-0.45, 0, 0], ...T }); // windscreen
    add(g, BOX(0.7, 0.02, 0.02), C.metal, { pos: [0, 0.2, 0.46], ...T }); // bumpers
    add(g, BOX(0.7, 0.02, 0.02), C.metal, { pos: [0, 0.2, -0.46], ...T });
    for (const x of [-0.24, 0.24]) {
      add(g, SPH(0.05, 8, 6), C.flameY, { pos: [x, 0.3, 0.45], scale: [1, 1, 0.5], ...T });
      add(g, SPH(0.035, 6, 5), C.red, { pos: [x, 0.3, -0.46], scale: [1, 1, 0.5], ...T });
    }
    for (const [x, z] of legs4(0.38, 0.28)) {
      add(g, CYL(0.13, 0.13, 0.1, 14), '#2f2c3d', { pos: [x, 0.13, z], rot: [0, 0, PI / 2] });
      add(g, CYL(0.06, 0.06, 0.105, 10), C.metal, { pos: [x, 0.13, z], rot: [0, 0, PI / 2], ...T });
    }
    add(g, CYL(0.05, 0.05, 0.012, 10), C.dark, { pos: [-0.12, 0.42, 0.1], rot: [-0.7, 0, 0], ...T }); // steering wheel
  },

  boat(g, r, ph) {
    const hull = new THREE.Group(); g.add(hull);
    const wd = '#b5763e', wl = '#d9a066';
    const h = (geo, mat, o) => add(hull, geo, mat, o);
    h(RB(0.6, 0.2, 0.7, 0.08), wd, { pos: [0, 0.14, -0.05] });
    h(RB(0.42, 0.2, 0.42, 0.08), wd, { pos: [0, 0.14, 0.24], rot: [0, PI / 4, 0] }); // pointed bow
    h(RB(0.5, 0.03, 0.62, 0.02), '#8a5a30', { pos: [0, 0.23, 0], noOutline: true }); // inner floor
    h(RB(0.6, 0.03, 0.07, 0.01), C.woodLight, { pos: [0, 0.27, -0.18] }); // thwarts
    h(RB(0.5, 0.03, 0.07, 0.01), C.woodLight, { pos: [0, 0.27, 0.12] });
    h(RB(0.07, 0.03, 0.66, 0.01, 1), wl, { pos: [-0.3, 0.25, -0.05], noOutline: true }); // gunwales
    h(RB(0.07, 0.03, 0.66, 0.01, 1), wl, { pos: [0.3, 0.25, -0.05], noOutline: true });
    h(RB(0.54, 0.035, 0.012, 0.005, 1), C.red, { pos: [0, 0.18, 0.31], ...T });
    for (const s of [-1, 1]) { // oars
      h(CAPS(0.014, 0.3, 3, 6), C.woodLight, { pos: [s * 0.42, 0.31, -0.1], rot: [0, 0, s * 1.15], noOutline: true });
      h(RB(0.07, 0.018, 0.14, 0.01, 1), C.woodLight, { pos: [s * 0.58, 0.22, -0.1], ...T });
      h(TOR(0.03, 0.006, 4, 8), C.metal, { pos: [s * 0.3, 0.29, -0.1], rot: [PI / 2, 0, 0], ...T });
    }
    g.userData.idle = (t) => { hull.position.y = 0.012 * Math.sin(t * 1.6 + ph); hull.rotation.z = 0.025 * Math.sin(t * 1.3 + ph); hull.rotation.x = 0.015 * Math.sin(t * 1.1 + ph * 2); };
  },

  bathtub(g, r) {
    const cer = '#fffdf6';
    add(g, RB(0.7, 0.34, 1.0, 0.14), cer, { pos: [0, 0.36, 0] });
    add(g, RB(0.52, 0.12, 0.84, 0.08), '#bfe6f5', { pos: [0, 0.54, 0], noOutline: true, shadow: false }); // inner basin hint (water)
    add(g, RB(0.74, 0.05, 1.04, 0.025), cer, { pos: [0, 0.54, 0] }); // rim
    for (const [x, z] of legs4(0.26, 0.4)) {
      add(g, SPH(0.07, 8, 6), C.gold, { pos: [x, 0.09, z], scale: [1, 1.1, 1] });
      add(g, CYL(0.03, 0.045, 0.1, 8), C.gold, { pos: [x, 0.17, z], noOutline: true });
    }
    add(g, CYL(0.025, 0.025, 0.2, 8), C.metal, { pos: [0, 0.68, -0.46] }); // tap
    add(g, TOR(0.05, 0.015, 6, 10, PI), C.metal, { pos: [0, 0.77, -0.41], rot: [0, 0, 0], ...T });
    add(g, SPH(0.03, 6, 5), C.red, { pos: [-0.07, 0.64, -0.46], ...T });
    add(g, SPH(0.03, 6, 5), '#4fb3d9', { pos: [0.07, 0.64, -0.46], ...T });
    for (let i = 0; i < 5; i++) add(g, SPH(0.04 + (i % 3) * 0.01, 8, 6), '#ffffff', { pos: [-0.14 + i * 0.07, 0.58 + (i % 2) * 0.02, 0.1 + ((i * 37) % 5) * 0.05], ...T }); // bubbles
  },

  stool(g, r) {
    for (const [x, z] of legs4(0.13, 0.13)) add(g, CYL(0.018, 0.014, 0.48, 6), C.metal, { pos: [x, 0.24, z], rot: [-z * 1.9, 0, x * 1.9], noOutline: true });
    add(g, TOR(0.13, 0.012, 5, 14), C.metal, { pos: [0, 0.14, 0], rot: [PI / 2, 0, 0], ...T });
    add(g, CYL(0.19, 0.19, 0.06, 16), '#d9605a', { pos: [0, 0.47, 0] });
    add(g, CYL(0.2, 0.2, 0.025, 16), shade('#d9605a', 0.8), { pos: [0, 0.435, 0], noOutline: true });
  },
};

export function buildObject(type, g, seed) {
  const b = BUILDERS[type];
  if (!b) { add(g, RB(0.5, 0.5, 0.5, 0.06), '#cccccc', { pos: [0, 0.25, 0] }); return false; }
  const r = rng(seed);
  b(g, r, (seed % 1000) / 1000 * PI * 2);
  return true;
}
