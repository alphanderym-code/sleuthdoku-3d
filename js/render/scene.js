// BoardView — three.js renderer for Tiny Crimes (see SPEC.md "js/render/scene.js").
// Soft toy-like diorama board with 3D tokens, gesture input (tap / hold / paint), limited orbit camera.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  makeCanvas, canvasTexture, prng, hashStr, toHex, FLOOR_BASE, floorTexture, frameWoodTexture, xMarkTexture, chipTexture,
  blobShadowTexture, glowTileTexture, ringTexture,
} from './textures.js';
import { DEG, FRAME_W, FRAME_TOP, keyOf, noRaycast } from './layout.js';
import { boardKit } from './boardkit.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OBJECT_TYPES } from '../model/objects.js';
import {
  createObject, createFigurine, disposeObject, standInfo, softMat, setGlow,
} from './models.js';
import { MOODS, defaultMood, moodEnvironment } from './moods.js';
import { Post } from './post.js';
import { buildWorld } from './world.js';

const HOLD_MS = 350;
const TAP_MOVE_PX = 10;
const DEFAULT_POLAR = 42 * DEG;   // angle from vertical (≈48° above the horizon)
const DEFAULT_AZIMUTH = 0;
const AZ_LIMIT = 35 * DEG;
const POLAR_MIN = 12 * DEG;
const POLAR_MAX = 64 * DEG;


// ---------------------------------------------------------------------------
// Easing + tiny tween helper
// ---------------------------------------------------------------------------
const Ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; },
  outBounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

class Tweens {
  constructor() { this.list = []; }
  /** update(easedT, rawT) is called every frame; returns a handle with cancel(). */
  add(dur, update, { delay = 0, ease = Ease.linear, onDone = null } = {}) {
    const tw = { t0: performance.now() + delay, dur: Math.max(1, dur), update, ease, onDone, dead: false };
    tw.cancel = () => { tw.dead = true; };
    this.list.push(tw);
    return tw;
  }
  tick(now) {
    const list = this.list.slice();
    for (const tw of list) {
      if (tw.dead) continue;
      const raw = (now - tw.t0) / tw.dur;
      if (raw < 0) continue;
      const t = Math.min(1, raw);
      try { tw.update(tw.ease(t), t); } catch (e) { console.error(e); tw.dead = true; }
      if (t >= 1 && !tw.dead) {
        tw.dead = true;
        if (tw.onDone) { try { tw.onDone(); } catch (e) { console.error(e); } }
      }
    }
    this.list = this.list.filter((t) => !t.dead);
  }
  clear() { this.list.forEach((t) => { t.dead = true; }); this.list = []; }
}

// Hold-progress ring shader
const RING_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RING_FRAG = `
uniform float uProgress; uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
void main(){
  vec2 p = vUv - 0.5; float d = length(p);
  float aa = fwidth(d) * 1.5;
  float ring = smoothstep(0.33 - aa, 0.33 + aa, d) * (1.0 - smoothstep(0.46 - aa, 0.46 + aa, d));
  if (ring < 0.01) discard;
  float a = atan(p.x, p.y); if (a < 0.0) a += 6.2831853;
  float f = a / 6.2831853;
  float filled = step(f, uProgress);
  float edge = smoothstep(0.33, 0.36, d) * (1.0 - smoothstep(0.43, 0.46, d));
  vec3 col = mix(vec3(0.17, 0.17, 0.23), mix(vec3(1.0), uColor, filled), edge);
  gl_FragColor = vec4(col, ring * mix(0.45, 1.0, filled) * uOpacity);
}`;

// Object `facing` -> rotation.y (model front = local +z; board row r = world +z, column c = world +x).
const FACING_ROT = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 };
function parseCell(v) {
  if (v == null) return null;
  if (typeof v === 'string') { const [r, c] = v.split(',').map(Number); return Number.isFinite(r) && Number.isFinite(c) ? { r, c } : null; }
  if (Array.isArray(v)) return { r: +v[0], c: +v[1] };
  if (typeof v === 'object' && Number.isFinite(+v.r) && Number.isFinite(+v.c)) return { r: +v.r, c: +v.c };
  return null;
}

// ---------------------------------------------------------------------------
// BoardView
// ---------------------------------------------------------------------------
export class BoardView {
  constructor(containerEl) {
    this.container = containerEl;
    this._listeners = {};
    this._tweens = new Tweens();
    this._disposed = false;
    this.N = 5;
    this.puzzle = null;
    this.tokens = new Map();
    this.objectsAt = new Map();
    this.chips = new Map();
    this.markMeshes = new Map();
    this.autoMeshes = new Map();
    this.view = null;
    this._press = null;
    this._touches = new Set();
    this._hoverKey = null;
    this._win = null;
    this._t0 = performance.now();

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' }); // antialias only matters for the no-post fallback
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Khronos PBR Neutral keeps pastel hues saturated (ACES/AgX washed the cartoon palette out).
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    const cv = renderer.domElement;
    cv.style.display = 'block';
    cv.style.width = '100%';
    cv.style.height = '100%';
    cv.style.touchAction = 'none';
    cv.style.outline = 'none';
    cv.style.webkitUserSelect = 'none';
    cv.style.userSelect = 'none';
    containerEl.appendChild(cv);
    this.renderer = renderer;
    this.canvas = cv;
    this._maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 4);

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#cfeaf0');
    scene.fog = new THREE.Fog('#cfeaf0', 50, 100);
    this.scene = scene;
    this.post = new Post(renderer);
    const gfx = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('gfx') : null;
    if (gfx != null && gfx !== '') this.post.lock(+gfx);

    this.camera = new THREE.PerspectiveCamera(36, 1, 0.3, 200);
    this._fitCam = new THREE.PerspectiveCamera(36, 1, 0.3, 200);

