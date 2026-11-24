// Board construction methods, mixed into BoardView.prototype (`this` is the BoardView):
// floors, room walls, outer frame, coordinate labels, ground decor and room plaques.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { softMat } from './models.js';
import { prng, roundRect, makeCanvas, canvasTexture, FONT, measurePlaque, plaqueTexture, PLAQUE_PX } from './textures.js';
import { DEG, FRAME_W, FRAME_TOP, WALL_T, WALL_H, OUTDOOR, keyOf, noRaycast, roundedRectShape, extrudeSlab, boxAt } from './layout.js';

// ---------------------------------------------------------------------------------------------------------------
// Shared helpers: per-floor surface settings, shader macro variation / water, tinted geometry, lazy materials.
// ---------------------------------------------------------------------------------------------------------------
const FLOOR_ROUGH = { tile: 0.32, checker: 0.3, water: 0.26, wood: 0.55, stone: 0.78, brick: 0.8, snow: 0.7, sand: 0.95, grass: 0.96, carpet: 1, dirt: 0.95, fairway: 0.92, green: 0.85 };
const MACRO = { grass: 1, fairway: 0.8, green: 0.6, sand: 0.7, dirt: 0.8, snow: 0.5, wood: 0.25, stone: 0.35, brick: 0.2 };
const OUTWALL = new Set(['grass', 'sand', 'snow', 'dirt', 'water', 'fairway', 'green', 'stone']);
const CAP_COLS = ['#ef7466', '#35b5aa', '#8f5fab', '#f2bd45', '#5f9fe6'];

/** World-space macro colour variation (patches several cells wide) and the animated water look. */
function patchFloor(mat, floor, U) {
  const water = floor === 'water', K = (MACRO[floor] || 0).toFixed(3);
  if (!water && !MACRO[floor]) return;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWTime = U;
    sh.vertexShader = 'attribute float aEdge;\nvarying float vEdge;\nvarying vec3 vWP;\n'
      + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vEdge = aEdge;');
    const macro = `
  float mA = sin(vWP.x * 0.52 + 1.7 * sin(vWP.z * 0.31)) * sin(vWP.z * 0.47 + 1.3 * sin(vWP.x * 0.37 + 1.0));
  diffuseColor.rgb *= 1.0 + ${K} * 0.08 * mA;
  diffuseColor.rgb += ${K} * (max(mA, 0.0) * vec3(0.07, 0.05, -0.045) - max(-mA, 0.0) * vec3(0.045, 0.02, -0.04));`;
    const waterCode = `
  float rp = sin(vWP.x * 9.0 + uWTime * 1.6 + sin(vWP.z * 7.0 + uWTime)) * sin(vWP.z * 8.0 - uWTime * 1.3 + sin(vWP.x * 6.0 - uWTime * 0.7));
  float rq = sin(vWP.x * 4.0 - uWTime * 0.9 + sin(vWP.z * 3.0 + uWTime * 0.5)) * sin(vWP.z * 4.5 + uWTime * 0.8);
  diffuseColor.rgb *= 0.96 + 0.04 * rp;
  diffuseColor.rgb += smoothstep(0.6, 0.92, rp) * 0.09 + smoothstep(0.55, 0.9, rq) * 0.06;
  float we = clamp(vEdge, 0.0, 1.0);
  diffuseColor.rgb *= mix(vec3(1.2, 1.08, 0.96), vec3(0.8, 0.94, 1.02), smoothstep(0.0, 0.85, we));
  float wc = 0.17 + 0.05 * sin(uWTime * 1.1 + (vWP.x + vWP.z) * 2.0);
  float band = (1.0 - smoothstep(0.012, 0.045, abs(we - wc))) * (0.65 + 0.35 * sin((vWP.x - vWP.z) * 13.0 + uWTime * 0.9));
  float lap = 1.0 - smoothstep(0.0, 0.1, we);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97, 1.0, 0.98), clamp(max(band * 0.75, lap * 0.7), 0.0, 0.85));`;
    sh.fragmentShader = 'uniform float uWTime;\nvarying float vEdge;\nvarying vec3 vWP;\n'
      + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>' + (water ? waterCode : macro));
  };
  mat.customProgramCacheKey = () => (water ? 'floorWater2' : 'floorMacro' + K);
}

