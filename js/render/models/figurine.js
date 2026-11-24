// Chibi figurines: big head with face, outfit variants, hair styles, accessories, letter disc.
import * as THREE from 'three';
import { createWeapon3d } from './weapons3d.js';
import {
  add, addMerged, toonOwn, canvasTex, addOutlines, hashStr, rng, shade, mix, paleColor, contrastAccent,
  RB, CYL, SPH, CONE, TOR, CAPS,
} from './kit.js';

const HEAD_Y = 0.66, HEAD_R = 0.22;
const TY0 = 0.17; // torso base height
const DISC_TOP = 0.0785;
const T = { noOutline: true, shadow: false }; // tiny details: no outline, no shadow

// Torso silhouette (radius by absolute height), used to stick details onto the surface.
const TORSO = [[0, TY0], [0.15, TY0], [0.19, 0.23], [0.195, 0.29], [0.175, 0.38], [0.135, 0.45], [0.1, 0.485], [0, 0.5]];
function torsoR(y) {
  for (let i = 1; i < TORSO.length; i++) {
    const [r0, y0] = TORSO[i - 1], [r1, y1] = TORSO[i];
    if (y <= y1) return r0 + (r1 - r0) * Math.max(0, (y - y0) / (y1 - y0));
  }
  return 0.1;
}
const torsoZ = (x, y, off = 0) => Math.sqrt(Math.max(torsoR(y) ** 2 - x * x, 0.002)) + off;
const torsoTilt = (y) => Math.atan2(torsoR(y - 0.04) - torsoR(y + 0.04), 0.08); // surface leans back going up

const headZ = (x, y, R = HEAD_R) => Math.sqrt(Math.max(R * R - x * x - y * y, 0.0004));
/** Puts obj on the head surface at (x,y) facing outwards. */
function onHead(obj, x, y, off = 0, R = HEAD_R) {
  obj.position.set(x, y, headZ(x, y, R) + off);
  obj.rotation.set(-Math.asin(THREE.MathUtils.clamp(y / R, -0.95, 0.95)), Math.asin(THREE.MathUtils.clamp(x / R, -0.95, 0.95)), 0);
  return obj;
}

function discTexture(letter, outfit) {
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#fff6e4';
    x.beginPath(); x.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2); x.fill();
    x.lineWidth = 7; x.strokeStyle = shade(outfit, 0.8);
    x.beginPath(); x.arc(w / 2, h / 2, w / 2 - 8, 0, Math.PI * 2); x.stroke();
    x.fillStyle = shade(outfit, 1.7);
    for (let i = 0; i < 24; i++) { // little dots on the rim
      const a = (i / 24) * Math.PI * 2;
      x.beginPath(); x.arc(w / 2 + Math.cos(a) * (w / 2 - 22), h / 2 + Math.sin(a) * (h / 2 - 22), 3.5, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = shade(outfit, 0.45);
    x.font = 'bold 60px "Trebuchet MS", "Segoe UI", Arial, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 8; x.strokeStyle = '#fff6e4'; x.lineJoin = 'round';
    x.strokeText(letter, w / 2, h / 2 + 90); x.fillText(letter, w / 2, h / 2 + 90);
  });
}

function capGeo(theta, r) {
  return new THREE.SphereGeometry(r, 22, 14, 0, Math.PI * 2, 0, theta);
}

/**
 * Builds a chibi figurine from character.look. Height ~0.9-1.0 (cell = 1), head centre at y=0.66.
 * group.userData.materials = toon materials owned by this figurine (for flashes).
 * group.userData.idle(t) = subtle breathing / blink / head tilt.
 */