    // Lights: warm key with soft shadows, cool fill + rim, hemisphere ambient. Colours / levels come from the mood (setMood).
    this._baseLight = { hemi: 1, sun: 3, fill: 0.4, rim: 0.5, env: 0.4 };
    this.hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1);
    scene.add(this.hemi);
    this._sunDir = new THREE.Vector3(-0.5, 1, 0.5).normalize();
    this.sun = new THREE.DirectionalLight('#ffffff', 3);
    this.sun.castShadow = true;
    const maxTex = renderer.capabilities.maxTextureSize || 4096;
    this.sun.shadow.mapSize.set(Math.min(4096, maxTex), Math.min(4096, maxTex));
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.fill = new THREE.DirectionalLight('#ffffff', 0.4);
    this.fill.position.set(6, 4, 5);
    scene.add(this.fill);
    this.rim = new THREE.DirectionalLight('#ffffff', 0.5);
    this.rim.position.set(2, 5, -7);
    scene.add(this.rim);
    // Warm local lights for the evening moods (always present so shaders never recompile).
    this.lamps = Array.from({ length: 4 }, () => { const l = new THREE.PointLight('#ffb765', 0, 5, 1.6); scene.add(l); return l; });
    // Win spotlight lives permanently (intensity 0) so lighting shaders never recompile mid-game.
    this.spot = new THREE.SpotLight('#fff2c0', 0, 0, 0.3, 0.55, 0);
    this.spot.position.set(0, 7, 0);
    scene.add(this.spot); scene.add(this.spot.target);

    // Controls
    const controls = new OrbitControls(this.camera, cv);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.rotateSpeed = 0.6;
    controls.zoomSpeed = 0.8;
    controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
    controls.minAzimuthAngle = -AZ_LIMIT;
    controls.maxAzimuthAngle = AZ_LIMIT;
    controls.minPolarAngle = POLAR_MIN;
    controls.maxPolarAngle = POLAR_MAX;
    controls.target.set(0, 0, 0);
    this.controls = controls;

    // Shared resources (live for the whole BoardView)
    this._floorTex = new Map();
    this._timeU = { value: 0 }; // shared shader time (water ripples, grass wind); frozen when reduced motion is on
    this._reduceMotion = (typeof window !== 'undefined' && window.matchMedia) ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    this._tex = {
      x: xMarkTexture('#e5484d', '#6e1a26', 11),
      xAuto: xMarkTexture('#8a8aa6', null, 23),
      shadow: blobShadowTexture(),
      glow: glowTileTexture(),
      ring: ringTexture(),
      wood: frameWoodTexture(),
    };
    this._tex.wood.repeat.set(0.45, 0.45);
    this._tex.wood.anisotropy = this._maxAniso;
    const tuftParts = [];
    for (let k = 0; k < 5; k++) {
      const h = 0.062 + 0.012 * (k % 3);
      tuftParts.push(new THREE.ConeGeometry(0.017, h, 4).translate(0, h / 2, 0)
        .rotateZ((k % 2 ? 1 : -1) * (0.18 + 0.08 * k)).rotateY(k * 1.37).translate(Math.cos(k * 2.3) * 0.012, 0, Math.sin(k * 2.3) * 0.012));
    }
    this._geo = {
      cell: new THREE.PlaneGeometry(0.98, 0.98).rotateX(-Math.PI / 2),
      glow: new THREE.PlaneGeometry(1.04, 1.04).rotateX(-Math.PI / 2),
      mark: new THREE.PlaneGeometry(0.66, 0.66).rotateX(-Math.PI / 2),
      chip: new THREE.PlaneGeometry(0.29, 0.29).rotateX(-Math.PI / 2),
      ring: new THREE.PlaneGeometry(1.06, 1.06).rotateX(-Math.PI / 2),
      holdRing: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      blob: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      tuft: mergeGeometries(tuftParts),
      head: new THREE.IcosahedronGeometry(0.022, 0),
      pebble: new THREE.IcosahedronGeometry(0.034, 0).scale(1, 0.55, 0.8).translate(0, 0.008, 0),
    };
    tuftParts.forEach((g) => g.dispose());
    const toonMat = (color, extra = {}) => softMat({ color, ...extra });
    this._mat = {
      // depthTest off so marks stay visible on chairs/sofas/beds (they never share a cell with a token).
      mark: new THREE.MeshBasicMaterial({ map: this._tex.x, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }),
      auto: new THREE.MeshBasicMaterial({ map: this._tex.xAuto, transparent: true, opacity: 0.34, depthWrite: false, depthTest: false, toneMapped: false }),
      hover: new THREE.MeshBasicMaterial({ map: this._tex.glow, color: '#fff0a0', transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }),
      ring: new THREE.MeshBasicMaterial({ map: this._tex.ring, transparent: true, depthWrite: false, toneMapped: false }),
      pulse: new THREE.MeshBasicMaterial({ map: this._tex.ring, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }),
      blob: new THREE.MeshBasicMaterial({
        map: this._tex.shadow, transparent: true, depthWrite: false, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
      }),
      wall: toonMat('#584b78'),
      wallBase: toonMat('#352c4a'),
      wallCap: toonMat('#a596cc'),
      frame: toonMat('#ffffff', { map: this._tex.wood }),
      plinth: toonMat('#4b3450'),
      decor: toonMat('#ffffff'),
      // Grass tufts: vertex-shader wind sway, bending more towards the tip (position.y), phase from instance position.
      decorWind: (() => {
        const m = toonMat('#ffffff');
        const U = this._timeU;
        m.onBeforeCompile = (sh) => {
          sh.uniforms.uWTime = U;
          sh.vertexShader = 'uniform float uWTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 ip = instanceMatrix[3].xyz;
#else
  vec3 ip = vec3(0.0);
#endif
  float wv = sin(uWTime * 1.9 + ip.x * 2.3 + ip.z * 1.7) + 0.5 * sin(uWTime * 3.7 + ip.z * 3.1);
  transformed.x += wv * 0.45 * position.y;
  transformed.z += wv * 0.2 * position.y;`);
        };
        m.customProgramCacheKey = () => 'tuftWind';
        return m;
      })(),
      // Plaques are drawn in the transparent pass without depth writes, so floor overlays (notes, X marks, hover)
      // that a leaning plaque would cover still show through; tokens/objects in front still hide it.
      plaqueBack: toonMat('#7a5536', { transparent: true, depthWrite: false }),
      plaqueBackTop: toonMat('#7a5536', { depthTest: false }),
      borderDark: toonMat('#a24f78'),
      borderLight: toonMat('#f7d77e'),
    };
    for (const m of Object.values(this._mat)) m.userData.shared = true;

    // Persistent FX meshes
    this.fx = new THREE.Group(); scene.add(this.fx);
    this.hoverMesh = new THREE.Mesh(this._geo.glow, this._mat.hover);
    this.hoverMesh.visible = false; this.hoverMesh.renderOrder = 2; this.fx.add(this.hoverMesh);
    this.selRing = new THREE.Mesh(this._geo.ring, this._mat.ring);
    this.selRing.visible = false; this.selRing.renderOrder = 7; this.fx.add(this.selRing);
    this.selPulse = new THREE.Mesh(this._geo.ring, this._mat.pulse);
    this.selPulse.visible = false; this.selPulse.renderOrder = 7; this.fx.add(this.selPulse);
    this._holdUniforms = {
      uProgress: { value: 0 }, uColor: { value: new THREE.Color('#ffd84d') }, uOpacity: { value: 1 },
    };
    this._holdMat = new THREE.ShaderMaterial({
      uniforms: this._holdUniforms, vertexShader: RING_VERT, fragmentShader: RING_FRAG,
      transparent: true, depthWrite: false, depthTest: false,
    });
    this._holdMat.userData.shared = true;
    this.holdRing = new THREE.Mesh(this._geo.holdRing, this._holdMat);
    this.holdRing.visible = false; this.holdRing.renderOrder = 40; this.fx.add(this.holdRing);
    for (const m of [this.hoverMesh, this.selRing, this.selPulse, this.holdRing]) m.raycast = noRaycast;

    this.board = null;

    // Input
    this._raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerCancel = this._onPointerCancel.bind(this);
    this._onPointerLeave = this._onPointerLeave.bind(this);
    this._onContextMenu = (e) => e.preventDefault();
    cv.addEventListener('pointerdown', this._onPointerDown);
    cv.addEventListener('pointermove', this._onPointerMove);
    cv.addEventListener('pointerup', this._onPointerUp);
    cv.addEventListener('pointercancel', this._onPointerCancel);
    cv.addEventListener('pointerleave', this._onPointerLeave);
    cv.addEventListener('contextmenu', this._onContextMenu);

    // Resize
    this._fitD = 0;
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(containerEl);
    this._resize(true);
    this._applyCamera(DEFAULT_POLAR, DEFAULT_AZIMUTH, this._fitD);

    // Loop
    this._last = performance.now();
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  // ------------------------------------------------------------------ events
  on(event, cb) {
    (this._listeners[event] ||= []).push(cb);
    return () => { this._listeners[event] = (this._listeners[event] || []).filter((f) => f !== cb); };
  }
  _emit(event, payload) {
    for (const cb of (this._listeners[event] || []).slice()) {
      try { cb(payload); } catch (e) { console.error(e); }
    }
  }

  // ------------------------------------------------------------------ helpers
  _cellPos(r, c, out = new THREE.Vector3()) {
    const h = (this.N - 1) / 2;
    return out.set(c - h, 0, r - h);
  }
  _inBoard(r, c) { return Number.isInteger(r) && Number.isInteger(c) && r >= 0 && c >= 0 && r < this.N && c < this.N; }
  _stand(r, c) {
    const o = this.objectsAt.get(keyOf(r, c));
    return o ? o.stand : { y: 0, dz: 0 };
  }
  _disposeBoard(board) {
    board.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    disposeObject(board);
  }
  _floorTexture(type) {
    let t = this._floorTex.get(type);
    if (!t) { t = floorTexture(type); t.anisotropy = this._maxAniso; this._floorTex.set(type, t); }
    return t;
  }

  // ------------------------------------------------------------------ board building
  loadPuzzle(puzzle) {
    this._clearWin();
    this._cancelPress();
    this._tweens.clear();
    this._clearFx();
    if (this.board) { this.scene.remove(this.board); this._disposeBoard(this.board); }
    if (this._chipMats) for (const { mat } of this._chipMats.values()) { mat.map?.dispose(); mat.dispose(); }
    this._chipMats = new Map();
    this.tokens.clear(); this.objectsAt.clear(); this._objPts = null; this.chips.clear(); this.markMeshes.clear(); this.autoMeshes.clear();
    this.view = null;
    this.hoverMesh.visible = false; this.selRing.visible = false; this.selPulse.visible = false; this.holdRing.visible = false;
    this._hoverKey = null;

    this.puzzle = puzzle;
    const N = Math.max(1, puzzle?.size | 0 || (puzzle?.rooms?.length ?? 5));
    this.N = N;
    const board = new THREE.Group(); board.name = 'board';
    this.board = board;
    this.scene.add(board);

    const rooms = (puzzle.rooms || []).map((row) => String(row));
    const roomAt = (r, c) => (rooms[r] && rooms[r][c]) || '?';
    const info = puzzle.roomInfo || {};
    const floorOf = (k) => (FLOOR_BASE[info[k]?.floor] ? info[k].floor : 'wood');

    this._buildFloors(board, roomAt, floorOf);
    this._buildWalls(board, roomAt);
    this._buildFrame(board);
    this._buildCoordLabels(board);

    // Objects (+ soft contact shadows)
    const p = new THREE.Vector3();
    const blobs = [];
    for (const o of puzzle.objects || []) {
      if (!this._inBoard(o.r, o.c)) continue;
      const g = createObject(o.type, o.r * 31 + o.c * 17);
      this._cellPos(o.r, o.c, p);
      g.position.copy(p);
      const rr = prng((o.r * 31 + o.c * 17 + 5) * 7919);
      if (['tree', 'bush', 'boulder', 'campfire'].includes(o.type)) g.rotation.y = rr() * Math.PI * 2;
      else if (o.type === 'crate') g.rotation.y = (rr() - 0.5) * 0.4;
      else if (o.facing) g.rotation.y = FACING_ROT[o.facing] ?? 0; // model front is +z; world x=c, z=r
      board.add(g);
      const box = new THREE.Box3().setFromObject(g);
      const size = box.getSize(new THREE.Vector3());
      const height = box.max.y;
      this.objectsAt.set(keyOf(o.r, o.c), {
        type: o.type, blocking: !!OBJECT_TYPES[o.type]?.blocking, stand: standInfo(o.type), group: g, height,
      });
      if (height > 0.08) {
        const s = THREE.MathUtils.clamp(Math.max(size.x, size.z) * 1.2, 0.45, 1.25);
        blobs.push({ x: p.x, z: p.z, s });
      }
    }
    if (blobs.length) {
      const im = new THREE.InstancedMesh(this._geo.blob, this._mat.blob, blobs.length);
      const m4 = new THREE.Matrix4();
      blobs.forEach((b, i) => im.setMatrixAt(i, m4.makeScale(b.s, 1, b.s).setPosition(b.x, 0.004, b.z)));
      im.renderOrder = 0.4; im.raycast = noRaycast;
      board.add(im);
    }

    this._buildDecor(board, roomAt, floorOf, hashStr(String(puzzle.id ?? '') + rooms.join('')));

    // World around the board
    this.world = buildWorld(this, puzzle);
    board.add(this.world.group);

    // Room plaques
    this._buildPlaques(board, rooms, roomAt, info);

    // Layers for notes / marks
    this.decals = new THREE.Group(); board.add(this.decals);
    (puzzle.characters || []).forEach((ch, i) => {
      const col = ch.look?.outfit || '#888888';
      const m = new THREE.MeshBasicMaterial({
        // depthTest off: notes must stay readable on chairs, sofas, beds, benches (drawn on top).
        map: chipTexture(String(ch.id).slice(0, 1).toUpperCase(), col), transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
      });
      this._chipMats.set(ch.id, { mat: m, slot: i % 9 });
    });

    // Tokens (hidden until placed)
    this.tokenGroup = new THREE.Group(); board.add(this.tokenGroup);
    (puzzle.characters || []).forEach((ch, i) => {
      const root = new THREE.Group();
      const hop = new THREE.Group();
      const fig = createFigurine(ch);
      fig.traverse((m) => { m.userData.tokenId = ch.id; if (m.isMesh && !m.userData.isOutline) m.castShadow = true; });
      hop.add(fig); root.add(hop);
      const blob = new THREE.Mesh(this._geo.blob, this._mat.blob);
      blob.position.y = 0.006; blob.scale.set(0.72, 1, 0.72); blob.renderOrder = 0.4; blob.raycast = noRaycast;
      root.add(blob);
      root.visible = false;
      this.tokenGroup.add(root);
      this.tokens.set(ch.id, { id: ch.id, ch, index: i, root, hop, fig, blob, cell: null, anim: null, materials: fig.userData.materials || [] });
    });

    this.setMood(this._moodOverride || defaultMood(puzzle));
    this._resize(true);
    this._applyCamera(DEFAULT_POLAR, DEFAULT_AZIMUTH, this._fitD);
    this.controls.update();
  }


  // ------------------------------------------------------------------ state sync
  setState(view) {
    if (!this.puzzle) return;
    const v = view || {};
    const placements = v.placements || {};
    const first = this.view == null;

    // Tokens
    let delayIdx = 0;
    for (const t of this.tokens.values()) {
      const next = parseCell(placements[t.id]);
      const valid = next && this._inBoard(next.r, next.c) ? next : null;
      const prev = t.cell;
      if (!prev && valid) { this._tokenPlace(t, valid, first ? delayIdx++ * 60 : 0); }
      else if (prev && !valid) { this._tokenRemove(t); }
      else if (prev && valid && (prev.r !== valid.r || prev.c !== valid.c)) { this._tokenMove(t, valid); }
    }

    // Notes
    const wantChips = new Set();
    const notes = v.notes || {};
    for (const k of Object.keys(notes)) {
      const cell = parseCell(k);
      if (!cell || !this._inBoard(cell.r, cell.c)) continue;
      const ids = Array.isArray(notes[k]) ? notes[k] : [];
      for (const id of ids) if (this._chipMats.has(id)) wantChips.add(`${cell.r},${cell.c}|${id}`);
    }
    for (const [key, mesh] of this.chips) {
      if (!wantChips.has(key) && mesh.visible && !mesh.userData.leaving) this._popOut(mesh);
    }
    for (const key of wantChips) {
      let mesh = this.chips.get(key);
      if (!mesh) {
        const [ck, id] = key.split('|');
        const cell = parseCell(ck);
        const info = this._chipMats.get(id);
        mesh = new THREE.Mesh(this._geo.chip, info.mat);
        mesh.renderOrder = 20;
        mesh.raycast = noRaycast;
        this._cellPos(cell.r, cell.c, mesh.position);
        const col = info.slot % 3, row = Math.floor(info.slot / 3);
        mesh.position.x += (col - 1) * 0.3;
        mesh.position.z += (row - 1) * 0.3;
        // Sit on top of occupiable objects (chair seat, bed, sofa...) instead of the floor.
        mesh.position.y = this._stand(cell.r, cell.c).y + 0.035 + info.slot * 0.0005;
        mesh.visible = false;
        this.decals.add(mesh);
        this.chips.set(key, mesh);
      }
      if (!mesh.visible || mesh.userData.leaving) this._popIn(mesh, 1);
    }

    // Marks (red X)
    const marks = new Set((v.marks || []).map((k) => { const c = parseCell(k); return c ? keyOf(c.r, c.c) : null; }).filter(Boolean));
    this._syncDecals(this.markMeshes, marks, this._mat.mark, 0.018, 5);

    // Auto marks (faint grey X) — skip cells with a token, blocking object or a real mark.
    const occupied = new Set();
    for (const id of Object.keys(placements)) { const c = parseCell(placements[id]); if (c) occupied.add(keyOf(c.r, c.c)); }
    const autos = new Set();
    for (const k of v.autoMarks || []) {
      const c = parseCell(k); if (!c) continue;
      const kk = keyOf(c.r, c.c);
      if (occupied.has(kk) || marks.has(kk) || this.objectsAt.get(kk)?.blocking) continue;
      autos.add(kk);
    }
    this._syncDecals(this.autoMeshes, autos, this._mat.auto, 0.013, 4);

    // Selection + hover
    // Plaques pop up on their posts while a token stands right in front of them.
    if (this._plaques) {
      const occ = new Set();
      for (const id of Object.keys(placements)) { const c = parseCell(placements[id]); if (c) occ.add(keyOf(c.r, c.c)); }
      for (const pq of this._plaques) pq.target = pq.cells.some((k) => occ.has(k)) ? 0.34 : 0;
    }
    this._selected = v.selected ?? null;
    const hv = parseCell(v.hover);
    if (hv && this._inBoard(hv.r, hv.c)) {
      this._cellPos(hv.r, hv.c, this.hoverMesh.position); this.hoverMesh.position.y = 0.009;
      this.hoverMesh.visible = true;
    } else this.hoverMesh.visible = false;

    this.view = v;
  }

  _syncDecals(map, want, mat, y, order) {
    for (const [k, mesh] of map) if (!want.has(k) && mesh.visible && !mesh.userData.leaving) this._popOut(mesh);
    for (const k of want) {
      if (!this._inBoard(...k.split(',').map(Number))) continue;
      let mesh = map.get(k);
      if (!mesh) {
        const c = parseCell(k);
        mesh = new THREE.Mesh(this._geo.mark, mat);
        this._cellPos(c.r, c.c, mesh.position); mesh.position.y = this._stand(c.r, c.c).y + y;
        mesh.rotation.y = ((c.r * 7 + c.c * 3) % 5 - 2) * 0.06; // hand-painted wobble
        mesh.renderOrder = order; mesh.visible = false; mesh.raycast = noRaycast;
        this.decals.add(mesh); map.set(k, mesh);
      }
      if (!mesh.visible || mesh.userData.leaving) this._popIn(mesh, 1);
    }
  }

  _popIn(mesh, target) {
    mesh.userData.anim?.cancel();
    mesh.userData.leaving = false;
    mesh.visible = true;
    const s0 = mesh.visible && mesh.scale.x < 1 ? mesh.scale.x : 0.01;
    mesh.userData.anim = this._tweens.add(220, (e) => { mesh.scale.setScalar(Math.max(0.01, s0 + (target - s0) * e)); }, { ease: Ease.outBack });
  }
  _popOut(mesh) {
    mesh.userData.anim?.cancel();
    mesh.userData.leaving = true;
    const s0 = mesh.scale.x;
    mesh.userData.anim = this._tweens.add(160, (e) => { mesh.scale.setScalar(Math.max(0.01, s0 * (1 - e))); },
      { ease: Ease.outCubic, onDone: () => { mesh.visible = false; mesh.userData.leaving = false; } });
  }

  // ------------------------------------------------------------------ token animations
  _resetHop(t) {
    t.hop.position.set(0, 0, 0); t.hop.rotation.set(0, 0, 0); t.hop.scale.set(1, 1, 1);
  }
  _squash(t, amt) { // amt: + = stretch tall, - = squash
    const sy = 1 + amt;
    const sxz = 1 / Math.sqrt(Math.max(0.3, sy));
    t.hop.scale.set(sxz, sy, sxz);
  }
  _tokenPlace(t, cell, delay = 0) {
    t.anim?.cancel();
    t.cell = { r: cell.r, c: cell.c };
    const st = this._stand(cell.r, cell.c);
    const p = this._cellPos(cell.r, cell.c);
    t.root.position.set(p.x, st.y, p.z + st.dz);
    t.root.visible = true;
    this._resetHop(t);
    t.hop.scale.setScalar(0.01);
    t.anim = this._tweens.add(560, (_, raw) => {
      if (raw < 0.65) {
        const u = raw / 0.65;
        const s = Math.min(1, Ease.outBack(Math.min(1, u * 1.8)));
        t.hop.position.y = Math.sin(Math.PI * u) * 0.65;
        const sy = 1 + 0.18 * Math.sin(Math.PI * u);
        const sxz = 1 / Math.sqrt(sy);
        t.hop.scale.set(sxz * s, sy * s, sxz * s);
      } else {
        const w = (raw - 0.65) / 0.35;
        t.hop.position.y = 0;
        this._squash(t, -0.24 * Math.sin(Math.PI * w) * (1 - w * 0.4));
      }
    }, { delay, onDone: () => this._resetHop(t) });
  }
  _tokenMove(t, cell) {
    t.anim?.cancel();
    const from = t.root.position.clone();
    const st = this._stand(cell.r, cell.c);
    const to = this._cellPos(cell.r, cell.c); to.y = st.y; to.z += st.dz;
    t.cell = { r: cell.r, c: cell.c };
    t.root.visible = true;
    this._resetHop(t);
    const dist = Math.hypot(to.x - from.x, to.z - from.z);
    const H = 0.45 + 0.12 * Math.min(dist, 5);
    const dur = 420 + 60 * Math.min(dist, 5);
    t.anim = this._tweens.add(dur, (_, raw) => {
      if (raw < 0.78) {
        const u = raw / 0.78;
        const e = Ease.inOutCubic(u);
        t.root.position.set(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e, from.z + (to.z - from.z) * e);
        t.hop.position.y = Math.sin(Math.PI * u) * H;
        this._squash(t, u < 0.12 ? -0.18 * Math.sin((u / 0.12) * Math.PI) : 0.14 * Math.sin(Math.PI * u));
      } else {
        const w = (raw - 0.78) / 0.22;
        t.root.position.copy(to);
        t.hop.position.y = 0;
        this._squash(t, -0.22 * Math.sin(Math.PI * w));
      }
    }, { onDone: () => { t.root.position.copy(to); this._resetHop(t); } });
  }
  _tokenRemove(t) {
    t.anim?.cancel();
    t.cell = null;
    const s0 = t.hop.scale.x || 1;
    t.anim = this._tweens.add(260, (_, raw) => {
      const s = raw < 0.3 ? s0 * (1 + 0.25 * (raw / 0.3)) : s0 * 1.25 * (1 - Ease.outCubic((raw - 0.3) / 0.7));
      t.hop.scale.setScalar(Math.max(0.01, s));
    }, { onDone: () => { t.root.visible = false; this._resetHop(t); } });
  }

  // ------------------------------------------------------------------ effects
  highlightCells(cells, color = '#ffd84d', ms = 2000) {
    if (!this.board) return;
    const list = Array.isArray(cells) ? cells : [cells];
    const mat = new THREE.MeshBasicMaterial({ map: this._tex.glow, color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const meshes = [];
    for (const raw of list) {
      const c = parseCell(raw);
      if (!c || !this._inBoard(c.r, c.c)) continue;
      const m = new THREE.Mesh(this._geo.glow, mat);
      this._cellPos(c.r, c.c, m.position); m.position.y = 0.009; m.renderOrder = 2;
      this.fx.add(m); meshes.push(m);
    }
    if (!meshes.length) { mat.dispose(); return; }
    const dur = Math.max(200, ms);
    const tw = this._tweens.add(dur, (_, raw) => {
      const tSec = (raw * dur) / 1000;
      const fadeIn = Math.min(1, raw * dur / 150);
      const fadeOut = raw > 0.75 ? 1 - (raw - 0.75) / 0.25 : 1;
      mat.opacity = (0.8 + 0.2 * Math.sin(tSec * Math.PI * 3)) * fadeIn * fadeOut;
    }, { onDone: () => { cleanup(); this._fxTweens.delete(entry); } });
    const cleanup = () => { meshes.forEach((m) => this.fx.remove(m)); mat.dispose(); };
    const entry = { tw, cleanup };
    (this._fxTweens ||= new Set()).add(entry);
  }

  playWrong(ids) {
    const list = Array.isArray(ids) ? ids : ids != null ? [ids] : [];
    const cells = [];
    for (const id of list) {
      const t = this.tokens.get(id);
      if (!t || !t.cell) continue;
      cells.push(t.cell);
      t.shake?.cancel();
      t.shake = this._tweens.add(700, (_, raw) => {
        const k = 1 - raw;
        t.hop.position.x = Math.sin(raw * Math.PI * 12) * 0.08 * k;
        t.hop.rotation.z = Math.sin(raw * Math.PI * 12 + 0.6) * 0.14 * k;
        const f = Math.abs(Math.sin(raw * Math.PI * 3)) * k;
        for (const m of t.materials) if (m.emissive) m.emissive.setRGB(0.9 * f, 0.08 * f, 0.08 * f);
      }, {
        onDone: () => {
          t.hop.position.x = 0; t.hop.rotation.z = 0;
          for (const m of t.materials) if (m.emissive) m.emissive.setRGB(0, 0, 0);
        },
      });
    }
    if (cells.length) this.highlightCells(cells, '#ff5a5a', 900);
  }

  playWin({ victimId, murdererId } = {}) {
    this._clearWin();
    const win = { tweens: [], objs: [] };
    this._win = win;
    const victim = this.tokens.get(victimId);
    if (victim && victim.cell) {
      victim.anim?.cancel();
      win.tweens.push(this._tweens.add(900, (e) => {
        victim.hop.rotation.z = -Math.PI / 2 * e;
        victim.hop.position.y = 0.21 * e;
        victim.hop.position.x = -0.3 * e;
      }, { ease: Ease.outBounce, delay: 150 }));
    }
    const m = this.tokens.get(murdererId);
    if (m && m.cell) {
      m.anim?.cancel();
      const pos = m.root.position;
      // Spotlight + visible cone
      const spot = this.spot;
      spot.position.set(pos.x, pos.y + 7, pos.z);
      spot.target.position.set(pos.x, pos.y, pos.z);
      spot.target.updateMatrixWorld();
      const coneMat = new THREE.MeshBasicMaterial({
        color: '#fff6c8', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.62, 6, 32, 1, true), coneMat);
      cone.position.set(pos.x, pos.y + 3, pos.z);
      cone.renderOrder = 20;
      this.scene.add(cone);
      win.objs.push(cone);
      win.tweens.push(this._tweens.add(700, (e) => {
        spot.intensity = 6 * e;
        coneMat.opacity = 0.2 * e;
        this.hemi.intensity = this._baseLight.hemi * (1 - 0.5 * e);
        this.sun.intensity = this._baseLight.sun * (1 - 0.6 * e);
        this.fill.intensity = this._baseLight.fill * (1 - 0.5 * e);
        this.rim.intensity = this._baseLight.rim * (1 - 0.3 * e);
        this.scene.environmentIntensity = this._baseLight.env * (1 - 0.5 * e);
      }, { ease: Ease.outCubic }));
      win.tweens.push(this._tweens.add(3200, (_, raw) => {
        const k = 1 - raw * 0.5;
        const ph = (raw * 6) % 1;
        m.hop.position.y = Math.sin(ph * Math.PI) * 0.32 * k;
        m.hop.rotation.y = raw * Math.PI * 2;
        this._squash(m, ph < 0.15 ? -0.2 * Math.sin((ph / 0.15) * Math.PI) * k : 0.1 * Math.sin(ph * Math.PI) * k);
      }, { delay: 300, onDone: () => { m.hop.position.y = 0; m.hop.rotation.y = 0; m.hop.scale.set(1, 1, 1); } }));
    }
    this._spawnConfetti(win);
  }

  _spawnConfetti(win) {
    const COUNT = 260;
    const geo = new THREE.PlaneGeometry(0.09, 0.14);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    mesh.frustumCulled = false;
    mesh.renderOrder = 15;
    const palette = ['#ff6b6b', '#ffd84d', '#6abf69', '#4f86c6', '#9b6bd1', '#ff9ff3', '#5bc0be', '#f08a4b'];
    const col = new THREE.Color();
    const N = this.N;
    const parts = [];
    for (let i = 0; i < COUNT; i++) {
      col.set(palette[i % palette.length]);
      mesh.setColorAt(i, col);
      parts.push({
        p: new THREE.Vector3((Math.random() - 0.5) * N * 0.6, 2.5 + Math.random() * 1.5, (Math.random() - 0.5) * N * 0.6),
        v: new THREE.Vector3((Math.random() - 0.5) * 5, 3 + Math.random() * 4, (Math.random() - 0.5) * 5),
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        w: new THREE.Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4),
        delay: Math.random() * 0.4,
      });
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
    win.objs.push(mesh);
    win.confetti = { mesh, parts, t: 0, life: 3.2, dummy: new THREE.Object3D() };
  }

  _updateConfetti(dt) {
    const cf = this._win?.confetti;
    if (!cf) return;
    cf.t += dt;
    const { mesh, parts, dummy } = cf;
    const fade = cf.t > cf.life - 0.6 ? Math.max(0, (cf.life - cf.t) / 0.6) : 1;
    for (let i = 0; i < parts.length; i++) {
      const q = parts[i];
      if (cf.t > q.delay) {
        q.v.y -= 6.5 * dt;
        q.v.multiplyScalar(1 - 1.6 * dt);
        q.v.y = Math.max(q.v.y, -1.6);
        q.p.addScaledVector(q.v, dt);
        q.p.x += Math.sin(cf.t * 3 + i) * 0.004;
        q.r.x += q.w.x * dt; q.r.y += q.w.y * dt; q.r.z += q.w.z * dt;
      }
      dummy.position.copy(q.p);
      dummy.rotation.copy(q.r);
      dummy.scale.setScalar(cf.t > q.delay ? fade : 0.0001);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (cf.t >= cf.life) {
      this.scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose?.();
      this._win.objs = this._win.objs.filter((o) => o !== mesh);
      this._win.confetti = null;
    }
  }

  _clearWin() {
    const w = this._win;
    if (!w) return;
    w.tweens.forEach((t) => t.cancel());
    for (const o of w.objs) {
      this.scene.remove(o);
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    }
    this._win = null;
    this.spot.intensity = 0;
    this.hemi.intensity = this._baseLight.hemi;
    this.sun.intensity = this._baseLight.sun;
    this.fill.intensity = this._baseLight.fill;
    this.rim.intensity = this._baseLight.rim;
    this.scene.environmentIntensity = this._baseLight.env;
    for (const t of this.tokens.values()) { if (t.cell) this._resetHop(t); }
  }

  _clearFx() {
    if (this._fxTweens) { for (const f of this._fxTweens) { f.tw.cancel(); f.cleanup(); } this._fxTweens.clear(); }
  }

  // ------------------------------------------------------------------ camera
  _dirFrom(polar, azimuth, out = new THREE.Vector3()) {
    return out.set(Math.sin(polar) * Math.sin(azimuth), Math.cos(polar), Math.sin(polar) * Math.cos(azimuth));
  }
  /** Distance at which the whole board fits the view for the given angles and current aspect. */
  _computeFit(polar, azimuth) {
    const cam = this._fitCam;
    cam.fov = this.camera.fov; cam.aspect = this.camera.aspect; cam.updateProjectionMatrix();
    const h = this.N / 2 + FRAME_W + 0.08;
    const pts = [];
    for (const y of [-0.45, 0.25]) for (const x of [-h, h]) for (const z of [-h, h]) pts.push(new THREE.Vector3(x, y, z));
    // coordinate labels (sides, bottom, and the pushed-out top row) and the raised room plaques
    const ls = this._labelSize || 0.3, lo = this._labelOff || h, lt = this._labelTopOff || h;
    const lx = lo + ls / 2, ly = FRAME_TOP + 0.06 + ls;
    for (const x of [-lx, lx]) for (const z of [-(lt + ls / 2), lo + ls / 2]) pts.push(new THREE.Vector3(x, ly, z));
    const ph = this._plaqueH || 0.3;
    for (const x of [-h + 0.4, h - 0.4]) pts.push(new THREE.Vector3(x, 0.5 + 0.9 * ph + 0.15, -(this.N / 2) - 0.8 * ph));
    // figurines / tall objects on the back and front rows
    for (const x of [-h + 0.4, h - 0.4]) for (const z of [-h + 0.5, h - 0.5]) pts.push(new THREE.Vector3(x, 1.15, z));
    // real object bounds (trees, signs, ...): their box corners, cached per puzzle
    if (!this._objPts) {
      this._objPts = [];
      const box = new THREE.Box3();
      for (const o of this.objectsAt.values()) {
        if (!o.group || !(o.height > 0.3)) continue;
        box.setFromObject(o.group);
        if (box.isEmpty()) continue;
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) this._objPts.push(new THREE.Vector3(x, y, z));
      }
    }
    for (const q of this._objPts) pts.push(q);
    const dir = this._dirFrom(polar, azimuth);
    const target = new THREE.Vector3();
    const v = new THREE.Vector3();
    const place = (d) => {
      cam.position.copy(target).addScaledVector(dir, d);
      cam.lookAt(target); cam.updateMatrixWorld(true);
    };
    const fits = (d) => {
      place(d);
      for (const p of pts) {
        v.copy(p).project(cam);
        if (v.z > 1 || Math.abs(v.x) > 0.92 || Math.abs(v.y) > 0.9) return false;
      }
      return true;
    };
    const search = () => {
      let lo = 1, hi = 200;
      for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
      return hi;
    };
    // Fit, then slide the orbit target along z so the board sits centred vertically; repeat to converge.
    let d = search();
    const k = Math.tan((cam.fov * DEG) / 2) / Math.max(0.2, Math.cos(polar));
    for (let it = 0; it < 4; it++) {
      place(d);
      let y0 = Infinity, y1 = -Infinity;
      for (const p of pts) { v.copy(p).project(cam); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
      target.z += -((y0 + y1) / 2) * d * k;
      d = search();
    }
    return { d, tz: target.z };
  }
  /** Lighting mood: 'day' | 'golden' | 'night'. override=true keeps it for the next puzzles too. */
  setMood(name, override = false) {
    const m = MOODS[name] ? name : 'day', M = MOODS[m];
    this.mood = m;
    if (override) this._moodOverride = m;
    const b = this._baseLight;
    this.hemi.color.set(M.hemi[0]); this.hemi.groundColor.set(M.hemi[1]); b.hemi = M.hemi[2];
    this.sun.color.set(M.sun[0]); b.sun = M.sun[1];
    this.fill.color.set(M.fill[0]); b.fill = M.fill[1];
    this.rim.color.set(M.rim[0]); b.rim = M.rim[1]; b.env = M.env;
    this.hemi.intensity = b.hemi; this.sun.intensity = b.sun; this.fill.intensity = b.fill; this.rim.intensity = b.rim;
    if ('intensity' in this.sun.shadow) this.sun.shadow.intensity = M.shadow;
    this.scene.environment = moodEnvironment(this.renderer, m);
    this.scene.environmentIntensity = M.env;
    this.scene.background.set(M.fog); this.scene.fog.color.set(M.fog);
    this._sunDir.set(...M.sunDir).normalize();
    this.post.setGrade(M.grade);
    setGlow(M.glow);
    this.world?.setMood?.(m, M);
    this._placeLamps(M.lamp);
    this._fitShadow();
    this._emit('mood', m);
  }
  /** Put the local lights on fires / lamps of the board first, then on the world's lamp posts. */
  _placeLamps(level) {
    const spots = [];
    const warm = { campfire: 0.5, fireplace: 0.45, oven: 0.5, heater: 0.45, arcade: 0.8, tv: 0.7 };
    for (const o of this.objectsAt.values()) if (warm[o.type]) spots.push({ p: o.group.position.clone().add(new THREE.Vector3(0, warm[o.type], 0.3)), pr: o.type === 'campfire' || o.type === 'fireplace' ? 0 : 1 });
    spots.sort((a, b) => a.pr - b.pr);
    for (const p of this.world?.lampSpots || []) spots.push({ p });
    this.lamps.forEach((l, i) => {
      const s = spots[i];
      l.intensity = s ? level : 0;
      if (s) l.position.copy(s.p);
    });
  }
  /** Aim the key light and fit its orthographic shadow frustum tightly around the board. */
  _fitShadow() {
    const N = this.N, e = N / 2 + 2.6; // a little of the surrounding world receives / casts shadows too
    const D = N * 1.5 + 8;
    this.sun.position.copy(this._sunDir).multiplyScalar(D);
    this.sun.target.position.set(0, 0, 0);
    this.sun.target.updateMatrixWorld();
    const tmp = new THREE.OrthographicCamera();
    tmp.position.copy(this.sun.position); tmp.lookAt(0, 0, 0); tmp.updateMatrixWorld(true);
    const inv = tmp.matrixWorld.clone().invert();
    const v = new THREE.Vector3();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const y of [-0.6, 2.0]) for (const x of [-e, e]) for (const z of [-e, e]) {
      v.set(x, y, z).applyMatrix4(inv);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
    }
    const sc = this.sun.shadow.camera;
    sc.left = x0 - 0.1; sc.right = x1 + 0.1; sc.bottom = y0 - 0.1; sc.top = y1 + 0.1;
    sc.near = Math.max(0.1, -z1 - 0.5); sc.far = -z0 + 0.5;
    sc.updateProjectionMatrix();
    // keep the soft-edge size roughly constant in world units
    this.sun.shadow.radius = 2.5;
  }
  _applyCamera(polar, azimuth, dist) {
    const dir = this._dirFrom(polar, azimuth);
    this.camera.position.copy(this.controls.target).addScaledVector(dir, dist);
    this.camera.lookAt(this.controls.target);
  }
  _resize(force = false) {
    if (this._disposed) return;
    const w = Math.max(1, this.container.clientWidth | 0);
    const h = Math.max(1, this.container.clientHeight | 0);
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    if (!force && w === this._w && h === this._h && pr === this._pr) return;
    this._pr = pr;
    if (this.renderer.getPixelRatio() !== pr) this.renderer.setPixelRatio(pr);
    this._w = w; this._h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const oldFit = this._fitD;
    const { d: fit, tz } = this._computeFit(DEFAULT_POLAR, DEFAULT_AZIMUTH);
    this._fitD = fit;
    this.scene.fog.near = fit + this.N * 0.9 + 4; this.scene.fog.far = fit + this.N * 3.2 + 22;
    this.controls.minDistance = fit * 0.5;
    this.controls.maxDistance = fit * 1.45;
    const off = this.camera.position.clone().sub(this.controls.target);
    this.controls.target.set(0, 0, tz);
    if (oldFit > 0) {
      const len = THREE.MathUtils.clamp(off.length() * (fit / oldFit), this.controls.minDistance, this.controls.maxDistance);
      this.camera.position.copy(this.controls.target).add(off.setLength(len));
    }
  }

  resetCamera() {
    const off = this.camera.position.clone().sub(this.controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    const from = { p: sph.phi, a: sph.theta, d: sph.radius };
    const to = { p: DEFAULT_POLAR, a: DEFAULT_AZIMUTH, d: this._fitD };
    this._camTween?.cancel();
    this._camTween = this._tweens.add(550, (e) => {
      this._applyCamera(from.p + (to.p - from.p) * e, from.a + (to.a - from.a) * e, from.d + (to.d - from.d) * e);
    }, { ease: Ease.inOutCubic });
  }

  // ------------------------------------------------------------------ input
  _pick(e) {
    if (!this.puzzle) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    this._ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this._raycaster.setFromCamera(this._ndc, this.camera);
    // Tokens first (they are tall and cover the cells behind them)
    const vis = [];
    for (const t of this.tokens.values()) if (t.cell && t.root.visible) vis.push(t.root);
    if (vis.length) {
      const hits = this._raycaster.intersectObjects(vis, true);
      for (const h of hits) {
        const id = h.object.userData.tokenId;
        const t = id != null && this.tokens.get(id);
        if (t && t.cell) return { cell: { r: t.cell.r, c: t.cell.c }, tokenId: id };
      }
    }
    const pt = new THREE.Vector3();
    if (!this._raycaster.ray.intersectPlane(this._plane, pt)) return null;
    const h = (this.N - 1) / 2;
    const c = Math.round(pt.x + h), r = Math.round(pt.z + h);
    if (!this._inBoard(r, c)) return null;
    return { cell: { r, c }, tokenId: null };
  }

  _onPointerDown(e) {
    if (e.pointerType === 'touch') {
      this._touches.add(e.pointerId);
      if (this._touches.size > 1) { this._cancelPress(); return; }
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (this._press) return;
    const hit = this._pick(e);
    if (!hit) return;
    try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    const press = {
      id: e.pointerId, type: e.pointerType, x0: e.clientX, y0: e.clientY, t0: performance.now(),
      cell: hit.cell, lastCell: hit.cell, tokenId: hit.tokenId, moved: 0, held: false, painted: false, timer: 0,
    };
    press.timer = setTimeout(() => this._fireHold(press), HOLD_MS);
    this._press = press;
    const p = this._cellPos(hit.cell.r, hit.cell.c, this.holdRing.position);
    p.y = this._stand(hit.cell.r, hit.cell.c).y + 0.03;
    this.holdRing.scale.setScalar(1);
    this._holdUniforms.uProgress.value = 0;
    this._holdUniforms.uOpacity.value = 0;
    this.holdRing.visible = true;
  }

  _fireHold(press) {
    if (this._press !== press || press.painted || press.held) return;
    press.held = true;
    this._holdUniforms.uProgress.value = 1;
    this._emit('cellHold', { r: press.cell.r, c: press.cell.c });
    // little pop then hide
    this._holdPop?.cancel();
    this._holdPop = this._tweens.add(220, (e) => {
      this.holdRing.scale.setScalar(1 + 0.35 * e);
      this._holdUniforms.uOpacity.value = 1 - e;
    }, { onDone: () => { this.holdRing.visible = false; this.holdRing.scale.setScalar(1); } });
  }

  _onPointerMove(e) {
    const press = this._press;
    if (press && e.pointerId === press.id) {
      press.moved = Math.max(press.moved, Math.hypot(e.clientX - press.x0, e.clientY - press.y0));
      const hit = this._pick(e);
      if (hit && !press.held && (hit.cell.r !== press.lastCell.r || hit.cell.c !== press.lastCell.c)) {
        const start = !press.painted;
        if (start) {
          press.painted = true;
          clearTimeout(press.timer);
          this.holdRing.visible = false;
        }
        // Walk intermediate cells so fast drags don't skip any.
        const a = press.lastCell, b = hit.cell;
        const steps = Math.max(Math.abs(b.r - a.r), Math.abs(b.c - a.c));
        let prev = a;
        for (let i = 1; i <= steps; i++) {
          const r = Math.round(a.r + ((b.r - a.r) * i) / steps), c = Math.round(a.c + ((b.c - a.c) * i) / steps);
          if (r === prev.r && c === prev.c) continue;
          const payload = { r, c };
          if (start && i === 1) payload.start = { r: press.cell.r, c: press.cell.c };
          this._emit('cellPaint', payload);
          prev = { r, c };
        }
        press.lastCell = { r: b.r, c: b.c };
      }
    }
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
      if (!press || e.pointerId === press.id) {
        const hit = press ? null : this._pick(e);
        if (!press) {
          const k = hit ? keyOf(hit.cell.r, hit.cell.c) : null;
          if (k !== this._hoverKey) { this._hoverKey = k; this._emit('cellHover', hit ? { r: hit.cell.r, c: hit.cell.c } : null); }
          this.canvas.style.cursor = hit?.tokenId ? 'pointer' : hit ? 'crosshair' : 'default';
        }
      }
    }
  }

  _onPointerUp(e) {
    if (e.pointerType === 'touch') this._touches.delete(e.pointerId);
    const press = this._press;
    if (!press || e.pointerId !== press.id) return;
    clearTimeout(press.timer);
    this._press = null;
    try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    if (!press.held) this.holdRing.visible = false;
    const elapsed = performance.now() - press.t0;
    if (!press.held && !press.painted && press.moved <= TAP_MOVE_PX && elapsed < HOLD_MS) {
      if (press.tokenId != null) this._emit('tokenTap', { id: press.tokenId });
      else this._emit('cellTap', { r: press.cell.r, c: press.cell.c });
    }
  }

  _onPointerCancel(e) {
    if (e.pointerType === 'touch') this._touches.delete(e.pointerId);
    if (this._press && this._press.id === e.pointerId) this._cancelPress();
  }

  _onPointerLeave(e) {
    if ((e.pointerType === 'mouse' || e.pointerType === 'pen') && !this._press && this._hoverKey !== null) {
      this._hoverKey = null;
      this._emit('cellHover', null);
    }
  }

  _cancelPress() {
    const p = this._press;
    if (!p) return;
    clearTimeout(p.timer);
    this._press = null;
    if (!p.held && this.holdRing) this.holdRing.visible = false;
  }

  // ------------------------------------------------------------------ loop
  _loop(now) {
    if (this._disposed) return;
    this._raf = requestAnimationFrame(this._loop);
    now = performance.now();
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this._tweens.tick(now);
    this.controls.update();
    const time = (now - this._t0) / 1000;

    // Hold ring progress
    const press = this._press;
    if (press && !press.held && !press.painted && this.holdRing.visible) {
      const prog = Math.min(1, (now - press.t0) / HOLD_MS);
      this._holdUniforms.uProgress.value = prog;
      this._holdUniforms.uOpacity.value = THREE.MathUtils.smoothstep(prog, 0.12, 0.3);
    }

    // Selection ring follows (and bobs around) the selected token
    const sel = this._selected != null ? this.tokens.get(this._selected) : null;
    if (sel && sel.cell && sel.root.visible) {
      const rp = sel.root.position;
      this.selRing.visible = true; this.selPulse.visible = true;
      this.selRing.position.set(rp.x, rp.y + 0.03 + 0.025 * (0.5 + 0.5 * Math.sin(time * 4)), rp.z);
      this.selRing.rotation.y = time * 0.8;
      const s = 1 + 0.04 * Math.sin(time * 4);
      this.selRing.scale.set(s, 1, s);
      const ph = (time * 0.9) % 1;
      this.selPulse.position.set(rp.x, rp.y + 0.025, rp.z);
      this.selPulse.scale.set(1 + 0.6 * ph, 1, 1 + 0.6 * ph);
      this._mat.pulse.opacity = 0.65 * (1 - ph) * (1 - ph);
    } else { this.selRing.visible = false; this.selPulse.visible = false; }

    // Raise / lower plaques
    if (this._plaques) {
      for (const pq of this._plaques) {
        if (Math.abs(pq.lift - pq.target) < 1e-4) continue;
        pq.lift += (pq.target - pq.lift) * Math.min(1, dt * 9);
        if (Math.abs(pq.lift - pq.target) < 0.002) pq.lift = pq.target;
        pq.g.position.y = pq.baseY + pq.lift;
        const k = (pq.baseY + pq.lift) / pq.baseY;
        for (const post of pq.g.userData.posts || []) post.scale.y = k;
      }
    }

    // Hover glow breathes a little
    if (this.hoverMesh.visible) this._mat.hover.opacity = 0.78 + 0.2 * Math.sin(time * 4.5);

    // Gently drifting water surface (shared texture, tiny offset so baked cell grid stays aligned)
    const calm = !!(this._reduceMotion && this._reduceMotion.matches);
    if (!calm) this._timeU.value = time;
    const wt = this._floorTex.get('water');
    if (wt && !calm) wt.offset.set(0.006 * Math.sin(time * 0.7), 0.006 * Math.cos(time * 0.55));

    // Idle hooks (breathing figurines, flickering flames…) + token contact shadows
    if (!calm) try { this.world?.update?.(time, dt); } catch (e) { console.error(e); this.world.update = null; }
    if (this.board) {
      for (const t of this.tokens.values()) {
        if (!t.root.visible) continue;
        if (!calm) try { t.fig.userData.idle?.(time); t.root.userData.idle?.(time); } catch (e) { console.error(e); t.fig.userData.idle = null; }
        const lift = Math.max(0, t.hop.position.y);
        const k = Math.max(0.35, 1 - lift * 0.9) * Math.min(1, Math.max(t.hop.scale.x, 0.01));
        t.blob.scale.set(0.72 * k, 1, 0.72 * k);
      }
      if (!calm) for (const o of this.objectsAt.values()) {
        try { o.group.userData.idle?.(time); } catch (e) { console.error(e); o.group.userData.idle = null; }
      }
    }

    if ((window.devicePixelRatio || 1) !== this._dprSeen) { this._dprSeen = window.devicePixelRatio || 1; this._resize(); }
    this._updateConfetti(dt);
    if (this._w > 1 && this._h > 1) this.post.render(this.scene, this.camera);
  }

  // ------------------------------------------------------------------ portrait
  static portrait(character, size = 160) {
    try {
      const S = BoardView;
      if (!S._pr) {
        const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        r.setPixelRatio(1);
        r.setClearColor(0x000000, 0);
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.toneMapping = THREE.NeutralToneMapping;
        r.toneMappingExposure = 1.0;
        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight('#fff3e3', '#b4a4d8', 1.3));
        const d = new THREE.DirectionalLight('#ffdcb0', 2.3); d.position.set(-1.5, 3, 4); scene.add(d);
        const f = new THREE.DirectionalLight('#b9cfff', 0.6); f.position.set(3, 1, 2); scene.add(f);
        const rim = new THREE.DirectionalLight('#d8e4ff', 1.0); rim.position.set(1, 3, -3); scene.add(rim);
        const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
        cam.position.set(0.28, 0.74, 1.27);
        cam.lookAt(0, 0.63, 0);
        S._pr = { r, scene, cam };
      }
      const { r, scene, cam } = S._pr;
      const px = Math.max(16, size | 0);
      r.setSize(px, px, false);
      const fig = createFigurine(character);
      fig.rotation.y = -0.18;
      scene.add(fig);
      r.render(scene, cam);
      const url = r.domElement.toDataURL('image/png');
      scene.remove(fig);
      disposeObject(fig);
      return url;
    } catch (e) {
      console.error('portrait failed', e);
      return '';
    }
  }

  // ------------------------------------------------------------------ dispose
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    cancelAnimationFrame(this._raf);
    this._cancelPress();
    this._tweens.clear();
    this._clearFx();
    this._clearWin();
    this._ro?.disconnect();
    const cv = this.canvas;
    cv.removeEventListener('pointerdown', this._onPointerDown);
    cv.removeEventListener('pointermove', this._onPointerMove);
    cv.removeEventListener('pointerup', this._onPointerUp);
    cv.removeEventListener('pointercancel', this._onPointerCancel);
    cv.removeEventListener('pointerleave', this._onPointerLeave);
    cv.removeEventListener('contextmenu', this._onContextMenu);
    this.controls.dispose();
    if (this.board) { this.scene.remove(this.board); this._disposeBoard(this.board); this.board = null; }
    for (const t of this._floorTex.values()) t.dispose();
    this._floorTex.clear();
    Object.values(this._geo).forEach((g) => g.dispose());
    Object.values(this._mat).forEach((m) => m.dispose());
    Object.values(this._tex).forEach((t) => t.dispose());
    this._holdMat.dispose();
    this.post.dispose();
    this.renderer.dispose();
    if (cv.parentNode) cv.parentNode.removeChild(cv);
    this._listeners = {};
    if (this._chipMats) for (const { mat } of this._chipMats.values()) { mat.map?.dispose(); mat.dispose(); }
    this.tokens.clear(); this.objectsAt.clear(); this.chips.clear();
  }
}

Object.assign(BoardView.prototype, boardKit);
