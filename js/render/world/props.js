// Reusable toy props and cheap life (traffic, butterflies, birds, drifting leaves) for the world themes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { softMat, toon, toonVC, RB, BOX, CYL, SPH, CONE, ICO } from '../models/kit.js';
import { GY, PAL, lerpHex } from './ctx.js';

const rot2 = (lx, lz, ry) => { const c = Math.cos(ry), s = Math.sin(ry); return [lx * c + lz * s, -lx * s + lz * c]; };

/** Chunky lamp post with glowing lantern; returns the lantern position. */
export function lamp(ctx, x, z, { h = 1.45, color = PAL.teal, spot = false } = {}) {
  ctx.cyl(x, GY, z, 0.2, 0.24, 0.14, lerpHex(color, '#ffffff', 0.15), { seg: 12 });
  ctx.cyl(x, GY + 0.1, z, 0.075, 0.1, h - 0.1, color, { seg: 10 });
  ctx.cyl(x, GY + h - 0.12, z, 0.13, 0.09, 0.1, color, { seg: 10 });
  ctx.glow('lamp', SPH(0.19, 10, 8), x, GY + h + 0.07, z);
  ctx.cone(x, GY + h + 0.2, z, 0.2, 0.14, lerpHex(color, '#1e5f6a', 0.4), { seg: 10 });
  if (!ctx.isNear(x, z)) ctx.blob(x + 0.2, z - 0.15, 0.3, 0.35, 0.5);
  if (spot) ctx.lampSpots.push(new THREE.Vector3(x, h - 0.1, z));
}
/** Four lamps just outside the kerb corners (lamp posts, lanterns or flood lights per theme). */
export function cornerLamps(ctx, fn = lamp, off = 1.25) {
  const H = ctx.H + off;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) fn(ctx, sx * H, sz * H, { spot: true });
}
export function bench(ctx, x, z, ry = 0, color = PAL.wood) {
  const P = (lx, lz) => { const [a, b] = rot2(lx, lz, ry); return [x + a, z + b]; };
  let [a, b] = P(0, 0); ctx.box(a, GY + 0.22, b, 0.95, 0.07, 0.32, color, { ry, r: 0.03 });
  [a, b] = P(0, -0.15); ctx.box(a, GY + 0.3, b, 0.95, 0.3, 0.06, color, { ry, rot: [-0.2, 0, 0], r: 0.03 });
  for (const sx of [-0.38, 0.38]) { [a, b] = P(sx, 0); ctx.box(a, GY, b, 0.08, 0.24, 0.3, PAL.tealD, { ry, r: 0.03 }); }
}
export function bin(ctx, x, z, color = PAL.wood) {
  ctx.cyl(x, GY, z, 0.2, 0.17, 0.42, color, { seg: 10 }); ctx.cyl(x, GY + 0.28, z, 0.205, 0.205, 0.07, PAL.tealD, { seg: 10 });
  ctx.cyl(x, GY + 0.4, z, 0.2, 0.2, 0.05, PAL.tealD, { seg: 10 });
}
export function planter(ctx, x, z, ry = 0, w = 0.7) {
  ctx.box(x, GY, z, w, 0.3, 0.5, '#e9d2a8', { ry, r: 0.06 });
  const [a, b] = rot2(w * 0.25, 0, ry);
  ctx.sph(x, GY + 0.42, z, 0.27, '#7fb040', { top: '#c3d956', s: [1.3, 0.8, 1] , ry});
  for (let i = 0; i < 3; i++) ctx.sph(x + (i - 1) * 0.2 * Math.cos(ry), GY + 0.6, z - (i - 1) * 0.2 * Math.sin(ry), 0.07, ctx.pick([PAL.coral, PAL.sun, '#ff9ec0']), { hs: 5, ws: 6 });
}
export function crate(ctx, x, z, ry = 0, s = 0.45, color = PAL.wood) {
  ctx.box(x, GY, z, s, s, s, color, { ry, r: 0.04 });
  ctx.box(x, GY + s * 0.46, z, s * 1.02, 0.05, s * 1.02, PAL.woodD, { ry, r: 0.02 });
}
export function hedgeRow(ctx, x0, z0, x1, z1, h = 0.55) {
  const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  ctx.box(mx, GY, mz, L, h, 0.5, '#5f9a3a', { ry, r: 0.2, top: '#b8d950' });
  const n = Math.round(L / 0.7);
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n - 0.5; ctx.sph(mx + Math.cos(ry) * L * t, GY + h, mz - Math.sin(ry) * L * t, 0.22, '#9ccb48', { s: [1.2, 0.7, 1], ws: 7, hs: 5, top: '#c9e05a' }); }
}
export function fence(ctx, x0, z0, x1, z1, color = PAL.wood, h = 0.5) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 0.8)), ry = Math.atan2(-(z1 - z0), x1 - x0);
  for (let i = 0; i <= n; i++) { const t = i / n; ctx.cyl(x0 + (x1 - x0) * t, GY, z0 + (z1 - z0) * t, 0.06, 0.07, h, color, { seg: 6 }); }
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  ctx.box(mx, GY + h * 0.55, mz, L, 0.07, 0.05, color, { ry }); ctx.box(mx, GY + h * 0.22, mz, L, 0.07, 0.05, color, { ry });
}

