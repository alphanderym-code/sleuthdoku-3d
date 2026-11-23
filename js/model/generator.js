// Puzzle generator. Pure ES module (Node + browser, no DOM).
// generatePuzzle({ size, difficulty, seed }) -> unique, logic-solvable puzzle in the SPEC format,
// following the genre conventions (SPEC v2): suspects A, B, C…, victim V, the victim is never
// referenced by a clue, few clues per suspect, case notes fill the gap.
import { makeRng } from './rng.js';
import { isBlockingType } from './objects.js';
import { roomAt, objectAt, isBeside, isCorner } from './grid.js';
import { evaluateClue, evaluateNote, roomNumber, lineOfSight, roomAdjacency } from './clues.js';
import { categoriesPresent } from './categories.js';
import { weaponsForScene, woundOf } from './weapons.js';
import { solve, prepare, murdererOf } from './solver.js';
import { propagate } from './hints.js';
import { assignFacing } from './facing.js';
import { SCENES, pickCast, randomLook } from '../data/content.js';

export const DIFFICULTIES = ['very-easy', 'easy', 'medium', 'hard', 'extreme'];
export const DEFAULT_SIZE = { 'very-easy': 5, easy: 6, medium: 7, hard: 8, extreme: 16 };
export const EXTREME_SIZE = 16;

const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

// Clue weights per difficulty, keyed by wkey() (clue type; 'dir' split into variants).
// Easy levels favour strong / compound clues so a single clue per suspect is enough.
const WEIGHTS = {
  'very-easy': { onObjectInRoom: 6, aloneInRoom: 6, onObject: 4, inRoom: 4, row: 3, column: 3, aloneWith: 3,
    besideCategory: 1.5, notBesideCategory: 0.6, sees: 0.5, wound: 0.8, witness: 0.8,
    besideObject: 3, corner: 1.5, alone: 1.5, rowOneOf: 1.5, columnOneOf: 1.5, besidePerson: 1.5, sameRoom: 1,
    dir: 0.8, dirDist: 1, dirDiag: 0.5, dirOther: 0.5, aloneWithGender: 0.8, withSomeoneBeside: 0.8,
    notOnObject: 0.3, notInRoom: 0.3, notBesideObject: 0.3, diagonal: 0.3 },
  easy: { onObjectInRoom: 5, aloneInRoom: 5, onObject: 3, inRoom: 3, row: 2.5, column: 2.5, aloneWith: 3,
    besideCategory: 2.5, notBesideCategory: 1, sees: 1.2, wound: 1.5, witness: 1.5,
    besideObject: 3, corner: 2, alone: 2, rowOneOf: 2, columnOneOf: 2, besidePerson: 2, sameRoom: 1.5,
    dir: 1.5, dirDist: 2, dirDiag: 1, dirOther: 1, aloneWithGender: 1.5, withSomeoneBeside: 1.5,
    notOnObject: 0.8, notInRoom: 0.8, notBesideObject: 0.6, diagonal: 0.8 },
  medium: { onObjectInRoom: 3, aloneInRoom: 3, onObject: 2, inRoom: 2, row: 1.5, column: 1.5, aloneWith: 3,
    besideCategory: 4, notBesideCategory: 3, sees: 4, wound: 2.5, witness: 2.5,
    besideObject: 3, corner: 2, alone: 2, rowOneOf: 2.5, columnOneOf: 2.5, besidePerson: 3, sameRoom: 2,
    dir: 2.5, dirDist: 3, dirDiag: 2.5, dirOther: 2, aloneWithGender: 2, withSomeoneBeside: 2,
    notOnObject: 1.5, notInRoom: 1.5, notBesideObject: 1.5, diagonal: 2 },
  hard: { onObjectInRoom: 1.5, aloneInRoom: 1.5, onObject: 1, inRoom: 1, row: 0.7, column: 0.7, aloneWith: 2.5,
    besideCategory: 5, notBesideCategory: 4, sees: 6, wound: 4, witness: 4,
    besideObject: 2.5, corner: 2, alone: 2, rowOneOf: 2, columnOneOf: 2, besidePerson: 3, sameRoom: 2.5,
    dir: 3, dirDist: 3, dirDiag: 3, dirOther: 3, aloneWithGender: 2.5, withSomeoneBeside: 2.5,
    notOnObject: 2, notInRoom: 2, notBesideObject: 2, diagonal: 2.5 },
  extreme: { onObjectInRoom: 2, aloneInRoom: 1.5, onObject: 1.5, inRoom: 1.5, row: 0.7, column: 0.7, aloneWith: 2.5,
    besideCategory: 7, notBesideCategory: 6, sees: 8, wound: 6, witness: 6,
    besideObject: 2.5, corner: 1.5, alone: 1.5, rowOneOf: 2, columnOneOf: 2, besidePerson: 3, sameRoom: 2.5,
    dir: 3, dirDist: 3, dirDiag: 3, dirOther: 3, aloneWithGender: 2.5, withSomeoneBeside: 2.5,
    notOnObject: 1.5, notInRoom: 1.5, notBesideObject: 1.5, diagonal: 2.5, rowOffset: 3, roomNumberCompare: 3.5 },
};
// Clue kinds used when repairing a puzzle the logic engine gets stuck on.
const STRONG = new Set(['inRoom', 'row', 'column', 'onObject', 'onObjectInRoom', 'aloneInRoom', 'aloneWith',
  'corner', 'besideObject', 'besideCategory', 'rowOneOf', 'columnOneOf', 'dirDist', 'besidePerson']);
// Starting clues at 16x16 (strong: they pin a room or a line, so the solver stays fast).
const START = new Set(['inRoom', 'onObjectInRoom', 'aloneInRoom']);
// Clue budget (SPEC v2 item 4) and case-note budget per difficulty.
//   maxPer: clues per suspect; maxDoubles: suspects allowed a 2nd clue; maxNotes: case notes;
//   notePrior: chance to start with a note; addW / noteW: relative weight of those edits.
const BUDGET = {
  'very-easy': { maxPer: 1, maxDoubles: 0, maxNotes: 1, notePrior: 0.1, addW: 0, noteW: 0.6 },
  easy: { maxPer: 1, maxDoubles: 0, maxNotes: 1, notePrior: 0.2, addW: 0, noteW: 0.8 },
  medium: { maxPer: 2, maxDoubles: 3, maxNotes: 2, notePrior: 0.4, addW: 0.3, noteW: 1.2 },
  hard: { maxPer: 2, maxDoubles: 8, maxNotes: 2, notePrior: 0.7, addW: 0.7, noteW: 1.5 },
  extreme: { maxPer: 2, maxDoubles: 15, maxNotes: 3, notePrior: 0.8, addW: 0.5, noteW: 1.5 },
};
// Max "what-if" (lookahead) steps and logic-engine "narrow" steps allowed per difficulty.
const LIMITS = {
  'very-easy': { trial: 0, narrow: 0 },
  easy: { trial: 1, narrow: 0 },
  medium: { trial: 3, narrow: 0 },
  hard: { trial: 99, narrow: 1 },
  extreme: { trial: 999, narrow: 999 }, // 16x16: uniqueness only (the logic profile is too slow to replay)
};

