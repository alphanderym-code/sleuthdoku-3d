// Object orientation. Pure module (Node + browser). Sets `facing` ('n'|'e'|'s'|'w') on objects that have a front.
// n = toward row r-1, s = r+1, w = c-1, e = c+1. Deterministic (no RNG), idempotent (keeps an existing `facing`).

export const FRONTED_TYPES = new Set([
  'fireplace', 'oven', 'tv', 'piano', 'desk', 'shelf', 'wardrobe', 'arcade', 'register', 'counter', 'heater',
  'chair', 'sofa', 'bed', 'bench', 'tractor', 'car',
]);

export const FACING_DIRS = { n: [-1, 0], e: [0, 1], s: [1, 0], w: [0, -1] };
const ORDER = ['n', 'e', 's', 'w'];
const OPPOSITE = { n: 's', s: 'n', e: 'w', w: 'e' };
const SEAT_TARGETS = ['table', 'desk', 'counter'];
const SOFA_TARGETS = ['tv', 'fireplace'];
const BENCH_FEATURES = ['water', 'flowers', 'tree', 'table', 'fireplace', 'campfire', 'statue', 'plant', 'bush'];
const BLOCKING_FRONT = new Set(['tree', 'bush', 'boulder', 'table', 'counter', 'oven', 'shelf', 'desk', 'plant', 'crate', 'statue',
  'fireplace', 'piano', 'campfire', 'tent', 'tv', 'wardrobe', 'register', 'barrel', 'flowers', 'arcade', 'heater', 'water', 'haybale', 'tractor']);

// Score every direction for one object; returns the best direction.
export function chooseFacing(puzzle, o, at) {
  const N = puzzle.size ?? puzzle.rooms.length;
  const roomOf = (r, c) => (r >= 0 && c >= 0 && r < N && c < N ? puzzle.rooms[r][c] : null);
  const here = roomOf(o.r, o.c);
  const typeAt = (r, c) => at.get(r * N + c)?.type ?? null;
  const sameRoom = (r, c) => roomOf(r, c) === here;
  const free = (r, c) => sameRoom(r, c) && !typeAt(r, c);

  // Room members (for targets / centre).
  const members = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (puzzle.rooms[r][c] === here) members.push([r, c]);
  const cr = members.reduce((s, m) => s + m[0], 0) / members.length;
  const cc = members.reduce((s, m) => s + m[1], 0) / members.length;
  const dominant = (dr, dc) => (Math.abs(dr) >= Math.abs(dc) ? (dr < 0 ? 'n' : 's') : (dc < 0 ? 'w' : 'e'));
  const towardDirs = (tr, tc) => {
    const dr = tr - o.r, dc = tc - o.c, out = [];
    if (dr) out.push(dr < 0 ? 'n' : 's');
    if (dc) out.push(dc < 0 ? 'w' : 'e');
    return out;
  };

  const bonus = { n: 0, e: 0, s: 0, w: 0 };
  const hard = new Set(); // directions forced by a strong rule
  if (o.type === 'chair') {
    for (const d of ORDER) {
      const [dr, dc] = FACING_DIRS[d], r = o.r + dr, c = o.c + dc;
      if (sameRoom(r, c) && SEAT_TARGETS.includes(typeAt(r, c))) bonus[d] += 100;
    }
  } else if (o.type === 'sofa') {
    const tvs = members.filter(([r, c]) => SOFA_TARGETS.includes(typeAt(r, c)));
    if (tvs.length) {
      tvs.sort((a, b) => (Math.abs(a[0] - o.r) + Math.abs(a[1] - o.c)) - (Math.abs(b[0] - o.r) + Math.abs(b[1] - o.c)));
      const [tr, tc] = tvs[0];
      if (tr === o.r) bonus[tc < o.c ? 'w' : 'e'] += 60;
      else if (tc === o.c) bonus[tr < o.r ? 'n' : 's'] += 60;
      else for (const d of towardDirs(tr, tc)) bonus[d] += 25;
    } else {
      const other = members.filter(([r, c]) => (r !== o.r || c !== o.c) && typeAt(r, c) === 'sofa');
      let done = false;
      for (const [r, c] of other) {
        if (r === o.r) { bonus[c < o.c ? 'w' : 'e'] += 30; done = true; }
        else if (c === o.c) { bonus[r < o.r ? 'n' : 's'] += 30; done = true; }
      }
      if (!done) bonus[dominant(cr - o.r, cc - o.c)] += 12;
    }
  } else if (o.type === 'bench') {
    const feats = members.filter(([r, c]) => BENCH_FEATURES.includes(typeAt(r, c)));
    if (feats.length) {
      feats.sort((a, b) => (Math.abs(a[0] - o.r) + Math.abs(a[1] - o.c)) - (Math.abs(b[0] - o.r) + Math.abs(b[1] - o.c)));
      const [tr, tc] = feats[0];
      for (const d of towardDirs(tr, tc)) bonus[d] += 15;
    }
    bonus[dominant(cr - o.r, cc - o.c)] += 10;
  } else {
    bonus[dominant(cr - o.r, cc - o.c)] += 4; // face the room's middle by default
  }

  let best = null, bestScore = -Infinity;
  for (const d of ORDER) {
    const [dr, dc] = FACING_DIRS[d];
    const fr = o.r + dr, fc = o.c + dc, br = o.r - dr, bc = o.c - dc;
    let s = bonus[d];
    if (roomOf(fr, fc) === null) s -= 1000;            // board edge in front
    else if (!sameRoom(fr, fc)) s -= 800;              // room wall in front
    else if (BLOCKING_FRONT.has(typeAt(fr, fc)) && !(o.type === 'chair' && SEAT_TARGETS.includes(typeAt(fr, fc)))) s -= 60;
    else if (typeAt(fr, fc)) s -= 5;
    else s += 3;
    if (!sameRoom(br, bc)) s += 8;                     // back against a wall / edge
    else if (BLOCKING_FRONT.has(typeAt(br, bc))) s += 3;
    // open room ahead
    for (let k = 2; k <= 3; k++) if (free(o.r + dr * k, o.c + dc * k)) s += 1;
    // deterministic tie-break
    s += (((o.r * 7 + o.c * 13 + ORDER.indexOf(d) * 5) % 11) / 100);
    if (s > bestScore) { bestScore = s; best = d; }
  }
  return best;
}

// Mutates puzzle.objects (adds `facing` where missing). Returns the puzzle.
export function assignFacing(puzzle) {
  if (!puzzle || !Array.isArray(puzzle.objects) || !puzzle.rooms) return puzzle;
  const N = puzzle.size ?? puzzle.rooms.length;
  const at = new Map();
  for (const o of puzzle.objects) at.set(o.r * N + o.c, o);
  for (const o of puzzle.objects) {
    if (!FRONTED_TYPES.has(o.type) || o.facing) continue;
    o.facing = chooseFacing(puzzle, o, at);
  }
  return puzzle;
}

export { OPPOSITE };
