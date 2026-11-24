// World building context: part merging, instancing, painted ground, water, blob shadows and cheap life (see ../world.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { softMat, glowMat, toonVC, canvasTex, rng, hashStr, RB, BOX, CYL, SPH, CONE } from '../models/kit.js';
import { noRaycast } from '../layout.js';

// Foliage helpers are written by another module; fall back to simple blobs when it is missing.
let FO = null;
try { FO = await import('../models/foliage.js'); } catch (e) { FO = null; }
export { FO };

export const GY = -0.42;      // ground height next to the kerb
export const WY = -0.9;       // water level
export const EXT = 30;        // half size of the painted near ground
export const PAL = {
  lawn: '#b3ae50', lawnL: '#cdc065', lawnD: '#8a9a4c', asphalt: '#9a8c86', asphaltD: '#877a76', kerb: '#ecd6b2', pave: '#d9bd95',
  tan: '#e6c08c', dirt: '#d9a977', teal: '#2f9d9a', tealD: '#237f86', coral: '#ee6a5a', sun: '#f6c445', sky: '#6fb6e8', plum: '#8b5e9c',
  cream: '#fff3dc', wood: '#c88d55', woodD: '#9d6b45', sand: '#f0d9a0', snow: '#f4f4ff', stone: '#b9b1c4', white: '#fff8ea', ink: '#2e2a45',
};
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
export const lerpHex = (a, b, t) => '#' + _c1.set(a).lerp(_c2.set(b), t).getHexString();
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---- value noise ---------------------------------------------------------------------------------------------------------
function hash2(ix, iy, s) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function vnoise(x, y, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function organicPoly(cx, cz, rx, rz, n = 22, wob = 0.18, seed = 1) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * 6.2832, k = 1 + (vnoise(Math.cos(a) * 1.3 + seed, Math.sin(a) * 1.3 + seed * 2, seed) - 0.5) * 2 * wob; pts.push([cx + Math.cos(a) * rx * k, cz + Math.sin(a) * rz * k]); }
  return pts;
}
export function scaledPoly(poly, k) {
  let cx = 0, cz = 0; for (const [x, z] of poly) { cx += x; cz += z; } cx /= poly.length; cz /= poly.length;
  return poly.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k]);
}
export const fbm = (x, y, s = 0) => vnoise(x, y, s) * 0.6 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.28 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.12;