/** Add a constant vertex colour to a geometry (hex is sRGB). */
function tinted(g, hex, mul = 1) {
  if (g.index) g = g.toNonIndexed();
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r * mul; a[i * 3 + 1] = c.g * mul; a[i * 3 + 2] = c.b * mul; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function hashPair(a, b) { const s = a < b ? a + b : b + a; let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
const RBOX = new Map();
/** Cached unit-ish rounded box (indexed geometry, cloned per use). */
function rbox(w, h, d, rad, seg = 3) {
  const key = [w, h, d, rad, seg].join(',');
  let g = RBOX.get(key);
  if (!g) { g = new RoundedBoxGeometry(w, h, d, seg, Math.min(rad, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)); RBOX.set(key, g); }
  return g.clone();
}
function bkMats(view) {
  if (view._bk) return view._bk;
  const m = {
    wall: softMat({ color: '#ffffff', vertexColors: true, roughness: 0.72 }),
    kerb: softMat({ color: '#ffffff', vertexColors: true, roughness: 0.85 }),
    decor: softMat({ color: '#ffffff', vertexColors: true, roughness: 0.8 }),
    plaque: softMat({ color: '#6c4a82', roughness: 0.6, transparent: true, depthWrite: false }),
    plaqueTop: softMat({ color: '#6c4a82', roughness: 0.6, depthTest: false }),
  };
  for (const k of Object.keys(m)) m[k].userData.shared = true;
  view._bk = m;
  return m;
}
const DECOR = {};
function decorGeos() {
  if (DECOR.tuft) return DECOR;
  const blades = [];
  for (let k = 0; k < 4; k++) {
    const h = 0.075 + 0.02 * (k % 3), lean = 0.03 + 0.012 * k;
    const g = new THREE.ConeGeometry(0.02, h, 4, 2).translate(0, h / 2, 0);
    const p = g.attributes.position, col = [];
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i) / h;
      p.setX(i, p.getX(i) + lean * t * t);
      col.push(0.72 + 0.7 * t, 0.78 + 0.68 * t, 0.6 + 0.3 * t);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.rotateY(k * 1.7).translate(Math.cos(k * 2.1) * 0.014, 0, Math.sin(k * 2.1) * 0.014);
    blades.push(g);
  }
  DECOR.tuft = mergeGeometries(blades); blades.forEach((g) => g.dispose());
  const st = new THREE.CylinderGeometry(0.004, 0.006, 0.07, 5).translate(0, 0.035, 0);
  const lf = new THREE.SphereGeometry(0.02, 6, 4).scale(1.3, 0.3, 0.7).translate(0.02, 0.025, 0);
  DECOR.stem = mergeGeometries([tinted(st, '#ffffff'), tinted(lf, '#ffffff', 1.1)]);
  const petals = [];
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; petals.push(tinted(new THREE.SphereGeometry(0.014, 6, 4).scale(1, 0.55, 1).translate(Math.cos(a) * 0.016, 0, Math.sin(a) * 0.016), '#ffffff')); }
  DECOR.petal = mergeGeometries(petals).translate(0, 0.075, 0); petals.forEach((g) => g.dispose());
  DECOR.centre = tinted(new THREE.SphereGeometry(0.011, 6, 4).translate(0, 0.08, 0), '#ffffff');
  DECOR.pebble = tinted(new THREE.SphereGeometry(0.034, 8, 6).scale(1, 0.55, 0.8).translate(0, 0.006, 0), '#ffffff');
  DECOR.shell = tinted(new THREE.SphereGeometry(0.03, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 0.85), '#ffffff');
  DECOR.lump = tinted(new THREE.SphereGeometry(0.05, 8, 6).scale(1.3, 0.5, 1.1).translate(0, 0.004, 0), '#ffffff');
  return DECOR;
}