/**
 * Toy building. kind 'house' | 'shop'. Local front is +z; ry rotates it.
 * o: w d h wall roof ry awning(colour) barrel(bool) tall chimney
 */
export function house(ctx, x, z, o = {}) {
  const { w = 2.2, d = 1.9, h = 1.5, ry = 0, wall = '#f3d9a8', roof = '#d9694f', awning = null, barrel = false, chimney = true, shop = false, glow = true } = o;
  const P = (lx, lz) => { const [a, b] = rot2(lx, lz, ry); return [x + a, z + b]; };
  const part = (lx, y0, lz, bw, bh, bd, c, op = {}) => { const [a, b] = P(lx, lz); ctx.box(a, y0, b, bw, bh, bd, c, { ry, ...op }); };
  ctx.claim(x, z, Math.max(w, d) * 0.75);
  part(0, GY, 0, w + 0.08, 0.16, d + 0.08, lerpHex(wall, '#8b7aa0', 0.45), { plain: true });
  part(0, GY + 0.1, 0, w, h, d, wall, { r: 0.1, top: lerpHex(wall, '#ffffff', 0.25) });
  const top = GY + 0.1 + h;
  if (barrel) {
    const [a, b] = P(0, 0);
    ctx.p(CYL(1, 1, w + 0.25, 14), a, top + 0.02, b, roof, { rot: [0, 0, Math.PI / 2], ry, s: [0.55, 1, d / 2 + 0.12], top: lerpHex(roof, '#ffd9a8', 0.3) });
  } else {
    const [a, b] = P(0, 0);
    part(0, top - 0.02, 0, w + 0.3, 0.1, d + 0.3, lerpHex(roof, '#ffffff', 0.15), { plain: true });
    ctx.p(CONE(0.7, 0.7, 4), a, top + 0.08 + 0.4 * (h > 1.3 ? 1 : 0.8), b, roof, { ry: ry + Math.PI / 4, s: [(w + 0.2) / 0.99, (h > 1.3 ? 1.1 : 0.9) * 0.72, (d + 0.2) / 0.99], top: lerpHex(roof, '#ffd9a8', 0.3) });
    if (chimney) { const [c, e] = P(w * 0.25, -d * 0.2); ctx.box(c, top, e, 0.26, 0.85, 0.26, '#e8c7a0', { ry, plain: true }); ctx.box(c, top + 0.85, e, 0.34, 0.09, 0.34, '#c9a77f', { ry }); }
  }
  const fz = d / 2 + 0.015;
  const wy = GY + (shop ? 0.2 : 0.55);
  if (glow) {
    if (shop) {
      const sw = w * 0.62;
      const [a, b] = P(-w * 0.14, fz); ctx.box(a, wy - 0.05, b, sw + 0.14, 0.85, 0.03, '#fff3dc', { ry, r: 0.02, grad: 0 });
      const [gx, gz] = P(-w * 0.14, fz + 0.012); ctx.glow('win', BOX(sw, 0.72, 0.05), gx, wy + 0.36, gz, { ry });
      const [dx, dz] = P(w * 0.33, fz); ctx.box(dx, GY + 0.1, dz, 0.42, 0.85, 0.05, PAL.teal, { ry, r: 0.03 });
      if (h > 1.2) for (const sx of [-0.28, 0.28]) { const [a2, b2] = P(sx * w, fz); ctx.gbox('win', a2, GY + 0.1 + h * 0.62, b2, 0.4, 0.42, 0.05, { ry }); }
    } else {
      const cols = Math.max(1, Math.round(w / 1.0));
      for (let i = 0; i < cols; i++) {
        const lx = (i - (cols - 1) / 2) * (w / cols) * (cols > 1 ? 1 : 0) - (cols === 1 ? w * 0.18 : 0);
        const [a, b] = P(lx, fz);
        ctx.box(a, wy - 0.05, b, 0.5, 0.56, 0.03, '#fff3dc', { ry, r: 0.02, grad: 0 });
        const [c, e] = P(lx, fz + 0.012); ctx.glow('win', BOX(0.38, 0.44, 0.04), c, wy + 0.22, e, { ry });
        if (h > 1.3) { const [c2, e2] = P(lx, fz + 0.012); ctx.glow('win', BOX(0.38, 0.44, 0.04), c2, wy + 0.22 + 0.7, e2, { ry }); }
      }
      const [dx, dz] = P(cols === 1 ? w * 0.3 : 0, fz); ctx.box(dx, GY + 0.1, dz, 0.38, 0.72, 0.05, PAL.woodD, { ry, r: 0.03 });
    }
    // side windows
    for (const sx of [-1, 1]) { const [a, b] = P(sx * (w / 2 + 0.012), 0); ctx.glow('win', BOX(0.04, 0.44, 0.44), a, GY + 0.1 + h * 0.5, b, { ry }); }
  }
  if (awning) {
    const aw = w * 0.74, n = 5, sw = aw / n, ax = -w * 0.14;
    for (let i = 0; i < n; i++) { const [a, b] = P(ax + (i - (n - 1) / 2) * sw, fz + 0.3); ctx.box(a, GY + 1.0, b, sw, 0.06, 0.62, i % 2 ? '#fff3dc' : awning, { ry, rot: [0.45, 0, 0], r: 0.02, grad: 0 }); }
    const [a, b] = P(ax, fz + 0.02); ctx.gbox('sign', a, GY + h * 0.78 + 0.12, b, aw * 0.7, 0.2, 0.05, { ry });
  }
}

