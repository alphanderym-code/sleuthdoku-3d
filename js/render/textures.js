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
  wood: '#e9c393', tile: '#dcf0f3', grass: '#b9e297', sand: '#f6e2b0',
  stone: '#d9d4ce', carpet: '#e9b6cc', snow: '#f2f6ff', checker: '#f6f0e4',
  water: '#8fd8e6', brick: '#c9b8d6', dirt: '#d6b48a',
  fairway: '#a4de7c', green: '#b9ee92', // golf (Extreme scenes)
};

/** Floor pattern texture covering 2×2 cells (UV unit = 2 cells). Cell borders are baked in as a soft grid. */
export function floorTexture(type) {
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
export function frameWoodTexture() {
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

export function backgroundTexture() {
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
export function plaqueTexture(text, aspect) {
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