export const boardKit = {
  /** One merged floor mesh per room, world-space UVs (texture spans 2×2 cells), per-room tint/offset. */
  _buildFloors(board, roomAt, floorOf) {
    const N = this.N, half = N / 2;
    const tints = ['#ffffff', '#f2eeff', '#fff0dc', '#e9f6e6', '#ffe9f1', '#e8f1ff', '#fffad6'];
    const corner = (k, cr, cc) => [[cr - 1, cc - 1], [cr - 1, cc], [cr, cc - 1], [cr, cc]].every(([a, b]) => same(k, a, b));
    const keys = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const k = roomAt(r, c); if (!keys.includes(k)) keys.push(k); }
    const variant = new Map();
    const same = (k, r, c) => r >= 0 && c >= 0 && r < N && c < N && roomAt(r, c) === k;
    for (const k of keys) {
      const floor = floorOf(k);
      const v = variant.get(floor) || 0; variant.set(floor, v + 1);
      const ou = v, ov = (v * 3) % 2;
      const pos = [], nor = [], uv = [], idx = [], edge = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if (roomAt(r, c) !== k) continue;
        const x0 = c - half, z0 = r - half, n = pos.length / 3;
        const u0 = (c + ou) / 2, u1 = (c + 1 + ou) / 2, v0 = -(r + ov) / 2, v1 = -(r + 1 + ov) / 2;
        pos.push(x0, 0, z0, x0, 0, z0 + 1, x0 + 1, 0, z0 + 1, x0 + 1, 0, z0);
        nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
        uv.push(u0, v0, u0, v1, u1, v1, u1, v0);
        idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
        edge.push(corner(k, r, c) ? 1 : 0, corner(k, r + 1, c) ? 1 : 0, corner(k, r + 1, c + 1) ? 1 : 0, corner(k, r, c + 1) ? 1 : 0);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      const tint = new THREE.Color(tints[v % tints.length]);
      const mat = softMat({ color: tint, map: this._floorTexture(floor), roughness: FLOOR_ROUGH[floor] ?? 0.9 });
      patchFloor(mat, floor, this._timeU);
      const mesh = new THREE.Mesh(g, mat);
      mesh.receiveShadow = true;
      board.add(mesh);

      // Carpet rooms get a woven border along the room outline.
      if (floor === 'carpet') {
        const strips = { dark: [], light: [] };
        const quad = (arr, xa, za, xb, zb, y) => {
          const n = arr.length;
          arr.push([xa, y, za, xa, y, zb, xb, y, zb, xb, y, za]);
          return n;
        };
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          if (roomAt(r, c) !== k) continue;
          const x0 = c - half, z0 = r - half, x1 = x0 + 1, z1 = z0 + 1;
          const bN = !same(k, r - 1, c), bS = !same(k, r + 1, c), bW = !same(k, r, c - 1), bE = !same(k, r, c + 1);
          for (const [band, a, w, y] of [['dark', 0.07, 0.075, 0.0016], ['light', 0.165, 0.025, 0.002]]) {
            const ext = a + w;
            // start/end trims: convex corners trim to the inner band, concave corners extend into the neighbour.
            const sx = bW ? x0 + a : (same(k, r - 1, c - 1) || same(k, r + 1, c - 1) ? x0 : x0);
            if (bN) {
              const xs = bW ? x0 + a : (same(k, r - 1, c - 1) ? x0 - ext : x0) ;
              const xe = bE ? x1 - a : (same(k, r - 1, c + 1) ? x1 + ext : x1);
              quad(strips[band], Math.max(xs, -half), z0 + a, Math.min(xe, half), z0 + a + w, y);
            }
            if (bS) {
              const xs = bW ? x0 + a : (same(k, r + 1, c - 1) ? x0 - ext : x0);
              const xe = bE ? x1 - a : (same(k, r + 1, c + 1) ? x1 + ext : x1);
              quad(strips[band], Math.max(xs, -half), z1 - a - w, Math.min(xe, half), z1 - a, y);
            }
            if (bW) {
              const zs = bN ? z0 + a : (same(k, r - 1, c - 1) ? z0 - ext : z0);
              const ze = bS ? z1 - a : (same(k, r + 1, c - 1) ? z1 + ext : z1);
              quad(strips[band], x0 + a, Math.max(zs, -half), x0 + a + w, Math.min(ze, half), y);
            }
            if (bE) {
              const zs = bN ? z0 + a : (same(k, r - 1, c + 1) ? z0 - ext : z0);
              const ze = bS ? z1 - a : (same(k, r + 1, c + 1) ? z1 + ext : z1);
              quad(strips[band], x1 - a - w, Math.max(zs, -half), x1 - a, Math.min(ze, half), y);
            }
            void sx;
          }
        }
        for (const band of ['dark', 'light']) {
          const qs = strips[band];
          if (!qs.length) continue;
          const P = [], Nn = [], I = [];
          qs.forEach((q, i) => {
            // ensure upward winding regardless of corner order
            const [xa, y, za, , , zb, xb] = q;
            const X0 = Math.min(xa, xb), X1 = Math.max(xa, xb), Z0 = Math.min(za, zb), Z1 = Math.max(za, zb);
            P.push(X0, y, Z0, X0, y, Z1, X1, y, Z1, X1, y, Z0);
            Nn.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
            const n = i * 4; I.push(n, n + 1, n + 2, n, n + 2, n + 3);
          });
          const sg = new THREE.BufferGeometry();
          sg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
          sg.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
          sg.setIndex(I);
          const sm = new THREE.Mesh(sg, band === 'dark' ? this._mat.borderDark : this._mat.borderLight);
          sm.receiveShadow = true; sm.raycast = noRaycast;
          board.add(sm);
        }
      }
    }
  },

  /** Room walls: rounded cream plaster walls with a coloured cap (indoor), low kerb / hedge / log between outdoor rooms. Merged. */
  _buildWalls(board, roomAt) {
    const N = this.N, h = (N - 1) / 2;
    const T = WALL_T, L = 1 + T * 0.8;
    const info = this.puzzle?.roomInfo || {};
    const flo = (k) => info[k]?.floor || 'wood';
    const parts = [];
    const place = (g0, vertical, x, y, z, hex) => { const g = tinted(g0, hex); g.translate(x, y, z); parts.push(g); void vertical; };
    const add = (vertical, x, z, ka, kb) => {
      const fa = flo(ka), fb = flo(kb), A = vertical ? 1 : 0;
      const bx = (w, hh, d, rad, seg) => (A ? rbox(w, hh, d, rad, seg) : rbox(d, hh, w, rad, seg)); // w = thickness, d = length
      const hp = hashPair(ka, kb);
      if (OUTWALL.has(fa) && OUTWALL.has(fb)) {
        const grassy = (f) => f === 'grass' || f === 'fairway' || f === 'green';
        if (grassy(fa) && grassy(fb)) { // little hedge
          place(bx(0.15, 0.12, L, 0.055, 3), A, x, 0.058, z, '#5aa93c');
          for (let i = 0; i < 4; i++) {
            const o = -L / 2 + (i + 0.5) * L / 4;
            const s = new THREE.SphereGeometry(0.08, 8, 6).scale(1, 0.75, 1);
            place(s, A, A ? x : x + o, 0.115, A ? z + o : z, i % 2 ? '#7cc545' : '#8fd04e');
          }
        } else if (fa === 'dirt' || fb === 'dirt') { // log border
          const g = new THREE.CylinderGeometry(0.062, 0.062, L, 10);
          if (!A) g.rotateZ(Math.PI / 2); else g.rotateX(Math.PI / 2);
          place(g, A, x, 0.062, z, hp % 2 ? '#c08a5a' : '#b57a4c');
        } else { // pale rounded kerb
          place(bx(0.14, 0.11, L, 0.05, 3), A, x, 0.052, z, '#ecd9b4');
        }
        return;
      }
      place(bx(T, 0.125, L, 0.035, 3), A, x, 0.058, z, '#f6e8cd');
      place(bx(T + 0.034, 0.06, L + 0.03, 0.028, 3), A, x, WALL_H - 0.03, z, CAP_COLS[hp % CAP_COLS.length]);
    };
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const x = c - h, z = r - h;
        if (c + 1 < N && roomAt(r, c) !== roomAt(r, c + 1)) add(true, x + 0.5, z, roomAt(r, c), roomAt(r, c + 1));
        if (r + 1 < N && roomAt(r, c) !== roomAt(r + 1, c)) add(false, x, z + 0.5, roomAt(r, c), roomAt(r + 1, c));
      }
    }
    if (!parts.length) return;
    const g = mergeGeometries(parts);
    parts.forEach((q) => q.dispose());
    const m = new THREE.Mesh(g, bkMats(this).wall);
    m.castShadow = true; m.receiveShadow = true;
    board.add(m);
  },

  /** Wide rounded cream-beige paving kerb with a stepped, sloping foot that meets the world ground (y = -0.42). */
  _buildFrame(board) {
    const N = this.N, half = N / 2, F = FRAME_W;
    const group = new THREE.Group();
    const bottom = -0.5;
    const ring = (outerHalf, rad, top, bev, hex, tone = 1) => {
      const outer = roundedRectShape(outerHalf - bev, outerHalf - bev, rad);
      const hole = new THREE.Path(), hh = half + bev;
      hole.moveTo(-hh, -hh); hole.lineTo(hh, -hh); hole.lineTo(hh, hh); hole.lineTo(-hh, hh); hole.closePath();
      outer.holes.push(hole);
      return tinted(extrudeSlab(outer, top - bottom - 2 * bev, top, bev), hex, tone);
    };
    const body = mergeGeometries([
      ring(half + F + 0.26, 0.55, -0.27, 0.1, '#e2d0aa'),
      ring(half + F, 0.14, FRAME_TOP - 0.05, 0.05, '#eddcb8'),
    ]);
    const kerb = new THREE.Mesh(body, bkMats(this).kerb);
    kerb.castShadow = true; kerb.receiveShadow = true;
    group.add(kerb);
    // paving slabs on top: corner pieces plus ~1-cell pieces along each side, with thin joints
    const slabs = [], th = 0.075, y = FRAME_TOP - th / 2 - 0.004, gap = 0.028;
    const slab = (cx, cz, w, d, i) => slabs.push(tinted(rbox(w, th, d, 0.03, 3).translate(cx, y, cz), i % 2 ? '#f7edd4' : '#f3e7cb'));
    const mid = half + F / 2, m = Math.max(1, Math.round(N / 0.9)), step = N / m;
    let q = 0;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) slab(sx * mid, sz * mid, F - gap, F - gap, q++);
    for (let i = 0; i < m; i++) {
      const p = -half + (i + 0.5) * step, len = step - gap;
      slab(p, mid, len, F - gap, q++); slab(p, -mid, len, F - gap, q++);
      slab(mid, p, F - gap, len, q++); slab(-mid, p, F - gap, len, q++);
    }
    const sg = mergeGeometries(slabs); slabs.forEach((s) => s.dispose());
    const sm = new THREE.Mesh(sg, bkMats(this).kerb);
    sm.castShadow = true; sm.receiveShadow = true;
    group.add(sm);
    group.traverse((o) => { o.raycast = noRaycast; });
    board.add(group);
  },

  /** Chess-style coordinates on the kerb: letters a.. for columns (bottom + top), numbers 1.. for rows (left + right); row 1 is the north (far) row. */
  _buildCoordLabels(board) {
    const N = this.N, half = N / 2, y = FRAME_TOP + 0.06;
    const ls = this._labelSize = 0.3 * THREE.MathUtils.clamp(N / 9, 1, 1.8); // readable at 16x16
    const off = half + Math.max(FRAME_W / 2, ls / 2 + 0.04);
    // Room plaques lean back over the top edge; keep the top letters clear of them.
    const topOff = Math.max(off, half + 0.8 * (0.2 + 0.018 * N) + ls * 0.6);
    this._labelOff = off; this._labelTopOff = topOff;
    const group = new THREE.Group(); group.name = 'coords';
    const cache = new Map();
    const labelMat = (txt) => {
      if (!cache.has(txt)) {
        const cv = makeCanvas(96, 96), g = cv.getContext('2d');
        g.fillStyle = 'rgba(90,60,40,0.25)'; roundRect(g, 10, 14, 76, 76, 26); g.fill();
        g.fillStyle = '#c3a477'; roundRect(g, 10, 9, 76, 76, 26); g.fill();
        g.fillStyle = '#fff7e0'; roundRect(g, 14, 12, 68, 68, 22); g.fill();
        g.font = `bold 46px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = '#43285f'; g.fillText(txt, 48, 48);
        cache.set(txt, new THREE.SpriteMaterial({ map: canvasTexture(cv), transparent: true, depthWrite: false, toneMapped: false }));
      }
      return cache.get(txt);
    };
    const add = (txt, x, z) => {
      const s = new THREE.Sprite(labelMat(txt));
      s.scale.set(ls * 1.2, ls * 1.2, 1); s.position.set(x, y + (ls - 0.3) / 2, z); s.raycast = noRaycast; s.renderOrder = 5;
      group.add(s);
    };
    for (let i = 0; i < N; i++) {
      const pos = i - (N - 1) / 2;
      const letter = String.fromCharCode(97 + i), num = String(i + 1);
      add(letter, pos, off); add(letter, pos, -topOff);
      add(num, -off, pos); add(num, off, pos);
    }
    board.add(group);
  },

  /** Instanced chunky grass blades / round-petal flowers / smooth pebbles / shells / snow lumps along cell edges on outdoor floors. */
  _buildDecor(board, roomAt, floorOf, seed) {
    const N = this.N;
    const r = prng(seed || 1);
    const G = decorGeos();
    const tufts = [], stems = [], petals = [], centres = [], pebbles = [], shells = [], lumps = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), v = new THREE.Vector3();
    const mat = (x, y, z, sx, sy, sz, ry, rx = 0) => {
      q.setFromEuler(e.set(rx, ry, 0));
      return m4.compose(v.set(x, y, z), q, s.set(sx, sy, sz)).clone();
    };
    const grassCols = ['#6fb243', '#5aa63f', '#86c04a', '#4c9a3b'];
    const flowerCols = ['#ffffff', '#ffd23f', '#ff8fb8', '#b9a2ff', '#ff7a5c'];
    const shellCols = ['#ffd3d6', '#fff0dc', '#f6c39c', '#f0dcc4'];
    const stoneCols = ['#d7d0c6', '#c2bbb2', '#e6dfd2', '#cdbfc9'];
    const p = new THREE.Vector3();
    for (let rr = 0; rr < N; rr++) for (let cc = 0; cc < N; cc++) {
      const k = roomAt(rr, cc);
      const floor = floorOf(k);
      if (!OUTDOOR.has(floor) || this.objectsAt.has(keyOf(rr, cc))) continue;
      this._cellPos(rr, cc, p);
      const walled = (side) => {
        const [dr, dc] = [[-1, 0], [1, 0], [0, -1], [0, 1]][side];
        const r2 = rr + dr, c2 = cc + dc;
        return !this._inBoard(r2, c2) || roomAt(r2, c2) !== k;
      };
      const count = floor === 'grass' ? 3 + ((r() * 3) | 0) : 1 + ((r() * 2) | 0);
      for (let i = 0; i < count; i++) {
        const side = (r() * 4) | 0;
        const along = (r() - 0.5) * 0.8;
        const d = (walled(side) ? 0.12 : 0.05) + r() * 0.03;
        let lx, lz;
        if (side === 0) { lx = along; lz = -0.5 + d; } else if (side === 1) { lx = along; lz = 0.5 - d; }
        else if (side === 2) { lx = -0.5 + d; lz = along; } else { lx = 0.5 - d; lz = along; }
        const X = p.x + lx, Z = p.z + lz, ry = r() * Math.PI * 2;
        if (floor === 'grass') {
          const kind = r();
          if (kind < 0.85) {
            const sc = 0.9 + r() * 0.5;
            tufts.push({ m: mat(X, 0, Z, sc, sc, sc, ry), c: grassCols[(r() * grassCols.length) | 0] });
            if (kind > 0.6) {
              const fc = flowerCols[(r() * flowerCols.length) | 0];
              stems.push({ m: mat(X + 0.03, 0, Z, 1, 1, 1, ry), c: '#6fb843' });
              petals.push({ m: mat(X + 0.03, 0, Z, 1, 1, 1, ry), c: fc });
              centres.push({ m: mat(X + 0.03, 0, Z, 1, 1, 1, ry), c: fc === '#ffd23f' ? '#ff9a2e' : '#ffd23f' });
            }
          } else {
            const sc = 0.7 + r() * 0.6;
            pebbles.push({ m: mat(X, 0, Z, sc, sc, sc, ry), c: stoneCols[(r() * stoneCols.length) | 0] });
          }
        } else if (floor === 'sand') {
          if (r() < 0.25) tufts.push({ m: mat(X, 0, Z, 0.8, 1.1, 0.8, ry), c: '#a9bd52' });
          else if (r() < 0.5) { const sc = 0.6 + r() * 0.4; pebbles.push({ m: mat(X, 0, Z, sc, sc, sc, ry), c: shellCols[(r() * shellCols.length) | 0] }); }
          else { const sc = 0.9 + r() * 0.5; shells.push({ m: mat(X, 0, Z, sc, sc, sc, ry), c: shellCols[(r() * shellCols.length) | 0] }); }
        } else { // snow
          const sc = 1 + r() * 0.8;
          lumps.push({ m: mat(X, -0.008, Z, sc, sc, sc * 0.95, ry), c: r() < 0.7 ? '#ffffff' : '#e2ebff' });
        }
      }
    }
    const col = new THREE.Color(), M = bkMats(this);
    for (const [list, geo, material] of [[tufts, G.tuft, this._mat.decorWind], [stems, G.stem, M.decor], [petals, G.petal, M.decor], [centres, G.centre, M.decor],
      [pebbles, G.pebble, M.decor], [shells, G.shell, M.decor], [lumps, G.lump, M.decor]]) {
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(geo, material, list.length);
      list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, col.set(it.c)); });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.receiveShadow = true; im.castShadow = false; im.raycast = noRaycast;
      board.add(im);
    }
  },

  /**
   * Room name plaques — same lettering size everywhere. Picks the room row-run (top rows first) that is long
   * enough and free of tall objects; otherwise the plaque stands raised on the room's north wall and renders on top.
   */
  _buildPlaques(board, rooms, roomAt, info) {
    const N = this.N, half = N / 2, hc = (N - 1) / 2;
    this._plaqueH = 0.2 + 0.018 * N;
    const hAt = (r, c) => this.objectsAt.get(keyOf(r, c))?.height ?? 0;
    // blocked: something taller than a rug in the cell, or a tall object right behind (it would overhang the plaque)
    const tall = (r, c) => hAt(r, c) > 0.08 || (r > 0 && hAt(r - 1, c) > 0.3);
    const placed = [];
    this._plaques = [];
    const overlaps = (x0, x1, z, y) => placed.some((q) => Math.abs(q.z - z) < 0.5 && Math.abs(q.y - y) < this._plaqueH + 0.06
      && x0 < q.x1 + 0.06 && x1 > q.x0 - 0.06);
    const keys = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const k = roomAt(r, c); if (!keys.includes(k)) keys.push(k); }
    for (const k of keys) {
      const name = String(info[k]?.name || k);
      const W = this._plaqueH * measurePlaque(name);
      // Row runs of this room, split at tall objects.
      const runs = [];
      let topRow = -1;
      for (let r = 0; r < N; r++) {
        let c = 0;
        while (c < N) {
          if (roomAt(r, c) !== k) { c++; continue; }
          if (topRow < 0) topRow = r;
          let a = c;
          while (c < N && roomAt(r, c) === k) {
            if (tall(r, c)) { if (c > a) runs.push({ r, a, b: c }); a = c + 1; }
            c++;
          }
          if (c > a) runs.push({ r, a, b: c });
        }
      }
      runs.sort((p, q) => (p.r - q.r) || ((q.b - q.a) - (p.b - p.a)) || (p.a - q.a));
      let spot = null;
      for (const run of runs) {
        const len = run.b - run.a;
        if (len - 0.14 < W) continue;
        const left = run.a - half;
        const zEdge = run.r - half;
        // Centre short runs, otherwise sit near the run's left end.
        const x0 = len <= 2 ? left + (len - W) / 2 : left + 0.1;
        const y = 0.21, z = zEdge + 0.01;
        if (overlaps(x0, x0 + W, z, y)) continue;
        spot = { x0, y, z, onTop: false, row: run.r };
        break;
      }
      if (!spot) {
        // Fallback: stand raised on the room's north wall above the longest top-row stretch.
        let best = null;
        for (let c = 0; c < N; c++) {
          if (roomAt(topRow, c) !== k) continue;
          let b = c; while (b < N && roomAt(topRow, b) === k) b++;
          if (!best || b - c > best.b - best.a) best = { a: c, b };
          c = b;
        }
        const mid = (best.a + best.b) / 2 - half;
        let x0 = THREE.MathUtils.clamp(mid - W / 2, -half - FRAME_W * 0.5, half + FRAME_W * 0.5 - W);
        let y = 0.5;
        const z = topRow - half + 0.02;
        for (let tries = 0; tries < 6 && overlaps(x0, x0 + W, z, y); tries++) y += this._plaqueH + 0.1;
        spot = { x0, y, z, onTop: true };
      }
      placed.push({ x0: spot.x0, x1: spot.x0 + W, z: spot.z, y: spot.y });
      const g = this._makePlaque(name, W, spot);
      board.add(g);
      if (!spot.onTop) {
        // cells whose standing tokens would hide this plaque (same row, under its x-range)
        const cells = [];
        for (let c = 0; c < N; c++) if (c - half + 1 > spot.x0 && c - half < spot.x0 + W) cells.push(keyOf(spot.row, c));
        this._plaques.push({ g, cells, baseY: spot.y, lift: 0, target: 0 });
      }
    }
    void hc; void rooms;
  },

  _makePlaque(name, W, { x0, y, z, onTop }) {
    const H = this._plaqueH;
    const tex = plaqueTexture(name, W / H);
    tex.anisotropy = this._maxAniso;
    const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, toneMapped: false, depthTest: !onTop, depthWrite: false });
    const plaque = new THREE.Group();
    const tilt = new THREE.Group();
    tilt.rotation.x = -0.92; // lean back so it faces the default camera (and covers less of the cell below)
    plaque.add(tilt);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), faceMat);
    face.position.set(0, H / 2, 0.013);
    tilt.add(face);
    const backMat = onTop ? bkMats(this).plaqueTop : bkMats(this).plaque;
    const back = new THREE.Mesh(rbox(W - 0.02, H - 0.02, 0.03, 0.012, 2).translate(0, H / 2, 0), backMat);
    back.castShadow = !onTop;
    tilt.add(back);
    // little posts down to the floor / wall
    const postH = onTop ? y - WALL_H + 0.03 : y + 0.03;
    if (postH > 0.02) {
      for (const px of [-W / 2 + 0.08, W / 2 - 0.08]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, postH, 8).translate(0, -postH / 2 + 0.03, 0), backMat);
        post.position.set(px, 0, -0.01);
        post.castShadow = !onTop;
        plaque.add(post);
        (plaque.userData.posts ||= []).push(post);
      }
    }
    if (onTop) {
      back.renderOrder = 30; face.renderOrder = 31;
      plaque.traverse((o) => { if (o.isMesh && o !== face && o !== back) o.renderOrder = 30; });
    } else {
      back.renderOrder = 0.5; face.renderOrder = 0.6;
      plaque.traverse((o) => { if (o.isMesh && o !== face && o !== back) o.renderOrder = 0.5; });
    }
    plaque.position.set(x0 + W / 2, y, z);
    plaque.traverse((o) => { o.raycast = noRaycast; });
    return plaque;
  },
};
