// Palette and small helpers shared by the object builders.
import * as THREE from 'three';
import { add, toon, toonOwn, SPH } from './kit.js';

export const PI = Math.PI;
export const C = {
  wood: '#c98b55', woodLight: '#dba570', woodDark: '#9b6238', woodDeep: '#7a4a2c',
  leaf: '#6cc56a', leaf2: '#86d67a', leaf3: '#4fae5a', leaf4: '#3d9a50',
  stone: '#aaa6b8', stoneLight: '#c8c4d4', stoneDark: '#8a869a', metal: '#cfd3dc', cream: '#f6f1e6', dark: '#3a3550', red: '#e06060',
  flameO: '#ff8a2a', flameY: '#ffd84d', gold: '#f2c14e', white: '#fffdf6',
};
export const T = { noOutline: true, shadow: false };
export const BOOKS = ['#e06060', '#4f86c6', '#6cc56a', '#f2c14e', '#a06ad8', '#f2994a', '#3fb8af', '#d95d92', '#7a4a2c', '#5b6fd6'];

export const flameMat = (c, i = 0.9) => toon(c, { emissive: c, emissiveIntensity: i });
/** Rising steam puffs: one translucent material, scale/position only (no per-frame allocation). Returns update(t). */
export function makeSteam(g, x, y, z, ph, n, rise, size) {
  const m = toonOwn('#ffffff'); m.transparent = true; m.opacity = 0.5; m.depthWrite = false;
  const puffs = [];
  for (let i = 0; i < n; i++) puffs.push(add(g, SPH(size, 6, 5), m, { pos: [x, y, z], ...T }));
  return (t) => {
    for (let i = 0; i < n; i++) {
      const u = (t * 0.3 + i / n + ph) % 1;
      puffs[i].position.set(x + Math.sin(i * 2.3 + u * 3) * 0.04, y + u * rise, z + Math.cos(i * 1.9 + u * 3) * 0.04);
      puffs[i].scale.setScalar(Math.max(0.001, Math.sin(u * PI) * (0.6 + 0.9 * u)));
    }
  };
}
/** Two stepped, additive-looking glow discs on the floor (toon-style firelight); returns update(k). */
export function makeFireGlow(g, x, y, z, rad) {
  const mats = [0, 1].map((i) => new THREE.MeshBasicMaterial({ color: i ? '#ffd27a' : '#ff9a3c', transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false }));
  const discs = mats.map((m, i) => add(g, new THREE.CircleGeometry(rad * (i ? 0.55 : 1), 24), m, { pos: [x, y + i * 0.001, z], rot: [-PI / 2, 0, 0], ...T }));
  return (k) => { mats[0].opacity = 0.13 + 0.05 * k; mats[1].opacity = 0.16 + 0.07 * k; discs[0].scale.setScalar(1 + 0.04 * k); };
}
/** Four-way symmetric leg positions helper. */
export const legs4 = (x, z) => [[-x, -z], [x, -z], [-x, z], [x, z]];
export const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