const ROOM_KEY_FALLBACK = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// ---------------------------------------------------------------- rooms

function partition(rng, N, K) {
  const total = N * N;
  const maxSize = Math.ceil((2.3 * total) / K);
  for (let attempt = 0; attempt < 300; attempt++) {
    const g = new Array(total).fill(-1);
    const sizes = new Array(K).fill(0);
    // Seeds spread apart (Manhattan >= 2 when possible).
    const order = rng.shuffle([...Array(total).keys()]);
    const seeds = [];
    for (const minD of [3, 2, 1]) {
      seeds.length = 0;
      for (const i of order) {
        if (seeds.length === K) break;
        const r = Math.floor(i / N), c = i % N;
        if (seeds.every((j) => Math.abs(Math.floor(j / N) - r) + Math.abs((j % N) - c) >= minD)) seeds.push(i);
      }
      if (seeds.length === K) break;
    }
    seeds.forEach((i, k) => { g[i] = k; sizes[k] = 1; });
    let left = total - K;
    while (left > 0) {
      // Frontier per room.
      const fronts = [];
      for (let k = 0; k < K; k++) fronts.push([]);
      for (let i = 0; i < total; i++) {
        if (g[i] !== -1) continue;
        const r = Math.floor(i / N), c = i % N;
        const cnt = new Map();
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
          const k = g[rr * N + cc];
          if (k >= 0) cnt.set(k, (cnt.get(k) || 0) + 1);
        }
        for (const [k, n] of cnt) fronts[k].push({ i, n });
      }
      const rw = [];
      let sum = 0;
      for (let k = 0; k < K; k++) {
        const w = fronts[k].length && sizes[k] < maxSize ? 1 / Math.pow(sizes[k], 1.4) : 0;
        rw.push(w); sum += w;
      }
      if (sum === 0) break;
      let x = rng.next() * sum, k = 0;
      while (k < K - 1 && (x -= rw[k]) > 0) k++;
      if (rw[k] === 0) k = rw.findIndex((w) => w > 0);
      // Compactness: prefer cells touching the room on more sides.
      const f = fronts[k];
      let fs = 0;
      const fw = f.map((e) => { const w = e.n * e.n * e.n; fs += w; return w; });
      let y = rng.next() * fs, j = 0;
      while (j < f.length - 1 && (y -= fw[j]) > 0) j++;
      g[f[j].i] = k; sizes[k]++; left--;
    }
    if (left > 0) continue;
    if (sizes.some((s) => s < 2)) continue;
    if (sizes.filter((s) => s === 2).length > 1) continue;
    // Not too skinny: few "end" cells with <= 1 same-room neighbour.
    let skinny = false;
    for (let k = 0; k < K && !skinny; k++) {
      let ends = 0;
      for (let i = 0; i < total; i++) {
        if (g[i] !== k) continue;
        const r = Math.floor(i / N), c = i % N;
        let n = 0;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && cc >= 0 && rr < N && cc < N && g[rr * N + cc] === k) n++;
        }
        if (n <= 1) ends++;
      }
      if (ends > Math.max(2, Math.ceil(sizes[k] / 3))) skinny = true;
      // Bigger rooms need some "body": enough cells inside a 2x2 block of the same room.
      if (!skinny && sizes[k] >= 4) {
        const inBlock = new Set();
        for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) {
          const q = [r * N + c, r * N + c + 1, (r + 1) * N + c, (r + 1) * N + c + 1];
          if (q.every((i) => g[i] === k)) q.forEach((i) => inBlock.add(i));
        }
        if (inBlock.size < (sizes[k] >= 6 ? Math.ceil(sizes[k] * 0.45) : 4)) skinny = true;
      }
    }
    if (skinny) continue;
    return g;
  }
  return null;
}

function roomKeysFor(names) {
  const used = new Set();
  return names.map((name) => {
    const letters = name.toUpperCase().replace(/[^A-Z]/g, '');
    for (const ch of letters + ROOM_KEY_FALLBACK) {
      if (!used.has(ch)) { used.add(ch); return ch; }
    }
    throw new Error('Out of room keys');
  });
}

// ---------------------------------------------------------------- layout & furnishing

// Types that only ever stand on cells touching a room boundary (or the grid edge).
export const WALL_TYPES = new Set(['shelf', 'wardrobe', 'tv', 'bed', 'counter', 'oven', 'fireplace', 'piano', 'desk', 'register', 'arcade', 'heater']);
// Seats must be orthogonally adjacent to one of these.
export const SEAT_ANCHORS = { chair: ['table', 'desk', 'counter'], stool: ['counter', 'table', 'desk', 'piano'] };
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
// Types that naturally come in big clumps (no cluster / per-room count limit).
export const CLUSTER_OK = new Set(['water', 'flowers', 'haybale', 'tree', 'bush', 'rug', 'boat',
  'bear', 'lion', 'elephant', 'penguin', 'croc', 'shark', 'shallows', 'bunker',
  'carhorse', 'deckchair', 'liftchair', 'foodstall', 'luggage', 'snowman']);
export const MAX_CLUSTER = 2;

function makeState(N, rooms, roomSize) {
  const nb = new Array(N * N).fill(0);
  const cells = {};
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const k = rooms[r][c];
      (cells[k] = cells[k] || []).push(r * N + c);
      for (const [dr, dc] of N4) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && cc >= 0 && rr < N && cc < N && rooms[rr][cc] === k) nb[r * N + c]++;
      }
    }
  }
  return {
    N, rooms, roomSize, nb, cells,
    occ: new Array(N * N).fill(null),
    blocked: new Array(N * N).fill(false),
    rowB: new Array(N).fill(0), colB: new Array(N).fill(0),
    roomB: {}, cnt: {}, objects: [],
  };
}

const cellRoom = (st, i) => st.rooms[Math.floor(i / st.N)][i % st.N];

