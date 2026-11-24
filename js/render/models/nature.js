// Natural scenery builders: (g, r, ph) => void. Each fits a 1x1 cell, rests on y=0, front faces +z.
// Foliage comes from foliage.js (leaf-card balls, flowers, smooth rocks); wind is driven by foliage.windU.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  add, addVC, addMerged, mergeVC, toon, toonOwn, toonVC, RB, CYL, SPH, TOR, CONE,
} from './kit.js';
import { PI, C, T, flameMat, makeFireGlow, pick } from './common.js';
import { foliageMat, treeGeo, bushGeo, rockGeo, flowerGeo, grassTuftGeo, leafBallGeo } from './foliage.js';

const _M = new THREE.Matrix4(), _E = new THREE.Euler(), _Q = new THREE.Quaternion();
/** Clone of a coloured geometry moved into place (position/normal/color only). */
function place(geo, x, y, z, ry = 0, s = 1, rx = 0, rz = 0) {
  const g = geo.clone();
  _M.compose(new THREE.Vector3(x, y, z), _Q.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(s, s, s));
  g.applyMatrix4(_M);
  return g;
}
const merge = (list) => mergeGeometries(list, false);
const flat = (g) => (g.index ? g.toNonIndexed() : g);
/** Lathe turned into a coloured non-indexed geometry: colour(y, ny) -> [r,g,b]. */
function latheVC(points, segs, colour) {
  let g = new THREE.LatheGeometry(points, segs);
  g = flat(g); g.deleteAttribute('uv');
  const p = g.attributes.position, n = g.attributes.normal, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const k = colour(p.getY(i), n.getY(i), Math.hypot(p.getX(i), p.getZ(i))); c[i * 3] = k[0]; c[i * 3 + 1] = k[1]; c[i * 3 + 2] = k[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
const hexRGB = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const mixRGB = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const _leafCache = new Map();
const cached = (k, f) => { let g = _leafCache.get(k); if (!g) { g = f(); _leafCache.set(k, g); } return g; };

export const NATURE_BUILDERS = {
  tree(g, r, ph) {
    const kind = r() < 0.72 ? 'round' : 'tall';
    const t = treeGeo(kind, Math.floor(r() * 4));
    const root = new THREE.Group(); root.scale.setScalar(Math.min(0.92, 1.46 / t.height)); g.add(root);
    add(root, t.trunk, toonVC());
    add(root, t.crown, foliageMat());
    const mode = r(), parts = [];
    if (mode < 0.7 && t.blobs.length) {
      const fruit = mode < 0.4;
      const n = fruit ? 6 : 12;
      for (let i = 0; i < n; i++) {
        const b = t.blobs[Math.floor(r() * t.blobs.length)], a = r() * PI * 2, e = 0.05 + r() * 0.85;
        const k = 1.04, sy = typeof b[4] === 'number' ? b[4] : b[4]?.sy ?? 1;
        const pos = [b[0] + Math.cos(a) * Math.cos(e) * b[3] * k, b[1] + Math.sin(e) * b[3] * sy * k, b[2] + Math.sin(a) * Math.cos(e) * b[3] * k];
        if (fruit) parts.push({ geo: SPH(0.05, 8, 6), pos, color: '#ee4b4b' }, { geo: SPH(0.012, 4, 3), pos: [pos[0], pos[1] + 0.05, pos[2]], color: '#5a3a28' });
        else parts.push({ geo: SPH(0.042, 7, 5), pos, scale: [1, 0.6, 1], color: pick(r, ['#fffafc', '#ffc9e2', '#fff1a8']) });
      }
      addVC(root, parts);
    }
    g.userData.idle = (tm) => { root.rotation.z = 0.012 * Math.sin(tm * 1.3 + ph); root.rotation.x = 0.009 * Math.sin(tm * 1.1 + ph * 2); };
  },

  bush(g, r, ph) {
    const kind = r() < 0.3 ? 'flower' : 'round';
    const fol = new THREE.Group(); g.add(fol);
    add(fol, bushGeo(kind, Math.floor(r() * 4)), foliageMat());
    fol.rotation.y = r() * 6;
    g.userData.idle = (t) => { const s = 1 + 0.01 * Math.sin(t * 1.9 + ph); fol.scale.set(s, 1 + 0.01 * Math.sin(t * 1.5 + ph), s); };
  },

  boulder(g, r) {
    const v = Math.floor(r() * 4);
    const rocks = [place(rockGeo(v, 1), 0, 0, 0, r() * 6, 1.18)];
    rocks.push(place(rockGeo(v + 1, 0.4), -0.3, 0, 0.24, r() * 6, 0.46), place(rockGeo(v + 2, 0), 0.3, 0, 0.3, r() * 6, 0.3), place(rockGeo(v + 3, 0.2), 0.27, 0, -0.27, r() * 6, 0.34));
    add(g, merge(rocks), toonVC());
    const fl = [place(grassTuftGeo(v), 0.02, 0.34, -0.04, r() * 6, 1.1), place(grassTuftGeo(v + 1), -0.26, 0.0, 0.34, r() * 6, 0.9), place(grassTuftGeo(v + 2), 0.38, 0.0, 0.05, r() * 6, 0.8)];
    const cols = ['#fff4e4', '#ffd84d', '#ff9ac0', '#b07ae0'];
    for (let i = 0; i < 3; i++) { const a = r() * 6; fl.push(place(flowerGeo(cols[(v + i) % 4], i + v), Math.cos(a) * 0.12, 0.33, Math.sin(a) * 0.1, r() * 6, 0.75)); }
    fl.push(place(flowerGeo(cols[(v + 1) % 4], 1), -0.3, 0.0, 0.36, 1, 0.7), place(flowerGeo(cols[(v + 2) % 4], 2), 0.33, 0.0, 0.2, 2, 0.7));
    add(g, merge(fl), foliageMat());
  },

  plant(g, r, ph) {
    const pot = latheVC([[0, 0], [0.15, 0], [0.19, 0.012], [0.232, 0.25], [0.255, 0.262], [0.262, 0.292], [0.25, 0.312], [0.215, 0.305], [0.2, 0.275], [0, 0.275]].map(([x, y]) => new THREE.Vector2(x, y)), 22,
      (y, ny, rr) => (y > 0.24 ? mixRGB(hexRGB('#f0a07c'), hexRGB('#ffb996'), (y - 0.24) / 0.07) : y > 0.272 && rr < 0.21 ? hexRGB('#6a4630') : mixRGB(hexRGB('#d8704c'), hexRGB('#ec8c64'), y / 0.25)));
    const soil = mergeVC([{ geo: CYL(0.205, 0.205, 0.02, 18), pos: [0, 0.275, 0], color: '#6a4630' }, { geo: TOR(0.218, 0.017, 6, 22), pos: [0, 0.14, 0], rot: [PI / 2, 0, 0], color: '#3fb8af' }]);
    add(g, merge([pot, soil]), toonVC());
    const v = Math.floor(r() * 4);
    const leaves = cached('plant' + v, () => leafBallGeo({
      blobs: [[0, 0.2, 0, 0.19, 1.15], [0.1 + v * 0.01, 0.3, 0.04, 0.14], [-0.1, 0.33, -0.05, 0.13], [0.0, 0.44, 0.0, 0.12]], leaves: 120, leafSize: 0.15, aspect: 1.45, tilt: 0.75, seed: 70 + v, colors: ['#35905a', '#72bf4e', '#c6e25a'],
    }));
    const fl = place(flowerGeo(pick(r, ['#ff6f8e', '#ffd84d', '#fff4e4']), v), 0.0, 0.5, 0.0, r() * 6, 0.85);
    const lf = new THREE.Group(); lf.position.y = 0.28; g.add(lf);
    add(lf, merge([leaves, fl]), foliageMat());
    g.userData.idle = (t) => { lf.rotation.z = 0.035 * Math.sin(t * 1.6 + ph); lf.rotation.x = 0.03 * Math.sin(t * 1.3 + ph * 1.7); };
  },

  flowers(g, r, ph) {
    const wood = '#cf9560', woodD = '#a56d3e';
    add(g, RB(0.94, 0.2, 0.11, 0.035), wood, { pos: [0, 0.1, 0.415] });
    add(g, RB(0.94, 0.2, 0.11, 0.035), wood, { pos: [0, 0.1, -0.415] });
    add(g, RB(0.11, 0.2, 0.74, 0.035), woodD, { pos: [0.415, 0.1, 0] });
    add(g, RB(0.11, 0.2, 0.74, 0.035), woodD, { pos: [-0.415, 0.1, 0] });
    add(g, RB(0.8, 0.2, 0.8, 0.04), '#6b4630', { pos: [0, 0.075, 0] });
    const mound = cached('bedmound', () => leafBallGeo({
      blobs: [[-0.22, 0.2, 0.1, 0.19, { sy: 0.55 }], [0.2, 0.2, -0.05, 0.2, { sy: 0.55 }], [0.0, 0.2, -0.22, 0.17, { sy: 0.55 }], [-0.05, 0.2, 0.26, 0.16, { sy: 0.5 }]],
      leaves: 120, leafSize: 0.1, seed: 12, colors: ['#3a9456', '#7cc04e', '#c4e05a'],
    }));
    const cols = ['#ff6f8e', '#ffd84d', '#fff4e4', '#b07ae0', '#ff9a3c', '#ff6f8e'];
    const list = [mound];
    for (let i = 0; i < 12; i++) {
      const x = -0.27 + (i % 4) * 0.18 + (r() - 0.5) * 0.06, z = -0.25 + Math.floor(i / 4) * 0.25 + (r() - 0.5) * 0.06;
      list.push(place(flowerGeo(pick(r, cols), Math.floor(r() * 4)), x, 0.16, z, r() * 6, 0.9 + r() * 0.3));
    }
    const fm = add(g, merge(list), foliageMat());
    g.userData.idle = (t) => { fm.rotation.z = 0.014 * Math.sin(t * 1.4 + ph); fm.rotation.x = 0.01 * Math.sin(t * 1.1 + ph); };
  },

  water(g, r, ph) {
    // The floor is the water (teal); this adds ripples, lily pads and a lotus well inside the cell edges so neighbours join up.
    const rm = toonOwn('#e6fffb', {}); rm.transparent = true; rm.opacity = 0.5; rm.depthWrite = false;
    const rings = [];
    for (let i = 0; i < 2; i++) {
      const ring = add(g, TOR(0.17 + i * 0.12, 0.011, 5, 28), rm, { pos: [(r() - 0.5) * 0.3, 0.012, (r() - 0.5) * 0.3], rot: [PI / 2, 0, 0], ...T });
      ring.userData.ph = ph + i * 2; rings.push(ring);
    }
    const padGeo = cached('pad', () => {
      let c = new THREE.CircleGeometry(0.12, 18, 0.5, PI * 2 - 0.6); c.rotateX(-PI / 2); c = flat(c); c.deleteAttribute('uv');
      const p = c.attributes.position, col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { const d = Math.hypot(p.getX(i), p.getZ(i)) / 0.12, k = mixRGB(hexRGB('#4aa84e'), hexRGB('#86cf5a'), d); col.set(k, i * 3); p.setY(i, 0.012 + 0.016 * d * d); }
      c.setAttribute('color', new THREE.BufferAttribute(col, 3)); c.computeVertexNormals();
      return c;
    });
    const list = [];
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, d = 0.12 + r() * 0.16;
      list.push(place(padGeo, Math.cos(a) * d, 0, Math.sin(a) * d, r() * 6, 0.8 + r() * 0.5));
    }
    if (r() < 0.6) list.push(place(flowerGeo(pick(r, ['#ff9ac0', '#fff4e4', '#ffd0e4']), Math.floor(r() * 4)), (r() - 0.5) * 0.3, -0.06, (r() - 0.5) * 0.3, r() * 6, 0.55));
    const pm = add(g, merge(list), toonVC(), { shadow: false });
    pm.material = foliageMat();
    g.userData.idle = (t) => { for (const m of rings) { const s = 1 + 0.12 * Math.sin(t * 1.2 + m.userData.ph); m.scale.set(s, s, 1); } pm.position.y = 0.004 * Math.sin(t * 1.6 + ph); };
  },

  haybale(g, r) {
    const Rr = 0.33, Lh = 0.4, ed = 0.08;
    const prof = [[0, -Lh], [Rr - ed, -Lh]];
    for (let i = 1; i <= 4; i++) { const a = (i / 4) * PI / 2; prof.push([Rr - ed + Math.sin(a) * ed, -Lh + ed - Math.cos(a) * ed]); }
    for (let i = 0; i <= 4; i++) { const a = (i / 4) * PI / 2; prof.push([Rr - ed + Math.cos(a) * ed, Lh - ed + Math.sin(a) * ed]); }
    prof.push([0, Lh]);
    const hay = hexRGB('#ecc85c'), hayD = hexRGB('#cfa23f'), hayL = hexRGB('#f6e08e');
    let bale = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 28);
    bale = flat(bale); bale.deleteAttribute('uv');
    const p = bale.attributes.position, n = bale.attributes.normal, cl = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const rad = Math.hypot(p.getX(i), p.getZ(i)), ang = Math.atan2(p.getZ(i), p.getX(i));
      let c;
      if (Math.abs(n.getY(i)) > 0.85) c = mixRGB(hayL, hayD, 0.5 + 0.5 * Math.sin(rad * 75)); // end faces: straw spiral
      else c = mixRGB(hay, hayD, 0.5 + 0.5 * Math.sin(ang * 21 + p.getY(i) * 6) * 1.0 * (0.5 + 0.5 * Math.sin(p.getY(i) * 40)));
      cl.set(c, i * 3);
    }
    bale.setAttribute('color', new THREE.BufferAttribute(cl, 3));
    bale.rotateZ(PI / 2);
    const parts = [];
    for (const x of [-0.18, 0.18]) parts.push({ geo: TOR(Rr + 0.004, 0.022, 6, 28), pos: [x, 0, 0], rot: [0, PI / 2, 0], color: '#b9693a' });
    for (let i = 0; i < 9; i++) parts.push({ geo: CYL(0.012, 0.012, 0.1 + r() * 0.08, 5), pos: [(r() - 0.5) * 0.9, 0.012, 0.32 + r() * 0.12], rot: [PI / 2, 0, (r() - 0.5) * 3], color: i % 2 ? '#f4dc84' : '#d6b048' });
    const dec = mergeVC(parts);
    const mesh = add(g, merge([bale, dec]), toonVC(), { pos: [0, Rr, 0] });
    dec.translate(0, 0, 0); mesh.rotation.y = (r() - 0.5) * 0.25; mesh.position.y = Rr;
  },

  campfire(g, r, ph) {
    const logs = [{ geo: CYL(0.285, 0.3, 0.014, 20), pos: [0, 0.007, 0], color: '#4a3c3c' }];
    const logBody = '#86532f', logEnd = '#e8c088';
    const addLog = (from, to, rad) => {
      const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), d = b.clone().sub(a), L = d.length(), m = a.clone().add(b).multiplyScalar(0.5), dir = d.clone().normalize();
      logs.push({ geo: CYL(rad, rad, L, 10), pos: m.toArray(), dir: dir.toArray(), color: logBody });
      for (const s of [-1, 1]) { const e = m.clone().addScaledVector(dir, s * (L / 2 + 0.002)); logs.push({ geo: CYL(rad * 0.94, rad * 0.94, 0.012, 10), pos: e.toArray(), dir: dir.toArray(), color: logEnd }); }
    };
    for (let i = 0; i < 5; i++) { // logs leaning in
      const a = (i / 5) * PI * 2 + 0.3 + r() * 0.2;
      addLog([Math.cos(a) * 0.23, 0.06, Math.sin(a) * 0.23], [Math.cos(a) * 0.06, 0.17 + (i % 2) * 0.04, Math.sin(a) * 0.06], 0.052 + (i % 2) * 0.008);
    }
    addLog([-0.2, 0.05, 0.1], [0.2, 0.05, 0.14], 0.055);
    const stones = [];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2 + 0.2; stones.push(place(rockGeo(i, 0), Math.cos(a) * 0.37, 0, Math.sin(a) * 0.37, i * 2.1, 0.3 + r() * 0.06)); }
    add(g, merge([mergeVC(logs), ...stones]), toonVC());
    const emb = [];
    for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = 0.05 + r() * 0.17; emb.push({ geo: SPH(0.028 + r() * 0.014, 6, 4), pos: [Math.cos(a) * d, 0.03, Math.sin(a) * d], scale: [1.2, 0.55, 1.2] }); }
    addMerged(g, emb, flameMat('#ff6a2a', 1.3), { ...T });
    // stylised layered tongues of flame
    const tongue = (R0, H) => {
      const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(Math.max(0.0005, R0 * Math.sin(PI * Math.pow(t, 0.7)) * (1 - 0.35 * t)) * (t > 0.97 ? 0.1 : 1), t * H)); }
      pts[10].x = 0.0005;
      return new THREE.LatheGeometry(pts, 14);
    };
    const specs = [[0.16, 0.5, 0, 0], [0.1, 0.34, 0.11, 0.08], [0.09, 0.3, -0.11, 0.04], [0.08, 0.26, 0.03, -0.11]];
    const flames = specs.map(([R0, H, x, z], i) => {
      const outer = add(g, tongue(R0, H), flameMat(i % 2 ? '#ff8a30' : '#ff7a2a', 0.95), { pos: [x, 0.04, z], ...T });
      add(outer, tongue(R0 * 0.72, H * 0.66), flameMat('#ffe066', 1.3), { pos: [0, -0.005, R0 * 0.38], ...T });
      return outer;
    });
    const sparks = [0, 1].map(() => add(g, SPH(0.014, 5, 4), flameMat(C.flameY, 1.5), { ...T }));
    const glow = makeFireGlow(g, 0, 0.02, 0, 0.7);
    g.userData.idle = (t) => {
      for (let i = 0; i < flames.length; i++) {
        const f = flames[i];
        const k = 1 + 0.15 * Math.sin(t * 11 + i * 2.1 + ph) + 0.07 * Math.sin(t * 23 + i);
        const q = 1 / Math.sqrt(k);
        f.scale.set(q, k, q);
        f.rotation.z = 0.08 * Math.sin(t * 7 + i * 1.7 + ph); f.rotation.x = 0.06 * Math.sin(t * 6 + i * 2.3 + ph);
      }
      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i], u = ((t * 0.5 + i * 0.5 + ph) % 1);
        s.position.set(Math.sin(i * 2.4 + u * 3) * 0.12, 0.3 + u * 0.5, Math.cos(i * 1.7 + u * 3) * 0.12);
        s.scale.setScalar(Math.max(0.001, 1 - u));
      }
      glow(Math.sin(t * 11 + ph) * 0.6 + Math.sin(t * 23) * 0.4);
    };
  },
};
