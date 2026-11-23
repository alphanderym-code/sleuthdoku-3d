// BoardView — three.js renderer for Tiny Crimes (see SPEC.md "js/render/scene.js").
// Toon diorama board with 3D tokens, gesture input (tap / hold / paint), limited orbit camera.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OBJECT_TYPES } from '../model/objects.js';
import {
  createObject, createFigurine, disposeObject, standInfo, gradientMap, addOutlines,
} from './models.js';

const HOLD_MS = 350;
const TAP_MOVE_PX = 10;
const DEG = Math.PI / 180;
const DEFAULT_POLAR = 42 * DEG;   // angle from vertical (≈48° above the horizon)
const DEFAULT_AZIMUTH = 0;
const AZ_LIMIT = 35 * DEG;
const POLAR_MIN = 12 * DEG;
const POLAR_MAX = 64 * DEG;

const FRAME_W = 0.34;      // outer frame width
const FRAME_TOP = 0.22;    // frame top above the floor
const WALL_T = 0.075;      // room wall thickness
const WALL_H = 0.17;       // room wall height (incl. cap)
const OUTDOOR = new Set(['grass', 'sand', 'snow']);
const SUN_DIR = new THREE.Vector3(-0.48, 1, 0.62).normalize();

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

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------
const FONT = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTexture(canvas, owned = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData.owned = owned;
  return t;
}
function prng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function roundRect(x, X, Y, W, H, R) {
  R = Math.min(R, W / 2, H / 2);
  x.beginPath();
  x.moveTo(X + R, Y); x.lineTo(X + W - R, Y); x.quadraticCurveTo(X + W, Y, X + W, Y + R);
  x.lineTo(X + W, Y + H - R); x.quadraticCurveTo(X + W, Y + H, X + W - R, Y + H);
  x.lineTo(X + R, Y + H); x.quadraticCurveTo(X, Y + H, X, Y + H - R);
  x.lineTo(X, Y + R); x.quadraticCurveTo(X, Y, X + R, Y); x.closePath();
}
function hexToHsl(hex) {
  const n = parseInt(String(hex).replace('#', '').slice(0, 6), 16) || 0;
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}
const clamp100 = (v) => Math.max(0, Math.min(100, v));
/** CSS colour = hex shifted in HSL (dl/ds in %, dh in degrees). */
function hsl(hex, dl = 0, ds = 0, dh = 0, a = 1) {
  const [h, s, l] = hexToHsl(hex);
  return `hsla(${(h + dh).toFixed(1)},${clamp100(s + ds).toFixed(1)}%,${clamp100(l + dl).toFixed(1)}%,${a})`;
}
/** Any CSS colour → #rrggbb (via THREE.Color, sRGB). */
function toHex(col) { try { return '#' + new THREE.Color(col).getHexString(); } catch (_) { return '#888888'; } }
/** Draw fn at the 9 wrap offsets so shapes crossing the edge tile seamlessly. */
function wrap9(S, fn) { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) fn(dx, dy); }

const FLOOR_BASE = {
  wood: '#e9c393', tile: '#dcf0f3', grass: '#b9e297', sand: '#f6e2b0',
  stone: '#d9d4ce', carpet: '#e9b6cc', snow: '#f2f6ff', checker: '#f6f0e4',
  water: '#8fd8e6', brick: '#c9b8d6', dirt: '#d6b48a',
  fairway: '#a4de7c', green: '#b9ee92', // golf (Extreme scenes)
};