// Can `type` stand on cell i? (solvability limits apply to blocking types only.)
// Would one more `type` on cell i keep clusters <= MAX_CLUSTER (orthogonally connected) and the per-room count sensible?
function sameOk(st, i, type) {
  if (CLUSTER_OK.has(type)) return true;
  const k = cellRoom(st, i);
  if ((st.cnt[k]?.[type] || 0) + 1 > Math.max(2, Math.ceil(st.roomSize[k] * 0.35))) return false;
  const seen = new Set([i]), stack = [i];
  while (stack.length) {
    for (const j of neighbours(st, stack.pop(), N4)) {
      if (st.occ[j] === type && !seen.has(j)) { seen.add(j); stack.push(j); }
    }
  }
  return seen.size <= MAX_CLUSTER;
}

function canPut(st, i, type, wall) {
  if (st.occ[i]) return false;
  if (!sameOk(st, i, type)) return false;
  const k = cellRoom(st, i);
  if (wall && st.nb[i] >= 4) return false;
  if (isBlockingType(type)) {
    const r = Math.floor(i / st.N), c = i % st.N, size = st.roomSize[k];
    const cap = Math.max(1, Math.min(Math.ceil(size * 0.5), size - 2));
    if (st.rowB[r] >= st.N - 2 || st.colB[c] >= st.N - 2 || (st.roomB[k] || 0) + 1 > cap) return false;
  }
  return true;
}

function put(st, i, type) {
  const r = Math.floor(i / st.N), c = i % st.N, k = cellRoom(st, i);
  st.occ[i] = type;
  if (isBlockingType(type)) { st.blocked[i] = true; st.rowB[r]++; st.colB[c]++; st.roomB[k] = (st.roomB[k] || 0) + 1; }
  const cc = (st.cnt[k] = st.cnt[k] || {});
  cc[type] = (cc[type] || 0) + 1;
  st.objects.push({ type, r, c });
}

function neighbours(st, i, dirs) {
  const r = Math.floor(i / st.N), c = i % st.N, out = [];
  for (const [dr, dc] of dirs) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && cc >= 0 && rr < st.N && cc < st.N) out.push(rr * st.N + cc);
  }
  return out;
}

const wantWall = (item) => item.wall ?? WALL_TYPES.has(item.t);
const span = (rng, [lo, hi], cap) => (cap <= 0 ? 0 : Math.max(lo > 0 ? 1 : 0, Math.min(rng.int(lo, hi), cap)));

// Place one item (a single object, a contiguous patch, plus seats / extra piece). Returns cells used.
function placeItem(rng, st, key, item, remaining, sizeOverride) {
  const wall = wantWall(item);
  let seeds = rng.shuffle(st.cells[key]).filter((i) => canPut(st, i, item.t, wall));
  if (item.corner) {
    const tight = seeds.filter((i) => st.nb[i] <= 2);
    if (tight.length) seeds = tight;
  }
  if (!seeds.length) return 0;
  const size = sizeOverride ?? (item.size ? span(rng, item.size, remaining) : 1);
  const patch = [seeds[0]];
  put(st, seeds[0], item.t);
  while (patch.length < size) {
    const fr = [...new Set(patch.flatMap((i) => neighbours(st, i, N4)))]
      .filter((i) => cellRoom(st, i) === key && canPut(st, i, item.t, wall));
    if (!fr.length) break;
    const i = rng.pick(fr);
    patch.push(i); put(st, i, item.t);
  }
  let used = patch.length;
  if (item.seat) {
    const [stype, range] = item.seat;
    const n = span(rng, range, Math.max(0, remaining - used));
    const dirs = item.t === 'campfire' ? N8 : N4;
    let cand = [...new Set(patch.flatMap((i) => neighbours(st, i, dirs)))]
      .filter((i) => cellRoom(st, i) === key && !st.occ[i]);
    cand = rng.shuffle(cand);
    if (stype === 'stool') cand.sort((a, b) => (st.nb[a] >= 4 ? 0 : 1) - (st.nb[b] >= 4 ? 0 : 1));
    let placed = 0;
    for (let s = 0; placed < n && s < cand.length; s++) {
      if (!sameOk(st, cand[s], stype)) continue;
      put(st, cand[s], stype); used++; placed++;
    }
  }
  if (item.extra && used < remaining) {
    const cand = rng.shuffle([...new Set(patch.flatMap((i) => neighbours(st, i, N4)))]
      .filter((i) => cellRoom(st, i) === key && canPut(st, i, item.extra, true)));
    if (cand.length) { put(st, cand[0], item.extra); used++; }
  }
  return used;
}

function furnishRoom(rng, st, key, rec, allowEmpty) {
  const size = st.roomSize[key];
  const [lo, hi] = rec.fill;
  let budget = Math.round(size * (lo + rng.next() * (hi - lo)));
  if (lo > 0) budget = Math.max(budget, 1);
  if (budget === 0 && !allowEmpty) budget = 1;
  if (size <= 4) budget = Math.min(budget, 2);
  if (!budget) return 0;
  const counts = new Map();
  const deferred = [];
  let rem = budget, placedAny = 0;
  const take = (item, forced) => {
    const sizeOv = item.size ? span(rng, item.size, rem) : 1;
    if (item.t === 'rug' && !forced) {
      deferred.push({ item, sizeOv }); rem -= sizeOv; counts.set(item, (counts.get(item) || 0) + 1); return true;
    }
    const used = placeItem(rng, st, key, item, rem, item.size ? sizeOv : undefined);
    if (!used) return false;
    rem -= used; counts.set(item, (counts.get(item) || 0) + 1); placedAny++;
    return true;
  };
  for (const item of rec.items) {
    for (let m = 0; m < item.min && rem > 0; m++) take(item);
  }
  for (let tries = 0; rem > 0 && tries < 14; tries++) {
    const cands = rec.items.filter((it2) => (counts.get(it2) || 0) < it2.max);
    if (!cands.length) break;
    let x = rng.next() * cands.reduce((s, it2) => s + it2.w, 0), item = cands[cands.length - 1];
    for (const it2 of cands) { x -= it2.w; if (x < 0) { item = it2; break; } }
    if (!take(item)) counts.set(item, item.max); // cannot place this kind here any more
  }
  for (const { item, sizeOv } of deferred) { if (placeItem(rng, st, key, item, sizeOv, sizeOv)) placedAny++; }
  return placedAny;
}