// ---- toy cars --------------------------------------------------------------------------------------------------------------
function carParts(kind) {
  const P = [], add = (g, x, y, z, c, o = {}) => P.push({ g, x, y, z, c, o });
  const van = kind === 'van';
  const L = van ? 1.75 : 1.5;
  add(RB(0.8, 0.36, L, 0.16, 2), 0, 0.31, 0, '#ffffff');
  if (van) { add(RB(0.78, 0.5, 1.1, 0.14, 2), 0, 0.64, -0.28, '#ffffff'); add(RB(0.7, 0.28, 0.1, 0.06, 1), 0, 0.68, 0.3, '#b8def0'); }
  else { add(RB(0.68, 0.3, 0.82, 0.13, 2), 0, 0.6, -0.08, '#f4f0ff'); add(RB(0.7, 0.2, 0.7, 0.08, 1), 0, 0.63, -0.08, '#b8def0'); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(CYL(0.17, 0.17, 0.13, 10), sx * 0.4, 0.17, sz * (L / 2 - 0.3), '#3b3550', { rot: [0, 0, Math.PI / 2] });
  for (const sx of [-1, 1]) { add(SPH(0.075, 6, 5), sx * 0.26, 0.34, L / 2, '#fff3c8'); add(SPH(0.06, 6, 5), sx * 0.27, 0.34, -L / 2, '#ee6a5a'); }
  add(RB(0.84, 0.06, 0.5, 0.03, 1), 0, 0.2, L / 2 - 0.2, '#e8e0f0');
  return P;
}
const _G = {};
function carGeo(kind) {
  if (_G[kind]) return _G[kind];
  const gs = carParts(kind).map(({ g, x, y, z, c, o }) => {
    let q = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k);
    if (o.rot) q.rotateX(o.rot[0]).rotateY(o.rot[1]).rotateZ(o.rot[2]);
    q.translate(x, y, z);
    const col = new THREE.Color(c), a = new Float32Array(q.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) { a[i] = col.r; a[i + 1] = col.g; a[i + 2] = col.b; }
    q.setAttribute('color', new THREE.BufferAttribute(a, 3)); return q;
  });
  return (_G[kind] = mergeGeometries(gs));
}
const TINTS = ['#ee6a5a', '#f6c445', '#3fb4a8', '#6fb6e8', '#b678c8', '#f59a5a', '#9ad25a'];