/** Floor pattern texture covering 2×2 cells (UV unit = 2 cells). Cell borders are baked in as a soft grid. */
function floorTexture(type) {
  const S = 512, C = S / 2;
  const cv = makeCanvas(S, S);
  const x = cv.getContext('2d');
  const r = prng(hashStr(type) + 7);
  const base = FLOOR_BASE[type] || '#eeeeee';
  x.fillStyle = base; x.fillRect(0, 0, S, S);
  switch (type) {
    case 'wood': {
      const rows = 8, ph = S / rows;
      for (let i = 0; i < rows; i++) {
        const y0 = i * ph;
        let px = r() * S; const end = px + S;
        while (px < end - 1) {
          let len = C * (0.8 + r() * 0.9);
          if (end - px - len < C * 0.4) len = end - px;
          const seed = (r() * 1e9) | 0;
          const col = hsl(base, (r() - 0.5) * 9, (r() - 0.5) * 10, (r() - 0.5) * 6);
          const X0 = px;
          wrap9(S, (dx, dy) => {
            if (dy !== 0) return;
            const q = prng(seed);
            const X = X0 + dx;
            x.save();
            x.beginPath(); x.rect(X, y0, len, ph); x.clip();
            x.fillStyle = col; x.fillRect(X, y0, len, ph);
            const g = x.createLinearGradient(0, y0, 0, y0 + ph);
            g.addColorStop(0, 'rgba(255,245,225,0.25)'); g.addColorStop(1, 'rgba(120,70,30,0.12)');
            x.fillStyle = g; x.fillRect(X, y0, len, ph);
            const n = 4 + ((q() * 3) | 0);
            for (let k = 0; k < n; k++) {
              const yy = y0 + ph * (0.12 + 0.76 * q());
              x.strokeStyle = hsl(base, -22 - q() * 10, 5, -3, 0.16 + q() * 0.14);
              x.lineWidth = 0.8 + q() * 1.6;
              x.beginPath(); x.moveTo(X - 4, yy);
              const a = (q() - 0.5) * 8;
              x.bezierCurveTo(X + len * 0.33, yy + a, X + len * 0.66, yy - a, X + len + 4, yy + (q() - 0.5) * 4);
              x.stroke();
            }
            if (q() < 0.4) {
              const kx = X + len * (0.2 + 0.6 * q()), ky = y0 + ph * (0.35 + 0.3 * q());
              const rx = 7 + q() * 7, ry = 3.5 + q() * 2.5;
              x.fillStyle = hsl(base, -28, 8, -4, 0.45);
              x.beginPath(); x.ellipse(kx, ky, rx * 0.55, ry * 0.6, 0, 0, Math.PI * 2); x.fill();
              x.strokeStyle = hsl(base, -24, 6, -4, 0.3); x.lineWidth = 1.2;
              for (let k = 1; k <= 2; k++) { x.beginPath(); x.ellipse(kx, ky, rx * (0.6 + k * 0.45), ry * (0.65 + k * 0.5), 0, 0, Math.PI * 2); x.stroke(); }
            }
            x.restore();
            x.fillStyle = 'rgba(105,60,28,0.5)'; x.fillRect(X, y0, len, 2.5);
            x.fillStyle = 'rgba(255,242,220,0.45)'; x.fillRect(X, y0 + 2.5, len, 1.5);
            x.fillStyle = 'rgba(105,60,28,0.5)'; x.fillRect(X, y0, 2.5, ph);
            x.fillStyle = 'rgba(255,242,220,0.35)'; x.fillRect(X + 2.5, y0 + 2.5, 1.5, ph - 2.5);
            x.fillStyle = 'rgba(90,55,30,0.45)';
            for (const nx of [X + 9, X + len - 9]) {
              x.beginPath(); x.arc(nx, y0 + ph * 0.3, 1.8, 0, 7); x.fill();
              x.beginPath(); x.arc(nx, y0 + ph * 0.72, 1.8, 0, 7); x.fill();
            }
          });
          px += len;
        }
      }
      break;
    }
    case 'tile': {
      const n = 4, ts = S / n, gw = 6;
      x.fillStyle = hsl(base, -16, -18); x.fillRect(0, 0, S, S); // grout
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const X = i * ts + gw / 2, Y = j * ts + gw / 2, W = ts - gw;
        const g = x.createLinearGradient(X, Y, X + W, Y + W);
        const dl = (r() - 0.5) * 6, dh = (r() - 0.5) * 10;
        g.addColorStop(0, hsl(base, 6 + dl, 0, dh)); g.addColorStop(1, hsl(base, -3 + dl, 0, dh));
        x.fillStyle = g; roundRect(x, X, Y, W, W, 9); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.55)';
        roundRect(x, X + 10, Y + 9, W * 0.32, 6, 3); x.fill();
        roundRect(x, X + 10, Y + 19, 6, 6, 3); x.fill();
        x.strokeStyle = 'rgba(60,110,130,0.14)'; x.lineWidth = 2;
        roundRect(x, X + 1, Y + 1, W - 2, W - 2, 8); x.stroke();
      }
      break;
    }
    case 'grass': {
      for (let i = 0; i < 26; i++) {
        const cx = r() * S, cy = r() * S, rad = 30 + r() * 70, light = r() < 0.5;
        wrap9(S, (dx, dy) => {
          const g = x.createRadialGradient(cx + dx, cy + dy, 0, cx + dx, cy + dy, rad);
          g.addColorStop(0, light ? 'rgba(230,255,190,0.35)' : 'rgba(90,160,70,0.22)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          x.fillStyle = g; x.fillRect(cx + dx - rad, cy + dy - rad, rad * 2, rad * 2);
        });
      }
      x.lineCap = 'round';
      for (let i = 0; i < 1700; i++) {
        const bx = r() * S, by = r() * S, len = 5 + r() * 8, ang = -Math.PI / 2 + (r() - 0.5) * 0.9;
        const k = r();
        x.strokeStyle = k < 0.45 ? hsl(base, -20 - r() * 12, 5, 4, 0.55) : k < 0.85 ? hsl(base, 10 + r() * 8, 5, -6, 0.6) : hsl(base, -4, 15, 10, 0.6);
        x.lineWidth = 1.6 + r() * 1.2;
        x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + Math.cos(ang) * len, by + Math.sin(ang) * len); x.stroke();
      }
      for (let i = 0; i < 40; i++) {
        x.fillStyle = r() < 0.5 ? 'rgba(255,250,200,0.8)' : 'rgba(255,255,255,0.75)';
        x.beginPath(); x.arc(r() * S, r() * S, 1.6 + r() * 1.4, 0, 7); x.fill();
      }
      break;
    }
    case 'sand': {
      for (let k = 0; k < 12; k++) {
        const y0 = (k + 0.5) * (S / 12) + (r() - 0.5) * 10, amp = 5 + r() * 5, ph = r() * Math.PI * 2;
        const line = (dy, col, w) => {
          x.strokeStyle = col; x.lineWidth = w; x.beginPath();
          for (let px = 0; px <= S; px += 8) {
            const yy = y0 + dy + Math.sin((px / S) * Math.PI * 6 + ph) * amp + Math.sin((px / S) * Math.PI * 2 + ph * 2) * amp * 0.6;
            if (px === 0) x.moveTo(px, yy); else x.lineTo(px, yy);
          }
          x.stroke();
        };
        line(0, 'rgba(255,250,232,0.65)', 3);
        line(4, hsl(base, -16, 5, -4, 0.35), 2.5);
      }
      for (let i = 0; i < 1600; i++) {
        x.fillStyle = r() < 0.55 ? hsl(base, -22 - r() * 10, 0, -6, 0.4) : 'rgba(255,255,245,0.7)';
        x.fillRect(r() * S, r() * S, 1.5 + r() * 1.5, 1.5 + r() * 1.5);
      }
      for (let i = 0; i < 5; i++) {
        const sx = 30 + r() * (S - 60), sy = 30 + r() * (S - 60), sr = 9 + r() * 6, rot = r() * Math.PI * 2;
        x.save(); x.translate(sx, sy); x.rotate(rot);
        x.fillStyle = r() < 0.5 ? '#fde0e3' : '#fff4e6';
        x.strokeStyle = 'rgba(150,100,90,0.6)'; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(0, sr * 0.4); x.arc(0, sr * 0.4, sr, Math.PI * 1.1, Math.PI * 1.9); x.closePath(); x.fill(); x.stroke();
        for (let k = 1; k < 5; k++) {
          const a = Math.PI * (1.1 + 0.8 * k / 5);
          x.beginPath(); x.moveTo(0, sr * 0.4); x.lineTo(Math.cos(a) * sr, sr * 0.4 + Math.sin(a) * sr); x.stroke();
        }
        x.restore();
      }
      {
        const sx = 80 + r() * 350, sy = 80 + r() * 350, R1 = 12, R2 = 5;
        x.fillStyle = '#f5a46b'; x.strokeStyle = 'rgba(140,70,40,0.7)'; x.lineWidth = 1.5;
        x.beginPath();
        for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? R2 : R1; x.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); }
        x.closePath(); x.fill(); x.stroke();
      }
      break;
    }
    case 'stone': {
      x.fillStyle = hsl(base, -22, -6); x.fillRect(0, 0, S, S);
      const rows = 4, rh = S / rows;
      for (let i = 0; i < rows; i++) {
        let px = r() * S; const end = px + S;
        while (px < end - 1) {
          let w = rh * (0.8 + r() * 0.7);
          if (end - px - w < rh * 0.5) w = end - px;
          const seed = (r() * 1e9) | 0;
          const dl = (r() - 0.5) * 10, dh = (r() - 0.5) * 16;
          const X0 = px, Y0 = i * rh;
          wrap9(S, (dx, dy) => {
            if (dy !== 0) return;
            const q = prng(seed);
            const X = X0 + dx + 4, Y = Y0 + 4, W = w - 8, H = rh - 8;
            const j = () => (q() - 0.5) * 10;
            const pts = [[X + j() + 6, Y + j() + 4], [X + W + j() - 6, Y + j() + 4], [X + W + j() - 3, Y + H + j() - 6], [X + j() + 3, Y + H + j() - 4]];
            const path = () => {
              x.beginPath();
              const m = (k) => { const a = pts[k % 4], b = pts[(k + 1) % 4]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
              const s0 = m(0); x.moveTo(s0[0], s0[1]);
              for (let k = 1; k <= 4; k++) { const a = pts[k % 4], mm = m(k); x.quadraticCurveTo(a[0], a[1], mm[0], mm[1]); }
              x.closePath();
            };
            x.save();
            path();
            const g = x.createLinearGradient(X, Y, X + W * 0.4, Y + H);
            g.addColorStop(0, hsl(base, 7 + dl, 0, dh)); g.addColorStop(1, hsl(base, -4 + dl, 0, dh));
            x.fillStyle = g; x.fill();
            x.clip();
            for (let k = 0; k < 60; k++) {
              x.fillStyle = q() < 0.5 ? 'rgba(90,80,75,0.18)' : 'rgba(255,255,255,0.3)';
              x.fillRect(X + q() * W, Y + q() * H, 2, 2);
            }
            if (q() < 0.35) {
              x.strokeStyle = 'rgba(80,70,65,0.35)'; x.lineWidth = 1.3;
              x.beginPath(); let cx = X + W * (0.2 + q() * 0.6), cy = Y + 4; x.moveTo(cx, cy);
              for (let k = 0; k < 4; k++) { cx += (q() - 0.5) * 18; cy += H / 5; x.lineTo(cx, cy); }
              x.stroke();
            }
            x.restore();
            path();
            x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 2; x.stroke();
          });
          px += w;
        }
      }
      break;
    }
    case 'carpet': {
      for (let i = 0; i < S; i += 4) {
        x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(0, i, S, 2);
        x.fillStyle = 'rgba(120,40,80,0.06)'; x.fillRect(i, 0, 2, S);
      }
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const cx = i * C + C / 2, cy = j * C + C / 2, R = C * 0.33;
        x.fillStyle = hsl(base, 6, 4); x.strokeStyle = hsl(base, -18, 6, -6, 0.7); x.lineWidth = 4;
        x.beginPath(); x.moveTo(cx, cy - R); x.lineTo(cx + R, cy); x.lineTo(cx, cy + R); x.lineTo(cx - R, cy); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = hsl(base, -14, 10, -8, 0.85);
        const r2 = R * 0.42;
        x.beginPath(); x.moveTo(cx, cy - r2); x.lineTo(cx + r2, cy); x.lineTo(cx, cy + r2); x.lineTo(cx - r2, cy); x.closePath(); x.fill();
        x.fillStyle = '#fff3d6';
        x.beginPath(); x.arc(cx, cy, 5, 0, 7); x.fill();
      }
      for (const [ox, oy] of [[0, 0], [C, 0], [0, C], [C, C], [S, 0], [0, S], [S, S], [S, C], [C, S]]) {
        x.fillStyle = hsl(base, -10, 6, -4, 0.7);
        x.beginPath(); x.arc(ox, oy, 10, 0, 7); x.fill();
      }
      for (let i = 0; i < 900; i++) {
        x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(110,30,70,0.08)';
        x.fillRect(r() * S, r() * S, 2, 2);
      }
      break;
    }
    case 'snow': {
      for (let i = 0; i < 22; i++) {
        const cx = r() * S, cy = r() * S, rad = 40 + r() * 80, strong = r() < 0.5;
        wrap9(S, (dx, dy) => {
          const g = x.createRadialGradient(cx + dx, cy + dy - rad * 0.2, 0, cx + dx, cy + dy, rad);
          g.addColorStop(0, strong ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)');
          g.addColorStop(0.7, strong ? 'rgba(170,195,240,0.18)' : 'rgba(255,255,255,0)');
          g.addColorStop(1, 'rgba(170,195,240,0)');
          x.fillStyle = g; x.fillRect(cx + dx - rad, cy + dy - rad, rad * 2, rad * 2);
        });
      }
      for (let i = 0; i < 500; i++) {
        x.fillStyle = r() < 0.6 ? 'rgba(150,180,230,0.3)' : 'rgba(255,255,255,0.9)';
        x.beginPath(); x.arc(r() * S, r() * S, 0.8 + r() * 1.6, 0, 7); x.fill();
      }
      for (let i = 0; i < 46; i++) {
        const sx = r() * S, sy = r() * S, L = 4 + r() * 6;
        const g = x.createRadialGradient(sx, sy, 0, sx, sy, L * 1.2);
        g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(sx - L * 1.2, sy - L * 1.2, L * 2.4, L * 2.4);
        x.strokeStyle = 'rgba(255,255,255,0.95)'; x.lineWidth = 1.4;
        x.beginPath(); x.moveTo(sx - L, sy); x.lineTo(sx + L, sy); x.moveTo(sx, sy - L); x.lineTo(sx, sy + L); x.stroke();
        x.strokeStyle = 'rgba(170,200,250,0.9)'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(sx - L * 0.4, sy - L * 0.4); x.lineTo(sx + L * 0.4, sy + L * 0.4); x.moveTo(sx + L * 0.4, sy - L * 0.4); x.lineTo(sx - L * 0.4, sy + L * 0.4); x.stroke();
      }
      break;
    }
    case 'checker': {
      const n = 4, ts = S / n;
      const dark = '#c9bfe6';
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const col = (i + j) % 2 === 1 ? dark : base;
        const dl = (r() - 0.5) * 4;
        const X = i * ts, Y = j * ts;
        const g = x.createLinearGradient(X, Y, X + ts, Y + ts);
        g.addColorStop(0, hsl(col, 4 + dl)); g.addColorStop(1, hsl(col, -3 + dl));
        x.fillStyle = g; x.fillRect(X, Y, ts, ts);
        x.fillStyle = 'rgba(255,255,255,0.4)'; x.fillRect(X + 2, Y + 2, ts - 4, 2.5); x.fillRect(X + 2, Y + 2, 2.5, ts - 4);
        x.fillStyle = 'rgba(70,55,110,0.16)'; x.fillRect(X + 2, Y + ts - 4, ts - 4, 2.5); x.fillRect(X + ts - 4, Y + 2, 2.5, ts - 4);
        if (r() < 0.25) { x.strokeStyle = 'rgba(255,255,255,0.45)'; x.lineWidth = 3; x.beginPath(); x.moveTo(X + ts * 0.62, Y + ts * 0.16); x.lineTo(X + ts * 0.84, Y + ts * 0.38); x.stroke(); }
      }
      break;
    }
    case 'water': {
      const g = x.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, hsl(base, 3)); g.addColorStop(0.5, hsl(base, -4, 0, 4)); g.addColorStop(1, hsl(base, 3));
      x.fillStyle = g; x.fillRect(0, 0, S, S);
      for (let i = 0; i < 22; i++) { // soft darker blobs
        const px = r() * S, py = r() * S, rad = 30 + r() * 40;
        x.fillStyle = hsl(base, -7, 4, 6, 0.18);
        wrap9(S, (dx, dy) => { x.beginPath(); x.ellipse(px + dx, py + dy, rad, rad * 0.5, 0, 0, 7); x.fill(); });
      }
      for (let i = 0; i < 16; i++) { // wave squiggles
        const px = r() * S, py = r() * S, len = 50 + r() * 50, a = 4 + r() * 4;
        const hi = r() < 0.6;
        x.strokeStyle = hi ? 'rgba(255,255,255,0.55)' : hsl(base, -14, 8, 4, 0.4);
        x.lineWidth = hi ? 3 : 2.5; x.lineCap = 'round';
        wrap9(S, (dx, dy) => {
          x.beginPath(); x.moveTo(px + dx, py + dy);
          x.bezierCurveTo(px + dx + len * 0.25, py + dy - a, px + dx + len * 0.4, py + dy + a, px + dx + len * 0.5, py + dy);
          x.bezierCurveTo(px + dx + len * 0.6, py + dy - a, px + dx + len * 0.8, py + dy + a, px + dx + len, py + dy);
          x.stroke();
        });
      }
      for (let i = 0; i < 12; i++) { // sparkles
        const px = r() * S, py = r() * S, L = 3 + r() * 3;
        x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 1.3;
        wrap9(S, (dx, dy) => { x.beginPath(); x.moveTo(px + dx - L, py + dy); x.lineTo(px + dx + L, py + dy); x.moveTo(px + dx, py + dy - L); x.lineTo(px + dx, py + dy + L); x.stroke(); });
      }
      break;
    }
    case 'brick': {
      const rows = 8, bh = S / rows, bw = S / 4;
      x.fillStyle = '#8a82a0'; x.fillRect(0, 0, S, S); // mortar
      for (let j = 0; j < rows; j++) {
        const off = (j % 2) * (bw / 2);
        for (let i = -1; i < 5; i++) {
          const X = i * bw + off, Y = j * bh;
          const col = hsl(base, (r() - 0.5) * 9, (r() - 0.5) * 6, (r() - 0.5) * 6);
          x.fillStyle = col; x.fillRect(X + 3, Y + 3, bw - 6, bh - 6);
          x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(X + 3, Y + 3, bw - 6, 2.5);
          x.fillStyle = 'rgba(50,40,80,0.18)'; x.fillRect(X + 3, Y + bh - 6, bw - 6, 3);
          if (r() < 0.3) { x.fillStyle = 'rgba(50,40,80,0.1)'; x.fillRect(X + 3 + r() * bw * 0.5, Y + 8, 8 + r() * 14, bh - 16); }
        }
      }
      break;
    }
    case 'dirt': {
      for (let i = 0; i < 30; i++) {
        const px = r() * S, py = r() * S, rad = 22 + r() * 40;
        x.fillStyle = hsl(base, (r() - 0.5) * 14, (r() - 0.5) * 8, 0, 0.35);
        wrap9(S, (dx, dy) => { x.beginPath(); x.ellipse(px + dx, py + dy, rad, rad * (0.5 + r() * 0.3), r() * 3, 0, 7); x.fill(); });
      }
      for (let i = 0; i < 60; i++) { // pebbles
        const px = r() * S, py = r() * S, rr = 1.5 + r() * 3;
        x.fillStyle = hsl(base, r() < 0.5 ? -18 : 8, -4, 0, 0.7);
        wrap9(S, (dx, dy) => { x.beginPath(); x.ellipse(px + dx, py + dy, rr * 1.3, rr, 0, 0, 7); x.fill(); });
      }
      for (let i = 0; i < 8; i++) { // furrow lines
        const py = r() * S, px = r() * S, len = 60 + r() * 80;
        x.strokeStyle = hsl(base, -16, 0, 0, 0.3); x.lineWidth = 2.5; x.lineCap = 'round';
        wrap9(S, (dx, dy) => { x.beginPath(); x.moveTo(px + dx, py + dy); x.quadraticCurveTo(px + dx + len / 2, py + dy + 5, px + dx + len, py + dy); x.stroke(); });
      }
      break;
    }
    case 'fairway':
    case 'green': { // mown golf turf: alternating light/dark stripes (green: finer + smoother)
      const stripes = type === 'green' ? 16 : 8, sw = S / stripes;
      for (let i = 0; i < stripes; i++) {
        x.fillStyle = i % 2 ? 'rgba(255,255,220,0.22)' : 'rgba(70,150,70,0.14)';
        x.fillRect(i * sw, 0, sw, S);
      }
      for (let i = 0; i < (type === 'green' ? 150 : 700); i++) {
        const bx = r() * S, by = r() * S, len = 3 + r() * 4;
        x.strokeStyle = r() < 0.5 ? 'rgba(60,140,60,0.35)' : 'rgba(235,255,200,0.4)';
        x.lineWidth = 1.2;
        x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + (r() - 0.5) * 2, by - len); x.stroke();
      }
      break;
    }
    default: break;
  }
  // Soft baked cell grid (cell borders at 0, C and S).
  for (const p of [0, C, S]) {
    x.fillStyle = 'rgba(43,43,58,0.15)';
    x.fillRect(p - 1.5, 0, 3, S); x.fillRect(0, p - 1.5, S, 3);
    x.fillStyle = 'rgba(43,43,58,0.05)';
    x.fillRect(p - 4, 0, 8, S); x.fillRect(0, p - 4, S, 8);
  }
  const t = canvasTexture(cv, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Wood texture for the outer frame. */
function frameWoodTexture() {
  const S = 512, cv = makeCanvas(S, S), x = cv.getContext('2d');
  const r = prng(4242);
  x.fillStyle = '#c08856'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) {
    const y = r() * S;
    x.strokeStyle = r() < 0.6 ? 'rgba(90,50,25,0.2)' : 'rgba(255,225,180,0.2)';
    x.lineWidth = 1 + r() * 2.5;
    x.beginPath(); x.moveTo(0, y);
    const a = (r() - 0.5) * 14;
    x.bezierCurveTo(S * 0.3, y + a, S * 0.7, y - a, S, y);
    x.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const kx = r() * S, ky = r() * S;
    x.fillStyle = 'rgba(80,45,20,0.3)';
    x.beginPath(); x.ellipse(kx, ky, 10, 5, 0, 0, 7); x.fill();
    x.strokeStyle = 'rgba(80,45,20,0.22)'; x.lineWidth = 1.5;
    x.beginPath(); x.ellipse(kx, ky, 18, 9, 0, 0, 7); x.stroke();
  }
  const t = canvasTexture(cv, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Chunky painted / chalky X mark. */
function xMarkTexture(color, outline, seed) {
  const S = 256, cv = makeCanvas(S, S), x = cv.getContext('2d');
  const r = prng(seed);
  x.lineCap = 'round'; x.lineJoin = 'round';
  const strokes = [[62, 56, 196, 198, -10], [198, 60, 58, 196, 10]];
  const path = ([ax, ay, bx, by, bend]) => {
    x.beginPath(); x.moveTo(ax, ay);
    x.quadraticCurveTo((ax + bx) / 2 + bend, (ay + by) / 2 - bend, bx, by);
  };
  if (outline) {
    x.save();
    x.shadowColor = 'rgba(40,10,20,0.35)'; x.shadowBlur = 8; x.shadowOffsetY = 6;
    x.strokeStyle = outline; x.lineWidth = 54;
    for (const s of strokes) { path(s); x.stroke(); }
    x.restore();
  }
  x.strokeStyle = color; x.lineWidth = 40;
  for (const s of strokes) { path(s); x.stroke(); }
  // brush bristles
  for (const [ax, ay, bx, by, bend] of strokes) {
    const nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny);
    for (let k = 0; k < 24; k++) {
      x.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)';
      x.lineWidth = 1.5 + r() * 2.5;
      const off = (r() - 0.5) * 30;
      const ox = (nx / nl) * off, oy = (ny / nl) * off;
      const t0 = 0.05 + r() * 0.15, t1 = 0.8 + r() * 0.15;
      x.beginPath();
      x.moveTo(ax + (bx - ax) * t0 + ox, ay + (by - ay) * t0 + oy);
      x.quadraticCurveTo((ax + bx) / 2 + bend + ox, (ay + by) / 2 - bend + oy, ax + (bx - ax) * t1 + ox, ay + (by - ay) * t1 + oy);
      x.stroke();
    }
  }
  x.strokeStyle = 'rgba(255,255,255,0.45)'; x.lineWidth = 6;
  x.beginPath(); x.moveTo(74, 64); x.lineTo(104, 96); x.stroke();
  // chalky grain (erase small specks)
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.5})`;
    x.fillRect(30 + r() * 196, 30 + r() * 196, 1.5 + r() * 2.5, 1.5 + r() * 2.5);
  }
  x.globalCompositeOperation = 'source-over';
  return canvasTexture(cv, false);
}

/** Rounded badge note chip in the character's outfit colour. */
function chipTexture(letter, color) {
  const S = 128, cv = makeCanvas(S, S), x = cv.getContext('2d');
  const hex = toHex(color);
  x.save();
  x.shadowColor = 'rgba(30,20,50,0.5)'; x.shadowBlur = 9; x.shadowOffsetY = 7;
  x.fillStyle = '#2b2b3a'; roundRect(x, 10, 8, S - 20, S - 24, 30); x.fill();
  x.restore();
  const g = x.createLinearGradient(0, 14, 0, S - 22);
  g.addColorStop(0, hsl(hex, 12)); g.addColorStop(1, hsl(hex, -6));
  x.fillStyle = g; roundRect(x, 17, 15, S - 34, S - 38, 24); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.38)'; roundRect(x, 28, 21, S - 56, 12, 6); x.fill();
  x.font = `bold 62px ${FONT}`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 10; x.lineJoin = 'round'; x.strokeStyle = '#2b2b3a'; x.strokeText(letter, S / 2, S / 2);
  x.fillStyle = '#ffffff'; x.fillText(letter, S / 2, S / 2);
  return canvasTexture(cv);
}

function backgroundTexture() {
  const S = 512, cv = makeCanvas(S, S), x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#ffe8d4'); g.addColorStop(0.5, '#f6e0ef'); g.addColorStop(1, '#d5d9f6');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const r = prng(99);
  for (let i = 0; i < 9; i++) {
    const cx = r() * S, cy = r() * S * 0.6, rad = 40 + r() * 90;
    const bg = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    bg.addColorStop(0, 'rgba(255,255,255,0.16)'); bg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = bg; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  const v = x.createRadialGradient(S / 2, S * 0.45, S * 0.3, S / 2, S * 0.5, S * 0.78);
  v.addColorStop(0, 'rgba(90,70,140,0)'); v.addColorStop(1, 'rgba(90,70,140,0.16)');
  x.fillStyle = v; x.fillRect(0, 0, S, S);
  return canvasTexture(cv, false);
}

function blobShadowTexture() {
  const S = 128, cv = makeCanvas(S, S), x = cv.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(45,30,70,0.5)'); g.addColorStop(0.45, 'rgba(45,30,70,0.3)');
  g.addColorStop(0.8, 'rgba(45,30,70,0.07)'); g.addColorStop(1, 'rgba(45,30,70,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return canvasTexture(cv, false);
}

/** White glowing rounded-tile outline (tinted by material colour). */
function glowTileTexture() {
  const S = 256, cv = makeCanvas(S, S), x = cv.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,0.2)'; roundRect(x, 22, 22, S - 44, S - 44, 34); x.fill();
  x.save();
  x.shadowColor = 'rgba(255,255,255,1)'; x.shadowBlur = 16;
  x.strokeStyle = 'rgba(255,255,255,0.95)'; x.lineWidth = 9;
  roundRect(x, 22, 22, S - 44, S - 44, 34); x.stroke();
  x.restore();
  x.strokeStyle = '#ffffff'; x.lineWidth = 5; roundRect(x, 22, 22, S - 44, S - 44, 34); x.stroke();
  return canvasTexture(cv, false);
}

/** Glowing selection ring. */
function ringTexture() {
  const S = 256, cv = makeCanvas(S, S), x = cv.getContext('2d');
  const c = S / 2, R = 96;
  x.save();
  x.shadowColor = 'rgba(255,220,80,1)'; x.shadowBlur = 18;
  x.strokeStyle = '#2b2b3a'; x.lineWidth = 22;
  x.beginPath(); x.arc(c, c, R, 0, 7); x.stroke();
  x.restore();
  x.strokeStyle = '#ffd84d'; x.lineWidth = 13;
  x.beginPath(); x.arc(c, c, R, 0, 7); x.stroke();
  x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 3;
  x.setLineDash([22, 18]);
  x.beginPath(); x.arc(c, c, R - 2, 0, 7); x.stroke();
  return canvasTexture(cv, false);
}

// Room plaques: one uniform world size for every label.
// world height of a plaque = 0.2 + 0.018·N (lettering scales with the board, identical for every room)
const PLAQUE_PX = 96;
const PLAQUE_FONT = `bold 50px ${FONT}`;
function measurePlaque(text) {
  const cv = makeCanvas(8, 8), x = cv.getContext('2d');
  x.font = PLAQUE_FONT;
  return (x.measureText(text).width + 48) / PLAQUE_PX; // aspect w/h
}
function plaqueTexture(text, aspect) {
  const H = PLAQUE_PX, W = Math.max(H, Math.round(H * aspect));
  const cv = makeCanvas(W, H), x = cv.getContext('2d');
  x.fillStyle = '#2b2b3a'; roundRect(x, 0, 0, W, H, 22); x.fill();
  const g = x.createLinearGradient(0, 6, 0, H - 6);
  g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#f1e1c2');
  x.fillStyle = g; roundRect(x, 6, 6, W - 12, H - 12, 17); x.fill();
  x.strokeStyle = 'rgba(160,120,80,0.45)'; x.lineWidth = 2;
  roundRect(x, 12, 12, W - 24, H - 24, 12); x.stroke();
  x.fillStyle = '#b8946a';
  for (const nx of [18, W - 18]) { x.beginPath(); x.arc(nx, H / 2, 3.5, 0, 7); x.fill(); }
  x.font = PLAQUE_FONT;
  x.fillStyle = '#2b2b3a'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, W / 2, H / 2 + 3);
  const t = canvasTexture(cv);
  return t;
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

const keyOf = (r, c) => `${r},${c}`;
// Object `facing` -> rotation.y (model front = local +z; board row r = world +z, column c = world +x).
const FACING_ROT = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 };
function parseCell(v) {
  if (v == null) return null;
  if (typeof v === 'string') { const [r, c] = v.split(',').map(Number); return Number.isFinite(r) && Number.isFinite(c) ? { r, c } : null; }
  if (Array.isArray(v)) return { r: +v[0], c: +v[1] };
  if (typeof v === 'object' && Number.isFinite(+v.r) && Number.isFinite(+v.c)) return { r: +v.r, c: +v.c };
  return null;
}
const noRaycast = () => {};

/** Rounded-rectangle THREE.Shape centred at the origin. */
function roundedRectShape(hw, hh, rad) {
  const s = new THREE.Shape();
  s.moveTo(-hw + rad, -hh);
  s.lineTo(hw - rad, -hh); s.quadraticCurveTo(hw, -hh, hw, -hh + rad);
  s.lineTo(hw, hh - rad); s.quadraticCurveTo(hw, hh, hw - rad, hh);
  s.lineTo(-hw + rad, hh); s.quadraticCurveTo(-hw, hh, -hw, hh - rad);
  s.lineTo(-hw, -hh + rad); s.quadraticCurveTo(-hw, -hh, -hw + rad, -hh);
  return s;
}
/** Extruded slab (shape in XZ) whose top face sits at y = top. */
function extrudeSlab(shape, depth, top, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, top - depth - bevel, 0);
  return g;
}
/** Box geometry placed at (x, y, z), non-indexed-compatible for merging. */
function boxAt(w, h, d, x, y, z) { return new THREE.BoxGeometry(w, h, d).translate(x, y, z); }

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
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
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
    this._bgTex = backgroundTexture();
    scene.background = this._bgTex;
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(36, 1, 0.3, 200);
    this._fitCam = new THREE.PerspectiveCamera(36, 1, 0.3, 200);

    // Lights: warm key with soft shadows, cool fill + rim, hemisphere ambient.
    this._baseLight = { hemi: 1.2, sun: 2.4, fill: 0.5, rim: 0.85 };
    this.hemi = new THREE.HemisphereLight('#fff3e3', '#b4a4d8', this._baseLight.hemi);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffdcb0', this._baseLight.sun);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.025;
    if ('intensity' in this.sun.shadow) this.sun.shadow.intensity = 0.75;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.fill = new THREE.DirectionalLight('#b9cfff', this._baseLight.fill);
    this.fill.position.set(6, 4, 5);
    scene.add(this.fill);
    this.rim = new THREE.DirectionalLight('#d8e4ff', this._baseLight.rim);
    this.rim.position.set(2, 5, -7);
    scene.add(this.rim);
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
    const toonMat = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...extra });
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
    this.tokens.clear(); this.objectsAt.clear(); this.chips.clear(); this.markMeshes.clear(); this.autoMeshes.clear();
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

    this._fitShadow();
    this._resize(true);
    this._applyCamera(DEFAULT_POLAR, DEFAULT_AZIMUTH, this._fitD);
    this.controls.update();
  }

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
      const mat = new THREE.MeshToonMaterial({ color: tint, map: this._floorTexture(floor), gradientMap: gradientMap() });
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
  }

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
  }

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
    addOutlines(group, 0.022);
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
  }

  /** Chess-style coordinates on the frame: letters a.. for columns (bottom + top), numbers 1.. for rows (left + right); row 1 is the north (far) row. */
  _buildCoordLabels(board) {
    const N = this.N, half = N / 2, off = half + FRAME_W / 2, y = FRAME_TOP + 0.06;
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
      s.scale.set(0.3, 0.3, 1); s.position.set(x, y, z); s.raycast = noRaycast; s.renderOrder = 5;
      group.add(s);
    };
    for (let i = 0; i < N; i++) {
      const pos = i - (N - 1) / 2;
      const letter = String.fromCharCode(97 + i), num = String(i + 1);
      add(letter, pos, off); add(letter, pos, -off);
      add(num, -off, pos); add(num, off, pos);
    }
    board.add(group);
  }

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
  }

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
  }

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
    // figurines / tall objects on the back row
    for (const x of [-h + 0.4, h - 0.4]) pts.push(new THREE.Vector3(x, 1.15, -h + 0.5));
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
        if (v.z > 1 || Math.abs(v.x) > 0.93 || Math.abs(v.y) > 0.9) return false;
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
  /** Aim the key light and fit its orthographic shadow frustum tightly around the board. */
  _fitShadow() {
    const N = this.N, e = N / 2 + FRAME_W + 0.2;
    const D = N * 1.5 + 8;
    this.sun.position.copy(SUN_DIR).multiplyScalar(D);
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
    this.sun.shadow.radius = 3;
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
    if (this._w > 1 && this._h > 1) this.renderer.render(this.scene, this.camera);
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
    this._bgTex.dispose();
    this.renderer.dispose();
    if (cv.parentNode) cv.parentNode.removeChild(cv);
    this._listeners = {};
    if (this._chipMats) for (const { mat } of this._chipMats.values()) { mat.map?.dispose(); mat.dispose(); }
    this.tokens.clear(); this.objectsAt.clear(); this.chips.clear();
  }
}
