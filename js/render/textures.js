// Canvas-drawn textures for the board: floors, marks, note chips, plaques, glows.
import * as THREE from 'three';

export const FONT = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';
export function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function canvasTexture(canvas, owned = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData.owned = owned;
  return t;
}
export function prng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function roundRect(x, X, Y, W, H, R) {
  R = Math.min(R, W / 2, H / 2);
  x.beginPath();
  x.moveTo(X + R, Y); x.lineTo(X + W - R, Y); x.quadraticCurveTo(X + W, Y, X + W, Y + R);
  x.lineTo(X + W, Y + H - R); x.quadraticCurveTo(X + W, Y + H, X + W - R, Y + H);
  x.lineTo(X + R, Y + H); x.quadraticCurveTo(X, Y + H, X, Y + H - R);
  x.lineTo(X, Y + R); x.quadraticCurveTo(X, Y, X + R, Y); x.closePath();
}
export function hexToHsl(hex) {
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
export const clamp100 = (v) => Math.max(0, Math.min(100, v));
/** CSS colour = hex shifted in HSL (dl/ds in %, dh in degrees). */
export function hsl(hex, dl = 0, ds = 0, dh = 0, a = 1) {
  const [h, s, l] = hexToHsl(hex);
  return `hsla(${(h + dh).toFixed(1)},${clamp100(s + ds).toFixed(1)}%,${clamp100(l + dl).toFixed(1)}%,${a})`;
}
/** Any CSS colour → #rrggbb (via THREE.Color, sRGB). */
export function toHex(col) { try { return '#' + new THREE.Color(col).getHexString(); } catch (_) { return '#888888'; } }
/** Draw fn at the 9 wrap offsets so shapes crossing the edge tile seamlessly. */
export function wrap9(S, fn) { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) fn(dx, dy); }

export const FLOOR_BASE = {
  wood: '#f0c690', tile: '#aee8dd', grass: '#b4b84c', sand: '#f9d6a0',
  stone: '#d6c8b6', carpet: '#e5799c', snow: '#fcf6ec', checker: '#fff0c6',
  water: '#4cc6c8', brick: '#e29c78', dirt: '#dcb282',
  fairway: '#a3b552', green: '#b4c45e', // golf (Extreme scenes)
};