export function createFigurine(character, weapon) {
  const ch = character || {};
  const victim = !!ch.victim;
  const seed = hashStr(String(ch.id || ch.name || '?') + (ch.name || ''));
  const male = ch.gender === 'm', female = ch.gender === 'f';
  // Normalize the look so it always matches gender (hand-authored cases included); source data is untouched.
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
  const letter = String(ch.id || '?').slice(0, 1).toUpperCase();
  const r = rng(seed);
  const variant = seed % 4;
  const accent = contrastAccent(outfit);

  const g = new THREE.Group();
  g.name = `figurine:${letter}`;
  const mats = [];
  const mat = (color, opts) => { const m = toonOwn(color, opts); mats.push(m); return m; };
  const mSkin = mat(skin), mHair = mat(hair), mOutfit = mat(outfit), mDark = mat('#2b2b3a');
  const mWhite = mat('#fffdf6'), mOutDark = mat(shade(outfit, 0.65)), mOutLight = mat(shade(outfit, 1.35));
  const mPants = mat(mix(shade(outfit, 0.5), '#3a3550', 0.4));
  const mShoe = mat(r() < 0.5 ? '#5a3a28' : '#f4efe6');
  const mAcc = mat(accent), mGold = mat('#f2c14e');

  // ---- Base disc: dark base, beveled ring in outfit colour, cream top plate with letter
  add(g, CYL(0.38, 0.4, 0.045, 36), mat(shade(outfit, 0.7)), { pos: [0, 0.0225, 0] });
  add(g, CYL(0.35, 0.375, 0.032, 36), mOutfit, { pos: [0, 0.061, 0], noOutline: true });
  add(g, TOR(0.352, 0.012, 6, 36), mOutLight, { pos: [0, 0.075, 0], rot: [Math.PI / 2, 0, 0], ...T });
  const discTop = new THREE.MeshBasicMaterial({ map: discTexture(letter, outfit) });
  const top = add(g, new THREE.CircleGeometry(0.338, 36), discTop, { pos: [0, DISC_TOP, 0], rot: [-Math.PI / 2, 0, 0], ...T });
  top.receiveShadow = false;

  // ---- Legs & shoes
  for (const sx of [-1, 1]) {
    add(g, CYL(0.055, 0.05, 0.1, 10), mPants, { pos: [sx * 0.085, 0.15, 0.015], ...T });
    add(g, SPH(0.07, 12, 8), mShoe, { pos: [sx * 0.088, 0.118, 0.09], scale: [1, 0.6, 1.5], rot: [0.05, sx * 0.12, 0], shadow: true, noOutline: true });
  }

  // ---- Torso (pear-shaped lathe) inside a group so it can "breathe"
  const torsoG = new THREE.Group(); torsoG.position.y = TY0;
  const torsoW = new THREE.Group(); torsoW.scale.x = male ? 1.1 : 1; torsoW.add(torsoG); g.add(torsoW); // broader chest for men
  const ly = (y) => y - TY0;
  const prof = TORSO.map(([rr, yy]) => new THREE.Vector2(rr, ly(yy)));
  add(torsoG, new THREE.LatheGeometry(prof, 24), mOutfit);
  const tz = (x, y, off = 0.004) => torsoZ(x, y, off);
  // belt (all but the apron/hoodie variants get a buckle)
  const beltY = 0.215;
  add(torsoG, TOR(torsoR(beltY) + 0.002, 0.016, 6, 28), mOutDark, { pos: [0, ly(beltY), 0], rot: [Math.PI / 2, 0, 0], ...T });
  if (variant === 0 || variant === 3) add(torsoG, RB(0.05, 0.036, 0.016, 0.006, 1), mGold, { pos: [0, ly(beltY), tz(0, beltY, 0.012)], ...T });

  const front = (geo, m, x, y, off = 0.004, extra = {}) => {
    const o = add(torsoG, geo, m, { ...T, ...extra });
    o.position.set(x, ly(y), tz(x, y, off));
    o.rotation.x = -torsoTilt(y) * 0.9; o.rotation.y = Math.asin(THREE.MathUtils.clamp(x / torsoR(y), -0.9, 0.9));
    return o;
  };
  if (variant === 0) { // jacket: shirt V, lapels, buttons, collar
    const v = new THREE.Shape(); v.moveTo(-0.07, 0); v.lineTo(0.07, 0); v.lineTo(0, -0.17);
    front(new THREE.ShapeGeometry(v), mWhite, 0, 0.46, 0.002);
    for (const sx of [-1, 1]) {
      const lap = front(RB(0.05, 0.19, 0.014, 0.005, 1), mOutLight, sx * 0.055, 0.385, 0.012);
      lap.rotation.z = sx * 0.4;
      front(RB(0.06, 0.035, 0.014, 0.005, 1), mOutLight, sx * 0.075, 0.475, 0.012).rotation.z = -sx * 0.5;
    }
    for (let i = 0; i < 3; i++) front(SPH(0.014, 8, 6), mDark, 0.0, 0.325 - i * 0.045, 0.008);
  } else if (variant === 1) { // apron with pocket and straps
    const ap = front(RB(0.17, 0.2, 0.012, 0.008, 1), mWhite, 0, 0.29, 0.006, { noOutline: false });
    front(RB(0.1, 0.1, 0.012, 0.008, 1), mWhite, 0, 0.4, 0.004);
    front(RB(0.08, 0.05, 0.01, 0.006, 1), mAcc, 0.0, 0.25, 0.014);
    for (const sx of [-1, 1]) {
      const s = front(BOXs(0.025, 0.12, 0.012), mWhite, sx * 0.1, 0.47, 0.0);
      s.rotation.z = sx * -0.35;
    }
    ap.userData.noOutline = true;
  } else if (variant === 2) { // zip hoodie
    add(torsoG, TOR(0.115, 0.04, 8, 20), mOutLight, { pos: [0, ly(0.465), -0.01], rot: [Math.PI / 2 - 0.25, 0, 0], ...T });
    front(BOXs(0.012, 0.25, 0.01), mDark, 0, 0.35, 0.006);
    front(SPH(0.016, 8, 6), mGold, 0.0, 0.43, 0.012);
    for (const sx of [-1, 1]) front(CAPS(0.007, 0.07, 2, 5), mWhite, sx * 0.035, 0.4, 0.014);
    front(RB(0.2, 0.075, 0.02, 0.014, 2), mOutDark, 0, 0.255, 0.012);
  } else { // vest, shirt and tie
    front(RB(0.17, 0.26, 0.014, 0.01, 1), mWhite, 0, 0.35, 0.004);
    front(RB(0.034, 0.17, 0.014, 0.008, 1), mAcc, 0, 0.35, 0.014);
    front(SPH(0.022, 8, 6), mAcc, 0, 0.45, 0.014);
    for (const sx of [-1, 1]) {
      const c = front(RB(0.06, 0.03, 0.012, 0.005, 1), mWhite, sx * 0.045, 0.475, 0.012); c.rotation.z = -sx * 0.5;
    }
  }

  // ---- Arms with sleeves, cuffs and hands
  const arms = [];
  for (const sx of [-1, 1]) {
    const ag = new THREE.Group(); ag.position.set(sx * (male ? 0.2 : 0.185), 0.4, 0.01); ag.rotation.z = sx * 0.55; g.add(ag);
    add(ag, CAPS(0.05, 0.1, 4, 8), mOutfit, { pos: [0, -0.07, 0] });
    add(ag, TOR(0.05, 0.012, 6, 12), mOutDark, { pos: [0, -0.155, 0], rot: [Math.PI / 2, 0, 0], ...T });
    add(ag, SPH(0.047, 10, 8), mSkin, { pos: [0, -0.2, 0.01], noOutline: true });
    arms.push(ag);
  }

  // ---- Head group
  const head = new THREE.Group(); head.position.y = HEAD_Y; g.add(head);
  add(head, SPH(HEAD_R, 28, 20), mSkin);
  for (const sx of [-1, 1]) add(head, SPH(0.045, 8, 6), mSkin, { pos: [sx * 0.222, -0.005, -0.005], scale: [0.5, 1, 0.8], ...T });

  const mBrow = mat(shade(hair, 0.6)), mNose = mat(mix(skin, '#e08a7a', 0.35)), mCheek = mat(mix(skin, '#ff7b8a', male ? 0.1 : 0.62));
  const mLash = mat('#1d1a26');
  const eyes = [];
  const eyeY = 0.025, eyeX = 0.088;
  for (const sx of [-1, 1]) {
    const eg = new THREE.Group(); onHead(eg, sx * eyeX, eyeY, -0.022); head.add(eg);
    add(eg, SPH(0.056, 14, 10), mWhite, { scale: [1, 1.18, 0.5], ...T });
    const pupil = add(eg, SPH(0.034, 12, 8), mDark, { pos: [sx * -0.004, -0.004, 0.018], scale: [1, 1.12, 0.5], ...T });
    add(eg, SPH(0.012, 8, 6), mWhite, { pos: [0.014, 0.02, 0.03], ...T });
    add(eg, SPH(0.006, 6, 5), mWhite, { pos: [-0.012, -0.014, 0.03], ...T });
    void pupil;
    eyes.push(eg);
    if (female) { // eyelashes: three small strokes fanned at the outer upper corner
      for (const a of [0.2, 0.62, 1.04]) {
        const dx = sx * Math.cos(a), dy = Math.sin(a);
        const l = add(eg, CAPS(0.0045, 0.022, 2, 4), mLash, { ...T });
        l.position.set(dx * 0.07, dy * 0.08, 0.014);
        l.rotation.z = -Math.atan2(dx, dy);
      }
    }
    // eyebrow: men thicker and straighter, women thin and slightly arched
    const br = add(head, male ? CAPS(0.014, 0.056, 2, 6) : CAPS(0.008, 0.05, 2, 6), mBrow, { ...T });
    onHead(br, sx * 0.09, male ? 0.104 : 0.108, 0.006);
    br.rotation.z = Math.PI / 2 + sx * (male ? 0.03 + (seed % 3) * 0.03 : 0.12 + (seed % 3) * 0.06) * -1;
    // cheeks (faint on men)
    const ck = add(head, SPH(0.035, 8, 6), mCheek, { scale: male ? [0.8, 0.5, 0.3] : [1.12, 0.7, 0.35], ...T });
    onHead(ck, sx * 0.145, -0.05, -0.004);
  }
  const nose = add(head, SPH(0.028, 10, 8), mNose, { ...T });
  nose.position.set(0, -0.022, headZ(0, -0.022) + 0.008);
  const hasBeard = look.accessory === 'beard';
  if (male && !hasBeard && look.accessory !== 'mustache' && seed % 3 === 1) { // light stubble / jaw shading below the mouth
    add(head, new THREE.SphereGeometry(HEAD_R + 0.003, 20, 8, Math.PI / 2 - 1.2, 2.4, 2.06, 0.75), mat(mix(skin, hair, 0.28)), { ...T });
  }
  const mLip = female ? mat(mix(skin, '#d6455d', 0.7)) : mDark;
  const mouthR = HEAD_R + (hasBeard ? 0.014 : 0);
  if (seed % 3 === 0) { // open smile
    const m = add(head, new THREE.CircleGeometry(0.04, 14, Math.PI, Math.PI), mat('#7a2e3a'), { ...T });
    onHead(m, 0, -0.082, 0.004, mouthR);
    const tg = add(head, SPH(0.02, 8, 6), mat('#ff8a9a'), { scale: [1, 0.55, 0.3], ...T });
    onHead(tg, 0, -0.098, 0.004, mouthR);
  } else {
    const m = add(head, TOR(0.036, 0.009, 4, 12, Math.PI), mLip, { ...T });
    onHead(m, 0, -0.07, 0.003, mouthR); m.rotation.z = Math.PI;
  }

  buildHair(head, look.hairStyle || 'short', mHair, look.accessory === 'hat', mAcc, r, male);
  buildHeadAccessory(head, look.accessory || null, { mHair, mDark, mat, mAcc, mGold, outfit, mOutfit, mOutDark, male, seed });
  // neck accessories live on the torso
  buildNeckAccessory(g, look.accessory || null, { mAcc, mat, accent, outfit });

  addOutlines(g, 0.014);

  // ---- Held weapon (suspects only), parented to the right arm so it follows the idle sway
  const weaponId = weapon !== undefined ? weapon : ch.weapon;
  if (weaponId && !victim) {
    const wp = createWeapon3d(weaponId, mats);
    // Brandished up and out (arm-local z -1.05 + arm sway ~0.55 = about 30 degrees off vertical, outside the body)
    // and enlarged so the silhouette reads at the default board camera, including on 16x16.
    wp.scale.setScalar(2.4); wp.position.set(0.02, -0.2, 0.07); wp.rotation.set(0.2, 0, -1.05);
    arms[1].add(wp);
  }  // (added after outlining; the prop outlines itself)

  const ph = (seed % 1000) / 1000 * Math.PI * 2;
  const blinkOff = (seed % 997) / 997 * 4;
  g.userData.idle = (t) => {
    const b = Math.sin(t * 2.2 + ph);
    const k = 0.022 * b;
    torsoG.scale.set(1 - k * 0.5, 1 + k, 1 - k * 0.5);
    head.position.y = HEAD_Y + (0.5 - TY0 + 0.0) * k * 0.55;
    head.rotation.z = 0.05 * Math.sin(t * 0.8 + ph);
    head.rotation.y = 0.07 * Math.sin(t * 0.5 + ph * 2);
    head.rotation.x = 0.015 * Math.sin(t * 1.1 + ph);
    const bt = (t + blinkOff) % 4.3;
    const s = bt < 0.14 ? 0.12 : 1;
    for (const e of eyes) e.scale.y = s;
    arms[0].rotation.z = -0.55 - 0.05 * b; arms[1].rotation.z = 0.55 + 0.05 * b;
  };

  g.userData.materials = mats;
  g.userData.character = ch;
  return g;
}

