// Soft vinyl-toy chibi figurines: big round head, bean body, mitten hands, chunky shoes, rounded coin base with letter.
// Everything static is merged into a few vertex-coloured meshes (own materials, flashable):
// static (coin rim + legs + shoes), coin face, torso, 2 arms, head, eyes (blink) + weapon (2 meshes) = ~9 draw calls.
import * as THREE from 'three';
import { createWeapon3d, vcMerge, vcMat, U, T } from './weapons3d.js';
import { toonOwn, softMat, hashStr, shade, mix, paleColor, contrastAccent, RB, TOR, CAPS } from './kit.js';

const PI = Math.PI;
// Head: ellipsoid, a little wider than tall.
const HX = 0.245, HY = 0.208, HZ = 0.225, HEAD_Y = 0.65;
const TY0 = 0.16; // torso base
const DISC_H = 0.053; // coin height
const ZO = -0.07; // body sits slightly behind the coin centre so the letter shows in front of the feet

// ---- torso profile (absolute y), used to stick details onto the surface ----------------------------------------
const TP = new THREE.SplineCurve([[0, 0], [0.09, 0.002], [0.15, 0.03], [0.176, 0.09], [0.172, 0.15], [0.146, 0.21], [0.1, 0.262], [0.05, 0.286], [0, 0.292]]
  .map(([r, y]) => new THREE.Vector2(r, y + TY0))).getPoints(12);
function tr(y) {
  for (let i = 1; i < TP.length; i++) if (y <= TP[i].y) { const a = TP[i - 1], b = TP[i]; return a.x + (b.x - a.x) * Math.max(0, (y - a.y) / (b.y - a.y || 1)); }
  return 0.02;
}
function tframe(x, y, off = 0) {
  const r = Math.max(tr(y), 0.04), z = Math.sqrt(Math.max(r * r - x * x, 0.0004));
  const pitch = Math.atan2(-(tr(y + 0.02) - tr(y - 0.02)), 0.04), yaw = Math.asin(THREE.MathUtils.clamp(x / r, -0.95, 0.95));
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, yaw, 0, 'YXZ'));
  const n = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z).addScaledVector(n, off), q, new THREE.Vector3(1, 1, 1));
}
const _bands = new Map();
function bandGeo(y0, y1, off) { // slice of the torso surface, a little bigger
  const k = `${y0}|${y1}|${off}`;
  let g = _bands.get(k);
  if (!g) {
    const pts = [];
    for (let i = 0; i <= 8; i++) { const y = y0 + (y1 - y0) * (i / 8); pts.push(new THREE.Vector2(tr(y) + off * (i === 0 || i === 8 ? 0.35 : 1), y)); }
    g = new THREE.LatheGeometry(pts, 18); _bands.set(k, g);
  }
  return g;
}
const SKIRT = new THREE.LatheGeometry([[0, 0.135], [0.215, 0.135], [0.252, 0.15], [0.256, 0.17], [0.215, 0.225], [0.182, 0.28], [0, 0.286]].map(([r, y]) => new THREE.Vector2(r, y)), 20);
const TORSO = new THREE.LatheGeometry(TP, 18);

