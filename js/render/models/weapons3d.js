// Held weapon props for suspect figurines: chunky soft toy versions. Each builder returns a THREE.Group with the
// grip at the origin and the weapon extending along +y (guns/crossbow along +z). Native size ~0.3-0.45; the
// figurine scales it up a little. Two draw calls per weapon: a matte vertex-coloured mesh and a satin-metal one.
// Materials are created with toonOwn (own, flashable) and pushed to `mats`.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonOwn, CAPS, RB, TOR } from './kit.js';

const PI = Math.PI;

// ---- shared soft-geometry helpers (also used by figurine.js) ----------------------------------
const _gc = new Map();
const gcache = (key, f) => { let g = _gc.get(key); if (!g) { g = f(); _gc.set(key, g); } return g; };
/** Unit sphere (radius 1), scale it into an ellipsoid. */
export const U = (ws = 8, hs = 6) => gcache(`u${ws}x${hs}`, () => new THREE.SphereGeometry(1, ws, hs));
/** Tapered capsule from y=0 (radius r0) to y=len (radius r1), rounded at both ends. */
export const T = (r0, r1, len, seg = 8) => gcache(`t${r0}|${r1}|${len}|${seg}`, () => {
  const pts = [];
  for (let i = 0; i <= 4; i++) { const a = -PI / 2 + (i / 4) * (PI / 2); pts.push(new THREE.Vector2(Math.max(r0 * Math.cos(a), 0.0001), r0 * Math.sin(a))); }
  for (let i = 0; i <= 4; i++) { const a = (i / 4) * (PI / 2); pts.push(new THREE.Vector2(Math.max(r1 * Math.cos(a), 0.0001), len + r1 * Math.sin(a))); }
  return new THREE.LatheGeometry(pts, seg);
});