// ---- shared soft textures (module cache, never disposed) -------------------------------------------------------------------
let _blobMat = null, _cloudMat = null;
function radialTex(stops) {
  const t = canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  t.userData.owned = false;
  return t;
}
function blobMat() {
  if (!_blobMat) {
    _blobMat = new THREE.MeshBasicMaterial({
      map: radialTex([[0, 'rgba(58,44,120,0.95)'], [0.55, 'rgba(58,44,120,0.55)'], [1, 'rgba(58,44,120,0)']]),
      transparent: true, depthWrite: false, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    _blobMat.userData.shared = true;
  }
  return _blobMat;
}
function cloudMat() {
  if (!_cloudMat) {
    _cloudMat = new THREE.MeshBasicMaterial({
      map: radialTex([[0, 'rgba(70,60,150,0.9)'], [0.6, 'rgba(70,60,150,0.5)'], [1, 'rgba(70,60,150,0)']]),
      transparent: true, depthWrite: false, opacity: 0.3, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    });
    _cloudMat.userData.shared = true;
  }
  return _cloudMat;
}

// ---- part baking -----------------------------------------------------------------------------------------------------------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _col = new THREE.Color(), _top = new THREE.Color();
const FLATBLOB = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
/** Bake {geo,x,y,z,rot,ry,s,color,top,grad} to a non-indexed vertex-coloured geometry (lighter top, darker base by default). */
function bake(p) {
  const src = p.geo;
  const g = src.index ? src.toNonIndexed() : src.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!src.boundingBox) src.computeBoundingBox();
  const y0 = src.boundingBox.min.y, hh = Math.max(1e-4, src.boundingBox.max.y - y0);
  _col.set(p.color || '#ffffff');
  const hasTop = !!p.top; if (hasTop) _top.set(p.top);
  const gr = p.grad === undefined ? 0.16 : p.grad;
  const pos = g.attributes.position, n = pos.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = (pos.getY(i) - y0) / hh;
    let r, gg, b;
    if (hasTop) { const k = t * t * (3 - 2 * t); r = _col.r + (_top.r - _col.r) * k; gg = _col.g + (_top.g - _col.g) * k; b = _col.b + (_top.b - _col.b) * k; }
    else { const k = 1 - gr * 0.6 + gr * t; r = _col.r * k; gg = _col.g * k; b = _col.b * k; }
    arr[i * 3] = r; arr[i * 3 + 1] = gg; arr[i * 3 + 2] = b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  _q.setFromEuler(_e.set(...(p.rot || [0, 0, 0])));
  if (p.ry) { _q2.setFromEuler(_e.set(0, p.ry, 0)); _q.premultiply(_q2); }
  const s = p.s === undefined ? 1 : p.s;
  if (Array.isArray(s)) _s.set(s[0], s[1], s[2]); else _s.set(s, s, s);
  _m.compose(_p.set(p.x, p.y, p.z), _q, _s);
  g.applyMatrix4(_m);
  return g;
}
function bakeGlow(p) {
  const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  _q.setFromEuler(_e.set(...(p.rot || [0, 0, 0])));
  if (p.ry) { _q2.setFromEuler(_e.set(0, p.ry, 0)); _q.premultiply(_q2); }
  const s = p.s === undefined ? 1 : p.s;
  if (Array.isArray(s)) _s.set(s[0], s[1], s[2]); else _s.set(s, s, s);
  _m.compose(_p.set(p.x, p.y, p.z), _q, _s);
  g.applyMatrix4(_m);
  return g;
}
const GLOWS = {
  win: () => glowMat('#a9dcf0', '#ffc660', { day: 0.04, night: 2.0 }),
  winC: () => glowMat('#bfe9f2', '#9fe8ff', { day: 0.05, night: 1.7 }),
  lamp: () => glowMat('#fff3c8', '#ffd479', { day: 0.25, night: 2.6 }),
  red: () => glowMat('#ff8a70', '#ff5a3c', { day: 0.1, night: 2.2 }),
  sign: () => glowMat('#ffe38a', '#ffb94a', { day: 0.12, night: 2.0 }),
  blue: () => glowMat('#9fd8ff', '#5fb0ff', { day: 0.1, night: 1.9 }),
};

// ---- the context -----------------------------------------------------------------------------------------------------------
export class Ctx {
  constructor(view, puzzle, theme) {
    this.N = view.N; this.H = view.N / 2; this.theme = theme;
    this.r = rng(hashStr(String(puzzle?.id ?? 'x') + '|' + theme));
    this.group = new THREE.Group(); this.group.name = 'world';
    this.near = []; this.far = []; this.glows = new Map(); this.insts = new Map(); this.blobs = [];
    this.occ = []; this.occR = []; this.anims = []; this.lampSpots = []; this.extra = []; this.moodFns = [];
    this.clear = 1.7;
  }
  // random helpers
  rr(a, b) { return a + (b - a) * this.r(); }
  pick(a) { return a[Math.floor(this.r() * a.length) % a.length]; }
  sgn() { return this.r() < 0.5 ? -1 : 1; }

  // placement helpers
  dBoard(x, z) { const dx = Math.max(Math.abs(x) - this.H, 0), dz = Math.max(Math.abs(z) - this.H, 0); return Math.hypot(dx, dz); }
  isNear(x, z) { return this.dBoard(x, z) < 3.3; }
  lowOnly(x, z) { return z > this.H - 0.5 && Math.abs(x) < this.H + 5.5 && this.dBoard(x, z) < 9.5; }
  free(x, z, r = 0.5) {
    if (this.dBoard(x, z) < this.clear + r * 0.5) return false;
    if (Math.abs(x) > EXT - 1 || Math.abs(z) > EXT - 1) return false;
    for (const o of this.occ) { const dx = x - o.x, dz = z - o.z, rr = r + o.r; if (dx * dx + dz * dz < rr * rr) return false; }
    for (const o of this.occR) if (x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r) return false;
    return true;
  }
  claim(x, z, r) { this.occ.push({ x, z, r }); }
  claimRect(x0, z0, x1, z1) { this.occR.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) }); }
  /** Calls fn(x,z,i) for up to n free spots between rMin and rMax away from the board. */
  scatter(n, rMin, rMax, fn, { r = 0.6, tries = 24, tall = false, area = null } = {}) {
    let placed = 0; const L = Math.min(this.H + rMax, EXT - 1);
    for (let i = 0; i < n * tries && placed < n; i++) {
      const x = (this.r() * 2 - 1) * L, z = (this.r() * 2 - 1) * L;
      const d = this.dBoard(x, z); if (d < rMin || d > rMax) continue;
      if (tall && this.lowOnly(x, z)) continue;
      if (area && !area(x, z)) continue;
      if (!this.free(x, z, r)) continue;
      this.claim(x, z, r); fn(x, z, placed++);
    }
    return placed;
  }

  // geometry parts (vertex-coloured, merged at finish)
  p(geo, x, y, z, color, o = {}) {
    const part = { geo, x, y: y + (o.dy || 0), z, color, rot: o.rot, ry: o.ry, s: o.s, top: o.top, grad: o.grad };
    (o.far || !this.isNear(x, z) ? this.far : this.near).push(part);
  }
  box(x, y0, z, w, h, d, color, o = {}) { this.p(o.plain || Math.min(w, h, d) < 0.14 ? BOX(w, h, d) : RB(w, h, d, o.r ?? Math.min(0.05, w / 4, h / 4, d / 4), 1), x, y0 + h / 2, z, color, o); }
  cyl(x, y0, z, rt, rb, h, color, o = {}) { this.p(CYL(rt, rb, h, o.seg || 10), x, y0 + h / 2, z, color, o); }
  sph(x, yc, z, r, color, o = {}) { this.p(SPH(r, o.ws || 10, o.hs || 7), x, yc, z, color, o); }
  cone(x, y0, z, r, h, color, o = {}) { this.p(CONE(r, h, o.seg || 8), x, y0 + h / 2, z, color, o); }
  glow(kind, geo, x, y, z, o = {}) {
    let e = this.glows.get(kind); if (!e) { e = { mat: GLOWS[kind](), parts: [] }; this.glows.set(kind, e); }
    e.parts.push({ geo, x, y, z, rot: o.rot, ry: o.ry, s: o.s });
  }
  gbox(kind, x, y0, z, w, h, d, o = {}) { this.glow(kind, BOX(w, h, d), x, y0 + h / 2, z, o); }

  // instances: key -> one InstancedMesh
  inst(key, geoFn, mat, x, y, z, ry = 0, s = 1, color = null, o = {}) {
    const near = !!o.near;
    const k = key + (near ? '#n' : '');
    let e = this.insts.get(k);
    if (!e) { e = { geo: typeof geoFn === 'function' ? geoFn() : geoFn, mat, list: [], near, color: false }; this.insts.set(k, e); }
    e.list.push({ x, y, z, ry, s, sy: o.sy ?? (Array.isArray(s) ? s[1] : s), color }); if (color) e.color = true;
  }
  blob(x, z, rx, rz = rx, a = 1) { this.blobs.push({ x, z, rx, rz, a }); }

  // ---- ground ---------------------------------------------------------------------------------------------------------------
  /**
   * cfg: base(x,z,color) lawn/sand/... colour, paint(P) vector painting, holes: [[ [x,z]... ]] water cut-outs in the near ground,
   * isWater(x,z) for the far ring, hill amplitude, farBase(x,z,color), water: { color, deep, size } or null, noLand.
   */
  buildGround(cfg) {
    const G = this.group;
    if (!cfg.noLand) {
      // painted near ground (canvas texture, soft patches under crisp vector shapes)
      const SZ = 2048, k = SZ / (2 * EXT);
      const tex = canvasTex(SZ, SZ, (g) => {
        const low = document.createElement('canvas'); low.width = low.height = 160;
        const lg = low.getContext('2d'), id = lg.createImageData(160, 160), c = new THREE.Color();
        for (let j = 0; j < 160; j++) for (let i = 0; i < 160; i++) {
          cfg.base(((i + 0.5) / 160 * 2 - 1) * EXT, ((j + 0.5) / 160 * 2 - 1) * EXT, c);
          const o = (j * 160 + i) * 4;
          _c2.copy(c).convertLinearToSRGB();
          id.data[o] = _c2.r * 255; id.data[o + 1] = _c2.g * 255; id.data[o + 2] = _c2.b * 255; id.data[o + 3] = 255;
        }
        lg.putImageData(id, 0, 0);
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.drawImage(low, 0, 0, SZ, SZ);
        if (cfg.paint) cfg.paint(new Painter(g, k, this));
      });
      tex.anisotropy = 8; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      const shape = new THREE.Shape();
      shape.moveTo(-EXT, EXT); shape.lineTo(EXT, EXT); shape.lineTo(EXT, -EXT); shape.lineTo(-EXT, -EXT); shape.closePath();
      for (const h of cfg.holes || []) { const path = new THREE.Path(); h.forEach(([x, z], i) => (i ? path.lineTo(x, -z) : path.moveTo(x, -z))); path.closePath(); shape.holes.push(path); }
      const ng = new THREE.ShapeGeometry(shape, 1).rotateX(-Math.PI / 2);
      const pp = ng.attributes.position, uv = ng.attributes.uv;
      for (let i = 0; i < pp.count; i++) uv.setXY(i, (pp.getX(i) + EXT) / (2 * EXT), (EXT - pp.getZ(i)) / (2 * EXT));
      ng.translate(0, GY, 0);
      const near = new THREE.Mesh(ng, softMat({ map: tex, roughness: 0.96 }));
      near.receiveShadow = true; near.name = 'ground'; G.add(near);
      this._farRing(cfg);
      if (cfg.holes?.length) this._shores(cfg.holes);
    }
    if (cfg.water) this._water(cfg.water);
  }

  _farRing(cfg) {
    const S = 5, R = 125, n = Math.round(2 * R / S) + 1, c = new THREE.Color();
    const pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = -R + i * S, z = -R + j * S, d = Math.max(Math.abs(x), Math.abs(z));
      const base = (cfg.farBase || cfg.base);
      base(x, z, c);
      let y = GY;
      const hill = cfg.hill ?? 1;
      if (d > EXT + 5) {
        const e = smooth(EXT + 5, EXT + 50, d);
        y += (fbm(x * 0.05, z * 0.05, 91) - 0.35) * 9 * e * hill + e * 1.2 * hill;
        c.lerp(_c2.set(cfg.farTint || '#9fc050'), e * 0.35 * fbm(x * 0.09, z * 0.09, 5) * 2);
      }
      if (cfg.isWater && cfg.isWater(x, z)) y = WY - 0.7;
      const o = (j * n + i) * 3;
      pos[o] = x; pos[o + 1] = y; pos[o + 2] = z; col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
    }
    const idx = [];
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const x0 = -R + i * S, z0 = -R + j * S;
      if (x0 >= -EXT && x0 + S <= EXT && z0 >= -EXT && z0 + S <= EXT) continue;
      const a = j * n + i, b = a + 1, cc = a + n, d = cc + 1;
      idx.push(a, cc, b, b, cc, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, softMat({ vertexColors: true, roughness: 0.96 }));
    m.receiveShadow = true; m.name = 'farGround'; this.group.add(m);
  }

  _shores(holes, { outward = false, walls = true } = {}) {
    const wall = [], wi = [], strip = [], si = [];
    const edgeOnBoundary = (a, b) => (Math.abs(a[0]) > EXT - 0.01 && Math.abs(b[0]) > EXT - 0.01 && Math.sign(a[0]) === Math.sign(b[0])) || (Math.abs(a[1]) > EXT - 0.01 && Math.abs(b[1]) > EXT - 0.01 && Math.sign(a[1]) === Math.sign(b[1]));
    const top = new THREE.Color('#ecd7a0'), bot = new THREE.Color('#b98f6a'), cw = new THREE.Color('#7fd6d0'), cf = new THREE.Color('#fff8ea');
    for (const h of holes) {
      const n = h.length; let area = 0;
      for (let i = 0; i < n; i++) { const a = h[i], b = h[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
      const sg = (area > 0 ? 1 : -1) * (outward ? -1 : 1);
      const nor = (i) => { // inward normal at vertex i
        const a = h[(i + n - 1) % n], b = h[i], c = h[(i + 1) % n];
        let nx = 0, nz = 0;
        for (const [p, q] of [[a, b], [b, c]]) { const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1; nx += -dz / l * sg; nz += dx / l * sg; }
        const l = Math.hypot(nx, nz) || 1; return [nx / l, nz / l];
      };
      for (let i = 0; i < n; i++) {
        const a = h[i], b = h[(i + 1) % n]; if (edgeOnBoundary(a, b)) continue;
        const na = nor(i), nb = nor((i + 1) % n);
        if (walls) {
          const base = wall.length / 6;
          for (const [p] of [[a], [b]]) { wall.push(p[0], GY, p[1], top.r, top.g, top.b); wall.push(p[0], WY - 0.2, p[1], bot.r, bot.g, bot.b); }
          wi.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        }
        // shallow + foam ribbons
        for (const [wdt, c0, c1, al0, al1, yy] of [[2.2, cw, cw, 0.0, 0.55, WY + 0.012], [0.55, cf, cf, 0.0, 0.95, WY + 0.02]]) {
          const sb = strip.length / 7;
          for (const [p, q] of [[a, na], [b, nb]]) {
            strip.push(p[0], yy, p[1], c1.r, c1.g, c1.b, al1);
            strip.push(p[0] + q[0] * wdt, yy, p[1] + q[1] * wdt, c0.r, c0.g, c0.b, al0);
          }
          si.push(sb, sb + 1, sb + 2, sb + 2, sb + 1, sb + 3);
        }
      }
    }
    if (wi.length) {
      const g = new THREE.BufferGeometry(); const w = new Float32Array(wall);
      const ib = new THREE.InterleavedBuffer(w, 6);
      g.setAttribute('position', new THREE.InterleavedBufferAttribute(ib, 3, 0)); g.setAttribute('color', new THREE.InterleavedBufferAttribute(ib, 3, 3));
      g.setIndex(wi); g.computeVertexNormals();
      const m = new THREE.Mesh(g, softMat({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }));
      m.receiveShadow = true; this.group.add(m);
    }
    if (si.length) {
      const g = new THREE.BufferGeometry(); const w = new Float32Array(strip); const ib = new THREE.InterleavedBuffer(w, 7);
      g.setAttribute('position', new THREE.InterleavedBufferAttribute(ib, 3, 0)); g.setAttribute('color', new THREE.InterleavedBufferAttribute(ib, 4, 3));
      g.setIndex(si);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      m.renderOrder = 2; this.foam = m; this.group.add(m);
      this.anims.push((t) => { m.material.opacity = 0.8 + 0.2 * Math.sin(t * 1.3); });
    }
  }

  _water(w) {
    const size = w.size || 400;
    const g = new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2); g.translate(0, WY, 0);
    const mat = softMat({ color: w.color, roughness: 0.55 });
    const U = { value: 0 }, deep = new THREE.Color(w.deep || w.color).multiplyScalar(0.75);
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = U; sh.uniforms.uDeep = { value: deep };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = position.xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vWP;\nuniform float uT;\nuniform vec3 uDeep;')
        .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 q = vWP;
        float a = sin(q.x*0.7+uT*0.8) + sin(q.y*0.9-uT*0.6) + sin((q.x+q.y)*0.5+uT*0.45) + sin((q.x-q.y)*1.3-uT*1.1)*0.6;
        float f = smoothstep(2.15, 2.75, a + sin(q.x*2.3+uT*1.5)*sin(q.y*2.1-uT*1.2)*0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, uDeep, smoothstep(14.0, 60.0, length(q)) * 0.7);
        diffuseColor.rgb *= 0.94 + 0.05 * a / 3.0;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 1.0, 0.96), f * 0.5);`);
    };
    mat.customProgramCacheKey = () => 'worldwater';
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.name = 'water'; this.group.add(m);
    this.water = { mesh: m, U };
    this.anims.push((t) => { U.value = t; });
    const cols = { day: w.color, golden: w.golden || w.color, night: w.night || w.color };
    this.moodFns.push((name) => { mat.color.set(cols[name] || w.color); });
  }

  /** Group of merged parts (local coords) that spins: axis 'z' (windmill), 'y' (propeller, ride). */
  spinner(parts, x, y, z, { ry = 0, speed = 1, axis = 'z' } = {}) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    const m = new THREE.Mesh(mergeGeometries(parts.map(bake), false), toonVC()); m.frustumCulled = false; g.add(m); this.group.add(g);
    this.anims.push((t) => { m.rotation[axis] = t * speed; });
    return g;
  }
  /** Group of merged parts that bobs on the water (boats, buoys) and optionally drifts back and forth along x/z. */
  bobber(parts, x, y, z, { ry = 0, amp = 0.05, speed = 1, drift = 0, ph = this.r() * 6 } = {}) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    const m = new THREE.Mesh(mergeGeometries(parts.map(bake), false), toonVC()); m.frustumCulled = false; m.castShadow = false; g.add(m); this.group.add(g);
    this.anims.push((t) => { const w = t * speed + ph; g.position.y = y + Math.sin(w * 1.3) * amp; m.rotation.z = Math.sin(w * 0.9) * 0.05; m.rotation.x = Math.sin(w * 1.1 + 1) * 0.04; if (drift) { g.position.x = x + Math.sin(w * 0.25) * drift * Math.cos(ry); g.position.z = z - Math.sin(w * 0.25) * drift * Math.sin(ry); } });
    return g;
  }

  /** Part spec for spinner/bobber (not added to the world). y is the centre. */
  mk(geo, x, y, z, color, o = {}) { return { geo, x, y, z, color, rot: o.rot, ry: o.ry, s: o.s, top: o.top, grad: o.grad }; }
  /** Group of merged parts (local coords) that spins: axis 'z' (windmill), 'y' (propeller, ride). */
  spinner(parts, x, y, z, { ry = 0, speed = 1, axis = 'z' } = {}) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    const m = new THREE.Mesh(mergeGeometries(parts.map(bake), false), toonVC()); m.frustumCulled = false; g.add(m); this.group.add(g);
    this.anims.push((t) => { m.rotation[axis] = t * speed; });
    return g;
  }
  /** Group of merged parts that bobs on the water (boats, buoys) and optionally drifts back and forth. */
  bobber(parts, x, y, z, { ry = 0, amp = 0.05, speed = 1, drift = 0, ph = this.r() * 6 } = {}) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    const m = new THREE.Mesh(mergeGeometries(parts.map(bake), false), toonVC()); m.frustumCulled = false; m.castShadow = false; g.add(m); this.group.add(g);
    this.anims.push((t) => {
      const w = t * speed + ph; g.position.y = y + Math.sin(w * 1.3) * amp; m.rotation.z = Math.sin(w * 0.9) * 0.05; m.rotation.x = Math.sin(w * 1.1 + 1) * 0.04;
      if (drift) { g.position.x = x + Math.sin(w * 0.25) * drift * Math.cos(ry); g.position.z = z - Math.sin(w * 0.25) * drift * Math.sin(ry); }
    });
    return g;
  }

  // ---- trees ----------------------------------------------------------------------------------------------------------------
  /** Instanced tree of a foliage kind at (x,z); skips spots that could hide the board. */
  tree(kind, x, z, s = 1, tint = null) {
    const cheap = this.dBoard(x, z) > 7, key = kind + (cheap ? '~' : '');
    const h = TREES.get(key) || makeTree(kind, cheap);
    if (this.lowOnly(x, z) && h.height * s > 0.85) return false;
    const near = this.isNear(x, z);
    const ry = this.r() * 6.28;
    this.inst('tree_' + key, h.geo, h.mat, x, GY, z, ry, s, tint || _tint(this.r), { near });
    if (!near) this.blob(x + 0.25 * s, z - 0.2 * s, h.radius * s * 1.25, h.radius * s * 1.1, 0.8);
    return true;
  }
  bush(kind, x, z, s = 1, tint = null) {
    const cheap = this.dBoard(x, z) > 7, key = kind + (cheap ? '~' : '');
    const h = BUSHES.get(key) || makeBush(kind, cheap);
    this.inst('bush_' + key, h.geo, h.mat, x, GY, z, this.r() * 6.28, s, tint || _tint(this.r), { near: this.isNear(x, z) });
    if (!this.isNear(x, z)) this.blob(x + 0.12 * s, z - 0.1 * s, h.radius * s * 1.2, h.radius * s, 0.6);
  }
  tuft(x, z, s = 1) { const h = TUFT || makeTuft(); this.inst('tuft', h.geo, h.mat, x, GY, z, this.r() * 6.28, s, _tint(this.r), {}); }
  flower(x, z, color, s = 1) { const h = FLOW || makeFlower(); this.inst('flower', h.geo, h.mat, x, GY, z, this.r() * 6.28, s, color); }
  rock(x, z, s = 1, y = GY, color = null) { const h = ROCK || makeRock(); this.inst('rock', h.geo, h.mat, x, y, z, this.r() * 6.28, s, color || _tintR(this.r), { sy: s * 0.75 }); if (!this.isNear(x, z)) this.blob(x + 0.1 * s, z - 0.1 * s, 0.5 * s, 0.4 * s, 0.6); }

  // ---- finish ---------------------------------------------------------------------------------------------------------------
  finish() {
    const G = this.group;
    const mk = (parts, cast) => {
      if (!parts.length) return;
      const m = new THREE.Mesh(mergeGeometries(parts.map(bake), false), toonVC());
      m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false; G.add(m);
    };
    mk(this.near, true); mk(this.far, false);
    for (const { mat, parts } of this.glows.values()) {
      const m = new THREE.Mesh(mergeGeometries(parts.map(bakeGlow), false), mat); m.frustumCulled = false; G.add(m);
    }
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
    for (const [key, e0] of this.insts) {
      const im = new THREE.InstancedMesh(e0.geo, e0.mat, e0.list.length);
      e0.list.forEach((o, i) => {
        q.setFromEuler(e.set(0, o.ry, 0)); const s = Array.isArray(o.s) ? o.s : [o.s, o.sy, o.s];
        mm.compose(v.set(o.x, o.y, o.z), q, sc.set(s[0], s[1], s[2])); im.setMatrixAt(i, mm);
        if (e0.color) im.setColorAt(i, o.color ? c.set(o.color) : c.set('#ffffff'));
      });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = e0.near; im.receiveShadow = true; im.frustumCulled = false; im.name = key; G.add(im);
    }
    if (this.blobs.length) {
      const im = new THREE.InstancedMesh(FLATBLOB, blobMat(), this.blobs.length);
      this.blobs.forEach((b, i) => { mm.compose(v.set(b.x, GY + 0.025, b.z), q.identity(), sc.set(b.rx * 2.2, 1, b.rz * 2.2)); im.setMatrixAt(i, mm); });
      im.frustumCulled = false; im.renderOrder = 1; this.blobGroup = new THREE.Group(); this.blobGroup.add(im); G.add(this.blobGroup);
    }
    // drifting cloud shadows
    const cn = 7, cim = new THREE.InstancedMesh(FLATBLOB, cloudMat(), cn), cl = [];
    for (let i = 0; i < cn; i++) cl.push({ x: this.rr(-40, 40), z: this.rr(-30, 30), sx: this.rr(7, 13), sz: this.rr(4, 8), v: this.rr(0.25, 0.5) });
    const upd = () => { for (let i = 0; i < cn; i++) { const o = cl[i]; mm.compose(v.set(o.x, GY + 0.03, o.z), q.identity(), sc.set(o.sx, 1, o.sz)); cim.setMatrixAt(i, mm); } cim.instanceMatrix.needsUpdate = true; };
    upd(); cim.frustumCulled = false; cim.renderOrder = 1; this.clouds = cim; G.add(cim);
    this.anims.push((t, dt) => { for (let i = 0; i < cn; i++) { const o = cl[i]; o.x += o.v * dt; if (o.x > 48) o.x = -48; } upd(); });
    G.traverse((o) => { o.raycast = noRaycast; });
  }
}

// ---- foliage adapters ------------------------------------------------------------------------------------------------------
const TREES = new Map(), BUSHES = new Map();
let TUFT = null, FLOW = null, ROCK = null;
const _tcol = new THREE.Color();
function _tint(r) { _tcol.setHSL(0.0, 0, 0.9 + r() * 0.1); return '#' + _tcol.getHexString(); }
function _tintR(r) { _tcol.setHSL(0.08, 0.2, 0.78 + r() * 0.2); return '#' + _tcol.getHexString(); }
function vcGeo(g, bot, top) {
  g = g.index ? g.toNonIndexed() : g; g.computeBoundingBox();
  const p = g.attributes.position, a = new Float32Array(p.count * 3), y0 = g.boundingBox.min.y, hh = g.boundingBox.max.y - y0 || 1, cb = new THREE.Color(bot), ct = new THREE.Color(top), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { c.copy(cb).lerp(ct, (p.getY(i) - y0) / hh); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
function mergeBlob(list) { return mergeGeometries(list.map((g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); return g; })); }
const FALL = {
  round: { bot: '#7fae3c', top: '#d6e05a', h: 2.1, r: 0.95, trunk: '#9b6a42' }, tall: { bot: '#6fa23c', top: '#cfdc58', h: 2.9, r: 0.8, trunk: '#9b6a42' },
  autumn: { bot: '#d9822f', top: '#f4c64a', h: 2.2, r: 1.0, trunk: '#8f5f3c' }, cherry: { bot: '#e58aa8', top: '#ffd0dc', h: 2.0, r: 1.0, trunk: '#8f5f3c' },
  pine: { bot: '#3f8a56', top: '#8cc65a', h: 2.8, r: 0.85, trunk: '#8f5f3c', cone: true }, snowpine: { bot: '#4a8f7c', top: '#f2f6ff', h: 2.8, r: 0.85, trunk: '#8f5f3c', cone: true },
  palm: { bot: '#5fae4a', top: '#c8e05a', h: 2.6, r: 1.1, trunk: '#c9a06a', palm: true },
};
function makeTree(kind, cheap = false) {
  let out;
  if (!cheap && FO?.treeGeo) {
    const t = FO.treeGeo(kind, 0);
    const parts = [t.trunk, t.crown].filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g));
    const keep = parts.map((g) => { const c = g.clone(); for (const k of Object.keys(c.attributes)) if (!['position', 'normal', 'color'].includes(k)) c.deleteAttribute(k); return c; });
    if (keep.every((g) => g.attributes.color)) out = { geo: mergeGeometries(keep), mat: FO.foliageMat ? FO.foliageMat() : toonVC(), height: t.height, radius: t.radius };
  }
  if (!out) {
    const f = FALL[kind] || FALL.round, L = [];
    L.push(vcGeo(CYL(0.07, 0.11, f.h * 0.55, 6).clone().translate(0, f.h * 0.275, 0), f.trunk, f.trunk));
    if (f.cone) { for (let i = 0; i < 3; i++) L.push(vcGeo(CONE(f.r * (1 - i * 0.26), f.h * 0.5, 9).clone().translate(0, f.h * (0.4 + i * 0.22), 0), f.bot, f.top)); }
    else if (f.palm) { for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; L.push(vcGeo(SPH(0.42, 6, 4).clone().scale(1.9, 0.3, 0.7).rotateZ(-0.3).rotateY(a).translate(Math.cos(a) * 0.5, f.h, -Math.sin(a) * 0.5), f.bot, f.top)); } }
    else { L.push(vcGeo(SPH(f.r * 0.85, 8, 6).clone().translate(0, f.h * 0.72, 0), f.bot, f.top)); L.push(vcGeo(SPH(f.r * 0.6, 8, 6).clone().translate(f.r * 0.55, f.h * 0.58, 0.2), f.bot, f.top)); L.push(vcGeo(SPH(f.r * 0.55, 8, 6).clone().translate(-f.r * 0.5, f.h * 0.6, -0.2), f.bot, f.top)); }
    out = { geo: mergeBlob(L), mat: toonVC(), height: f.h, radius: f.r };
  }
  TREES.set(kind + (cheap ? '~' : ''), out); return out;
}
function makeBush(kind, cheap = false) {
  let out;
  if (!cheap && FO?.bushGeo) {
    const b = FO.bushGeo(kind, 0), g = b.geo || b.crown || b;
    if (g?.attributes?.color) out = { geo: g, mat: FO.foliageMat ? FO.foliageMat() : toonVC(), radius: b.radius || 0.5 };
  }
  if (!out) {
    const hedge = kind === 'hedge';
    const L = hedge ? [vcGeo(RB(1.0, 0.5, 0.4, 0.15, 2).clone().translate(0, 0.25, 0), '#5f9a3a', '#a8c84a')]
      : [vcGeo(SPH(0.42, 8, 6).clone().translate(0, 0.32, 0), '#6aa23c', '#c3d956'), vcGeo(SPH(0.3, 8, 6).clone().translate(0.3, 0.24, 0.1), '#6aa23c', '#c3d956')];
    out = { geo: mergeBlob(L), mat: toonVC(), radius: 0.5 };
  }
  BUSHES.set(kind + (cheap ? '~' : ''), out); return out;
}
function makeTuft() {
  let g = null;
  if (FO?.grassTuftGeo) { const t = FO.grassTuftGeo(0); if (t?.attributes?.color) g = t; }
  if (!g) { const L = []; for (let i = 0; i < 4; i++) L.push(vcGeo(CONE(0.05, 0.26, 4).clone().rotateZ((i - 1.5) * 0.25).rotateY(i * 1.6).translate(0, 0.13, 0), '#7fae3c', '#cfe060')); g = mergeBlob(L); }
  TUFT = { geo: g, mat: FO?.foliageMat && FO.grassTuftGeo ? FO.foliageMat() : toonVC() }; return TUFT;
}
function makeFlower() {
  let g = null;
  if (FO?.flowerGeo) { const t = FO.flowerGeo('#ffffff', 0); if (t?.attributes?.color) g = t; }
  if (!g) g = mergeBlob([vcGeo(CYL(0.012, 0.012, 0.18, 4).clone().translate(0, 0.09, 0), '#5f9a3a', '#5f9a3a'), vcGeo(SPH(0.07, 6, 4).clone().translate(0, 0.2, 0), '#ffffff', '#ffffff')]);
  FLOW = { geo: g, mat: toonVC() }; return FLOW;
}
function makeRock() {
  let g = null;
  if (FO?.rockGeo) { const t = FO.rockGeo(0); if (t?.attributes?.color) g = t; }
  if (!g) g = mergeBlob([vcGeo(new THREE.IcosahedronGeometry(0.5, 1).scale(1, 0.7, 0.85).translate(0, 0.25, 0), '#b9b1c4', '#e0d8e8')]);
  ROCK = { geo: g, mat: FO?.rockGeo && FO.foliageMat ? FO.foliageMat() : toonVC() }; return ROCK;
}

// ---- 2D painter on the ground canvas ---------------------------------------------------------------------------------------
export class Painter {
  constructor(g, k, ctx) { this.g = g; this.k = k; this.ctx = ctx; }
  x(v) { return (v + EXT) * this.k; }
  y(v) { return (v + EXT) * this.k; }
  fill(c, a = 1) { this.g.globalAlpha = a; this.g.fillStyle = c; }
  rect(x0, z0, x1, z1, c, rad = 0, a = 1) {
    const g = this.g; this.fill(c, a); g.beginPath();
    if (g.roundRect) g.roundRect(this.x(x0), this.y(z0), (x1 - x0) * this.k, (z1 - z0) * this.k, rad * this.k); else g.rect(this.x(x0), this.y(z0), (x1 - x0) * this.k, (z1 - z0) * this.k);
    g.fill(); g.globalAlpha = 1;
  }
  circ(x, z, r, c, a = 1) { const g = this.g; this.fill(c, a); g.beginPath(); g.arc(this.x(x), this.y(z), r * this.k, 0, 6.2832); g.fill(); g.globalAlpha = 1; }
  ell(x, z, rx, rz, c, a = 1, rot = 0) { const g = this.g; this.fill(c, a); g.beginPath(); g.ellipse(this.x(x), this.y(z), rx * this.k, rz * this.k, rot, 0, 6.2832); g.fill(); g.globalAlpha = 1; }
  poly(pts, c, a = 1) { const g = this.g; this.fill(c, a); g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(this.x(x), this.y(z)) : g.moveTo(this.x(x), this.y(z)))); g.closePath(); g.fill(); g.globalAlpha = 1; }
  /** smooth stroke through points (quadratic midpoints) */
  line(pts, w, c, { a = 1, cap = 'round', dash = null, close = false } = {}) {
    const g = this.g; g.globalAlpha = a; g.strokeStyle = c; g.lineWidth = w * this.k; g.lineCap = cap; g.lineJoin = 'round';
    g.setLineDash(dash ? dash.map((d) => d * this.k) : []);
    g.beginPath();
    const P = pts.map(([x, z]) => [this.x(x), this.y(z)]);
    g.moveTo(P[0][0], P[0][1]);
    if (P.length === 2) g.lineTo(P[1][0], P[1][1]);
    else {
      for (let i = 1; i < P.length - 1; i++) g.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
      g.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
    }
    if (close) g.closePath();
    g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
  }
  /** big soft painterly blot */
  blot(x, z, r, c, a = 0.25) {
    const g = this.g, gr = g.createRadialGradient(this.x(x), this.y(z), 0, this.x(x), this.y(z), r * this.k);
    _c1.set(c); const cs = `${Math.round(_c1.r * 255)},${Math.round(_c1.g * 255)},${Math.round(_c1.b * 255)}`;
    gr.addColorStop(0, `rgba(${cs},${a})`); gr.addColorStop(1, `rgba(${cs},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(this.x(x), this.y(z), r * this.k, 0, 6.2832); g.fill();
  }
  /** road with kerbs (cream), asphalt, subtle cracks; pts is a polyline */
  road(pts, w, { kerb = PAL.kerb, col = PAL.asphalt, dash = true, crack = true, edge = 0.28 } = {}) {
    this.line(pts, w + edge * 2 + 0.2, lerpHex(kerb, '#a68c68', 0.35), { cap: 'butt', a: 0.5 });
    this.line(pts, w + edge * 2, kerb, { cap: 'butt' });
    this.line(pts, w, col, { cap: 'butt' });
    this.line(pts, w * 0.55, lerpHex(col, '#b8a89c', 0.25), { cap: 'butt', a: 0.28 });
    if (dash) this.line(pts, 0.07, '#d8cfc4', { cap: 'butt', dash: [0.7, 0.6], a: 0.85 });
    if (crack) {
      const r = this.ctx.r, g = this.g;
      for (let i = 0; i < 10; i++) {
        const t = r(), a = pts[0], b = pts[pts.length - 1], x = a[0] + (b[0] - a[0]) * t + (r() - 0.5) * w * 0.7, z = a[1] + (b[1] - a[1]) * t + (r() - 0.5) * w * 0.7;
        const pp = []; let cx = x, cz = z; for (let j = 0; j < 4; j++) { pp.push([cx, cz]); cx += (r() - 0.5) * 0.7; cz += (r() - 0.5) * 0.7; }
        this.line(pp, 0.025, '#6e5f5a', { a: 0.35 });
      }
    }
  }
}

const _la = new THREE.Color(), _lb = new THREE.Color();
/** Painterly lemon-lime lawn colour field (soft big patches) as a base(x,z,color) function. */
export function lawnBase(seed = 0, { dark = PAL.lawnD, mid = PAL.lawn, light = PAL.lawnL } = {}) {
  return (x, z, c) => {
    const n = fbm(x * 0.06 + seed, z * 0.06, 3), m = fbm(x * 0.17 - seed, z * 0.17, 4), k = (n * 0.65 + m * 0.35 - 0.5) * 1.9 + 0.5;
    c.set(dark).lerp(_la.set(mid), smooth(0.3, 0.55, k)).lerp(_lb.set(light), smooth(0.55, 0.85, k));
  };
}
