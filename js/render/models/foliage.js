// Leafy foliage kit: dense balls of rounded leaf cards (real geometry), trees, bushes, grass, flowers, rocks.
// Everything is non-indexed with position/normal/color so parts merge freely; use foliageMat() for the leaves
// (double-sided, vertex-coloured, gentle wind) and toonVC() for trunks/rocks if you do not want the sway.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { softMat } from './kit.js';

/** Time-like uniform driving the wind sway. Scene code sets windU.value = seconds every frame (0 = still). */
export const windU = { value: 0 };

const V = THREE.Vector3;
const UP = new V(0, 1, 0);
const PI = Math.PI;

function mulberry(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hashS = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const col = (h) => new THREE.Color(h);
const lerpC = (a, b, t) => [a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t];

// ---------------------------------------------------------------------------
// Accumulator
// ---------------------------------------------------------------------------
class Acc {
  constructor() { this.p = []; this.n = []; this.c = []; this.a = []; }
  get count() { return this.p.length / 3; }
  vert(p, n, c, fl = 0, jit = 0, ny = 0, sn = 0) {
    this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.c.push(c[0], c[1], c[2]); this.a.push(fl, jit, ny, sn);
  }
  /** Emit a triangle; winding is fixed so the geometric normal faces `ref`. */
  tri(a, b, c, ref) {
    const e1 = new V().subVectors(b.p, a.p), e2 = new V().subVectors(c.p, a.p);
    if (e1.cross(e2).dot(ref) < 0) { const t = b; b = c; c = t; }
    for (const q of [a, b, c]) this.vert(q.p, q.n, q.c, q.fl, q.jit, q.ny, q.sn);
  }
  /** Append an existing non-indexed geometry (position+normal). colorFn(x,y,z,nx,ny,nz) -> [r,g,b]. */
  geo(g, colorFn, fl = 0, jit = 0) {
    const pa = g.attributes.position, na = g.attributes.normal;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), nx = na.getX(i), ny = na.getY(i), nz = na.getZ(i);
      this.p.push(x, y, z); this.n.push(nx, ny, nz);
      const c = colorFn(x, y, z, nx, ny, nz); this.c.push(c[0], c[1], c[2]);
      this.a.push(fl, jit, ny, 0);
    }
  }
  /** Gradient shading of flagged vertices from index `start` on: light on top, dark below. */
  shade(start, ramp, snow = null) {
    const [d, m, l] = ramp.map(col);
    let lo = Infinity, hi = -Infinity;
    for (let i = start; i < this.count; i++) if (this.a[i * 4] === 1) { const y = this.p[i * 3 + 1]; if (y < lo) lo = y; if (y > hi) hi = y; }
    const sc = snow ? col(snow) : null;
    for (let i = start; i < this.count; i++) {
      if (this.a[i * 4] !== 1) continue;
      const hn = (this.p[i * 3 + 1] - lo) / Math.max(1e-4, hi - lo), ny = this.a[i * 4 + 2], jit = this.a[i * 4 + 1];
      const t = clamp(0.5 * hn + 0.35 * (0.5 + 0.5 * ny) + 0.15 + jit);
      let c = t < 0.5 ? lerpC(d, m, t * 2) : lerpC(m, l, (t - 0.5) * 2);
      if (sc && this.a[i * 4 + 3] === 1) { const k = sstep(0.25, 0.65, ny + jit * 0.6); c = lerpC({ r: c[0], g: c[1], b: c[2] }, sc, k); }
      this.c[i * 3] = c[0]; this.c[i * 3 + 1] = c[1]; this.c[i * 3 + 2] = c[2];
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// ---------------------------------------------------------------------------
// Leaf card: 4 triangles, oval, cupped and drooping
// ---------------------------------------------------------------------------
const ROWS = [[0, 0], [0.3, 0.97], [0.7, 0.9], [1, 0]];
/** o: cup, bend, c0/c1 (Color arrays), grad (bool), jit, nfn(p)->V|null, nmix, snow */
function leafCard(A, base, u, f, l, w, o) {
  const s = new V().crossVectors(u, f).normalize();
  const f2 = new V().crossVectors(s, u).normalize();
  const hw = w * 0.5;
  const pt = (t, x) => {
    const cup = (o.cup || 0) * w * 0.3 * (x * x) / (hw * hw || 1), bend = (o.bend || 0) * l * 0.3 * t * t;
    return new V().copy(base).addScaledVector(u, t * l).addScaledVector(s, x).addScaledVector(f2, -(cup + bend));
  };
  const mk = (t, x) => {
    const p = pt(t, x);
    let n = f2.clone();
    const nb = o.nfn ? o.nfn(p) : null;
    if (nb) n.copy(nb).multiplyScalar(o.nmix ?? 0.8).addScaledVector(f2, 1 - (o.nmix ?? 0.8)).normalize();
    // push the vertex normals outward at the rims so the card reads as a soft dome
    const c = o.grad ? [0.5, 0.5, 0.5] : lerpC(o.c0, o.c1, t);
    return { p, n, c, fl: o.grad ? 1 : 0, jit: (o.jit || 0) + (t - 0.5) * 0.1, ny: nb ? nb.y : n.y, sn: o.snow ? 1 : 0 };
  };
  const v = ROWS.map(([t, k]) => (k === 0 ? [mk(t, 0)] : [mk(t, -hw * k), mk(t, hw * k)]));
  A.tri(v[0][0], v[1][1], v[1][0], f2);
  A.tri(v[1][0], v[1][1], v[2][1], f2); A.tri(v[1][0], v[2][1], v[2][0], f2);
  A.tri(v[2][0], v[2][1], v[3][0], f2);
}

// ---------------------------------------------------------------------------
// Leaf cloud on ellipsoid blobs
// ---------------------------------------------------------------------------
const ICO0 = new THREE.IcosahedronGeometry(1, 1);
function blobShape(b) {
  const e = b[4];
  if (typeof e === 'number') return { sx: 1, sy: e, sz: 1 };
  return { sx: e?.sx ?? 1, sy: e?.sy ?? 1, sz: e?.sz ?? 1 };
}

function leafCloud(A, blobs, o) {
  const R = mulberry(o.seed ?? 1);
  const start = A.count;
  const sh = blobs.map(blobShape);
  const leaves = o.leaves ?? 300;
  const sumA = blobs.reduce((s, b, i) => s + b[3] * b[3] * (sh[i].sx * sh[i].sz + sh[i].sy) , 0);
  const cand = [];
  let visA = 0;
  const inside = (P, skip) => {
    for (let j = 0; j < blobs.length; j++) {
      if (j === skip) continue;
      const b = blobs[j], s = sh[j];
      const qx = (P.x - b[0]) / (b[3] * s.sx), qy = (P.y - b[1]) / (b[3] * s.sy), qz = (P.z - b[2]) / (b[3] * s.sz);
      if (qx * qx + qy * qy + qz * qz < 0.72) return true;
    }
    return false;
  };
  blobs.forEach((b, i) => {
    const s = sh[i], cnt = Math.max(6, Math.round(leaves * (b[3] * b[3] * (s.sx * s.sz + s.sy)) / sumA));
    const area = 4 * PI * b[3] * b[3] * (s.sx + s.sy + s.sz) / 3;
    let kept = 0;
    for (let k = 0; k < cnt; k++) {
      const yy = 1 - (k + 0.5) / cnt * 2, th = k * 2.399963 + R() * 0.8, rr = Math.sqrt(Math.max(0, 1 - yy * yy));
      const d = new V(Math.cos(th) * rr + (R() - 0.5) * 0.18, yy + (R() - 0.5) * 0.18, Math.sin(th) * rr + (R() - 0.5) * 0.18).normalize();
      const P = new V(b[0] + s.sx * b[3] * d.x, b[1] + s.sy * b[3] * d.y, b[2] + s.sz * b[3] * d.z);
      const n = new V(d.x / s.sx, d.y / s.sy, d.z / s.sz).normalize();
      if (inside(P, i)) continue;
      if (n.y < -0.35 && R() < 0.55) continue;
      kept++;
      cand.push({ P, n, i });
    }
    visA += area * kept / cnt;
  });
  const aspect = o.aspect ?? 1.25;
  const size = o.leafSize ?? Math.sqrt((o.cover ?? 2.1) * visA / (Math.max(1, cand.length) * 0.4 * (1.25 / aspect)));
  for (const { P, n, i } of cand) {
    const b = blobs[i], s = sh[i];
    // direction of the leaf length: down along the surface, rotated by jitter
    const d = new V(0, -1, 0).addScaledVector(n, n.y);
    let dl = d.length();
    if (dl < 0.3) { d.copy(new V(R() - 0.5, R() - 0.5, R() - 0.5).cross(n)); if (d.lengthSq() < 1e-5) d.set(1, 0, 0).cross(n); d.normalize(); }
    else d.divideScalar(dl);
    const ang = (R() - 0.5) * (1.1 + 1.6 * clamp(n.y));
    d.multiplyScalar(Math.cos(ang)).addScaledVector(new V().crossVectors(n, d), Math.sin(ang)).normalize();
    const tilt = (o.tilt ?? 0.5) * (0.65 + R() * 0.7) * (n.y > 0.75 ? 0.7 : 1);
    const u = d.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(n, Math.sin(tilt)).normalize();
    const f = n.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(d, -Math.sin(tilt)).normalize();
    const l = size * (0.82 + R() * 0.4), w = l / aspect * (0.9 + R() * 0.2);
    const base = P.clone().addScaledVector(u, -l * 0.42).addScaledVector(n, -l * 0.04);
    const nfn = (p) => new V((p.x - b[0]) / (s.sx * s.sx), (p.y - b[1]) / (s.sy * s.sy), (p.z - b[2]) / (s.sz * s.sz)).normalize();
    leafCard(A, base, u, f, l, w, { cup: 0.55 + R() * 0.3, bend: o.bend ?? 0.45, grad: true, jit: (R() - 0.5) * 0.3, nfn, nmix: 0.82, snow: !!o.snow });
  }
  // inner solid core per blob so there are no see-through holes
  const pa = ICO0.attributes.position;
  for (let i = 0; i < blobs.length; i++) {
    const b = blobs[i], s = sh[i], k = (o.core ?? 0.86) * b[3];
    for (let q = 0; q < pa.count; q++) {
      const dx = pa.getX(q), dy = pa.getY(q), dz = pa.getZ(q);
      const n = new V(dx / s.sx, dy / s.sy, dz / s.sz).normalize();
      A.vert(new V(b[0] + s.sx * k * dx, b[1] + s.sy * k * dy, b[2] + s.sz * k * dz), n, [0.4, 0.5, 0.3], 1, -0.2, n.y, 0);
    }
  }
  return start;
}

const DEF_COLS = ['#3f9a52', '#8cc64e', '#d4e45a'];

/** Dense ball of leaf cards. blobs: [x,y,z,r] or [x,y,z,r,{sx,sy,sz}|sy]. Returns non-indexed position/normal/color geometry. */
export function leafBallGeo({ blobs, leaves = 300, leafSize, seed = 1, colors = DEF_COLS, aspect, tilt, bend, snow, cover, core } = {}) {
  const A = new Acc();
  const st = leafCloud(A, blobs, { leaves, leafSize, seed, aspect, tilt, bend, snow: !!snow, cover, core });
  A.shade(st, colors, snow ? (typeof snow === 'string' ? snow : '#f6fbff') : null);
  return A.build();
}

// ---------------------------------------------------------------------------
// Generic helpers: tubes, rounded blobs, petals, blades
// ---------------------------------------------------------------------------
function tubeGeo(curvePts, radiusFn, seg, cb, closeTop = true) {
  const curve = new THREE.CatmullRomCurve3(curvePts);
  const N = 9, pos = [], idx = [];
  const rings = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = curve.getPoint(t), tg = curve.getTangent(t);
    let right = new V().crossVectors(tg, new V(0, 0, 1)); if (right.lengthSq() < 0.05) right = new V(1, 0, 0).cross(tg);
    right.normalize(); const up = new V().crossVectors(right, tg).normalize();
    for (let j = 0; j < seg; j++) {
      const th = (j / seg) * PI * 2, r = radiusFn(t, th);
      pos.push(p.x + (right.x * Math.cos(th) + up.x * Math.sin(th)) * r, p.y + (right.y * Math.cos(th) + up.y * Math.sin(th)) * r, p.z + (right.z * Math.cos(th) + up.z * Math.sin(th)) * r);
    }
    rings.push(p);
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < seg; j++) {
    const a = i * seg + j, b = i * seg + (j + 1) % seg, c = (i + 1) * seg + j, d = (i + 1) * seg + (j + 1) % seg;
    idx.push(a, c, b, b, c, d);
  }
  if (closeTop) {
    const top = pos.length / 3; const p = rings[N]; pos.push(p.x, p.y, p.z);
    for (let j = 0; j < seg; j++) idx.push(N * seg + j, top, N * seg + (j + 1) % seg);
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  g.computeVertexNormals();
  g = g.toNonIndexed();
  // colour callback sees (y fraction along height) via position; supply through cb(x,y,z,nx,ny,nz)
  return { geo: g, cb };
}

function addTube(A, pts, radiusFn, seg, cb) { const t = tubeGeo(pts, radiusFn, seg, cb); A.geo(t.geo, cb); }

const _sph = new THREE.IcosahedronGeometry(1, 2);
/** Smooth ellipsoid blob (non-indexed, own normals). */
function ellipsoid(A, cx, cy, cz, rx, ry, rz, colorFn, geo = _sph) {
  const pa = geo.attributes.position;
  for (let q = 0; q < pa.count; q++) {
    const dx = pa.getX(q), dy = pa.getY(q), dz = pa.getZ(q);
    const n = new V(dx / rx, dy / ry, dz / rz).normalize();
    const x = cx + rx * dx, y = cy + ry * dy, z = cz + rz * dz;
    A.vert(new V(x, y, z), n, colorFn(x, y, z, n.x, n.y, n.z), 0, 0, n.y, 0);
  }
}

function petalFlower(A, pos, axis, size, color, R, petals = 5) {
  const a = axis.clone().normalize();
  const t1 = new V().crossVectors(a, Math.abs(a.y) > 0.9 ? new V(1, 0, 0) : UP).normalize(), t2 = new V().crossVectors(a, t1);
  const cc = col(color), c0 = lerpC(cc, col('#ffffff'), 0.08), c1 = lerpC(cc, col('#ffffff'), 0.34);
  const dark = lerpC(cc, col('#7a3a6a'), 0.18);
  const ph = R() * 6.28;
  for (let k = 0; k < petals; k++) {
    const phi = ph + k / petals * PI * 2;
    const rd = t1.clone().multiplyScalar(Math.cos(phi)).addScaledVector(t2, Math.sin(phi));
    const lift = 0.3;
    const u = rd.clone().multiplyScalar(Math.cos(lift)).addScaledVector(a, Math.sin(lift));
    const f = a.clone().multiplyScalar(Math.cos(lift)).addScaledVector(rd, -Math.sin(lift));
    leafCard(A, pos.clone().addScaledVector(a, 0.004), u, f, size, size * 1.0, { cup: 0.9, bend: 0.35, c0: dark.length ? { r: dark[0], g: dark[1], b: dark[2] } : c0, c1: { r: c1[0], g: c1[1], b: c1[2] }, nfn: (p) => p.clone().sub(pos).addScaledVector(a, size * 0.5).normalize(), nmix: 0.55 });
  }
  const gold = col('#ffd84d');
  ellipsoid(A, pos.x + a.x * size * 0.12, pos.y + a.y * size * 0.12, pos.z + a.z * size * 0.12, size * 0.3, size * 0.3, size * 0.3, (x, y) => lerpC(gold, col('#fff2a0'), clamp(0.5 + (y - pos.y) / size)), ICO0);
}

function blade(A, P, ang, h, wd, lean, c0, c1, R) {
  const out = new V(Math.cos(ang), 0, Math.sin(ang)), side = new V(-out.z, 0, out.x);
  const ts = [0, 0.35, 0.7, 1], ws = [1, 0.92, 0.62, 0];
  const row = ts.map((t, i) => {
    const c = new V().copy(P).addScaledVector(out, lean * h * t * t).addScaledVector(UP, h * t * (1 - 0.18 * t));
    const tg = new V().addScaledVector(out, 2 * lean * t).addScaledVector(UP, 1 - 0.36 * t).normalize();
    const fn = new V().crossVectors(side, tg).normalize();
    const n = fn.clone().multiplyScalar(0.35).addScaledVector(out, 0.35).addScaledVector(UP, 0.45).normalize();
    const mk = (sx) => ({ p: c.clone().addScaledVector(side, sx * wd * ws[i]), n, c: lerpC(c0, c1, t), fl: 0, jit: 0, ny: n.y, sn: 0 });
    return ws[i] === 0 ? [mk(0)] : [mk(-1), mk(1)];
  });
  const ref = new V().crossVectors(side, UP).add(out).normalize();
  const fN = out.clone();
  A.tri(row[0][0], row[1][1], row[1][0], fN); A.tri(row[1][0], row[1][1], row[2][1], fN); A.tri(row[1][0], row[2][1], row[2][0], fN);
  A.tri(row[2][0], row[2][1], row[3][0], fN);
}

function grassClump(A, R, n, rad, hMin, hMax, cols, wd) {
  const [d, m, l] = cols.map(col);
  for (let i = 0; i < n; i++) {
    const k = i / n, r = rad * Math.sqrt(R()) , a = R() * PI * 2;
    const center = 1 - r / rad;
    const h = hMin + (hMax - hMin) * (0.35 * R() + 0.65 * center * center);
    const jit = 0.5 + 0.5 * R();
    const c0 = { r: d.r + (m.r - d.r) * 0.3, g: d.g + (m.g - d.g) * 0.3, b: d.b + (m.b - d.b) * 0.3 };
    const c1 = lerpC(m, l, jit); blade(A, new V(Math.cos(a) * r, 0, Math.sin(a) * r), a + (R() - 0.5) * 0.6, h, wd * (0.8 + R() * 0.5), 0.25 + 0.7 * (1 - center) + R() * 0.3, c0, { r: c1[0], g: c1[1], b: c1[2] }, R);
  }
}

// ---------------------------------------------------------------------------
// Material
// ---------------------------------------------------------------------------
let _fm = null;
/** Shared vertex-coloured double-sided leaf material with wind sway and a faint up-facing translucency lift. */
export function foliageMat() {
  if (_fm) return _fm;
  const m = softMat({ color: '#ffffff', vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  m.userData.shared = true; m.userData.flat = false;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windU;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float wPh = modelMatrix[3].x * 1.7 + modelMatrix[3].z * 2.3;
      #ifdef USE_INSTANCING
        wPh += instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3;
      #endif
      float wH = max(transformed.y, 0.0);
      transformed.x += ( sin( uWind * 1.7 + wPh + transformed.y * 2.0 + transformed.z * 3.1 ) * 0.016 + sin( uWind * 5.3 + wPh * 2.0 + transformed.x * 9.0 ) * 0.004 ) * wH;
      transformed.z += sin( uWind * 1.3 + wPh * 1.3 + transformed.y * 1.7 + transformed.x * 2.7 ) * 0.011 * wH;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      float fUp = saturate( dot( normalize( normal ), normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ) ) );
      outgoingLight += diffuseColor.rgb * ( 0.05 + 0.13 * fUp );
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'foliage-wind-v1';
  _fm = m;
  return m;
}

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------
const TREE = {
  round: { cols: ['#3f9a52', '#8cc64e', '#d8e85c'], trunk: ['#8f5a38', '#b98250'] },
  tall: { cols: ['#34905a', '#79bd4e', '#cfe45a'], trunk: ['#8f5a38', '#b98250'] },
  autumn: { cols: ['#d4552c', '#f2962e', '#ffd75a'], trunk: ['#7f4f34', '#a8754a'] },
  pine: { cols: ['#2a7a5e', '#46a05c', '#a4d25c'], trunk: ['#85543a', '#a87a4e'] },
  snowpine: { cols: ['#2a7a68', '#4aa070', '#bfe3b0'], trunk: ['#85543a', '#a87a4e'], snow: '#f6fbff' },
  palm: { cols: ['#3e9a52', '#70c04e', '#bcdc58'], trunk: ['#a57a52', '#d2a874'] },
  cherry: { cols: ['#e4608c', '#f799b8', '#ffdae6'], trunk: ['#7a4a3a', '#a46a52'] },
};

function trunkColor(c0, c1) {
  const a = col(c0), b = col(c1);
  return (x, y, z, nx, ny, nz, ht = 1.2) => {
    const t = clamp(y / ht), bark = 0.06 * Math.sin(Math.atan2(nz, nx) * 5 + y * 3);
    const c = lerpC(a, b, clamp(t * 0.9 + 0.1 + bark));
    return c;
  };
}

function makeTrunk(A, h, r0, lean, R, c0, c1, o = {}) {
  const lx = lean[0], lz = lean[1];
  const pts = [new V(0, 0, 0), new V(lx * 0.25, h * 0.33, lz * 0.25), new V(lx * 0.7, h * 0.68, lz * 0.7), new V(lx, h, lz)];
  const cf = trunkColor(c0, c1);
  const ring = o.rings;
  addTube(A, pts, (t, th) => {
    const taper = 1 - 0.42 * t;
    const flare = 1 + (0.5 + 0.2 * Math.cos(th * 3 + 1)) * Math.exp(-t * 10);
    return r0 * taper * flare * (ring ? 1 + 0.07 * Math.sin(t * 70) : 1);
  }, 9, (x, y, z, nx, ny, nz) => cf(x, y, z, nx, ny, nz, h));
  return pts;
}

function branch(A, from, to, r0, c0, c1) {
  const mid = from.clone().lerp(to, 0.5); mid.x += (to.x - from.x) * 0.1; mid.y -= 0.02;
  const cf = trunkColor(c0, c1);
  addTube(A, [from, mid, to], (t) => r0 * (1 - 0.45 * t), 6, (x, y, z, nx, ny, nz) => cf(x, y, z, nx, ny, nz, 1.2));
}

function frond(A, P, ang, L, W, cols, rise, R) {
  const [d, m, l] = cols.map(col);
  const out = new V(Math.cos(ang), 0, Math.sin(ang)), side = new V(-out.z, 0, out.x);
  const NR = 9, rows = [];
  for (let i = 0; i <= NR; i++) {
    const t = i / NR;
    const c = new V().copy(P).addScaledVector(out, L * t * 0.95).addScaledVector(UP, L * (rise * t - 0.8 * t * t));
    const tg = new V().addScaledVector(out, 0.95).addScaledVector(UP, rise - 1.6 * t).normalize();
    const fn = new V().crossVectors(side, tg).normalize();
    if (fn.y < 0) fn.negate();
    const zz = 1 + (i % 2 ? 0.2 : -0.1);
    const wv = W * Math.sin(PI * (0.08 + 0.84 * t) ) * (1 - 0.25 * t) * (i === NR ? 0 : zz);
    const cm = lerpC(d, l, t), ce = lerpC(d, m, 0.4 + 0.5 * t);
    const mkv = (p, n, c) => ({ p, n: n.clone().normalize(), c, fl: 0, jit: 0, ny: n.y, sn: 0 });
    const mid = c.clone().addScaledVector(UP, 0.015);
    const lp = c.clone().addScaledVector(side, -wv).addScaledVector(UP, -wv * 0.45), rp = c.clone().addScaledVector(side, wv).addScaledVector(UP, -wv * 0.45);
    rows.push([mkv(lp, fn.clone().addScaledVector(side, -0.4).addScaledVector(UP, 0.4), ce), mkv(mid, fn.clone().addScaledVector(UP, 0.4), cm), mkv(rp, fn.clone().addScaledVector(side, 0.4).addScaledVector(UP, 0.4), ce)]);
  }
  for (let i = 0; i < NR; i++) {
    const a = rows[i], b = rows[i + 1], ref = new V(0, 1, 0);
    A.tri(a[0], a[1], b[1], ref); A.tri(a[0], b[1], b[0], ref); A.tri(a[1], a[2], b[2], ref); A.tri(a[1], b[2], b[1], ref);
  }
}

function buildTree(kind, v) {
  const spec = TREE[kind];
  const R = mulberry(hashS(kind) + v * 7919 + 17);
  const J = (a) => (R() - 0.5) * a;
  const T = new Acc(), Cr = new Acc();
  let blobs = [], height = 1.6, radius = 0.5, tr = spec.trunk;
  let o = { leaves: 400, seed: 100 + v * 31 + hashS(kind) % 97, tilt: 0.5 };
  const lean = [J(0.1), J(0.1)];
  if (kind === 'round' || kind === 'autumn' || kind === 'cherry') {
    const th = 0.52 + J(0.08);
    const cy = 0.98 + J(0.05);
    blobs.push([lean[0] + J(0.04), cy, lean[1] + J(0.04), 0.4]);
    const n = 5 + (v % 2);
    for (let i = 0; i < n; i++) {
      const a = i / n * PI * 2 + J(0.4) + v, rr = 0.28 + J(0.05);
      blobs.push([lean[0] + Math.cos(a) * rr, cy + J(0.2) - 0.05, lean[1] + Math.sin(a) * rr, 0.25 + J(0.04)]);
    }
    blobs.push([lean[0] + J(0.1), cy + 0.34, lean[1] + J(0.1), 0.26]);
    const trunkH = th + 0.42;
    const pts = makeTrunk(T, trunkH, kind === 'cherry' ? 0.1 : 0.11, lean, R, tr[0], tr[1]);
    const top = pts[3];
    for (let i = 0; i < 2; i++) { const b = blobs[1 + i * 2]; branch(T, new V(top.x * 0.8, trunkH * 0.82, top.z * 0.8), new V(b[0] * 0.55, b[1] - 0.12, b[2] * 0.55), 0.05, tr[0], tr[1]); }
    o.leaves = kind === 'cherry' ? 420 : 400;
  } else if (kind === 'tall') {
    const lx = lean[0], lz = lean[1];
    blobs = [[lx, 1.0, lz, 0.32, 1.6], [lx + 0.13, 0.78 + J(0.05), lz + 0.08, 0.23, 1.1], [lx - 0.13, 1.18 + J(0.05), lz - 0.1, 0.23, 1.1], [lx + J(0.06), 1.55, lz + J(0.06), 0.22, 1.5], [lx - 0.1, 0.74, lz - 0.1, 0.2]];
    const trunkH = 0.62;
    const pts = makeTrunk(T, trunkH, 0.1, lean, R, tr[0], tr[1]);
    branch(T, new V(pts[3].x * 0.9, trunkH * 0.8, pts[3].z * 0.9), new V(lx + 0.1, 0.9, lz + 0.06), 0.045, tr[0], tr[1]);
    o.leaves = 380;
  } else if (kind === 'pine' || kind === 'snowpine') {
    const w = 1 + J(0.06);
    blobs = [[0, 0.58, 0, 0.5 * w, { sy: 0.46 }], [0.0, 0.88, 0, 0.4 * w, { sy: 0.46 }], [0, 1.15, 0, 0.31 * w, { sy: 0.5 }], [0, 1.4, 0, 0.21 * w, { sy: 0.55 }], [0, 1.64, 0, 0.11 * w, { sy: 1.5 }]];
    makeTrunk(T, 0.5, 0.1, [0, 0], R, tr[0], tr[1]);
    o.leaves = 440; o.aspect = 1.7; o.tilt = 1.0; o.bend = 0.5; o.cover = 2.3;
    if (kind === 'snowpine') o.snow = true;
  } else if (kind === 'palm') {
    const lx = 0.14 + J(0.06), lz = J(0.1), th = 1.3;
    const pts = makeTrunk(T, th, 0.085, [lx, lz], R, tr[0], tr[1], { rings: true });
    const top = new V(lx, th, lz);
    const nf = 8 + (v % 2);
    for (let i = 0; i < nf; i++) frond(Cr, top.clone().addScaledVector(UP, 0.02), i / nf * PI * 2 + J(0.3), 0.62 + J(0.1), 0.085, spec.cols, 0.5 + J(0.25) + (i % 2) * 0.2, R);
    const nut = col('#7a4a2a'), nut2 = col('#9b6a3a');
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + v; ellipsoid(Cr, lx + Math.cos(a) * 0.07, th - 0.06, lz + Math.sin(a) * 0.07, 0.06, 0.065, 0.06, (x, y, z, nx, ny) => lerpC(nut, nut2, clamp(ny * 0.5 + 0.5))); }
    height = 1.75; radius = 0.62;
    return finish(T, Cr, height, radius, [], null);
  }
  const st = leafCloud(Cr, blobs, o);
  Cr.shade(st, spec.cols, spec.snow);
  height = Math.max(...blobs.map((b) => b[1] + b[3] * (typeof b[4] === 'number' ? b[4] : b[4]?.sy ?? 1)));
  radius = Math.max(...blobs.map((b) => Math.hypot(b[0], b[2]) + b[3]));
  return finish(T, Cr, height, radius, blobs, spec);
}
function finish(T, Cr, height, radius, blobs) {
  return { trunk: T.build(), crown: Cr.build(), height, radius, blobs };
}

const _tc = new Map();
/** Cached tree geometry. kind: round tall autumn pine snowpine palm cherry. trunk: use toonVC(); crown: use foliageMat(). */
export function treeGeo(kind = 'round', variant = 0) {
  const v = ((variant % 4) + 4) % 4, key = kind + v;
  let t = _tc.get(key);
  if (!t) { t = buildTree(TREE[kind] ? kind : 'round', v); _tc.set(key, t); }
  return t;
}

// ---------------------------------------------------------------------------
// Bushes, grass, flowers
// ---------------------------------------------------------------------------
const BUSH = {
  round: { cols: ['#3e9a55', '#86c64e', '#d2e35a'] },
  flower: { cols: ['#3e9a58', '#86c64e', '#cfe35a'] },
  hedge: { cols: ['#2f8a56', '#68b84e', '#b8d85a'] },
};
const FLOWER_COLS = ['#ff6f8e', '#ffd84d', '#fff4e4', '#b07ae0', '#ff9a3c'];
const _bc = new Map();
function buildBush(kind, v) {
  const R = mulberry(hashS(kind) * 3 + v * 977 + 5), J = (a) => (R() - 0.5) * a;
  const A = new Acc();
  if (kind === 'round' || kind === 'flower') {
    const blobs = [[J(0.05), 0.23, J(0.05), 0.27], [0.21 + J(0.05), 0.19, 0.07 + J(0.05), 0.2], [-0.21 + J(0.05), 0.19, -0.03 + J(0.05), 0.2], [0.03 + J(0.05), 0.35, -0.08, 0.17], [-0.06, 0.16, 0.2 + J(0.04), 0.16], [0.17, 0.16, -0.2, 0.17]];
    const st = leafCloud(A, blobs, { leaves: 210, seed: 40 + v, tilt: 0.5 });
    A.shade(st, BUSH.round.cols);
    if (kind === 'flower') {
      const c = FLOWER_COLS[v % FLOWER_COLS.length], c2 = FLOWER_COLS[(v + 2) % FLOWER_COLS.length];
      for (let i = 0; i < 6; i++) {
        const b = blobs[i % blobs.length], a = R() * PI * 2, e = 0.25 + R() * 0.65;
        const n = new V(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
        petalFlower(A, new V(b[0] + n.x * b[3] * 0.97, b[1] + n.y * b[3] * 0.97, b[2] + n.z * b[3] * 0.97), n.clone().add(new V(0, 0.4, 0.3)), 0.06 + R() * 0.02, i % 3 ? c : c2, R);
      }
    }
  } else if (kind === 'hedge') {
    const blobs = [];
    for (let i = 0; i < 5; i++) blobs.push([-0.36 + i * 0.18, 0.24 + J(0.03), J(0.03), 0.225 + J(0.015), { sx: 1.0, sy: 1.0, sz: 0.98 }]);
    blobs.push([-0.2, 0.2, 0, 0.2], [0.2, 0.2, 0, 0.2], [0, 0.18, 0, 0.21]);
    const st = leafCloud(A, blobs, { leaves: 300, seed: 60 + v, tilt: 0.45, core: 0.88 });
    A.shade(st, BUSH.hedge.cols);
  } else if (kind === 'grass') {
    grassClump(A, R, 52, 0.3, 0.26, 0.56, ['#9ac43e', '#cde050', '#f3f272'], 0.058);
  } else if (kind === 'succulent') {
    const cc = ['#3a9a86', '#64c4a0', '#c8f0c0'].map(col);
    const rings = [[5, 1.25, 0.15, 0.1], [8, 0.9, 0.2, 0.12], [11, 0.5, 0.25, 0.13], [13, 0.2, 0.26, 0.12]];
    rings.forEach(([n, el, L, W], ri) => {
      for (let i = 0; i < n; i++) {
        const a = i / n * PI * 2 + ri * 0.5 + J(0.15), e = el + J(0.1);
        const u = new V(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
        const f = new V(-Math.cos(a) * Math.sin(e), Math.cos(e), -Math.sin(a) * Math.sin(e));
        const tip = lerpC(cc[1], col('#f08aa6'), 0.25 + 0.2 * ri / 3);
        leafCard(A, new V(Math.cos(a) * 0.03, 0.04 + ri * 0.012, Math.sin(a) * 0.03), u, f, L * (0.9 + R() * 0.25), W, { cup: 0.8, bend: 0.1, c0: cc[ri % 2 ? 0 : 1], c1: { r: tip[0], g: tip[1], b: tip[2] }, nfn: (p) => f.clone().multiplyScalar(0.6).addScaledVector(UP, 0.4).normalize(), nmix: 1 });
      }
    });
  }
  return A.build();
}
/** Cached bush geometry. kind: round flower hedge grass succulent. Use with foliageMat(). */
export function bushGeo(kind = 'round', variant = 0) {
  const v = ((variant % 4) + 4) % 4, key = kind + v;
  let g = _bc.get(key);
  if (!g) { g = buildBush(kind, v); _bc.set(key, g); }
  return g;
}

const _gc = new Map();
/** Small lemon grass tuft (~0.2 tall). */
export function grassTuftGeo(variant = 0) {
  const v = ((variant % 4) + 4) % 4;
  let g = _gc.get(v);
  if (!g) { const A = new Acc(); grassClump(A, mulberry(900 + v * 13), 13, 0.07, 0.12, 0.25, ['#8fbd3e', '#c8de4e', '#eef070'], 0.036); g = A.build(); _gc.set(v, g); }
  return g;
}

const _fc = new Map();
/** One flower on a short stem with two leaves: ~0.3 tall, head ~0.18 across, round petals. */
export function flowerGeo(color = '#ff6f8e', variant = 0) {
  const v = ((variant % 4) + 4) % 4, key = color + v;
  let g = _fc.get(key);
  if (!g) {
    const R = mulberry(hashS(color) + v * 31), A = new Acc(), J = (a) => (R() - 0.5) * a;
    const h = 0.23 + v * 0.025 + J(0.03), lean = [J(0.05), 0.03 + J(0.04)];
    const sc = col('#4fa04a'), sc2 = col('#8cc850');
    addTube(A, [new V(0, 0, 0), new V(lean[0] * 0.4, h * 0.5, lean[1] * 0.4), new V(lean[0], h, lean[1])], (t) => 0.016 - 0.004 * t, 5, (x, y) => lerpC(sc, sc2, clamp(y / h)));
    for (let i = 0; i < 2; i++) {
      const a = i * PI + 0.6 + v;
      const u = new V(Math.cos(a) * 0.85, 0.5, Math.sin(a) * 0.85).normalize(), f = new V(-Math.cos(a) * 0.5, 0.85, -Math.sin(a) * 0.5).normalize();
      leafCard(A, new V(0, 0.015, 0), u, f, 0.13, 0.075, { cup: 0.5, bend: 0.5, c0: { r: sc.r, g: sc.g, b: sc.b }, c1: { r: sc2.r, g: sc2.g, b: sc2.b }, nfn: () => f, nmix: 1 });
    }
    petalFlower(A, new V(lean[0], h, lean[1]), new V(0.1 * (v - 1.5), 1, 0.45 + 0.1 * v), 0.092, color, R, 5 + (v % 2));
    g = A.build(); _fc.set(key, g);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Rocks
// ---------------------------------------------------------------------------
const _rc = new Map();
/** Smooth chunky rounded boulder, radius ~0.4, flat bottom at y=0. Vertex-coloured grey-lilac; moss (0..1) greens the top. */
export function rockGeo(variant = 0, moss = 0) {
  const v = ((variant % 4) + 4) % 4, key = v + '|' + moss;
  let out = _rc.get(key);
  if (out) return out;
  const R = mulberry(333 + v * 71), ph = [R() * 6, R() * 6, R() * 6, R() * 6];
  let g = new THREE.IcosahedronGeometry(1, 3);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  const pa = g.attributes.position;
  const sx = 1 + 0.15 * (v % 2), sz = 0.92 + 0.12 * (v >> 1);
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
    const bump = 1 + 0.1 * Math.sin(x * 2.1 + ph[0]) * Math.cos(z * 1.8 + ph[1]) + 0.07 * Math.sin(y * 3 + x * 1.4 + ph[2]) + 0.05 * Math.sin(z * 3.3 + y * 2 + ph[3]);
    let py = y * bump * 0.62;
    if (py < -0.18) py = -0.18 - (-0.18 - py) * 0.15; // squash the underside
    pa.setXYZ(i, x * bump * 0.4 * sx, Math.max(0, (py + 0.18) * 0.4), z * bump * 0.4 * sz);
  }
  g.computeVertexNormals();
  g = g.toNonIndexed();
  const dk = col('#8f8aa8'), lt = col('#cdc9dc'), mo = col('#86c458'), mo2 = col('#bcdc62');
  const A = new Acc();
  A.geo(g, (x, y, z, nx, ny, nz) => {
    const patch = 0.5 + 0.5 * Math.sin(x * 9 + ph[0]) * Math.sin(z * 8 + ph[1]);
    let c = lerpC(dk, lt, clamp(y / 0.3 * 0.6 + 0.25 + 0.15 * patch));
    if (moss > 0) {
      const k = sstep(0.55, 0.85, ny + (patch - 0.5) * 0.35 + (y - 0.15) * 0.4) * moss;
      c = lerpC({ r: c[0], g: c[1], b: c[2] }, y > 0.28 ? mo2 : mo, k);
    }
    return c;
  });
  out = A.build();
  _rc.set(key, out);
  return out;
}
