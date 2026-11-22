// Grid geometry helpers. Pure ES module (Node + browser).
import { isBlockingType } from './objects.js';

const objCache = new WeakMap();

function objectMap(puzzle) {
  let m = objCache.get(puzzle);
  if (!m) {
    m = new Map();
    for (const o of puzzle.objects || []) m.set(o.r * 64 + o.c, o);
    objCache.set(puzzle, m);
  }
  return m;
}

export function inBounds(puzzle, r, c) {
  return r >= 0 && c >= 0 && r < puzzle.size && c < puzzle.size;
}

export function roomAt(puzzle, r, c) {
  if (!inBounds(puzzle, r, c)) return null;
  return puzzle.rooms[r][c];
}

export function objectAt(puzzle, r, c) {
  return objectMap(puzzle).get(r * 64 + c) ?? null;
}

export function isOccupiable(puzzle, r, c) {
  if (!inBounds(puzzle, r, c)) return false;
  const o = objectAt(puzzle, r, c);
  return !(o && isBlockingType(o.type));
}

// a, b = {r,c}: orthogonally adjacent AND same room
export function isBeside(puzzle, a, b) {
  const d = Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
  return d === 1 && roomAt(puzzle, a.r, a.c) === roomAt(puzzle, b.r, b.c);
}

// Room boundary (other room or grid edge) on two perpendicular sides.
export function isCorner(puzzle, r, c) {
  const k = roomAt(puzzle, r, c);
  const wall = (rr, cc) => roomAt(puzzle, rr, cc) !== k; // null (off-grid) counts as wall
  const ns = wall(r - 1, c) || wall(r + 1, c);
  const ew = wall(r, c - 1) || wall(r, c + 1);
  return ns && ew;
}

export function roomCells(puzzle, roomKey) {
  const out = [];
  for (let r = 0; r < puzzle.size; r++)
    for (let c = 0; c < puzzle.size; c++)
      if (puzzle.rooms[r][c] === roomKey) out.push({ r, c });
  return out;
}

export function roomKeys(puzzle) {
  const seen = [];
  for (const row of puzzle.rooms)
    for (const ch of row) if (!seen.includes(ch)) seen.push(ch);
  return seen;
}

export function neighbors(puzzle, r, c) {
  return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
    .filter(([rr, cc]) => inBounds(puzzle, rr, cc))
    .map(([rr, cc]) => ({ r: rr, c: cc }));
}

export function cellKey(r, c) {
  return `${r},${c}`;
}