/** Cars: movers (driving back and forth along a line) and parked ones, with smoke puffs behind movers. */
export function traffic(ctx) {
  const movers = [], parked = [];
  const T = {
    mover(kind, axis, fixed, dir, speed, lo, hi, tint) { movers.push({ kind, axis, fixed, dir, speed, lo, hi, ph: ctx.r() * (hi - lo), tint: tint || ctx.pick(TINTS) }); },
    parked(kind, x, z, ry, tint) { parked.push({ kind, x, z, ry, tint: tint || ctx.pick(TINTS) }); ctx.blob(x + 0.2, z - 0.15, 0.8, 0.55, 0.7); },
    finish() {
      const mat = toonVC(), G = ctx.group;
      const kinds = ['car', 'van'], mm = new THREE.Matrix4();
      const all = [];
      for (const k of kinds) {
        const mv = movers.filter((m) => m.kind === k), pk = parked.filter((m) => m.kind === k), n = mv.length + pk.length;
        if (!n) continue;
        const im = new THREE.InstancedMesh(carGeo(k), mat, n); const c = new THREE.Color();
        const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
        pk.forEach((p, i) => { q.setFromEuler(e.set(0, p.ry, 0)); mm.compose(v.set(p.x, GY, p.z), q, sc); im.setMatrixAt(mv.length + i, mm); im.setColorAt(mv.length + i, c.set(p.tint)); });
        mv.forEach((m, i) => im.setColorAt(i, c.set(m.tint)));
        im.instanceColor.needsUpdate = true; im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true; G.add(im);
        all.push({ im, mv });
      }
      const nm = movers.length;
      if (!nm) return;
      const pn = nm * 3, puffs = new THREE.InstancedMesh(SPH(0.5, 8, 6), toon('#fff6e6'), pn);
      puffs.frustumCulled = false; puffs.castShadow = false; G.add(puffs);
      const m4 = new THREE.Matrix4(), e = m4.elements;
      ctx.anims.push((t) => {
        let pi = 0;
        for (const { im, mv } of all) {
          for (let i = 0; i < mv.length; i++) {
            const m = mv[i], len = m.hi - m.lo, s = ((t * m.speed + m.ph) % len + len) % len, pos = m.dir > 0 ? m.lo + s : m.hi - s;
            const x = m.axis === 'x' ? pos : m.fixed, z = m.axis === 'x' ? m.fixed : pos;
            const ry = m.axis === 'x' ? (m.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (m.dir > 0 ? 0 : Math.PI);
            m4.makeRotationY(ry); e[12] = x; e[13] = GY + 0.012 * Math.sin(t * 11 + m.ph); e[14] = z;
            im.setMatrixAt(i, m4);
            const bx = m.axis === 'x' ? -m.dir : 0, bz = m.axis === 'x' ? 0 : -m.dir;
            for (let k = 0; k < 3; k++) {
              const ph = (t * 0.6 + k / 3 + m.ph * 0.37) % 1, sz = 0.07 + ph * 0.26 * (1 - ph * 0.45);
              m4.makeScale(sz, sz * 0.9, sz);
              const back = 0.95 + ph * 1.3; e[12] = x + bx * back; e[13] = GY + 0.28 + ph * 0.55; e[14] = z + bz * back;
              puffs.setMatrixAt(pi++, m4);
            }
          }
          im.instanceMatrix.needsUpdate = true;
        }
        puffs.instanceMatrix.needsUpdate = true;
      });
    },
  };
  return T;
}

// ---- fliers / drifters ---------------------------------------------------------------------------------------------------------
function wingGeo(bird) {
  const g = new THREE.BufferGeometry(), s = bird ? 0.55 : 0.2;
  const v = bird ? [0, 0, -0.35, -1, 0.1, 0.2, 0, 0, 0.15, 0, 0, -0.35, 0, 0, 0.15, 1, 0.1, 0.2]
    : [0, 0, 0.06, -1, 0, -0.5, -0.8, 0, 0.55, 0, 0, 0.06, 0.8, 0, 0.55, 1, 0, -0.5];
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v.map((n, i) => n * (i % 3 === 1 ? 1 : s))), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
  return g;
}
/** Wandering butterflies (kind 'bf') or circling birds (kind 'bird'). pts: anchor centres [x,z] */
export function fliers(ctx, kind, pts, colors, { rad = 1.4, h = 0.9, speed = 1 } = {}) {
  const n = pts.length, bird = kind === 'bird';
  const mat = softMat({ side: THREE.DoubleSide, roughness: 0.7 });
  const im = new THREE.InstancedMesh(wingGeo(bird), mat, n), c = new THREE.Color();
  const A = pts.map(([x, z], i) => ({ x, z, ph: ctx.r() * 6.28, a: 0.5 + ctx.r() * 0.5, b: 0.4 + ctx.r() * 0.5, R: rad * (0.6 + ctx.r() * 0.6), h: h * (0.8 + ctx.r() * 0.5), sp: 0.7 + ctx.r() * 0.6 }));
  A.forEach((o, i) => im.setColorAt(i, c.set(colors[i % colors.length])));
  im.frustumCulled = false; im.castShadow = false; ctx.group.add(im);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  ctx.anims.push((t) => {
    for (let i = 0; i < n; i++) {
      const o = A[i], w = t * speed * o.sp;
      let x, z, y, vx, vz;
      if (bird) { x = o.x + Math.cos(w * 0.35 + o.ph) * o.R; z = o.z + Math.sin(w * 0.35 + o.ph) * o.R; vx = -Math.sin(w * 0.35 + o.ph); vz = Math.cos(w * 0.35 + o.ph); y = GY + o.h + Math.sin(w * 0.5) * 0.3; }
      else { x = o.x + Math.sin(w * o.a + o.ph) * o.R; z = o.z + Math.cos(w * o.b + o.ph * 1.7) * o.R; vx = Math.cos(w * o.a + o.ph) * o.a; vz = -Math.sin(w * o.b + o.ph * 1.7) * o.b; y = GY + o.h + Math.sin(w * 1.3 + o.ph) * 0.25; }
      const flap = bird ? 0.55 + 0.45 * Math.sin(t * 5 + o.ph * 3) : 0.25 + 0.75 * Math.abs(Math.sin(t * 14 + o.ph * 5));
      e.set(bird ? 0.1 : 0.25 * Math.sin(w), Math.atan2(vx, vz) + Math.PI, bird ? -0.25 : 0); q.setFromEuler(e);
      m4.compose(v.set(x, y, z), q, s.set(flap, 1, 1)); im.setMatrixAt(i, m4);
    }
    im.instanceMatrix.needsUpdate = true;
  });
  ctx.moodFns.push((name) => { im.visible = bird || name !== 'night'; });
  return im;
}
/** Falling leaves / petals / flakes outside the board. */
export function drifters(ctx, n, colors, { size = 0.14, fall = 0.35, top = 4, area = 16, sway = 0.6 } = {}) {
  const q = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mat = softMat({ side: THREE.DoubleSide, roughness: 0.8 });
  const im = new THREE.InstancedMesh(q, mat, n), c = new THREE.Color(), A = [];
  const H = ctx.H;
  for (let i = 0; i < n; i++) {
    let x, z, g = 0;
    do { x = (ctx.r() * 2 - 1) * (H + area); z = (ctx.r() * 2 - 1) * (H + area); } while (g++ < 20 && ctx.dBoard(x, z) < 2.4);
    A.push({ x, z, y: ctx.r() * top, ph: ctx.r() * 6.28, f: fall * (0.7 + ctx.r() * 0.6), sp: 1 + ctx.r() * 2 });
    im.setColorAt(i, c.set(colors[i % colors.length]));
  }
  im.frustumCulled = false; ctx.group.add(im);
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(size, size, size * 1.5);
  ctx.anims.push((t) => {
    for (let i = 0; i < n; i++) {
      const o = A[i], y = top - (((t * o.f + o.y) % top) + top) % top;
      e.set(Math.sin(t * o.sp + o.ph) * 1.0, t * o.sp * 0.7 + o.ph, Math.cos(t * o.sp + o.ph) * 0.8); qq.setFromEuler(e);
      m4.compose(v.set(o.x + Math.sin(t * 0.6 + o.ph) * sway, GY + y, o.z + Math.cos(t * 0.5 + o.ph) * sway), qq, s); im.setMatrixAt(i, m4);
    }
    im.instanceMatrix.needsUpdate = true;
  });
  return im;
}