function BOXs(w, h, d) { return RB(w, h, d, Math.min(w, h, d) * 0.3, 1); }

function buildHair(head, style, mHair, hasHat, mAcc, r, male = false) {
  const R = HEAD_R + 0.012;
  const cap = (theta, tilt = -0.5, rr = R) => add(head, capGeo(theta, rr), mHair, { rot: [tilt, 0, 0] });
  const ball = (x, y, z, s, sc = [1, 1, 1]) => ({ geo: SPH(s, 10, 8), pos: [x, y, z], scale: sc });
  switch (style) {
    case 'bald': {
      addMerged(head, [ball(-0.2, 0.05, -0.04, 0.05, [0.6, 1.2, 1.2]), ball(0.2, 0.05, -0.04, 0.05, [0.6, 1.2, 1.2]), ball(-0.19, 0.09, 0.0, 0.04, [0.6, 1, 1]), ball(0.19, 0.09, 0.0, 0.04, [0.6, 1, 1])], mHair);
      if (!hasHat && !male) {
        add(head, TOR(0.025, 0.007, 4, 10, Math.PI * 1.5), mHair, { pos: [0.0, 0.215, 0.025], rot: [-Math.PI / 2 + 0.2, 0, 0.5], ...T });
        add(head, CONE(0.012, 0.04, 5), mHair, { pos: [0.0, 0.24, 0.025], ...T });
      }
      break;
    }
    case 'long': {
      cap(1.58, -0.5);
      addMerged(head, [
        { geo: SPH(0.2, 16, 12), pos: [0, -0.04, -0.12], scale: [1.08, 1.45, 0.7] },
        { geo: CAPS(0.055, 0.15, 4, 8), pos: [-0.2, -0.07, 0.0] }, { geo: CAPS(0.055, 0.15, 4, 8), pos: [0.2, -0.07, 0.0] },
        ball(-0.065, 0.185, 0.115, 0.07, [1.3, 0.8, 0.8]), ball(0.075, 0.18, 0.12, 0.07, [1.3, 0.8, 0.8]), ball(0.0, 0.2, 0.1, 0.06, [1.2, 0.8, 0.8]),
      ], mHair);
      break;
    }
    case 'bun': {
      cap(1.58, -0.5);
      addMerged(head, [ball(-0.07, 0.185, 0.115, 0.065, [1.3, 0.8, 0.8]), ball(0.07, 0.185, 0.115, 0.065, [1.3, 0.8, 0.8]), ball(0, 0.2, 0.11, 0.055, [1.2, 0.8, 0.8])], mHair);
      if (!hasHat) {
        add(head, SPH(0.095, 14, 10), mHair, { pos: [0, 0.255, -0.09] });
        add(head, TOR(0.09, 0.016, 6, 16), mAcc, { pos: [0, 0.215, -0.09], rot: [Math.PI / 2, 0, 0], ...T });
        add(head, SPH(0.02, 6, 5), mAcc, { pos: [0.0, 0.31, -0.09], ...T });
      }
      break;
    }
    case 'curly': {
      cap(1.4, -0.45, HEAD_R + 0.005);
      const parts = [];
      const ring = (polar, n, rad, skipFront) => {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + 0.3;
          const x = Math.sin(a), z = Math.cos(a); // z>0 = front
          if (skipFront && z > 0.55) continue;
          const sp = Math.sin(polar), cp = Math.cos(polar);
          parts.push({ geo: SPH(rad, 10, 8), pos: [x * sp * 0.225, cp * 0.225 + 0.005, z * sp * 0.225 - 0.01] });
        }
      };
      if (male) { // short tight curls hugging the skull
        if (!hasHat) ring(0.0, 1, 0.05, false);
        if (!hasHat) ring(0.55, 7, 0.048, false);
        ring(1.0, 10, 0.046, true);
        ring(1.3, 11, 0.042, true);
        parts.push({ geo: SPH(0.04, 8, 6), pos: [-0.08, 0.165, 0.14] }, { geo: SPH(0.04, 8, 6), pos: [0.0, 0.178, 0.145] }, { geo: SPH(0.04, 8, 6), pos: [0.08, 0.165, 0.14] });
      } else {
        if (!hasHat) ring(0.0, 1, 0.085, false);
        if (!hasHat) ring(0.55, 6, 0.08, false);
        ring(1.0, 8, 0.075, true);
        ring(1.35, 9, 0.065, true);
        // fringe curls
        parts.push({ geo: SPH(0.06, 10, 8), pos: [-0.09, 0.155, 0.15] }, { geo: SPH(0.06, 10, 8), pos: [0.0, 0.17, 0.155] }, { geo: SPH(0.06, 10, 8), pos: [0.09, 0.155, 0.15] });
      }
      addMerged(head, parts, mHair);
      break;
    }
    case 'ponytail': {
      cap(1.58, -0.5);
      addMerged(head, [ball(-0.07, 0.185, 0.115, 0.065, [1.3, 0.8, 0.8]), ball(0.07, 0.185, 0.115, 0.065, [1.3, 0.8, 0.8]), ball(0, 0.2, 0.11, 0.055, [1.2, 0.8, 0.8]),
        ball(0, 0.0, -0.225, 0.07), { geo: SPH(0.075, 12, 10), pos: [0, -0.08, -0.29], scale: [1, 1.35, 0.9] }, { geo: CONE(0.05, 0.2, 8), pos: [0, -0.22, -0.31], rot: [Math.PI, 0, 0] }], mHair);
      add(head, TOR(0.05, 0.014, 6, 12), mAcc, { pos: [0, 0.0, -0.245], rot: [0.3, 0, 0], ...T });
      break;
    }
    case 'spiky': {
      cap(1.45, -0.45, HEAD_R + 0.004);
      const parts = [];
      const spike = (dir, len, w) => parts.push({ geo: CONE(w, len, 6), dir, pos: [dir[0] * 0.2, dir[1] * 0.2 + 0.005, dir[2] * 0.2 - 0.01].map((v, i) => v + dir[i] * len * 0.45) });
      if (!hasHat) {
        spike([0, 1, -0.1], 0.18, 0.065);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.2;
          spike([Math.sin(a) * 0.75, 0.75, Math.cos(a) * 0.65 - 0.15], 0.15, 0.055);
        }
      }
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (0.55 + i * 0.15); // back half
        spike([Math.sin(a) * 1.0, 0.25, -Math.abs(Math.cos(a)) - 0.2], 0.14, 0.05);
      }
      parts.push({ geo: CONE(0.05, 0.12, 6), dir: [-0.3, 0.55, 1], pos: [-0.07, 0.19, 0.17] }, { geo: CONE(0.05, 0.12, 6), dir: [0.3, 0.55, 1], pos: [0.07, 0.19, 0.17] });
      addMerged(head, parts, mHair);
      break;
    }
    case 'slick': { // short side-part, swept sideways
      cap(1.58, -0.52);
      const fr = [[-0.12, 0.15, 0.14, -0.15], [-0.04, 0.165, 0.145, -0.1], [0.04, 0.175, 0.14, -0.05], [0.12, 0.165, 0.12, 0.0]];
      addMerged(head, fr.map(([x, y, z, rz]) => ({ geo: SPH(0.06, 10, 8), pos: [x, y, z], scale: [1.5, 0.55, 0.8], rot: [0, 0, rz] })), mHair);
      break;
    }
    default: { // short
      cap(1.58, -0.52);
      const fr = [[-0.1, 0.17, 0.125, -0.25], [-0.02, 0.185, 0.135, 0], [0.07, 0.178, 0.13, 0.2], [0.14, 0.15, 0.1, 0.5]];
      addMerged(head, fr.map(([x, y, z, rz]) => ({ geo: SPH(0.065, 10, 8), pos: [x, y, z], scale: [1.3, 0.8, 0.8], rot: [0, 0, rz] })), mHair);
      if (!hasHat && !male) add(head, CONE(0.035, 0.09, 6), mHair, { pos: [0.02, 0.225, 0.02], rot: [0.2, 0, -0.35], ...T });
    }
  }
}