// ---- head surface ------------------------------------------------------------------------------------------
function hsurf(x, y) { return HZ * Math.sqrt(Math.max(1 - (x / HX) ** 2 - (y / HY) ** 2, 0.0004)); }
function hframe(x, y, off = 0) {
  const z = hsurf(x, y);
  const n = new THREE.Vector3(x / (HX * HX), y / (HY * HY), z / (HZ * HZ)).normalize();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.asin(n.y), Math.atan2(n.x, n.z), 0, 'YXZ'));
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z).addScaledVector(n, off), q, new THREE.Vector3(1, 1, 1));
}
const _caps = new Map();
const capGeo = (theta) => { let g = _caps.get(theta); if (!g) { g = new THREE.SphereGeometry(1, 18, 8, 0, PI * 2, 0, theta); _caps.set(theta, g); } return g; };
const _brims = new Map();
function brimGeo(rin, rout, drop, th) {
  const k = `${rin}|${rout}|${drop}|${th}`;
  let g = _brims.get(k);
  if (!g) {
    const h = th / 2, mid = (rin + rout) / 2;
    g = new THREE.LatheGeometry([[rin, -h], [mid, -h - drop * 0.5], [rout, -h - drop], [rout + h * 0.9, -drop], [rout, h - drop], [mid, h - drop * 0.5], [rin, h]].map(([r, y]) => new THREE.Vector2(r, y)), 36);
    _brims.set(k, g);
  }
  return g;
}
const beardGeo = new THREE.SphereGeometry(1, 16, 8, PI / 2 - 1.25, 2.5, 2.2, 0.95);
const discGeo = new THREE.LatheGeometry([[0, 0], [0.36, 0], [0.382, 0.011], [0.39, 0.026], [0.376, 0.044], [0.345, 0.051], [0.3, 0.049], [0, 0.049]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
const faceGeo = new THREE.CircleGeometry(0.318, 40);

function discTexture(letter, outfit) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const x = cv.getContext('2d');
  x.fillStyle = '#fff3dc'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = shade(outfit, 1.45); x.lineWidth = 6;
  x.beginPath(); x.arc(128, 128, 118, 0, PI * 2); x.stroke();
  x.font = '900 112px "Trebuchet MS", "Segoe UI", Arial, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  x.lineWidth = 16; x.strokeStyle = '#fff3dc';
  x.strokeText(letter, 128, 196);
  x.fillStyle = shade(outfit, 0.52); x.fillText(letter, 128, 196);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.owned = true;
  return t;
}

/**
 * Builds a chibi figurine from character.look. Height ~1 (cell = 1), head centre at y=0.65, feet/base at y=0, faces +z.
 * group.userData.materials = own materials (for flashes). group.userData.idle(t) = breathing / blink / head tilt / arm sway.
 */
export function createFigurine(character, weapon) {
  const ch = character || {};
  const victim = !!ch.victim;
  const seed = hashStr(String(ch.id || ch.name || '?') + (ch.name || ''));
  const male = ch.gender === 'm', female = ch.gender === 'f';
  const look = { ...(ch.look || {}) };
  if (male) {
    if (look.hairStyle === 'long' || look.hairStyle === 'bun' || look.hairStyle === 'ponytail') look.hairStyle = ['short', 'slick', 'spiky', 'curly'][seed % 4];
    if (look.accessory === 'scarf') look.accessory = null;
  }
  if (female && (look.accessory === 'beard' || look.accessory === 'mustache')) look.accessory = null;
  const tint = (hex, fallback) => { const v = hex || fallback; return victim ? paleColor(v) : v; };
  const skin = tint(look.skin, '#f1c27d');
  const hair = tint(look.hair, '#3b2a1a');
  const outfit = tint(look.outfit, '#4f86c6');
  const accent = tint(contrastAccent(outfit), '#e07a5f');
  const letter = String(ch.id || '?').slice(0, 1).toUpperCase();
  const ex = seed % 5; // expression
  const style = look.hairStyle || 'short';
  const hat = look.accessory === 'hat';
  let ov = seed % 8; // outfit variant
  if (!female && ov === 6) ov = 2;

  const g = new THREE.Group();
  g.name = `figurine:${letter}`;
  const mats = [];
  const own = (m) => { mats.push(m); return m; };
  const mBody = own(vcMat(0.55));
  const mEyes = own(vcMat(0.12));

  const od = shade(outfit, 0.72), ol = shade(outfit, 1.4), cream = '#fff3dc';
  const shirt = mix(cream, outfit, 0.18);
  const hd = hair, hl = mix(hair, '#ffffff', 0.2);
  const hairC = [hd, hl, -0.04, 0.26];
  const skinC = [shade(skin, 0.97), shade(skin, 1.05), -0.2, 0.2];
  const shoeC = ['#6b4a3a', '#f6efe4', '#d65a4c', '#3f4f7a'][(seed >> 3) % 4];
  const pants = ov === 1 ? outfit : mix(shade(outfit, 0.5), '#3a3550', 0.45);
  const legC = ov === 6 ? skin : pants;

  // ---- Static: coin rim, legs, shoes
  const st = [];
  st.push({ g: discGeo, c: [shade(outfit, 0.62), shade(outfit, 1.08), 0, 0.04], p: [0, 0, 0] });
  for (const sx of [-1, 1]) {
    st.push({ g: CAPS(0.046, 0.05, 2, 8), c: legC, p: [sx * 0.078, 0.125, ZO + 0.01] });
    st.push({ g: U(8, 6), c: shoeC, p: [sx * 0.082, 0.085, ZO + 0.045], s: [0.072, 0.052, 0.105], r: [0.04, sx * 0.1, 0] });
    st.push({ g: U(7, 5), c: shade(shoeC, 1.25), p: [sx * 0.084, 0.07, ZO + 0.075], s: [0.065, 0.03, 0.095], r: [0.04, sx * 0.1, 0] });
  }
  const stMesh = new THREE.Mesh(vcMerge(st), mBody); g.add(stMesh);

  // ---- Coin face with the letter (readable from above, in front of the feet)
  const mFace = own(softMat({ map: discTexture(letter, outfit), roughness: 0.6 }));
  const face = new THREE.Mesh(faceGeo, mFace);
  face.rotation.x = -PI / 2; face.position.y = DISC_H + 0.0005; face.receiveShadow = true; g.add(face);

  const body = new THREE.Group(); body.position.z = ZO; g.add(body);

  // ---- Torso (bean) with outfit details
  const sleeveC = (ov === 1 || ov === 3 || ov === 4) ? shirt : ov === 7 ? od : outfit;
  const torsoC = (ov === 1 || ov === 3 || ov === 4) ? shirt : ov === 7 ? od : outfit;
  const tp = [{ g: TORSO, c: [shade(torsoC, 0.95), shade(torsoC, 1.04), TY0, 0.45] }];
  const on = (geo, c, x, y, off, s, r) => tp.push({ g: geo, c, m: tframe(x, y, off), s, r });
  const front = (x, y, off, geo, c, s, r) => on(geo, c, x, y, off, s, r);
  switch (ov) {
    case 0: // sweater: stripe, hem, roll neck
      tp.push({ g: bandGeo(0.262, 0.3, 0.007), c: ol });
      tp.push({ g: bandGeo(0.162, 0.2, 0.006), c: od });
      tp.push({ g: TOR(0.1, 0.034, 6, 14), c: ol, p: [0, 0.455, -0.005], r: [PI / 2, 0, 0] });
      break;
    case 1: // dungarees
      tp.push({ g: bandGeo(0.16, 0.285, 0.008), c: outfit });
      front(0, 0.345, 0.006, RB(0.13, 0.13, 0.03, 0.02, 1), outfit);
      front(0, 0.31, 0.02, RB(0.075, 0.05, 0.02, 0.012, 1), od);
      for (const sx of [-1, 1]) {
        front(sx * 0.06, 0.4, 0.008, CAPS(0.016, 0.09, 3, 8), outfit, null, [0, 0, -sx * 0.12]);
        front(sx * 0.05, 0.37, 0.03, U(8, 6), '#f2c14e', [0.016, 0.016, 0.01]);
      }
      break;
    case 2: // raincoat
      tp.push({ g: bandGeo(0.162, 0.2, 0.007), c: ol });
      tp.push({ g: U(), c: ol, p: [0, 0.43, -0.105], s: [0.12, 0.085, 0.07] });
      for (let i = 0; i < 3; i++) front(0, 0.38 - i * 0.065, 0.012, CAPS(0.014, 0.03, 3, 8), cream, null, [0, 0, PI / 2]);
      front(0.07, 0.22, 0.012, RB(0.075, 0.05, 0.02, 0.012, 1), od);
      break;
    case 3: // cardigan + shirt
      front(0, 0.33, 0.004, RB(0.07, 0.26, 0.02, 0.01, 1), cream);
      for (let i = 0; i < 3; i++) front(0.0, 0.4 - i * 0.07, 0.016, U(8, 6), outfit, [0.014, 0.014, 0.01]);
      for (const sx of [-1, 1]) front(sx * 0.052, 0.45, 0.01, U(), cream, [0.04, 0.024, 0.018], [0, 0, -sx * 0.5]);
      for (const sx of [-1, 1]) front(sx * 0.1, 0.2, 0.012, RB(0.06, 0.05, 0.016, 0.01, 1), od);
      tp.push({ g: bandGeo(0.162, 0.188, 0.006), c: od });
      break;
    case 4: // apron
      front(0, 0.25, 0.01, RB(0.17, 0.19, 0.026, 0.02, 1), outfit);
      front(0, 0.375, 0.012, RB(0.1, 0.1, 0.026, 0.02, 1), outfit);
      front(0, 0.245, 0.03, RB(0.085, 0.05, 0.02, 0.012, 1), accent);
      tp.push({ g: TOR(0.088, 0.012, 6, 20), c: outfit, p: [0, 0.44, -0.0], r: [PI / 2 - 0.2, 0, 0] });
      break;
    case 5: // polo
      for (const sx of [-1, 1]) front(sx * 0.055, 0.45, 0.012, U(), ol, [0.05, 0.026, 0.02], [0, 0, -sx * 0.55]);
      front(0, 0.395, 0.007, RB(0.03, 0.1, 0.016, 0.008, 1), ol);
      for (let i = 0; i < 2; i++) front(0, 0.425 - i * 0.045, 0.018, U(8, 6), cream, [0.011, 0.011, 0.008]);
      tp.push({ g: bandGeo(0.162, 0.185, 0.006), c: od });
      break;
    case 6: // dress
      tp.push({ g: SKIRT, c: [od, outfit, 0.135, 0.28] });
      tp.push({ g: bandGeo(0.262, 0.292, 0.007), c: accent });
      tp.push({ g: TOR(0.1, 0.022, 6, 24), c: cream, p: [0, 0.455, 0.0], r: [PI / 2 - 0.1, 0, 0] });
      break;
    default: // blazer + tie
      for (const sx of [-1, 1]) front(sx * 0.07, 0.38, 0.012, RB(0.055, 0.17, 0.02, 0.01, 1), shade(od, 1.3), null, [0, 0, sx * 0.3]);
      front(0, 0.375, 0.006, RB(0.055, 0.2, 0.018, 0.01, 1), cream);
      front(0, 0.34, 0.02, T(0.016, 0.026, 0.1, 10), accent, null, [PI, 0, 0]);
      front(0, 0.425, 0.02, U(), accent, [0.024, 0.02, 0.016]);
      front(-0.085, 0.3, 0.014, RB(0.04, 0.02, 0.014, 0.006, 1), cream);
      for (let i = 0; i < 2; i++) front(0.06, 0.28 - i * 0.04, 0.018, U(8, 6), '#2e2a45', [0.012, 0.012, 0.008]);
      tp.push({ g: bandGeo(0.162, 0.2, 0.006), c: shade(od, 1.15) });
  }
  // neck accessories
  if (look.accessory === 'bowtie') {
    for (const sx of [-1, 1]) front(sx * 0.052, 0.4, 0.018, U(), accent, [0.056, 0.04, 0.026], [0, 0, -sx * 0.22]);
    front(0, 0.4, 0.026, U(), shade(accent, 0.75), [0.024, 0.03, 0.022]);
  } else if (look.accessory === 'scarf') {
    const sc = accent, sc2 = shade(accent, 1.5);
    tp.push({ g: TOR(0.115, 0.048, 6, 16), c: sc, p: [0, 0.43, 0], r: [PI / 2 - 0.12, 0, 0] });
    front(0.075, 0.33, 0.03, RB(0.085, 0.2, 0.04, 0.018, 1), sc, null, [0, 0, -0.08]);
    front(0.078, 0.26, 0.036, RB(0.088, 0.03, 0.044, 0.012, 1), sc2, null, [0, 0, -0.08]);
    front(0.074, 0.35, 0.036, RB(0.088, 0.03, 0.044, 0.012, 1), sc2, null, [0, 0, -0.08]);
  }
  const torso = new THREE.Mesh(vcMerge(tp, -TY0), mBody);
  torso.position.y = TY0; if (male) torso.scale.x = 1.07;
  body.add(torso);

  // ---- Arms: tapered sleeve, cuff, mitten hand, thumb
  const arms = [];
  for (const sx of [-1, 1]) {
    const ap = [
      { g: T(0.064, 0.05, 0.115, 14), c: sleeveC, d: [0, -1, 0] },
      { g: TOR(0.053, 0.014, 5, 10), c: ov === 5 ? cream : shade(sleeveC, 1.35), p: [0, -0.125, 0], r: [PI / 2, 0, 0] },
      { g: U(8, 6), c: skin, p: [0, -0.192, 0.006], s: [0.05, 0.054, 0.05] },
      { g: U(7, 5), c: skin, p: [-sx * 0.036, -0.178, 0.026], s: [0.02, 0.026, 0.02] },
    ];
    const am = new THREE.Mesh(vcMerge(ap), mBody);
    const ag = new THREE.Group(); ag.position.set(sx * (male ? 0.19 : 0.182), 0.395, 0.0); ag.rotation.z = sx * 0.5;
    ag.add(am); body.add(ag); arms.push(ag);
  }

  // ---- Head group: head mesh (skin + hair + hat + accessories) and eyes mesh (blink)
  const head = new THREE.Group(); head.position.y = HEAD_Y; body.add(head);
  const hp = [{ g: U(18, 12), c: skinC, s: [HX, HY, HZ] }];
  for (const sx of [-1, 1]) hp.push({ g: U(), c: skin, p: [sx * 0.236, -0.012, -0.005], s: [0.032, 0.05, 0.04] });
  const fp = (geo, c, x, y, off, s, r, p) => hp.push({ g: geo, c, m: hframe(x, y, off), s, r, p });
  // blush, nose
  const blushC = victim ? mix(skin, '#c9a0b8', 0.4) : mix(skin, '#ff6f86', male ? 0.3 : 0.55);
  for (const sx of [-1, 1]) fp(U(), blushC, sx * 0.155, -0.058, -0.004, [0.042, 0.026, 0.014]);
  fp(U(), mix(skin, '#d97a64', 0.3), 0, -0.04, 0.004, [0.021, 0.018, 0.018]);
  // brows
  const browC = mix(hair, '#2a2030', 0.5);
  const bk = victim ? -0.38 : [-0.2, -0.16, -0.05, 0.0, 0.1][ex];
  for (const sx of [-1, 1]) {
    const lift = (ex === 2 && sx > 0 ? 0.014 : 0) + (ex === 4 ? 0.008 : 0) + (victim ? 0.008 : 0);
    fp(CAPS(0.0075, male ? 0.036 : 0.03, 3, 6), browC, sx * 0.098, 0.082 + lift, 0.0, null, [0, 0, PI / 2 + sx * bk]);
  }
  // mouth
  const mouthC = victim ? mix(skin, '#b8707c', 0.6) : '#74303c';
  const arcAt = (A, w, tilt = 0, dx = 0) => fp(TOR(w, 0.0068, 5, 14, A), mouthC, dx, -0.088, 0.004, null, [0, 0, 1.5 * PI - A / 2 + tilt], [0, w * 0.5, 0]);
  if (victim) fp(CAPS(0.006, 0.026, 3, 6), mouthC, 0, -0.092, 0.004, null, [0, 0, PI / 2]);
  else if (ex === 1) {
    fp(new THREE.CircleGeometry(0.036, 18, PI, PI), '#5a2230', 0, -0.075, 0.004);
    fp(U(), '#ff8fa0', 0, -0.092, 0.006, [0.02, 0.011, 0.004]);
  } else if (ex === 2) arcAt(0.75 * PI, 0.028, 0.18, 0.012);
  else if (ex === 3) fp(U(), mouthC, 0, -0.088, 0.004, [0.014, 0.018, 0.008]);
  else arcAt(PI, 0.031);

  // hair
  const cap = (theta, tilt, grow = 0.014) => ({ g: capGeo(theta), c: hairC, s: [HX + grow, HY + grow, HZ + grow], r: [tilt, 0, 0] });
  const blob = (x, y, z, sx, sy, sz, rz = 0, rx = 0, c = hairC) => ({ g: U(8, 6), c, p: [x, y, z], s: [sx, sy, sz], r: [rx, 0, rz] });
  const spike = (ux, uy, uz, len = 0.07) => {
    const u = new THREE.Vector3(ux, uy, uz).normalize();
    return { g: T(0.058, 0.03, len, 8), c: hairC, p: [u.x * HX * 0.9, u.y * HY * 0.9, u.z * HZ * 0.9], d: [u.x, u.y + 0.25, u.z] };
  };
  const hairParts = [];
  const fringe = (k = 1) => {
    hairParts.push(blob(-0.065, 0.165, 0.118, 0.15 * k, 0.055, 0.09, 0.32), blob(0.085, 0.172, 0.105, 0.1 * k, 0.05, 0.08, -0.22), blob(0, 0.225, 0.03, 0.12, 0.05, 0.1));
  };
  if (hat) {
    hairParts.push(blob(-0.232, -0.035, -0.01, 0.022, 0.085, 0.11), blob(0.232, -0.035, -0.01, 0.022, 0.085, 0.11), blob(0, -0.02, -0.205, 0.2, 0.1, 0.035));
    if (style === 'long') hairParts.push(blob(0, -0.1, -0.15, 0.24, 0.22, 0.11));
    if (style === 'ponytail') hairParts.push({ g: T(0.07, 0.03, 0.2, 12), c: hairC, p: [0, 0.0, -0.22], d: [0, -0.9, -0.55] });
  } else {
    switch (style) {
      case 'bald':
        hairParts.push(blob(-0.226, 0.03, -0.03, 0.03, 0.065, 0.07), blob(0.226, 0.03, -0.03, 0.03, 0.065, 0.07));
        hp.push({ g: capGeo(0.55), c: shade(skin, 1.1), s: [HX + 0.003, HY + 0.003, HZ + 0.003], r: [-0.45, 0, 0] });
        break;
      case 'long':
        hairParts.push(cap(1.44, -0.4), blob(-0.1, 0.16, 0.12, 0.11, 0.055, 0.09, 0.3), blob(0.0, 0.18, 0.13, 0.1, 0.05, 0.09), blob(0.1, 0.16, 0.12, 0.11, 0.055, 0.09, -0.3),
          blob(-0.222, -0.06, 0.01, 0.05, 0.155, 0.1), blob(0.222, -0.06, 0.01, 0.05, 0.155, 0.1), blob(0, -0.07, -0.13, 0.25, 0.22, 0.12));
        break;
      case 'bun':
        hairParts.push(cap(1.4, -0.42)); fringe(0.9);
        hairParts.push(blob(0, 0.255, -0.07, 0.092, 0.085, 0.092), { g: TOR(0.07, 0.014, 6, 16), c: accent, p: [0, 0.2, -0.05], r: [PI / 2 - 0.5, 0, 0] });
        break;
      case 'curly':
        hairParts.push(cap(1.3, -0.4));
        for (const [x, y, z, r] of [[-0.12, 0.2, 0.1, 0.1], [0.12, 0.2, 0.1, 0.1], [-0.2, 0.08, 0.0, 0.1], [0.2, 0.08, 0.0, 0.1], [0, 0.27, 0.0, 0.11], [-0.13, 0.1, -0.16, 0.1], [0.13, 0.1, -0.16, 0.1], [0, 0.18, -0.17, 0.1]]) hairParts.push(blob(x, y, z, r, r, r));
        break;
      case 'ponytail':
        hairParts.push(cap(1.4, -0.42)); fringe(0.95);
        hairParts.push(blob(0, 0.13, -0.2, 0.065, 0.065, 0.065), { g: T(0.07, 0.03, 0.22, 12), c: hairC, p: [0, 0.14, -0.21], d: [0, -0.8, -0.6] }, { g: TOR(0.06, 0.012, 6, 14), c: accent, p: [0, 0.135, -0.205], r: [PI / 2 - 1.0, 0, 0] });
        break;
      case 'spiky':
        hairParts.push(cap(1.3, -0.4), spike(0, 0.95, 0.1, 0.09), spike(-0.6, 0.75, 0.2), spike(0.6, 0.75, 0.2), spike(-0.3, 0.7, 0.65, 0.06), spike(0.35, 0.72, 0.6, 0.06), spike(-0.7, 0.55, -0.4), spike(0.7, 0.55, -0.4), spike(0, 0.6, -0.8, 0.08), spike(0.1, 0.85, -0.35, 0.08));
        break;
      case 'slick':
        hairParts.push(cap(1.36, -0.45), blob(0.0, 0.205, 0.095, 0.19, 0.07, 0.12, 0, -0.35), blob(-0.1, 0.16, 0.12, 0.1, 0.05, 0.08, 0.25), blob(0.12, 0.16, 0.1, 0.09, 0.045, 0.08, -0.3));
        break;
      default: // short, side swept
        hairParts.push(cap(1.4, -0.42)); fringe(1);
    }
  }
  hp.push(...hairParts);

  // hat
  if (hat) {
    const hc = (seed >> 2) % 2 ? accent : shade(outfit, 0.95), hc2 = shade(hc, 0.72);
    const kind = female ? ['beret', 'straw', 'bucket', 'cap'][(seed >> 4) % 4] : ['cap', 'bucket', 'cap', 'straw'][(seed >> 4) % 4];
    const dome = (theta, tilt, grow, c) => ({ g: capGeo(theta), c, s: [HX + grow, HY + grow, HZ + grow], r: [tilt, 0, 0] });
    if (kind === 'cap') {
      hp.push(dome(1.3, -0.26, 0.032, hc), { g: U(16, 10), c: hc2, p: [0, 0.098, 0.228], s: [0.135, 0.018, 0.105], r: [0.28, 0, 0] }, { g: U(), c: hc2, p: [0, 0.262, -0.04], s: [0.025, 0.02, 0.025] });
    } else if (kind === 'bucket') {
      hp.push(dome(1.5, -0.1, 0.03, hc), { g: brimGeo(0.2, 0.33, 0.03, 0.022), c: hc, p: [0, 0.075, 0.01], r: [-0.06, 0, 0] }, { g: TOR(0.26, 0.016, 6, 28), c: hc2, p: [0, 0.095, 0.0], r: [PI / 2 - 0.06, 0, 0] });
    } else if (kind === 'beret') {
      hp.push({ g: U(18, 11), c: hc, p: [0.03, 0.168, -0.005], s: [0.275, 0.1, 0.265], r: [0.12, 0, -0.14] }, { g: U(), c: hc2, p: [0.02, 0.265, -0.01], s: [0.022, 0.03, 0.022] });
    } else {
      const straw = '#ecc873';
      hp.push(dome(1.45, -0.1, 0.03, straw), { g: brimGeo(0.2, 0.365, 0.035, 0.022), c: shade(straw, 1.08), p: [0, 0.078, 0.01], r: [-0.04, 0, 0] }, { g: TOR(0.255, 0.022, 6, 28), c: accent, p: [0, 0.1, 0.0], r: [PI / 2 - 0.06, 0, 0] });
    }
  }
  // face accessories
  const dark = '#3a3550';
  if (look.accessory === 'glasses') {
    for (const sx of [-1, 1]) {
      fp(TOR(0.067, 0.0095, 5, 14), dark, sx * 0.098, -0.005, 0.02);
      const A = hframe(sx * 0.163, -0.005, 0.02).elements, Bp = new THREE.Vector3(sx * 0.247, -0.005, -0.01), Ap = new THREE.Vector3(A[12], A[13], A[14]);
      const d = Bp.clone().sub(Ap), len = d.length();
      hp.push({ g: CAPS(0.007, Math.max(0.01, len - 0.014), 3, 6), c: dark, p: Ap.clone().addScaledVector(d, 0.5).toArray(), d: d.toArray() });
    }
    fp(CAPS(0.0075, 0.03, 3, 6), dark, 0, 0.005, 0.022, null, [0, 0, PI / 2]);
  }
  if (look.accessory === 'beard') {
    hp.push({ g: beardGeo, c: hairC, s: [HX + 0.017, HY + 0.017, HZ + 0.017] }, blob(0, -0.172, 0.085, 0.145, 0.065, 0.12));
    for (const sx of [-1, 1]) fp(U(), hairC, sx * 0.04, -0.056, 0.012, [0.055, 0.024, 0.03], [0, 0, sx * 0.3]);
  }
  if (look.accessory === 'mustache') {
    for (const sx of [-1, 1]) fp(U(), hairC, sx * 0.042, -0.056, 0.012, [0.058, 0.026, 0.032], [0, 0, sx * 0.32]);
  }
  const headMesh = new THREE.Mesh(vcMerge(hp), mBody); head.add(headMesh);

  // eyes
  const ep = [];
  const eyeC = '#2a2236';
  for (const sx of [-1, 1]) {
    const M = hframe(sx * 0.098, -0.005, -0.004);
    if (victim) {
      ep.push({ g: TOR(0.04, 0.0075, 5, 14, PI), c: eyeC, m: M, r: [0, 0, PI], p: [0, 0.02, 0.014] });
      for (const k of [0, 1]) ep.push({ g: CAPS(0.0045, 0.02, 1, 4), c: eyeC, m: M, p: [sx * (0.036 + k * 0.01), -0.006 - k * 0.012, 0.012], r: [0, 0, -sx * (0.7 + k * 0.4)] });
    } else {
      ep.push({ g: U(10, 7), c: eyeC, m: M, s: [0.042, 0.057, 0.03] });
      ep.push({ g: U(7, 5), c: '#ffffff', m: M, p: [0.014, 0.022, 0.0255], s: [0.0135, 0.0135, 0.007] });
      ep.push({ g: U(6, 4), c: '#ffffff', m: M, p: [-0.014, -0.02, 0.0252], s: [0.007, 0.007, 0.004] });
      if (female) for (const k of [0, 1]) ep.push({ g: CAPS(0.0048, 0.024, 1, 4), c: eyeC, m: M, p: [sx * (0.04 + k * 0.004), 0.034 - k * 0.022, 0.012], r: [0, 0, -sx * (0.85 + k * 0.5)] });
    }
  }
  const eyes = new THREE.Mesh(vcMerge(ep, 0.005), mEyes);
  eyes.position.y = -0.005; head.add(eyes);

  for (const o of g.children) if (o.isMesh) { o.castShadow = o !== face; o.receiveShadow = true; }
  for (const grp of [torso, headMesh, eyes, ...arms.map((a) => a.children[0])]) { grp.castShadow = true; grp.receiveShadow = true; }

  // ---- Held weapon (suspects only), right hand (screen right), out to the side
  const weaponId = weapon !== undefined ? weapon : ch.weapon;
  if (weaponId && !victim) {
    const wp = createWeapon3d(weaponId, mats);
    wp.scale.setScalar(1.45); wp.position.set(0.0, -0.195, 0.012); wp.rotation.set(0.28, 0, -0.95);
    arms[1].add(wp);
    arms[1].rotation.z = 0.62;
  }

  const ph = (seed % 1000) / 1000 * PI * 2;
  const blinkOff = (seed % 997) / 997 * 4;
  const baseR = [arms[0].rotation.z, arms[1].rotation.z];
  g.userData.idle = (t) => {
    const b = Math.sin(t * 2.2 + ph), k = 0.022 * b;
    torso.scale.set((male ? 1.07 : 1) * (1 - k * 0.5), 1 + k, 1 - k * 0.5);
    head.position.y = HEAD_Y + 0.25 * k;
    head.rotation.z = 0.05 * Math.sin(t * 0.8 + ph);
    head.rotation.y = 0.07 * Math.sin(t * 0.5 + ph * 2);
    head.rotation.x = 0.02 * Math.sin(t * 1.1 + ph);
    if (!victim) eyes.scale.y = ((t + blinkOff) % 4.3) < 0.14 ? 0.1 : 1;
    arms[0].rotation.z = baseR[0] - 0.05 * b; arms[1].rotation.z = baseR[1] + 0.04 * b;
  };

  g.userData.materials = mats;
  g.userData.character = ch;
  return g;
}