// Fill a room's remaining free cells with open water (blocking, but exempt from the room's density cap and
// not counted in its per-type tallies). Keeps >= 2 free cells per row/column and at least ~30% of the room
// free (boats included). A cell that cannot be flooded gets a boat, so no bare "walkable water" is left.
function floodRoom(rng, st, key, type) {
  const size = st.roomSize[key], N = st.N;
  const keepFree = Math.max(2, Math.ceil(size * 0.3));
  let blockedHere = st.cells[key].filter((i) => st.blocked[i]).length;
  for (const i of rng.shuffle(st.cells[key])) {
    if (st.occ[i]) continue;
    const r = Math.floor(i / N), c = i % N;
    if (st.rowB[r] < N - 2 && st.colB[c] < N - 2 && size - blockedHere - 1 >= keepFree) {
      st.occ[i] = type; st.blocked[i] = true; st.rowB[r]++; st.colB[c]++; blockedHere++;
      st.objects.push({ type, r, c });
    } else {
      put(st, i, 'boat');
    }
  }
}

// Add one occupiable object on cell i if the room's recipe allows one there. Returns the type or null.
function addOccupiableAt(rng, ctx, i) {
  const { st, recipes } = ctx;
  if (st.occ[i]) return null;
  const k = cellRoom(st, i), rec = recipes[k], have = st.cnt[k] || {};
  const total = Object.values(have).reduce((s, v) => s + v, 0);
  if (total + 1 > Math.max(2, Math.ceil(st.roomSize[k] * rec.fill[1]) + 1)) return null;
  const cands = [];
  const anchored = (types) => neighbours(st, i, N4).some((j) => types.includes(st.occ[j]));
  for (const item of rec.items) {
    if (OBJ_OCC(item.t) && (have[item.t] || 0) < item.max && (!wantWall(item) || st.nb[i] < 4)) {
      if (item.t === 'bed' && st.nb[i] > 2) continue;
      cands.push([item.t, item.w]);
    }
    if (item.seat && SEAT_ANCHORS[item.seat[0]] && anchored(SEAT_ANCHORS[item.seat[0]]) && (have[item.seat[0]] || 0) < item.seat[1][1]) {
      cands.push([item.seat[0], 1.5]);
    }
  }
  const okc = cands.filter(([t]) => sameOk(st, i, t));
  if (!okc.length) return null;
  cands.length = 0; cands.push(...okc);
  let x = rng.next() * cands.reduce((s, [, w]) => s + w, 0), type = cands[cands.length - 1][0];
  for (const [t, w] of cands) { x -= w; if (x < 0) { type = t; break; } }
  put(st, i, type);
  return type;
}
const OBJ_OCC = (t) => !isBlockingType(t);

export function buildLayout(rng, N, scene) {
  const maxK = scene.rooms.length;
  const [kLo, kHi] = (N >= 10 && scene.roomCount) || [Math.max(3, N - 1), N + 1];
  const K = Math.min(maxK, rng.int(kLo, kHi));
  const g = partition(rng, N, K);
  if (!g) return null;
  const sizes = new Array(K).fill(0);
  for (const k of g) sizes[k]++;
  // Match scene rooms to regions: rooms that prefer to be big (big:1) get large regions, small ones tiny ones.
  // Rooms flagged `always` (e.g. the Lake) are never dropped when the scene has more rooms than regions.
  const pool = rng.shuffle(scene.rooms).sort((a, b) => (b.always ? 1 : 0) - (a.always ? 1 : 0)).slice(0, K);
  const defsOrder = pool.map((d) => [d, (d.big || 0) + rng.next() * 1.2]).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  const regionOrder = rng.shuffle([...Array(K).keys()]).sort((a, b) => sizes[b] - sizes[a]);
  const roomDefs = new Array(K);
  regionOrder.forEach((reg, idx) => { roomDefs[reg] = defsOrder[idx]; });
  const keys = roomKeysFor(roomDefs.map((d) => d.name));
  const rooms = [];
  for (let r = 0; r < N; r++) {
    let s = '';
    for (let c = 0; c < N; c++) s += keys[g[r * N + c]];
    rooms.push(s);
  }
  const roomInfo = {}, recipes = {}, roomSize = {};
  roomDefs.forEach((d, k) => { roomInfo[keys[k]] = { name: d.name, floor: d.floor, ...(d.numbered ? { numbered: true } : {}) }; recipes[keys[k]] = d; roomSize[keys[k]] = sizes[k]; });

  const st = makeState(N, rooms, roomSize);
  let empties = 0;
  for (const key of rng.shuffle(Object.keys(recipes))) {
    const placed = furnishRoom(rng, st, key, recipes[key], empties < 1);
    if (!placed && recipes[key].fill[0] === 0) empties++;
  }
  // Flooded rooms (lake / pond): last, so the other rooms have first claim on row/column capacity.
  for (const key of Object.keys(recipes)) if (recipes[key].flood) floodRoom(rng, st, key, recipes[key].flood);
  return { K, rooms, roomInfo, blocked: st.blocked, objects: st.objects, ctx: { st, recipes } };
}

// Random permutation (one per row/col) on free cells.
function randomPlacement(rng, N, blocked) {
  const colUsed = new Array(N).fill(false);
  const out = [];
  let steps = 0;
  function rec(r) {
    if (r === N) return true;
    if (++steps > 5000) return false;
    for (const c of rng.shuffle([...Array(N).keys()])) {
      if (colUsed[c] || blocked[r * N + c]) continue;
      colUsed[c] = true; out.push({ r, c });
      if (rec(r + 1)) return true;
      colUsed[c] = false; out.pop();
    }
    return false;
  }
  return rec(0) ? out : null;
}

// ---------------------------------------------------------------- clues

// Weight keys: clue type, except 'dir' variants (dirDist / dirDiag / dirOther).
function wkey(cl) {
  if (cl.type !== 'dir') return cl.type;
  if (cl.dist != null) return 'dirDist';
  if (cl.otherRoom) return 'dirOther';
  if (DIAG_DIRS.includes(cl.dir)) return 'dirDiag';
  return 'dir';
}
const DIAG_DIRS = ['northeast', 'northwest', 'southeast', 'southwest'];

