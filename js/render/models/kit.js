// Shared helpers for the procedural cartoon models: materials, outlines, geometry caches, merging.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const OUTLINE_COLOR = '#2b2b3a';

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
let _gradient = null;
/** 3-step toon gradient map (shared). */
export function gradientMap() {
  if (!_gradient) {
    _gradient = new THREE.DataTexture(new Uint8Array([90, 180, 255]), 3, 1, THREE.RedFormat);
    _gradient.minFilter = THREE.NearestFilter;
    _gradient.magFilter = THREE.NearestFilter;
    _gradient.generateMipmaps = false;
    _gradient.needsUpdate = true;
  }
  return _gradient;
}

const _toonCache = new Map();
/** Shared (cached) toon material for a colour. Never disposed by disposeObject. */
export function toon(color, { flat = false, emissive = null, emissiveIntensity = 1, double = false } = {}) {
  const key = `${color}|${flat}|${emissive}|${emissiveIntensity}|${double}`;
  let m = _toonCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() });
    m.userData.flat = flat; // MeshToonMaterial has no flatShading: add() flattens geometry normals instead
    if (emissive) { m.emissive.set(emissive); m.emissiveIntensity = emissiveIntensity; }
    if (double) m.side = THREE.DoubleSide;
    m.userData.shared = true;
    _toonCache.set(key, m);
  }
  return m;
}

/** Unshared toon material (owned by the model, e.g. for per-token flashing or animated glow). */
export function toonOwn(color, { flat = false, emissive = null, emissiveIntensity = 1, double = false } = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() });
  m.userData.flat = flat;
  if (emissive) { m.emissive.set(emissive); m.emissiveIntensity = emissiveIntensity; }
  if (double) m.side = THREE.DoubleSide;
  return m;
}

let _vcMat = null;
/** Shared toon material that reads per-vertex colours (used with mergeVC). */
export function toonVC() {
  if (!_vcMat) {
    _vcMat = new THREE.MeshToonMaterial({ color: '#ffffff', vertexColors: true, gradientMap: gradientMap() });
    _vcMat.userData.shared = true;
    _vcMat.userData.flat = false;
  }
  return _vcMat;
}

const _texCache = new Map();
/** Cached shared toon material with a canvas texture (never disposed). */
export function texToon(key, w, h, draw, { repeat = null } = {}) {
  let m = _texCache.get(key);
  if (!m) {
    const t = canvasTex(w, h, draw);
    t.userData.owned = false;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    m = new THREE.MeshToonMaterial({ color: '#ffffff', map: t, gradientMap: gradientMap() });
    m.userData.shared = true;
    _texCache.set(key, m);
  }
  return m;
}

export function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData.owned = true;
  return t;
}

// ---------------------------------------------------------------------------
// Outlines / disposal
// ---------------------------------------------------------------------------
/** Faceted normals for a low-poly look (non-indexed + per-face normals). */
export function flatten(geo) {
  if (geo.userData.flat) return geo;
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  g.userData.flat = true;
  return g;
}

let _outlineMat = null;
function outlineMaterial() {
  if (!_outlineMat) {
    _outlineMat = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });
    _outlineMat.userData.shared = true;
  }
  return _outlineMat;
}

/** Adds an inverted-hull outline child to every mesh under root (unless mesh.userData.noOutline). */
export function addOutlines(root, thickness = 0.018) {
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && !o.userData.noOutline && !o.userData.isOutline) meshes.push(o); });
  const size = new THREE.Vector3(), center = new THREE.Vector3();
  for (const mesh of meshes) {
    const g = mesh.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    bb.getSize(size); bb.getCenter(center);
    const ms = mesh.scale;
    const sx = 1 + (2 * thickness) / Math.max(size.x * Math.abs(ms.x), 0.01);
    const sy = 1 + (2 * thickness) / Math.max(size.y * Math.abs(ms.y), 0.01);
    const sz = 1 + (2 * thickness) / Math.max(size.z * Math.abs(ms.z), 0.01);
    const o = new THREE.Mesh(g, outlineMaterial());
    o.userData.isOutline = true;
    o.scale.set(sx, sy, sz);
    o.position.set(center.x * (1 - sx), center.y * (1 - sy), center.z * (1 - sz)); // scale about bbox centre
    o.castShadow = false; o.receiveShadow = false;
    mesh.add(o);
  }
  return root;
}

/** Disposes geometries, unshared materials and owned textures under obj. */
export function disposeObject(obj) {
  if (!obj) return;
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (m.userData && m.userData.shared) continue;
      if (m.map && m.map.userData && m.map.userData.owned) m.map.dispose();
      m.dispose();
    }
  });
}

