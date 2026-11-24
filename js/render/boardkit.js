// Board construction methods, mixed into BoardView.prototype (`this` is the BoardView):
// floors, room walls, outer frame, coordinate labels, ground decor and room plaques.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { softMat } from './models.js';
import { prng, makeCanvas, canvasTexture, FONT, measurePlaque, plaqueTexture, PLAQUE_PX } from './textures.js';
import { DEG, FRAME_W, FRAME_TOP, WALL_T, WALL_H, OUTDOOR, keyOf, noRaycast, roundedRectShape, extrudeSlab, boxAt } from './layout.js';

export const boardKit = {
  /** One merged floor mesh per room, world-space UVs (texture spans 2×2 cells), per-room tint/offset. */
  _buildFloors(board, roomAt, floorOf) {
    const N = this.N, half = N / 2;
    const tints = ['#ffffff', '#f1ecff', '#fff1e2', '#ecf7ec', '#ffeef4', '#eaf2ff', '#fff9e0'];
    const keys = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const k = roomAt(r, c); if (!keys.includes(k)) keys.push(k); }
    const variant = new Map();
    const same = (k, r, c) => r >= 0 && c >= 0 && r < N && c < N && roomAt(r, c) === k;
    for (const k of keys) {
      const floor = floorOf(k);
      const v = variant.get(floor) || 0; variant.set(floor, v + 1);
      const ou = v, ov = (v * 3) % 2;
      const pos = [], nor = [], uv = [], idx = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if (roomAt(r, c) !== k) continue;
        const x0 = c - half, z0 = r - half, n = pos.length / 3;
        const u0 = (c + ou) / 2, u1 = (c + 1 + ou) / 2, v0 = -(r + ov) / 2, v1 = -(r + 1 + ov) / 2;
        pos.push(x0, 0, z0, x0, 0, z0 + 1, x0 + 1, 0, z0 + 1, x0 + 1, 0, z0);
        nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
        uv.push(u0, v0, u0, v1, u1, v1, u1, v0);
        idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      const tint = new THREE.Color(tints[v % tints.length]);
      const mat = softMat({ color: tint, map: this._floorTexture(floor), roughness: 0.9 });
      if (floor === 'water') {
        // Animated ripples/glints in world space on top of the drifting texture.
        const U = this._timeU;
        mat.onBeforeCompile = (sh) => {
          sh.uniforms.uWTime = U;
          sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
          sh.fragmentShader = 'uniform float uWTime;\nvarying vec3 vWP;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  float rp = sin(vWP.x * 9.0 + uWTime * 1.6 + sin(vWP.z * 7.0 + uWTime)) * sin(vWP.z * 8.0 - uWTime * 1.3 + sin(vWP.x * 6.0 - uWTime * 0.7));
  diffuseColor.rgb *= 0.96 + 0.04 * rp;
  diffuseColor.rgb += smoothstep(0.6, 0.92, rp) * 0.09;`);
        };
        mat.customProgramCacheKey = () => 'waterRipple';
      }
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

  /** Room walls: dark base, body and lighter cap, merged per material. */
  _buildWalls(board, roomAt) {
    const N = this.N, h = (N - 1) / 2;
    const T = WALL_T, L = 1 + T;
    const body = [], base = [], cap = [];
    const BASE_H = 0.04, CAP_H = 0.032;
    const add = (vertical, x, z) => {
      const sx = vertical ? 1 : 0;
      const dims = (w, d) => (sx ? [w, d] : [d, w]);
      let [w, d] = dims(T, L);
      body.push(boxAt(w, WALL_H - CAP_H, d, x, (WALL_H - CAP_H) / 2, z));
      [w, d] = dims(T + 0.034, L + 0.034);
      base.push(boxAt(w, BASE_H, d, x, BASE_H / 2, z));
      [w, d] = dims(T + 0.026, L + 0.026);
      cap.push(boxAt(w, CAP_H, d, x, WALL_H - CAP_H / 2, z));
    };
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const x = c - h, z = r - h;
        if (c + 1 < N && roomAt(r, c) !== roomAt(r, c + 1)) add(true, x + 0.5, z);
        if (r + 1 < N && roomAt(r, c) !== roomAt(r + 1, c)) add(false, x, z + 0.5);
      }
    }
    for (const [list, mat] of [[body, this._mat.wall], [base, this._mat.wallBase], [cap, this._mat.wallCap]]) {
      if (!list.length) continue;
      const g = mergeGeometries(list);
      list.forEach((q) => q.dispose());
      const m = new THREE.Mesh(g, mat);
      m.castShadow = true; m.receiveShadow = true;
      board.add(m);
    }
  },

  /** Chunky bevelled wooden frame, dark plinth and a soft ground shadow. */
  _buildFrame(board) {
    const N = this.N, half = N / 2, F = FRAME_W;
    const group = new THREE.Group();
    const bev = 0.05;
    const outer = roundedRectShape(half + F - bev, half + F - bev, 0.2);
    const hole = new THREE.Path();
    const hh = half + bev;
    hole.moveTo(-hh, -hh); hole.lineTo(hh, -hh); hole.lineTo(hh, hh); hole.lineTo(-hh, hh); hole.closePath();
    outer.holes.push(hole);
    const bottom = -0.3;
    const frameGeo = extrudeSlab(outer, FRAME_TOP - bottom - 2 * bev, FRAME_TOP, bev);
    const frame = new THREE.Mesh(frameGeo, this._mat.frame);
    frame.castShadow = true; frame.receiveShadow = true;
    group.add(frame);
    const pb = 0.04, pd = 0.12;
    const plinthGeo = extrudeSlab(roundedRectShape(half + F + 0.12 - pb, half + F + 0.12 - pb, 0.28), pd, bottom + 0.02, pb);
    const plinth = new THREE.Mesh(plinthGeo, this._mat.plinth);
    plinth.receiveShadow = true;
    group.add(plinth);
    group.traverse((o) => { o.raycast = noRaycast; });
    board.add(group);
    // Soft ground shadow
    const gmat = new THREE.MeshBasicMaterial({ map: this._tex.shadow, transparent: true, depthWrite: false, opacity: 0.85, toneMapped: false });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), gmat);
    const s = (N + 2 * F) * 1.75;
    ground.scale.set(s, 1, s * 0.95);
    ground.position.set(0.25, bottom + 0.02 - pd - 2 * pb - 0.02, 0.35);
    ground.raycast = noRaycast;
    board.add(ground);
  },

  /** Chess-style coordinates on the frame: letters a.. for columns (bottom + top), numbers 1.. for rows (left + right); row 1 is the north (far) row. */
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
        const cv = makeCanvas(64, 64), g = cv.getContext('2d');
        g.font = `bold 44px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 8; g.strokeStyle = 'rgba(40,24,12,0.9)'; g.strokeText(txt, 32, 34);
        g.fillStyle = '#f6e7c1'; g.fillText(txt, 32, 34);
        cache.set(txt, new THREE.SpriteMaterial({ map: canvasTexture(cv), transparent: true, depthWrite: false, toneMapped: false }));
      }
      return cache.get(txt);
    };
    const add = (txt, x, z) => {
      const s = new THREE.Sprite(labelMat(txt));
      s.scale.set(ls, ls, 1); s.position.set(x, y + (ls - 0.3) / 2, z); s.raycast = noRaycast; s.renderOrder = 5;
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

  /** Instanced grass tufts / flowers / pebbles / shells / snow lumps along cell edges on outdoor floors. */
  _buildDecor(board, roomAt, floorOf, seed) {
    const N = this.N;
    const r = prng(seed || 1);
    const tufts = [], heads = [], pebbles = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), v = new THREE.Vector3();
    const mat = (x, y, z, sx, sy, sz, ry, rx = 0) => {
      q.setFromEuler(e.set(rx, ry, 0));
      return m4.compose(v.set(x, y, z), q, s.set(sx, sy, sz)).clone();
    };
    const grassCols = ['#4f9e45', '#62b24c', '#3f8c3c', '#79bf55'];
    const flowerCols = ['#ffffff', '#ffd84d', '#ff9ec4', '#b9a6ff', '#ff8a6b'];
    const shellCols = ['#fde0e3', '#fff4e6', '#f3c9a8', '#e8d6c0'];
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
        const along = (r() - 0.5) * 0.84;
        const d = (walled(side) ? 0.085 : 0.045) + r() * 0.03;
        let lx, lz;
        if (side === 0) { lx = along; lz = -0.5 + d; } else if (side === 1) { lx = along; lz = 0.5 - d; }
        else if (side === 2) { lx = -0.5 + d; lz = along; } else { lx = 0.5 - d; lz = along; }
        const X = p.x + lx, Z = p.z + lz, ry = r() * Math.PI * 2;
        if (floor === 'grass') {
          const kind = r();
          if (kind < 0.85) {
            const sc = 0.8 + r() * 0.5;
            tufts.push({ m: mat(X, 0, Z, sc, sc, sc, ry), c: grassCols[(r() * grassCols.length) | 0] });
            if (kind > 0.6) heads.push({ m: mat(X, 0.075 * sc, Z, 1, 0.8, 1, ry), c: flowerCols[(r() * flowerCols.length) | 0] });
          } else {
            const sc = 0.7 + r() * 0.6;
            pebbles.push({ m: mat(X, 0, Z, sc, sc, sc, ry), c: ['#c9c4bd', '#b3aea8', '#ddd6cc'][(r() * 3) | 0] });
          }
        } else if (floor === 'sand') {
          if (r() < 0.25) tufts.push({ m: mat(X, 0, Z, 0.8, 1.1, 0.8, ry), c: '#a9b85e' });
          else { const sc = 0.55 + r() * 0.4; pebbles.push({ m: mat(X, 0, Z, sc, sc * 0.8, sc, ry), c: shellCols[(r() * shellCols.length) | 0] }); }
        } else { // snow
          const sc = 1 + r() * 0.8;
          pebbles.push({ m: mat(X, -0.004, Z, sc * 1.3, sc * 0.7, sc * 1.2, ry), c: r() < 0.7 ? '#ffffff' : '#e4ecff' });
        }
      }
    }
    const col = new THREE.Color();
    for (const [list, geo] of [[tufts, this._geo.tuft], [heads, this._geo.head], [pebbles, this._geo.pebble]]) {
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(geo, geo === this._geo.tuft ? this._mat.decorWind : this._mat.decor, list.length);
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
    const backMat = onTop ? this._mat.plaqueBackTop : this._mat.plaqueBack;
    const back = new THREE.Mesh(new THREE.BoxGeometry(W + 0.03, H + 0.03, 0.022).translate(0, H / 2, 0), backMat);
    back.castShadow = !onTop;
    tilt.add(back);
    // little posts down to the floor / wall
    const postH = onTop ? y - WALL_H + 0.03 : y + 0.03;
    if (postH > 0.02) {
      for (const px of [-W / 2 + 0.08, W / 2 - 0.08]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, postH, 0.03).translate(0, -postH / 2 + 0.03, 0), backMat);
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