// All true clues for suspect `id` (never referencing the victim). Each {clue, w}.
function cluePool(puzzle, sol, id, victimId) {
  const N = puzzle.size;
  const p = sol[id];
  const room = roomAt(puzzle, p.r, p.c);
  const out = [];
  const add = (clue, w = 1) => out.push({ clue, w });
  const roomKeysAll = Object.keys(puzzle.roomInfo);
  add({ type: 'inRoom', room });
  for (const k of roomKeysAll) if (k !== room) add({ type: 'notInRoom', room: k }, 1 / roomKeysAll.length);
  const o = objectAt(puzzle, p.r, p.c);
  const occTypes = [...new Set(puzzle.objects.filter((x) => !isBlockingType(x.type)).map((x) => x.type))];
  if (o && !isBlockingType(o.type)) {
    add({ type: 'onObject', object: o.type });
    add({ type: 'onObjectInRoom', object: o.type, room });
  }
  for (const t of occTypes) if (!o || o.type !== t) add({ type: 'notOnObject', object: t }, 0.6);
  const types = [...new Set(puzzle.objects.map((x) => x.type))];
  for (const cat of categoriesPresent(puzzle)) {
    const clue = { type: 'besideCategory', category: cat, v: 0 };
    const beside = evaluateClue(clue, id, { [id]: p }, puzzle) === true;
    for (let v = 0; v < 3; v++) add({ type: beside ? 'besideCategory' : 'notBesideCategory', category: cat, v }, (beside ? 1 : 0.5) / 3);
  }
  for (const t of types) {
    const beside = puzzle.objects.some((x) => x.type === t && isBeside(puzzle, p, x));
    add({ type: beside ? 'besideObject' : 'notBesideObject', object: t }, beside ? 1 : 0.5);
  }
  add({ type: 'row', index: p.r });
  add({ type: 'column', index: p.c });
  for (const d of [-1, 1]) {
    if (p.r + d >= 0 && p.r + d < N) add({ type: 'rowOneOf', indices: [Math.min(p.r, p.r + d), Math.max(p.r, p.r + d)] });
    if (p.c + d >= 0 && p.c + d < N) add({ type: 'columnOneOf', indices: [Math.min(p.c, p.c + d), Math.max(p.c, p.c + d)] });
  }
  if (isCorner(puzzle, p.r, p.c)) add({ type: 'corner' });
  // Room population.
  const mates = puzzle.characters.filter((ch) => ch.id !== id && roomAt(puzzle, sol[ch.id].r, sol[ch.id].c) === room);
  if (mates.length === 0) {
    add({ type: 'alone' });
    add({ type: 'aloneInRoom', room });
  }
  if (mates.length === 1) {
    const m = mates[0];
    if (!m.victim) add({ type: 'aloneWith', who: m.id });
    // For the murderer this would point straight at the victim's room: never offered.
    if (!m.victim) add({ type: 'aloneWithGender', gender: m.gender });
  }
  for (const t of types) {
    if (mates.some((m) => !m.victim && puzzle.objects.some((x) => x.type === t && isBeside(puzzle, sol[m.id], x)))) {
      add({ type: 'withSomeoneBeside', object: t });
    }
  }
  // Relations to other suspects.
  const myNum = roomNumber(puzzle, room);
  for (const ch of puzzle.characters) {
    if (ch.id === id || ch.id === victimId) continue;
    const q = sol[ch.id];
    const dr = p.r - q.r, dc = p.c - q.c;
    const otherNum = roomNumber(puzzle, roomAt(puzzle, q.r, q.c));
    if (myNum != null && otherNum != null && myNum !== otherNum) {
      add({ type: 'roomNumberCompare', of: ch.id, cmp: myNum > otherNum ? 'higher' : 'lower' }, 1.2);
    }
    if (N >= 12 && dr && Math.abs(dr) <= 3) add({ type: 'rowOffset', of: ch.id, delta: dr }, 1);
    const other = roomAt(puzzle, q.r, q.c) !== room;
    if (isBeside(puzzle, p, q)) add({ type: 'besidePerson', who: ch.id });
    if (!other) add({ type: 'sameRoom', who: ch.id });
    const ns = dr < 0 ? 'north' : 'south', ew = dc < 0 ? 'west' : 'east';
    if (dr) {
      add({ type: 'dir', dir: ns, of: ch.id });
      if (Math.abs(dr) <= 2) add({ type: 'dir', dir: ns, of: ch.id, dist: Math.abs(dr) }, 0.5);
      if (other) add({ type: 'dir', dir: ns, of: ch.id, otherRoom: true });
    }
    if (dc) {
      add({ type: 'dir', dir: ew, of: ch.id });
      if (Math.abs(dc) <= 2) add({ type: 'dir', dir: ew, of: ch.id, dist: Math.abs(dc) }, 0.5);
      if (other) add({ type: 'dir', dir: ew, of: ch.id, otherRoom: true });
    }
    if (dr && dc) add({ type: 'dir', dir: ns + ew, of: ch.id });
    if (Math.abs(dr) === Math.abs(dc)) add({ type: 'diagonal', with: ch.id });
    if (lineOfSight(puzzle, p, q)) add({ type: 'sees', who: ch.id }, 1.5);
  }
  return out;
}

// True puzzle-wide notes. Each {note, w}. Never about the victim's room genders.
function notePool(puzzle, sol, victimId) {
  const out = [];
  const chars = puzzle.characters;
  const occTypes = [...new Set(puzzle.objects.filter((x) => !isBlockingType(x.type)).map((x) => x.type))];
  for (const t of occTypes) {
    const count = chars.filter((ch) => objectAt(puzzle, sol[ch.id].r, sol[ch.id].c)?.type === t).length;
    out.push({ note: { type: 'countOnObject', object: t, count }, w: count ? 1 : 0.4 });
  }
  const byRoom = {};
  for (const ch of chars) (byRoom[roomAt(puzzle, sol[ch.id].r, sol[ch.id].c)] ||= []).push(ch);
  const keys = Object.keys(puzzle.roomInfo);
  const empty = keys.filter((k) => !byRoom[k]).length;
  if (empty === 0) out.push({ note: { type: 'noEmptyRoom' }, w: 1 });
  else if (empty <= 3) out.push({ note: { type: 'emptyRooms', count: empty }, w: 0.8 });
  const vRoom = roomAt(puzzle, sol[victimId].r, sol[victimId].c);
  for (const [k, list] of Object.entries(byRoom)) {
    if (k === vRoom || list.length !== 2 || list[0].gender === list[1].gender) continue;
    out.push({ note: { type: 'roomGenders', room: k }, w: 1 });
  }
  // Weapon wound (the murderer's) and witness zone (victim's room, or a neighbouring room).
  const murderer = chars.find((ch) => !ch.victim && byRoom[vRoom]?.includes(ch));
  if (murderer?.weapon) out.push({ note: { type: 'wound', wound: woundOf(murderer.weapon) }, w: 1 });
  out.push({ note: { type: 'witness', room: vRoom }, w: 0.6 });
  for (const k of roomAdjacency(puzzle).get(vRoom) ?? []) out.push({ note: { type: 'witness', room: k }, w: 1 });
  return out;
}