// ---------------------------------------------------------------------------
// Meshes & geometry
// ---------------------------------------------------------------------------
/** Tiny deterministic RNG for repeatable decoration. */
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Creates a mesh and adds it to a parent. opts: pos [x,y,z], rot [x,y,z], scale [x,y,z], noOutline, shadow. */
export function add(parent, geo, mat, opts = {}) {
  const material = typeof mat === 'string' ? toon(mat) : mat;
  const m = new THREE.Mesh(material.userData.flat ? flatten(geo) : geo, material);
  if (opts.pos) m.position.set(...opts.pos);
  if (opts.rot) m.rotation.set(...opts.rot);
  if (opts.scale) m.scale.set(...opts.scale);
  if (opts.noOutline) m.userData.noOutline = true;
  m.castShadow = opts.shadow !== false;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// Geometry caches (shared between instances; disposing just re-uploads on next use).
const _geo = new Map();
const gc = (key, f) => { let g = _geo.get(key); if (!g) { g = f(); _geo.set(key, g); } return g; };
export const RB = (w, h, d, r = 0.03, s = 2) => gc(`rb${w}|${h}|${d}|${r}|${s}`,
  () => new RoundedBoxGeometry(w, h, d, s, Math.max(0.002, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001))));
export const BOX = (w, h, d) => gc(`bx${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
export const CYL = (rt, rb, h, s = 16) => gc(`cy${rt}|${rb}|${h}|${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
export const SPH = (r, ws = 14, hs = 10) => gc(`sp${r}|${ws}|${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
export const ICO = (r, d = 1) => gc(`ic${r}|${d}`, () => new THREE.IcosahedronGeometry(r, d));
export const CONE = (r, h, s = 8) => gc(`co${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
export const TOR = (r, t, rs = 8, ts = 20, arc = Math.PI * 2) => gc(`to${r}|${t}|${rs}|${ts}|${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));
export const CAPS = (r, l, cs = 4, rs = 8) => gc(`ca${r}|${l}|${cs}|${rs}`, () => new THREE.CapsuleGeometry(r, l, cs, rs));

const _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

/** Bakes a part {geo,pos,rot,scale,dir,color,flat} into a standalone non-indexed geometry. */
function bake(p, withColor) {
  let g = p.flat ? flatten(p.geo) : p.geo;
  g = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (p.dir) _q.setFromUnitVectors(_up, _v.set(...p.dir).normalize());
  else if (p.ry !== undefined) { // yaw applied after the local rotation
    _q.setFromEuler(_e.set(0, p.ry, 0));
    _q.multiply(_q2.setFromEuler(_e.set(...(p.rot || [0, 0, 0]))));
  } else _q.setFromEuler(_e.set(...(p.rot || [0, 0, 0])));
  _m.compose(_v.set(...(p.pos || [0, 0, 0])), _q, _s.set(...(p.scale || [1, 1, 1])));
  g.applyMatrix4(_m);
  if (withColor) {
    const c = new THREE.Color(p.color || '#ffffff');
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }
  return g;
}
/** Merge parts into a single geometry (same material). */
export function mergeParts(parts) { return mergeGeometries(parts.map((p) => bake(p, false)), false); }
/** Merge parts with per-part colours into one vertex-coloured geometry (use with toonVC()). */
export function mergeVC(parts) { return mergeGeometries(parts.map((p) => bake(p, true)), false); }
/** Convenience: merged vertex-coloured mesh. */
export function addVC(parent, parts, opts = {}) { return add(parent, mergeVC(parts), toonVC(), { noOutline: true, ...opts }); }
/** Convenience: merged single-material mesh. */
export function addMerged(parent, parts, mat, opts = {}) { return add(parent, mergeParts(parts), mat, opts); }

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------
export function paleColor(hex) {
  const c = new THREE.Color(hex);
  const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s * 0.35, hsl.l + (1 - hsl.l) * 0.4);
  return '#' + c.getHexString();
}
export function shade(hex, k) { // k<1 darker, k>1 lighter
  const c = new THREE.Color(hex);
  if (k < 1) c.multiplyScalar(k); else c.lerp(new THREE.Color('#ffffff'), k - 1);
  return '#' + c.getHexString();
}
export function mix(a, b, t) {
  return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}
export function contrastAccent(outfit) {
  const c = new THREE.Color(outfit); const hsl = {}; c.getHSL(hsl);
  c.setHSL((hsl.h + 0.5) % 1, 0.65, 0.55);
  return '#' + c.getHexString();
}