const _m4 = new THREE.Matrix4(), _pm = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _e = new THREE.Euler(), _e2 = new THREE.Euler(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const _c0 = new THREE.Color(), _c1 = new THREE.Color();

/**
 * Merges parts into one vertex-coloured geometry. part: { g: geometry, c: '#hex' | [lo, hi, y0, y1] (vertical gradient),
 * p: [x,y,z], r: [rx,ry,rz], ry: yaw applied after r, s: [sx,sy,sz], d: [x,y,z] (aligns +y), m: Matrix4 applied last }.
 */
export function vcMerge(parts, dy = 0) {
  const gs = [];
  for (const p of parts) {
    const g = p.g.index ? p.g.toNonIndexed() : p.g.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (p.d) _q.setFromUnitVectors(_up, _v2.set(...p.d).normalize());
    else {
      _q.setFromEuler(_e.set(...(p.r || [0, 0, 0])));
      if (p.ry) _q.premultiply(_q2.setFromEuler(_e2.set(0, p.ry, 0)));
    }
    _m4.compose(_v.set(...(p.p || [0, 0, 0])), _q, _s.set(...(p.s || [1, 1, 1])));
    if (p.m) _m4.premultiply(p.m);
    if (dy) { _pm.makeTranslation(0, dy, 0); _m4.premultiply(_pm); }
    g.applyMatrix4(_m4);
    const pos = g.attributes.position, n = pos.count, arr = new Float32Array(n * 3);
    if (Array.isArray(p.c)) {
      _c0.set(p.c[0]); _c1.set(p.c[1]);
      for (let i = 0; i < n; i++) {
        const t = Math.min(1, Math.max(0, (pos.getY(i) - p.c[2]) / (p.c[3] - p.c[2])));
        arr[i * 3] = _c0.r + (_c1.r - _c0.r) * t; arr[i * 3 + 1] = _c0.g + (_c1.g - _c0.g) * t; arr[i * 3 + 2] = _c0.b + (_c1.b - _c0.b) * t;
      }
    } else {
      _c0.set(p.c || '#ffffff');
      for (let i = 0; i < n; i++) { arr[i * 3] = _c0.r; arr[i * 3 + 1] = _c0.g; arr[i * 3 + 2] = _c0.b; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    gs.push(g);
  }
  return mergeGeometries(gs, false);
}

/** Own (flashable) vertex-colour material. */
export function vcMat(rough, metal = 0) {
  const m = toonOwn('#ffffff', { rough, metal });
  m.vertexColors = true;
  return m;
}

// ---- palette ----------------------------------------------------------------------------------
const C = {
  steel: '#d8e0e8', dark: '#4a4a5e', wood: '#b9774a', gold: '#f0c24a', red: '#e5584c', rope: '#dcb976', cloth: '#c4569e', cloth2: '#8f3f78',
  candle: '#fff3dc', flame: '#ffb12e', glass: '#bdeedd', liquid: '#5fd57a', cream: '#fff6e4',
};
const SX = (r, y, z = r) => [r, y, z];

// Builders receive (a, b): a(geo, color, pos, opts) adds a matte part, b(...) a satin-metal part.
const BUILDERS = {
  knife(a, b) {
    a(CAPS(0.03, 0.07, 2, 8), C.wood, [0, 0, 0]);
    b(RB(0.11, 0.032, 0.05, 0.015, 2), C.gold, [0, 0.085, 0]);
    b(T(0.05, 0.012, 0.2), C.steel, [0, 0.095, 0], { s: [1, 1, 0.32] });
  },
  letteropener(a, b) {
    b(T(0.024, 0.02, 0.1), C.gold, [0, -0.05, 0]);
    b(U(), C.gold, [0, 0.07, 0], { s: SX(0.04, 0.026, 0.026) });
    b(T(0.03, 0.007, 0.22), C.steel, [0, 0.08, 0], { s: [1, 1, 0.28] });
    b(U(), C.gold, [0, -0.06, 0], { s: SX(0.032, 0.032) });
  },
  shears(a, b) {
    for (const s of [-1, 1]) {
      a(TOR(0.034, 0.012, 6, 12), C.red, [s * 0.036, -0.055, 0], { r: [0, 0, 0] });
      a(CAPS(0.014, 0.05, 3, 8), C.red, [s * 0.016, -0.005, 0], { r: [0, 0, s * 0.35] });
      b(T(0.032, 0.008, 0.24), C.steel, [s * 0.005, 0.0, 0], { s: [1, 1, 0.28], r: [0, 0, -s * 0.1] });
    }
    b(U(8, 6), C.dark, [0, 0.012, 0.012], { s: SX(0.016, 0.016) });
  },
  pistol(a, b) {
    a(RB(0.064, 0.15, 0.075, 0.028, 2), C.wood, [0, -0.01, 0], { r: [0, 0, 0.1] });
    a(RB(0.078, 0.085, 0.27, 0.034, 2), C.dark, [0, 0.085, 0.07]);
    b(CAPS(0.025, 0.05, 2, 8), C.steel, [0, 0.085, 0.22], { r: [PI / 2, 0, 0] });
    a(TOR(0.032, 0.009, 6, 12, PI), C.dark, [0, 0.03, 0.02], { r: [0, PI / 2, PI] });
  },
  crossbow(a, b) {
    a(CAPS(0.026, 0.07, 4, 8), C.wood, [0, 0, 0]);
    a(RB(0.065, 0.065, 0.38, 0.028, 2), C.wood, [0, 0.07, 0.07]);
    for (const s of [-1, 1]) a(CAPS(0.022, 0.12, 4, 8), C.wood, [s * 0.13, 0.07, 0.2], { r: [0, 0, PI / 2 - s * 0.1], ry: s * 0.2 });
    b(CAPS(0.01, 0.17, 3, 6), C.cream, [0, 0.07, 0.17], { r: [0, 0, PI / 2], ry: 0 });
    a(CAPS(0.014, 0.26, 3, 6), C.red, [0, 0.11, 0.18], { r: [PI / 2, 0, 0] });
    b(T(0.02, 0.002, 0.05, 8), C.steel, [0, 0.11, 0.35], { d: [0, 0, 1] });
  },
  rope(a) {
    for (let i = 0; i < 3; i++) a(TOR(0.085 - i * 0.006, 0.032, 10, 24), C.rope, [0, 0.03 + i * 0.05, 0], { r: [PI / 2, 0, i * 0.5] });
    a(CAPS(0.026, 0.14, 4, 8), C.rope, [0.08, -0.04, 0.02], { r: [0, 0, 0.5] });
    a(TOR(0.09, 0.011, 6, 24), C.red, [0, 0.085, 0], { r: [PI / 2, 0, 0] });
  },
  scarf(a) {
    a(CAPS(0.05, 0.12, 5, 12), C.cloth, [0, 0.0, 0], { r: [0, 0, 0.0] });
    a(RB(0.1, 0.24, 0.04, 0.02, 2), C.cloth, [0.0, -0.14, 0.04], { r: [0.12, 0, 0.1] });
    a(RB(0.1, 0.2, 0.04, 0.02, 2), C.cloth2, [0.07, -0.12, -0.03], { r: [-0.1, 0, -0.1] });
    a(RB(0.108, 0.03, 0.046, 0.014, 2), C.cream, [0.0, -0.17, 0.045], { r: [0.12, 0, 0.1] });
    a(RB(0.108, 0.03, 0.046, 0.014, 2), C.cream, [0.07, -0.15, -0.03], { r: [-0.1, 0, -0.1] });
  },
  candlestick(a, b) {
    b(U(), C.gold, [0, 0.0, 0], { s: SX(0.075, 0.03, 0.075) });
    b(T(0.022, 0.028, 0.15), C.gold, [0, 0.01, 0]);
    b(U(), C.gold, [0, 0.1, 0], { s: SX(0.04, 0.03, 0.04) });
    b(U(), C.gold, [0, 0.19, 0], { s: SX(0.058, 0.03, 0.058) });
    a(CAPS(0.026, 0.09, 2, 8), C.candle, [0, 0.265, 0]);
    a(U(10, 8), C.flame, [0, 0.37, 0], { s: SX(0.026, 0.045, 0.026) });
  },
  wrench(a, b) {
    b(RB(0.06, 0.29, 0.034, 0.016, 2), C.steel, [0, 0.1, 0]);
    b(TOR(0.06, 0.026, 8, 20, PI * 1.5), C.steel, [0, 0.29, 0], { r: [0, 0, PI * 0.75], s: [1, 1, 0.8] });
    b(U(), C.steel, [0, -0.045, 0], { s: SX(0.04, 0.04, 0.02) });
    a(CAPS(0.032, 0.08, 2, 8), C.red, [0, -0.01, 0]);
  },
  hammer(a, b) {
    a(T(0.028, 0.024, 0.3), C.wood, [0, -0.06, 0]);
    b(RB(0.19, 0.085, 0.085, 0.034, 2), C.steel, [0, 0.285, 0]);
    a(RB(0.04, 0.09, 0.09, 0.02, 2), C.red, [0.1, 0.285, 0]);
  },
  golfclub(a, b) {
    a(T(0.026, 0.02, 0.12), C.dark, [0, -0.05, 0]);
    b(T(0.015, 0.012, 0.34), C.steel, [0, 0.06, 0]);
    b(RB(0.1, 0.07, 0.15, 0.03, 2), C.steel, [0, 0.43, 0.04], { r: [0.3, 0, 0] });
    a(RB(0.05, 0.02, 0.1, 0.01, 2), C.red, [0, 0.46, 0.05], { r: [0.3, 0, 0] });
  },
  mallet(a) {
    a(T(0.026, 0.022, 0.32), C.wood, [0, -0.04, 0]);
    a(CAPS(0.075, 0.1, 6, 14), C.red, [0, 0.33, 0], { r: [0, 0, PI / 2] });
    for (const s of [-1, 1]) a(U(), C.gold, [s * 0.105, 0.33, 0], { s: [0.03, 0.079, 0.079] });
  },
  flaregun(a, b) {
    a(RB(0.066, 0.14, 0.08, 0.03, 2), C.red, [0, -0.01, 0], { r: [0, 0, 0.12] });
    a(CAPS(0.05, 0.13, 6, 12), C.red, [0, 0.1, 0.07], { r: [PI / 2, 0, 0] });
    b(CAPS(0.036, 0.02, 2, 8), C.steel, [0, 0.1, 0.19], { r: [PI / 2, 0, 0] });
    a(U(10, 8), C.flame, [0, 0.1, 0.225], { s: SX(0.034, 0.034, 0.02) });
    a(TOR(0.03, 0.009, 6, 12, PI), C.dark, [0, 0.03, 0.02], { r: [0, PI / 2, PI] });
  },
  skipole(a, b) {
    a(T(0.026, 0.022, 0.1), C.dark, [0, -0.05, 0]);
    b(T(0.014, 0.012, 0.36), C.steel, [0, 0.06, 0]);
    a(TOR(0.055, 0.012, 6, 16), C.dark, [0, 0.36, 0], { r: [PI / 2, 0, 0] });
    b(T(0.02, 0.004, 0.06, 8), C.steel, [0, 0.4, 0]);
    a(TOR(0.045, 0.01, 6, 14, PI * 1.3), C.red, [0, -0.02, 0], { r: [0, PI / 2, 0] });
  },
  shovel(a, b) {
    a(T(0.02, 0.018, 0.34), C.wood, [0, -0.05, 0]);
    a(TOR(0.042, 0.015, 6, 12), C.wood, [0, -0.07, 0], { r: [0, 0, 0], s: [1, 0.8, 1] });
    b(T(0.026, 0.02, 0.07), C.steel, [0, 0.28, 0]);
    b(U(), C.steel, [0, 0.4, 0], { s: [0.085, 0.1, 0.017] });
  },
  poison(a, b) {
    b(U(16, 12), '#7ad98f', [0, 0.075, 0], { s: SX(0.078, 0.082, 0.078) });
    b(T(0.028, 0.024, 0.07), '#a8e8bd', [0, 0.14, 0]);
    a(CAPS(0.03, 0.02, 4, 8), C.wood, [0, 0.235, 0]);
    a(U(10, 8), C.cream, [0, 0.07, 0.07], { s: [0.045, 0.045, 0.015] });
    a(U(8, 6), C.dark, [0, 0.075, 0.082], { s: [0.016, 0.018, 0.006] });
  },
  syringe(a, b) {
    b(T(0.036, 0.036, 0.15), '#aeeedb', [0, 0.03, 0]);
    a(T(0.026, 0.026, 0.1), C.liquid, [0, 0.045, 0.0], { s: [1, 1, 1.0] });
    b(RB(0.12, 0.02, 0.05, 0.01, 2), C.steel, [0, 0.19, 0]);
    b(CAPS(0.012, 0.08, 3, 8), C.steel, [0, -0.04, 0]);
    a(U(10, 8), C.red, [0, -0.1, 0], { s: SX(0.04, 0.016, 0.04) });
    b(T(0.01, 0.003, 0.1, 8), C.steel, [0, 0.2, 0]);
  },
  // Generic fallback for unknown ids: a short club.
  _generic(a) {
    a(T(0.028, 0.04, 0.26), C.wood, [0, -0.04, 0]);
  },
};

/** Builds a held weapon prop group (grip at origin, +y along the weapon). `mats` receives its materials. */
export function createWeapon3d(id, mats = []) {
  const g = new THREE.Group();
  g.name = `weapon:${id}`;
  const A = [], B = [];
  const mk = (list) => (geo, c, p = [0, 0, 0], o = {}) => list.push({ g: geo, c, p, ...o });
  (BUILDERS[id] || BUILDERS._generic)(mk(A), mk(B));
  for (const [list, mat] of [[A, vcMat(0.55)], [B, vcMat(0.35, 0.3)]]) {
    if (!list.length) continue;
    mats.push(mat);
    const m = new THREE.Mesh(vcMerge(list), mat);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

export const WEAPON3D_IDS = Object.keys(BUILDERS).filter((k) => k[0] !== '_');