function buildHeadAccessory(head, kind, { mHair, mDark, mat, mAcc, mGold, outfit, male = false, seed = 0 }) {
  switch (kind) {
    case 'hat': {
      const hg = new THREE.Group(); hg.position.set(0, 0.0, 0); hg.rotation.set(-0.06, 0, 0.05); head.add(hg);
      const mHat = mat(shade(outfit, 0.85));
      if (male && seed % 2 === 0) { // baseball cap: dome, front visor, button
        add(hg, new THREE.SphereGeometry(0.245, 24, 14, 0, Math.PI * 2, 0, 1.1), mHat, { rot: [-0.05, 0, 0] });
        add(hg, new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20, 1, false, -Math.PI / 2, Math.PI), mat(shade(outfit, 0.65)), { pos: [0, 0.105, 0.1], rot: [0.14, 0, 0] });
        add(hg, SPH(0.02, 8, 6), mAcc, { pos: [0, 0.245, 0], ...T });
        break;
      }
      if (male) { // fedora: narrower brim, taller crown, hat band
        add(hg, CYL(0.27, 0.27, 0.018, 28), mHat, { pos: [0, 0.125, 0] });
        add(hg, CYL(0.165, 0.19, 0.17, 24), mHat, { pos: [0, 0.21, 0] });
        add(hg, CYL(0.15, 0.15, 0.012, 24), mat(shade(outfit, 0.6)), { pos: [0, 0.297, 0], ...T });
        add(hg, CYL(0.192, 0.196, 0.04, 24), mAcc, { pos: [0, 0.157, 0], noOutline: true });
        break;
      }
      add(hg, CYL(0.3, 0.3, 0.022, 28), mHat, { pos: [0, 0.135, 0] });
      add(hg, CYL(0.17, 0.2, 0.16, 24), mHat, { pos: [0, 0.21, 0] });
      add(hg, CYL(0.165, 0.165, 0.012, 24), mat(shade(outfit, 1.2)), { pos: [0, 0.294, 0], ...T });
      add(hg, CYL(0.192, 0.2, 0.04, 24), mAcc, { pos: [0, 0.158, 0], noOutline: true });
      add(hg, RB(0.05, 0.04, 0.02, 0.008, 1), mGold, { pos: [0, 0.158, 0.2], ...T });
      break;
    }
    case 'glasses': {
      const frame = mat('#3a3550');
      for (const sx of [-1, 1]) {
        const rim = add(head, TOR(0.062, 0.0085, 6, 20), frame, { ...T });
        onHead(rim, sx * 0.088, 0.025, 0.014);
        const lens = add(head, new THREE.CircleGeometry(0.058, 16), new THREE.MeshStandardMaterial({ color: '#cfe8ff', roughness: 0.15, transparent: true, opacity: 0.28 }), { ...T });
        onHead(lens, sx * 0.088, 0.025, 0.011);
        const tmp = add(head, CAPS(0.006, 0.12, 2, 5), frame, { ...T });
        tmp.position.set(sx * 0.2, 0.03, 0.07); tmp.rotation.set(Math.PI / 2, 0, 0); tmp.rotation.z = sx * 0.1;
      }
      add(head, CAPS(0.006, 0.03, 2, 5), frame, { pos: [0, 0.03, headZ(0, 0.03) + 0.014], rot: [0, 0, Math.PI / 2], ...T });
      break;
    }
    case 'beard': {
      const phiStart = Math.PI / 2 - 1.2;
      add(head, new THREE.SphereGeometry(HEAD_R + 0.012, 20, 12, phiStart, 2.4, 1.78, 0.9), mHair, { rot: [0.05, 0, 0] });
      add(head, SPH(0.06, 10, 8), mHair, { pos: [0, -0.205, 0.1], scale: [1.2, 1, 0.9], ...T });
      const must = [-1, 1].map((sx) => ({ geo: CAPS(0.018, 0.05, 3, 6), pos: [sx * 0.03, -0.045, headZ(sx * 0.03, -0.045) + 0.012], rot: [0, 0, Math.PI / 2 - sx * 0.35] }));
      addMerged(head, must, mHair, T);
      break;
    }
    case 'mustache': {
      const must = [-1, 1].map((sx) => ({ geo: CAPS(0.02, 0.06, 3, 6), pos: [sx * 0.04, -0.045, headZ(sx * 0.04, -0.045) + 0.012], rot: [0, 0, Math.PI / 2 - sx * 0.45] }));
      must.push({ geo: SPH(0.02, 8, 6), pos: [0, -0.038, headZ(0, -0.038) + 0.012] });
      addMerged(head, must, mHair, T);
      break;
    }
    default: break;
  }
}

