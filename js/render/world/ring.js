// The "ring": the strip of world the player actually sees around the board at the default camera.
// Helpers that densely dress it (bushes, trees at the back and sides, tufts, flowers, rocks) and keep the board unobstructed:
//   front (z > 0): only low things; sides (|x| >= H+1.1): up to ~1.8 high, taller only further back (z < 0); behind: up to ~3.
import { GY } from './ctx.js';

/** Density factor: the ring is a band of constant width around a board that grows with N. */
export const ringK = (H) => (12.4 * (4 * H + 12.4)) / 327;

/** Places up to n items at free spots in the ring. fn(x,z,i). Skips anywhere farther than reach from the board. */
export function ringSpots(c, n, fn, { r = 0.4, reach = 6.2, ok = null, minD = 0 } = {}) {
  const H = c.H; let placed = 0;
  for (let i = 0; i < n * 40 && placed < n; i++) {
    const x = c.rr(-(H + reach), H + reach), z = c.rr(-(H + reach), H + reach);
    const d = c.dBoard(x, z); if (d > reach || d < minD) continue;
    if (ok && !ok(x, z)) continue;
    if (!c.free(x, z, r)) continue;
    c.claim(x, z, r * 0.8); fn(x, z, placed++);
  }
  return placed;
}

/** Trees only where they cannot hide the board: behind it and at the sides further back (z<0). */
export function ringTrees(c, kinds, n, { s0 = 0.8, s1 = 1.15, r = 1.0, reach = 6.6, sideS = 0.75 } = {}) {
  const H = c.H;
  return ringSpots(c, n, (x, z) => {
    const back = z < -(H + 2.2);
    c.tree(c.pick(kinds), x, z, back ? c.rr(s0, s1) : c.rr(s0, s1) * sideS);
  }, { r, reach, ok: (x, z) => (z < -(H + 2.2) || (Math.abs(x) > H + 2.2 && z < -0.5)) });
}

/** Bushes, tufts, flowers and rocks everywhere else in the ring (front stays low). */
export function ringFill(c, { bushes = ['round', 'grass'], bushN = 0, tufts = 0, flowers = 0, cols = ['#ffffff'], rocks = 0, bushS = [0.6, 1.0] } = {}) {
  const H = c.H, k = ringK(H);
  const lowS = (z) => (z > H - 0.5 ? 0.62 : 1);
  ringSpots(c, Math.round(bushN * k), (x, z) => c.bush(c.pick(bushes), x, z, c.rr(bushS[0], bushS[1]) * lowS(z)), { r: 0.55 });
  ringSpots(c, Math.round(rocks * k), (x, z) => c.rock(x, z, c.rr(0.3, 0.6)), { r: 0.45 });
  ringSpots(c, Math.round(flowers * k), (x, z) => c.flower(x, z, c.pick(cols), c.rr(0.9, 1.3)), { r: 0.22 });
  ringSpots(c, Math.round(tufts * k), (x, z) => c.tuft(x, z, c.rr(0.8, 1.4)), { r: 0.2, reach: 7.2 });
}

/** Painted soil / path patches helper: an irregular blot of colour on the ground texture. */
export function soil(P, x, z, rx, rz, col, a = 0.8) { P.ell(x, z, rx, rz, col, a * 0.5); P.ell(x, z, rx * 0.85, rz * 0.85, col, a); }
export { GY };