const keyOf = (x) => JSON.stringify(x);

function pickW(rng, items, wf) {
  const ws = items.map(wf);
  const sum = ws.reduce((a, b) => a + b, 0);
  if (sum <= 0) return items.length ? rng.pick(items) : null;
  let x = rng.next() * sum, i = 0;
  while (i < items.length - 1 && (x -= ws[i]) > 0) i++;
  return items[i];
}

const sameSol = (a, b) => Object.keys(b).every((id) => a[id] && a[id].r === b[id].r && a[id].c === b[id].c);

// ---------------------------------------------------------------- logic profile

// Replays the hint engine's reasoning from an empty board: direct singles, one-step "what if"
// lookahead (as getHint does, domains <= 12), else a 'narrow' (player would need to guess).
export function logicProfile(puzzle, sol) {
  const P = prepare(puzzle);
  const placements = {};
  let direct = 0, trial = 0, narrow = 0;
  const stuck = [];
  let placed = 0;
  while (placed < P.ids.length) {
    const { domains, contradiction } = propagate(puzzle, placements);
    if (contradiction) return { ok: false, direct, trial, narrow, stuck };
    const unplaced = P.ids.filter((id) => !placements[id]);
    const singles = unplaced.filter((id) => domains[id].length === 1);
    if (singles.length) {
      for (const id of singles) {
        const cell = P.cells[domains[id][0]];
        if (cell.r !== sol[id].r || cell.c !== sol[id].c) return { ok: false, direct, trial, narrow, stuck };
        placements[id] = { r: cell.r, c: cell.c };
        placed++; direct++;
      }
      continue;
    }
    const order = unplaced.slice().sort((a, b) => domains[a].length - domains[b].length);
    let done = false;
    for (const id of order) {
      if (domains[id].length > 12) break;
      const d = domains[id].filter((i) => {
        const p = P.cells[i];
        return !propagate(puzzle, { ...placements, [id]: { r: p.r, c: p.c } }).contradiction;
      });
      if (d.length === 1) {
        const cell = P.cells[d[0]];
        if (cell.r !== sol[id].r || cell.c !== sol[id].c) return { ok: false, direct, trial, narrow, stuck };
        placements[id] = { r: cell.r, c: cell.c };
        placed++; trial++; stuck.push(id); done = true;
        break;
      }
    }
    if (done) continue;
    const id = order[0];
    placements[id] = { r: sol[id].r, c: sol[id].c };
    placed++; narrow++; stuck.push(id);
  }
  return { ok: true, direct, trial, narrow, stuck };
}

function acceptable(prof, difficulty) {
  const L = LIMITS[difficulty];
  return prof.ok && prof.narrow <= L.narrow && prof.trial <= L.trial;
}

// Lower is better (used when no attempt is fully acceptable before the budget runs out).
function badness(prof, difficulty) {
  if (!prof.ok) return 1e6;
  const L = LIMITS[difficulty];
  let b = Math.max(0, prof.narrow - L.narrow) * 10 + Math.max(0, prof.trial - L.trial) * 2;
  if (difficulty === 'hard' && prof.trial + prof.narrow === 0) b += 1;
  return b;
}

// ---------------------------------------------------------------- one attempt