/** Local frame: place parts relative to (x,z) rotated by ry (front = local +z). */
export function frame(ctx, x, z, ry = 0, k = 1) {
  const co = Math.cos(ry), si = Math.sin(ry), T = (lx, lz) => [x + lx * k * co + lz * k * si, z - lx * k * si + lz * k * co];
  const Y = (y) => GY + (y - GY) * k;
  return {
    T, x, z, ry, k,
    p(geo, lx, y, lz, col, o = {}) { const [a, b] = T(lx, lz); ctx.p(geo, a, Y(y), b, col, { ry, ...o, s: o.s ? (Array.isArray(o.s) ? o.s.map((v) => v * k) : o.s * k) : (k === 1 ? undefined : k) }); },
    box(lx, y0, lz, w, h, d, col, o = {}) { const [a, b] = T(lx, lz); ctx.box(a, Y(y0), b, w * k, h * k, d * k, col, { ry, ...o }); },
    cyl(lx, y0, lz, rt, rb, h, col, o = {}) { const [a, b] = T(lx, lz); ctx.cyl(a, Y(y0), b, rt * k, rb * k, h * k, col, { ry, ...o }); },
    sph(lx, yc, lz, r, col, o = {}) { const [a, b] = T(lx, lz); ctx.sph(a, Y(yc), b, r * k, col, { ry, ...o }); },
    cone(lx, y0, lz, r, h, col, o = {}) { const [a, b] = T(lx, lz); ctx.cone(a, Y(y0), b, r * k, h * k, col, { ry, ...o }); },
    glow(kind, geo, lx, y, lz, o = {}) { const [a, b] = T(lx, lz); ctx.glow(kind, geo, a, Y(y), b, { ry, s: k === 1 ? undefined : k, ...o }); },
    gbox(kind, lx, y0, lz, w, h, d, o = {}) { const [a, b] = T(lx, lz); ctx.gbox(kind, a, Y(y0), b, w * k, h * k, d * k, { ry, ...o }); },
  };
}
export function lantern(ctx, x, z, { h = 1.3, spot = false } = {}) {
  ctx.cyl(x, GY, z, 0.08, 0.11, h, PAL.woodD, { seg: 8 });
  ctx.box(x, GY + h - 0.05, z, 0.36, 0.06, 0.36, PAL.woodD, { plain: true });
  ctx.glow('lamp', BOX(0.26, 0.3, 0.26), x, GY + h + 0.12, z);
  ctx.cone(x, GY + h + 0.26, z, 0.26, 0.17, PAL.coral, { seg: 4, ry: Math.PI / 4 });
  if (!ctx.isNear(x, z)) ctx.blob(x + 0.2, z - 0.15, 0.3, 0.35, 0.5);
  if (spot) ctx.lampSpots.push(new THREE.Vector3(x, h, z));
}