/** Soft-edged (plateau) elliptical colour patch, drawn at the 9 wrap offsets so it tiles. */
function patch(x, S, cx, cy, rad, rgb, a, { sy = 1, rot = 0, soft = 0.45 } = {}) {
  wrap9(S, (dx, dy) => {
    x.save(); x.translate(cx + dx, cy + dy); x.rotate(rot); x.scale(1, sy);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, rad);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1 - soft, `rgba(${rgb},${a * 0.9})`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(-rad, -rad, rad * 2, rad * 2);
    x.restore();
  });
}
/** Curved, tapered grass blade (leaf shape). */
function blade(x, S, bx, by, h, w, lean, fill) {
  wrap9(S, (dx, dy) => {
    const X = bx + dx, Y = by + dy;
    x.fillStyle = fill; x.beginPath();
    x.moveTo(X - w, Y); x.quadraticCurveTo(X - w * 0.3 + lean * 0.4, Y - h * 0.65, X + lean, Y - h);
    x.quadraticCurveTo(X + w * 0.4 + lean * 0.5, Y - h * 0.5, X + w, Y); x.closePath(); x.fill();
  });
}
/** Chunky rounded paver / tile with a lighter top-left bevel and a tinted rim. */
function paver(x, X, Y, W, H, R, col, rim, { gloss = false } = {}) {
  col = toHex(col);
  x.fillStyle = rim; roundRect(x, X, Y, W, H, R); x.fill();
  const g = x.createLinearGradient(X, Y, X + W * 0.6, Y + H);
  g.addColorStop(0, hsl(col, 6)); g.addColorStop(1, hsl(col, -5));
  x.fillStyle = g; roundRect(x, X + 4, Y + 3, W - 9, H - 9, Math.max(2, R - 3)); x.fill();
  x.save(); roundRect(x, X + 4, Y + 3, W - 9, H - 9, Math.max(2, R - 3)); x.clip();
  x.strokeStyle = 'rgba(255,250,232,0.5)'; x.lineWidth = 5; roundRect(x, X + 6, Y + 6, W - 8, H - 8, R - 4); x.stroke();
  if (gloss) {
    const gg = x.createLinearGradient(X, Y, X + W, Y + H);
    gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(0.28, 'rgba(255,255,255,0)');
    gg.addColorStop(0.4, 'rgba(255,255,255,0.3)'); gg.addColorStop(0.55, 'rgba(255,255,255,0)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gg; x.fillRect(X, Y, W, H);
    x.fillStyle = 'rgba(255,255,255,0.6)'; roundRect(x, X + 18, Y + 16, W * 0.22, 8, 4); x.fill();
    roundRect(x, X + 18, Y + 30, 8, 8, 4); x.fill();
  }
  x.restore();
}

/** Floor pattern texture covering 2×2 cells (UV unit = 2 cells). Cell borders are baked in as a soft grid. */
export function floorTexture(type) {
  const S = 1024, C = S / 2;
  const cv = makeCanvas(S, S);
  const x = cv.getContext('2d');
  const r = prng(hashStr(type) + 7);
  const base = FLOOR_BASE[type] || '#eeeeee';
  x.fillStyle = base; x.fillRect(0, 0, S, S);
  x.lineCap = 'round'; x.lineJoin = 'round';
  switch (type) {
    case 'wood': {
      const tones = ['#f2c48a', '#e6ad6c', '#f6d29c'];
      const rows = 4, ph = S / rows;
      x.fillStyle = '#9c6234'; x.fillRect(0, 0, S, S);
      for (let i = 0; i < rows; i++) {
        const y0 = i * ph;
        let px = r() * S; const end = px + S;
        while (px < end - 1) {
          let len = C * (0.9 + r() * 0.8);
          if (end - px - len < C * 0.5) len = end - px;
          const seed = (r() * 1e9) | 0;
          const col = hsl(tones[(r() * 3) | 0], (r() - 0.5) * 4, 0, (r() - 0.5) * 4);
          const X0 = px;
          wrap9(S, (dx, dy) => {
            if (dy !== 0) return;
            const q = prng(seed);
            const X = X0 + dx;
            paver(x, X + 2, y0 + 3, len - 4, ph - 6, 22, col, 'rgba(120,66,30,0.55)');
            x.save(); roundRect(x, X + 6, y0 + 7, len - 12, ph - 14, 18); x.clip();
            const n = 3 + ((q() * 3) | 0);
            for (let k = 0; k < n; k++) {
              const yy = y0 + ph * (0.2 + 0.6 * q());
              x.strokeStyle = hsl(col, -14, 4, -2, 0.2 + q() * 0.12); x.lineWidth = 2.5 + q() * 3;
              x.beginPath(); x.moveTo(X, yy);
              const a = (q() - 0.5) * 16;
              x.bezierCurveTo(X + len * 0.33, yy + a, X + len * 0.66, yy - a, X + len, yy + (q() - 0.5) * 8);
              x.stroke();
            }
            if (q() < 0.3) {
              const kx = X + len * (0.25 + 0.5 * q()), ky = y0 + ph * (0.4 + 0.2 * q());
              x.strokeStyle = hsl(col, -18, 4, -2, 0.3); x.lineWidth = 3;
              for (let k = 0; k < 3; k++) { x.beginPath(); x.ellipse(kx, ky, 12 + k * 9, 5 + k * 4, 0, 0, Math.PI * 2); x.stroke(); }
            }
            x.restore();
          });
          px += len;
        }
      }
      break;
    }
    case 'tile':
    case 'checker': {
      const n = 4, ts = S / n;
      const A = type === 'tile' ? ['#b4eadf', '#a2e0e6', '#c3efd6'] : ['#fff1c4'];
      const B = type === 'tile' ? null : '#bba8ee';
      x.fillStyle = type === 'tile' ? '#74bfbd' : '#a38fd6'; x.fillRect(0, 0, S, S); // joints
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const col = type === 'checker' ? ((i + j) % 2 ? B : A[0]) : A[(r() * A.length) | 0];
        paver(x, i * ts + 3, j * ts + 3, ts - 6, ts - 6, 30, hsl(col, (r() - 0.5) * 3), type === 'tile' ? 'rgba(60,130,140,0.4)' : 'rgba(110,90,170,0.35)', { gloss: true });
      }
      break;
    }
    case 'grass': {
      for (let i = 0; i < 16; i++) patch(x, S, r() * S, r() * S, 120 + r() * 170, '214,204,96', 0.34, { sy: 0.5 + r() * 0.4, rot: r() * 3 });
      for (let i = 0; i < 16; i++) patch(x, S, r() * S, r() * S, 110 + r() * 160, '116,156,62', 0.3, { sy: 0.5 + r() * 0.4, rot: r() * 3 });
      for (let i = 0; i < 34; i++) { // simple leaf blades in small fans
        const cx = r() * S, cy = r() * S, light = r() < 0.5;
        for (let k = -1; k <= 1; k++) blade(x, S, cx + k * 8, cy, 30 + r() * 14, 5, k * 9, light ? hsl(base, 9, 6, 6, 0.8) : hsl(base, -16, 8, -4, 0.7));
      }
      for (let i = 0; i < 7; i++) { // clover
        const cx = r() * S, cy = r() * S;
        x.fillStyle = hsl(base, 5, 8, 8, 0.85);
        wrap9(S, (dx, dy) => { for (const [ox, oy] of [[-8, 0], [8, 0], [0, -9]]) { x.beginPath(); x.arc(cx + dx + ox, cy + dy + oy, 8, 0, 7); x.fill(); } });
      }
      break;
    }
    case 'fairway':
    case 'green': { // mown golf turf: soft alternating light/dark stripes
      const stripes = type === 'green' ? 16 : 8, sw = S / stripes;
      for (let i = 0; i < stripes; i++) {
        const lightS = i % 2 === 0;
        const g = x.createLinearGradient(i * sw, 0, (i + 1) * sw, 0);
        const c = lightS ? '255,255,150' : '60,150,60', a = lightS ? 0.32 : 0.2;
        g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.18, `rgba(${c},${a})`); g.addColorStop(0.82, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`);
        x.fillStyle = g; x.fillRect(i * sw, 0, sw, S);
      }
      for (let i = 0; i < 10; i++) patch(x, S, r() * S, r() * S, 110 + r() * 120, i % 2 ? '255,250,150' : '70,150,60', 0.14, { sy: 0.6 });
      for (let i = 0; i < (type === 'green' ? 20 : 30); i++) blade(x, S, r() * S, r() * S, 22 + r() * 8, 4, (r() - 0.5) * 8, 'rgba(240,255,170,0.5)');
      break;
    }
    case 'sand': {
      for (let i = 0; i < 12; i++) patch(x, S, r() * S, r() * S, 120 + r() * 140, r() < 0.5 ? '255,236,190' : '240,160,110', 0.26, { sy: 0.6, rot: r() * 3 });
      const rowsN = 8;
      for (let k = 0; k < rowsN; k++) {
        const y0 = (k + 0.5) * (S / rowsN) + (r() - 0.5) * 20, amp = 10 + r() * 8, ph = r() * 6.28, cyc = 2 + ((r() * 2) | 0);
        const line = (off, col, w) => {
          x.strokeStyle = col; x.lineWidth = w;
          for (const dy of [-S, 0, S]) {
            x.beginPath();
            for (let px = 0; px <= S; px += 8) {
              const yy = y0 + off + dy + Math.sin((px / S) * Math.PI * 2 * cyc + ph) * amp;
              if (px === 0) x.moveTo(px, yy); else x.lineTo(px, yy);
            }
            x.stroke();
          }
        };
        line(10, 'rgba(225,140,95,0.16)', 26); line(10, 'rgba(225,140,95,0.2)', 12);
        line(-6, 'rgba(255,246,220,0.35)', 22); line(-6, 'rgba(255,250,232,0.55)', 9);
      }
      for (let i = 0; i < 160; i++) { x.fillStyle = r() < 0.5 ? 'rgba(210,130,90,0.3)' : 'rgba(255,250,235,0.6)'; x.beginPath(); x.arc(r() * S, r() * S, 2 + r() * 2.5, 0, 7); x.fill(); }
      break;
    }
    case 'dirt': {
      for (let i = 0; i < 14; i++) patch(x, S, r() * S, r() * S, 120 + r() * 140, r() < 0.5 ? '245,205,150' : '170,110,70', 0.3, { sy: 0.6, rot: r() * 3 });
      for (let i = 0; i < 46; i++) { // soft clods
        const px = r() * S, py = r() * S, rr = 16 + r() * 26, sy = 0.65 + r() * 0.3, rot = r() * 3;
        wrap9(S, (dx, dy) => {
          x.save(); x.translate(px + dx, py + dy); x.rotate(rot);
          x.fillStyle = 'rgba(110,64,40,0.28)'; x.beginPath(); x.ellipse(4, 6, rr, rr * sy, 0, 0, 7); x.fill();
          const g = x.createLinearGradient(-rr, -rr, rr, rr);
          g.addColorStop(0, hsl(base, 9, 2, 2)); g.addColorStop(1, hsl(base, -8, 2, -2));
          x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, rr, rr * sy, 0, 0, 7); x.fill();
          x.fillStyle = 'rgba(255,240,210,0.35)'; x.beginPath(); x.ellipse(-rr * 0.25, -rr * 0.3 * sy, rr * 0.45, rr * 0.2, -0.3, 0, 7); x.fill();
          x.restore();
        });
      }
      for (let i = 0; i < 24; i++) { x.fillStyle = hsl(base, r() < 0.5 ? -22 : 10, -4, 0, 0.75); x.beginPath(); x.ellipse(r() * S, r() * S, 6 + r() * 4, 4 + r() * 3, r() * 3, 0, 7); x.fill(); }
      break;
    }
    case 'stone': {
      x.fillStyle = hsl(base, -26, 4, -6); x.fillRect(0, 0, S, S);
      const rows = 4, rh = S / rows;
      for (let i = 0; i < rows; i++) {
        let px = r() * S; const end = px + S;
        while (px < end - 1) {
          let w = rh * (0.95 + r() * 0.7);
          if (end - px - w < rh * 0.6) w = end - px;
          const col = hsl(base, (r() - 0.5) * 8, (r() - 0.5) * 8, (r() - 0.5) * 10);
          const X0 = px, Y0 = i * rh;
          wrap9(S, (dx, dy) => { if (dy === 0) paver(x, X0 + dx + 3, Y0 + 3, w - 6, rh - 6, 40, col, hsl(base, -22, 6, -6)); });
          px += w;
        }
      }
      break;
    }
    case 'brick': {
      x.fillStyle = hsl(base, -22, -6, -4); x.fillRect(0, 0, S, S);
      const rows = 8, bh = S / rows, bw = S / 4;
      for (let j = 0; j < rows; j++) {
        const off = (j % 2) * (bw / 2);
        for (let i = -1; i < 5; i++) {
          const col = hsl(base, (r() - 0.5) * 10, (r() - 0.5) * 8, (r() - 0.5) * 8);
          wrap9(S, (dx, dy) => { if (dy === 0 && dx === 0) paver(x, i * bw + off + 4, j * bh + 4, bw - 8, bh - 8, 20, col, hsl(base, -18, 0, -3)); });
        }
      }
      break;
    }
    case 'carpet': {
      for (let i = 0; i < 12; i++) patch(x, S, r() * S, r() * S, 120 + r() * 120, r() < 0.5 ? '255,170,195' : '190,60,110', 0.16, { sy: 0.6, rot: r() * 3 });
      for (let i = 0; i < 2600; i++) { // plush pile
        const px = r() * S, py = r() * S, a = r() * 3.14;
        x.strokeStyle = r() < 0.5 ? 'rgba(255,200,215,0.18)' : 'rgba(140,30,80,0.12)'; x.lineWidth = 2.5;
        x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * 7, py + Math.sin(a) * 7); x.stroke();
      }
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const cx = i * C + C / 2, cy = j * C + C / 2, R = C * 0.34;
        const dia = (rr) => { x.beginPath(); x.moveTo(cx, cy - rr); x.lineTo(cx + rr, cy); x.lineTo(cx, cy + rr); x.lineTo(cx - rr, cy); x.closePath(); };
        x.lineWidth = 16; x.strokeStyle = hsl(base, -16, 4, -6, 0.75); x.fillStyle = hsl(base, 9, 4, 4); dia(R); x.fill(); x.stroke();
        x.fillStyle = hsl(base, -16, 8, -6, 0.9); dia(R * 0.46); x.fill();
        x.fillStyle = '#ffe8b8'; x.beginPath(); x.arc(cx, cy, 13, 0, 7); x.fill();
      }
      for (const [ox, oy] of [[0, 0], [C, 0], [0, C], [C, C], [S, 0], [0, S], [S, S], [S, C], [C, S]]) {
        x.fillStyle = '#ffd98a'; x.beginPath(); x.arc(ox, oy, 15, 0, 7); x.fill();
        x.fillStyle = hsl(base, -16, 4, -6, 0.9); x.beginPath(); x.arc(ox, oy, 7, 0, 7); x.fill();
      }
      break;
    }
    case 'snow': {
      for (let i = 0; i < 12; i++) patch(x, S, r() * S, r() * S, 90 + r() * 140, '150,188,244', 0.55, { sy: 0.55 + r() * 0.3, rot: r() * 3, soft: 0.6 });
      for (let i = 0; i < 12; i++) patch(x, S, r() * S, r() * S, 70 + r() * 120, '255,255,255', 0.75, { sy: 0.6, rot: r() * 3, soft: 0.5 });
      for (let i = 0; i < 70; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.95)' : 'rgba(150,185,235,0.4)'; x.beginPath(); x.arc(r() * S, r() * S, 2 + r() * 3, 0, 7); x.fill(); }
      for (let i = 0; i < 14; i++) {
        const sx = r() * S, sy = r() * S, L = 8 + r() * 6;
        x.strokeStyle = 'rgba(255,255,255,0.95)'; x.lineWidth = 3;
        wrap9(S, (dx, dy) => { x.beginPath(); x.moveTo(sx + dx - L, sy + dy); x.lineTo(sx + dx + L, sy + dy); x.moveTo(sx + dx, sy + dy - L); x.lineTo(sx + dx, sy + dy + L); x.stroke(); });
      }
      break;
    }
    case 'water': {
      for (let i = 0; i < 14; i++) patch(x, S, r() * S, r() * S, 130 + r() * 130, r() < 0.55 ? '26,140,170' : '120,230,225', 0.3, { sy: 0.6, rot: r() * 3, soft: 0.6 });
      for (let i = 0; i < 20; i++) { // caustic-like loops
        const cx = r() * S, cy = r() * S, rad = 36 + r() * 50, n = 5 + ((r() * 2) | 0), ph = r() * 6.28;
        const pts = []; for (let k = 0; k < n; k++) { const a = ph + k / n * 6.283, rr = rad * (0.7 + r() * 0.5); pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.65]); }
        wrap9(S, (dx, dy) => {
          x.beginPath();
          for (let k = 0; k <= n; k++) {
            const a = pts[k % n], b = pts[(k + 1) % n], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
            if (k === 0) x.moveTo(cx + dx + mx, cy + dy + my); else x.quadraticCurveTo(cx + dx + a[0], cy + dy + a[1], cx + dx + mx, cy + dy + my);
          }
          x.strokeStyle = 'rgba(210,255,248,0.12)'; x.lineWidth = 18; x.stroke();
          x.strokeStyle = 'rgba(225,255,250,0.4)'; x.lineWidth = 6; x.stroke();
        });
      }
      for (let i = 0; i < 10; i++) {
        const px = r() * S, py = r() * S, L = 7 + r() * 5;
        x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 3;
        wrap9(S, (dx, dy) => { x.beginPath(); x.moveTo(px + dx - L, py + dy); x.lineTo(px + dx + L, py + dy); x.moveTo(px + dx, py + dy - L); x.lineTo(px + dx, py + dy + L); x.stroke(); });
      }
      break;
    }
    default: break;
  }
  // Soft baked cell grid (cell borders at 0, C and S): soft shade line plus a light line on its lit side.
  for (const p of [0, C, S]) {
    x.fillStyle = 'rgba(70,50,90,0.07)';
    x.fillRect(p - 9, 0, 18, S); x.fillRect(0, p - 9, S, 18);
    x.fillStyle = 'rgba(70,45,85,0.24)';
    x.fillRect(p - 3, 0, 6, S); x.fillRect(0, p - 3, S, 6);
    x.fillStyle = 'rgba(255,250,232,0.3)';
    x.fillRect(p + 4, 0, 4, S); x.fillRect(0, p + 4, S, 4);
  }
  const t = canvasTexture(cv, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}


/** Wood texture for the outer frame. */
/** Chunky painted / chalky X mark. */
export function xMarkTexture(color, outline, seed) {
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
export function chipTexture(letter, color) {
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

export function blobShadowTexture() {
  const S = 128, cv = makeCanvas(S, S), x = cv.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(45,30,70,0.5)'); g.addColorStop(0.45, 'rgba(45,30,70,0.3)');
  g.addColorStop(0.8, 'rgba(45,30,70,0.07)'); g.addColorStop(1, 'rgba(45,30,70,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return canvasTexture(cv, false);
}

/** White glowing rounded-tile outline (tinted by material colour). */
export function glowTileTexture() {
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
export function ringTexture() {
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
export const PLAQUE_PX = 96;
export const PLAQUE_FONT = `bold 50px ${FONT}`;
export function measurePlaque(text) {
  const cv = makeCanvas(8, 8), x = cv.getContext('2d');
  x.font = PLAQUE_FONT;
  return (x.measureText(text).width + 48) / PLAQUE_PX; // aspect w/h
}
export const PLAQUE_RIMS = ['#ee6f5c', '#2fb3a8', '#8d5aa8'];
export function plaqueTexture(text, aspect) {
  const H = PLAQUE_PX, W = Math.max(H, Math.round(H * aspect));
  const cv = makeCanvas(W, H), x = cv.getContext('2d');
  const rim = PLAQUE_RIMS[hashStr(text) % PLAQUE_RIMS.length];
  x.fillStyle = rim; roundRect(x, 0, 0, W, H, 30); x.fill();
  x.fillStyle = 'rgba(0,0,0,0.12)'; roundRect(x, 0, H * 0.5, W, H * 0.5, 30); x.fill();
  x.fillStyle = rim; roundRect(x, 0, 0, W, H - 4, 30); x.fill();
  x.fillStyle = hsl(rim, 14, 6); roundRect(x, 3, 2, W - 6, 10, 5); x.fill();
  const g = x.createLinearGradient(0, 8, 0, H - 8);
  g.addColorStop(0, '#fffbee'); g.addColorStop(1, '#f7e8c8');
  x.fillStyle = g; roundRect(x, 8, 8, W - 16, H - 20, 23); x.fill();
  x.font = PLAQUE_FONT;
  x.fillStyle = '#3a2a55'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, W / 2, H / 2 - 1);
  return canvasTexture(cv);
}