function attempt(rng, N, difficulty, sceneOpt, seed, budgetMs) {
  const eligible = SCENES.filter((s) => ((difficulty === 'extreme' || N >= 10) ? s.extreme : !(s.minSize > N)));
  const scene = sceneOpt
    ? SCENES.find((s) => s.key === sceneOpt) ?? rng.pick(eligible)
    : rng.pick(eligible);
  const layout = buildLayout(rng, N, scene);
  if (!layout) return null;
  const { rooms, roomInfo, blocked, objects } = layout;
  // Numbered rooms (golf holes): the numbers are dealt after the people are placed, so that every
  // hole's head count has the parity of its number (needs #odd-count holes == #odd numbers).
  const numberedKeys = scene.numbered ? Object.keys(roomInfo).filter((k) => roomInfo[k].numbered) : [];

  // Solution placement with a valid victim room.
  let cellsSol = null, victimIdx = -1;
  for (let t = 0; t < 40 && !cellsSol; t++) {
    const pl = randomPlacement(rng, N, blocked);
    if (!pl) continue;
    const byRoom = {};
    pl.forEach((p, i) => { const k = rooms[p.r][p.c]; (byRoom[k] = byRoom[k] || []).push(i); });
    const used = Object.keys(byRoom).length;
    if (used < 3) continue;
    const pairs = Object.values(byRoom).filter((l) => l.length === 2);
    if (!pairs.length) continue;
    const pair = rng.shuffle(rng.pick(pairs));
    if (numberedKeys.length) {
      const M = numberedKeys.length;
      const odd = numberedKeys.filter((k) => (byRoom[k]?.length || 0) % 2 === 1);
      if (odd.length !== Math.ceil(M / 2)) continue;
      const nums = [...Array(M).keys()].map((x) => x + 1);
      const oddNums = rng.shuffle(nums.filter((x) => x % 2 === 1)), evenNums = rng.shuffle(nums.filter((x) => x % 2 === 0));
      for (const k of numberedKeys) {
        const n = (byRoom[k]?.length || 0) % 2 === 1 ? oddNums.pop() : evenNums.pop();
        roomInfo[k] = { name: `${(scene.noun || 'area').replace(/^./, (ch) => ch.toUpperCase())} ${n}`, floor: roomInfo[k].floor, number: n, recipe: layout.ctx.recipes[k].name };
      }
    }
    cellsSol = pl; victimIdx = pair[0];
  }
  if (!cellsSol) return null;

  // Occupiable objects: make sure some solution cells hold one the room's recipe allows (object clues).
  const { ctx } = layout;
  const onSol = rng.int(1, Math.max(1, Math.floor(N / 3)));
  const isOcc = (t) => t && !isBlockingType(t);
  let haveOcc = cellsSol.filter((p) => isOcc(ctx.st.occ[p.r * N + p.c])).length;
  for (const p of rng.shuffle(cellsSol)) {
    if (haveOcc >= onSol) break;
    if (addOccupiableAt(rng, ctx, p.r * N + p.c)) haveOcc++;
  }
  objects.sort((a, b) => a.r - b.r || a.c - b.c);
  assignFacing({ size: N, rooms, objects });

  // Cast: suspects A, B, C… and the victim V (last card).
  const cast = pickCast(rng, N);
  if (cast.length < N) return null;
  const suspects = rng.shuffle(cast.slice(0, N - 1));
  const sol = {};
  const characters = [];
  let si = 0;
  cellsSol.forEach((p, i) => {
    const person = i === victimIdx ? cast[N - 1] : suspects[si++];
    const id = person.name[0].toUpperCase();
    sol[id] = { r: p.r, c: p.c };
    characters.push({
      id, name: person.name, gender: person.gender, victim: i === victimIdx,
      look: randomLook(rng, person.gender), clues: [],
    });
  });
  characters.sort((a, b) => (a.id < b.id ? -1 : 1));
  // Weapons: every suspect carries one (scene flavor); a few wound kinds, so weapons are shared.
  {
    const wl = weaponsForScene(scene);
    const wounds = rng.shuffle([...new Set(wl.map(woundOf))]).slice(0, N <= 6 ? 3 : 4);
    for (const ch of characters) {
      if (ch.victim) continue;
      const w = rng.pick(wounds);
      ch.weapon = rng.pick(wl.filter((k) => woundOf(k) === w));
    }
  }
  const victimId = characters.find((c) => c.victim).id;
  const suspectIds = characters.filter((c) => !c.victim).map((c) => c.id);

  const base = {
    id: `gen-${seed}-${N}`, title: scene.title, difficulty, size: N, outdoor: !!scene.outdoor,
    rooms, roomInfo, objects, characters, notes: numberedKeys.length && scene.parity ? [{ type: 'roomParity' }] : [],
    ...(numberedKeys.length ? { roomNoun: scene.noun || 'area' } : {}),
  };

  const W = WEIGHTS[difficulty];
  const B = BUDGET[difficulty];
  const XL = N >= 10;
  const SAMPLE = XL ? 4 : N >= 8 ? 3 : 5;
  const NODES = XL ? 20000 : N >= 8 ? 1500 : 4000;
  const pools = {};
  for (const id of suspectIds) {
    pools[id] = cluePool(base, sol, id, victimId).filter((c) => evaluateClue(c.clue, id, sol, base) === true);
    if (!pools[id].length) return null;
  }
  const notesAll = notePool(base, sol, victimId).filter((n) => evaluateNote(n.note, sol, base) === true)
    .map((n) => ({ ...n, w: n.w * (W[n.note.type] ?? 1) }));
  const clueW = (c) => (W[wkey(c.clue)] ?? 0.5) * c.w;

  // State: clue lists per suspect + notes.
  let state = { clues: {}, notes: [] };
  // 16x16: the weak-clue state has far too many solutions for the solver, so start from two strong
  // clues per suspect (a room + a line: nearly one cell) and weaken them afterwards while uniqueness holds.
  for (const id of suspectIds) {
    if (XL) {
      const roomy = pools[id].filter((c) => START.has(c.clue.type));
      const line = pools[id].filter((c) => c.clue.type === 'row' || c.clue.type === 'column');
      state.clues[id] = [pickW(rng, roomy.length ? roomy : pools[id], clueW).clue];
      if (line.length) state.clues[id].push(pickW(rng, line, clueW).clue);
    } else state.clues[id] = [pickW(rng, pools[id], clueW).clue];
  }
  if (notesAll.length && rng.chance(B.notePrior)) state.notes.push(pickW(rng, notesAll, (n) => n.w).note);

  const build = (st) => ({
    ...base,
    notes: [...base.notes.map((n) => ({ ...n })), ...st.notes.map((n) => ({ ...n }))],
    characters: base.characters.map((ch) => ({
      ...ch, clues: ch.victim ? [{ type: 'victim' }] : st.clues[ch.id].map((cl) => ({ ...cl })),
    })),
  });
  const doubles = (st) => suspectIds.filter((id) => st.clues[id].length > 1).length;
  const apply = (st, op) => {
    const next = { clues: { ...st.clues }, notes: st.notes.slice() };
    if (op.kind === 'replace') {
      const l = st.clues[op.owner].slice(); l[op.idx] = op.clue; next.clues[op.owner] = l;
    } else if (op.kind === 'add') {
      next.clues[op.owner] = [...st.clues[op.owner], op.clue];
    } else if (op.kind === 'note') {
      next.notes.push(op.note);
    } else if (op.kind === 'swapNote') {
      next.notes[op.idx] = op.note;
    }
    return next;
  };
  // Candidate edits; `filter(owner, clue|note)` keeps those worth trying.
  const ops = (st, keep) => {
    const out = [];
    for (const id of suspectIds) {
      const have = new Set(st.clues[id].map(keyOf));
      for (const c of pools[id]) {
        if (have.has(keyOf(c.clue)) || !keep(id, c.clue, null)) continue;
        const w = clueW(c);
        st.clues[id].forEach((_, idx) => out.push({ kind: 'replace', owner: id, idx, clue: c.clue, w }));
        if (st.clues[id].length < B.maxPer && doubles(st) < B.maxDoubles) out.push({ kind: 'add', owner: id, clue: c.clue, w: w * B.addW });
      }
    }
    const haveN = new Set(st.notes.map(keyOf));
    for (const n of notesAll) {
      if (haveN.has(keyOf(n.note)) || !keep(null, null, n.note)) continue;
      if (st.notes.length < B.maxNotes) out.push({ kind: 'note', note: n.note, w: n.w * B.noteW });
      st.notes.forEach((_, idx) => out.push({ kind: 'swapNote', idx, note: n.note, w: n.w * 0.5 }));
    }
    return out;
  };
  const sample = (list, k) => {
    const pool = list.slice(), out = [];
    while (pool.length && out.length < k) {
      const o = pickW(rng, pool, (x) => x.w);
      out.push(o); pool.splice(pool.indexOf(o), 1);
    }
    return out;
  };

  // Phase 1: reach a unique solution (each edit rules out a current alternative; keep the edit
  // that leaves the fewest solutions).
  let unique = false;
  let res = solve(build(state), { limit: 4, nodeLimit: NODES });
  if (res.aborted) return null;
  for (let it = 0; it < 40; it++) {
    if (res.count === 0) throw new Error('generator: true clues produced no solution (internal bug)');
    if (res.count === 1) { unique = true; break; }
    const alt = res.solutions.find((s) => !sameSol(s, sol));
    const altP = build(state);
    const cand = ops(state, (owner, clue, note) => (note
      ? evaluateNote(note, alt, altP) === false
      : evaluateClue(clue, owner, alt, altP) === false));
    if (!cand.length) return null;
    let best = null, bestR = null;
    for (const op of sample(cand, SAMPLE)) {
      const st = apply(state, op);
      const r = solve(build(st), { limit: 4, nodeLimit: NODES });
      if (r.aborted) continue;
      if (!bestR || r.count < bestR.count) { bestR = r; best = st; }
      if (r.count === 1) break;
    }
    if (!best) return null;
    state = best; res = bestR;
  }
  if (!unique) return null;

  if (XL) {
    // Phase 2 (extreme): weaken clues one at a time (drop a second clue or swap in a weaker one),
    // keeping the solution unique, until the time budget is used.
    const tEnd = now() + Math.max(900, (budgetMs ?? 1400) * 0.9);
    // Clues of the new mechanics injected below are protected from later weakening.
    const protectedKeys = new Set();
    const free = (cl) => cl.map((x, i) => i).filter((i) => !protectedKeys.has(keyOf(cl[i])));
    const dropClue = (st, id, idxs) => {
      const next = { clues: { ...st.clues }, notes: st.notes };
      const l = st.clues[id].slice(); l.splice(rng.pick(idxs), 1); next.clues[id] = l;
      return next;
    };
    const weakenStep = (st, forceDrop) => {
      const id = rng.pick(suspectIds);
      const cl = st.clues[id];
      const idxs = free(cl);
      if (!idxs.length) return null;
      if (cl.length > 1 && (forceDrop || rng.chance(0.3))) return dropClue(st, id, idxs);
      if (forceDrop) return null;
      const have = new Set(cl.map(keyOf));
      const opts = pools[id].filter((x) => !have.has(keyOf(x.clue)));
      if (!opts.length) return null;
      const c = pickW(rng, opts, (x) => clueW(x) * (STRONG.has(wkey(x.clue)) ? 0.2 : 1));
      return apply(st, { kind: 'replace', owner: id, idx: rng.pick(idxs), clue: c.clue });
    };
    const tryStep = (forceDrop) => {
      const st = weakenStep(state, forceDrop);
      if (!st) return false;
      const r = solve(build(st), { limit: 2, nodeLimit: 8000 });
      if (r.aborted || r.count !== 1) return false;
      state = st; return true;
    };
    // Make sure the new mechanics show up: swap a few of them in (kept only while the solution stays unique).
    // Extreme mixes every note kind: true notes only add constraints, so uniqueness is kept.
    for (const type of ['wound', 'witness']) {
      if (state.notes.length >= B.maxNotes || state.notes.some((n) => n.type === type)) continue;
      const opts = notesAll.filter((n) => n.note.type === type);
      if (opts.length) state = { ...state, notes: [...state.notes, pickW(rng, opts, (n) => n.w).note] };
    }
    const FEATURES = [new Set(['besideCategory', 'notBesideCategory']), new Set(['sees'])];
    for (const kinds of FEATURES) {
      let have = 0;
      for (let tries = 0; tries < 30 && have < 2 && now() < tEnd - 300; tries++) {
        const id = rng.pick(suspectIds);
        const opts = pools[id].filter((x) => kinds.has(x.clue.type));
        const idxs = free(state.clues[id]);
        if (!opts.length || !idxs.length) continue;
        const c = pickW(rng, opts, (x) => x.w);
        const st = apply(state, { kind: 'replace', owner: id, idx: rng.pick(idxs), clue: c.clue });
        const r = solve(build(st), { limit: 2, nodeLimit: 8000 });
        if (r.aborted || r.count !== 1) continue;
        state = st; protectedKeys.add(keyOf(c.clue)); have++;
      }
    }
    for (let it = 0; it < 600 && now() < tEnd; it++) tryStep(false);
    const pzx = build(state);
    return { puzzle: { ...pzx, solution: sol, murderer: murdererOf(pzx, sol) }, prof: { ok: true, direct: 0, trial: 0, narrow: 0, stuck: [] }, scene: scene.key };
  }

  // Phase 2: difficulty repair — edits that keep uniqueness and lower the logic-profile badness.
  let pz = build(state);
  let prof = logicProfile(pz, sol);
  for (let rep = 0; rep < 6 && !acceptable(prof, difficulty); rep++) {
    if (!prof.ok) return null;
    const stuck = new Set(prof.stuck);
    const cand = ops(state, (owner, clue) => (owner ? stuck.has(owner) && STRONG.has(wkey(clue)) : true));
    let best = null, bestB = badness(prof, difficulty), bestProf = null;
    for (const op of sample(cand, SAMPLE)) {
      const st = apply(state, op);
      const p2 = build(st);
      const r = solve(p2, { limit: 2, nodeLimit: NODES });
      if (r.aborted || r.count !== 1) continue;
      const pr = logicProfile(p2, sol);
      const b = badness(pr, difficulty);
      if (b < bestB) { bestB = b; best = st; bestProf = pr; }
    }
    if (!best) break;
    state = best; prof = bestProf;
  }
  pz = build(state);
  const out = { ...pz, solution: sol, murderer: murdererOf(pz, sol) };
  return { puzzle: out, prof, scene: scene.key };
}