function buildNeckAccessory(g, kind, { mAcc, mat, accent, outfit }) {
  const neckY = 0.47;
  if (kind === 'bowtie') {
    const z = torsoZ(0, neckY, 0.025);
    for (const sx of [-1, 1]) add(g, CONE(0.04, 0.075, 8), mAcc, { pos: [sx * 0.045, neckY, z], rot: [0, 0, -sx * Math.PI / 2], scale: [1, 1, 0.55], ...T });
    add(g, SPH(0.022, 8, 6), mat(shade(accent, 0.8)), { pos: [0, neckY, z + 0.004], ...T });
  } else if (kind === 'scarf') {
    const m2 = mat(shade(accent, 1.45));
    add(g, TOR(0.13, 0.048, 8, 22), mAcc, { pos: [0, neckY - 0.005, -0.005], rot: [Math.PI / 2 - 0.12, 0, 0] });
    add(g, TOR(0.133, 0.012, 6, 22), m2, { pos: [0, neckY + 0.004, -0.004], rot: [Math.PI / 2 - 0.12, 0, 0], ...T });
    const z = torsoZ(0.07, 0.36, 0.03);
    add(g, RB(0.075, 0.2, 0.03, 0.012, 2), mAcc, { pos: [0.075, 0.37, z - 0.005], rot: [-0.25, 0, -0.08] });
    add(g, RB(0.077, 0.03, 0.032, 0.01, 1), m2, { pos: [0.082, 0.31, z + 0.005], rot: [-0.25, 0, -0.08], ...T });
    for (let i = 0; i < 3; i++) add(g, CAPS(0.005, 0.03, 2, 4), m2, { pos: [0.058 + i * 0.02, 0.27, z + 0.012], rot: [-0.25, 0, -0.08], ...T });
  }
}