// ---------------------------------------------------------------- public API

export function generatePuzzle({ size, difficulty = 'easy', seed = Date.now(), scene = null, budgetMs = 1400 } = {}) {
  if (!DIFFICULTIES.includes(difficulty)) throw new Error(`Unknown difficulty: ${difficulty}`);
  let N = size ?? DEFAULT_SIZE[difficulty];
  N = difficulty === 'extreme' ? EXTREME_SIZE : Math.max(5, Math.min(EXTREME_SIZE, Math.round(N)));
  const t0 = now();
  let best = null, bestBad = Infinity;
  const MAX_ATTEMPTS = 80;
  for (let a = 0; a < MAX_ATTEMPTS; a++) {
    const rng = makeRng(`${seed}|${N}|${difficulty}|${scene ?? ''}|${a}`);
    const res = attempt(rng, N, difficulty, scene, seed, budgetMs);
    if (res) {
      if (acceptable(res.prof, difficulty)) {
        if (difficulty !== 'hard' || N >= 10 || res.prof.trial + res.prof.narrow > 0 || a >= 6) return res.puzzle;
      }
      const b = badness(res.prof, difficulty);
      if (b < bestBad) { bestBad = b; best = res.puzzle; }
    }
    if (now() - t0 > budgetMs && best) break;
  }
  if (best && bestBad < 1e6) return best;
  throw new Error(`generatePuzzle: could not build a ${N}x${N} ${difficulty} puzzle (seed ${seed})`);
}
