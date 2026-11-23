// Backtracking solver. Pure ES module (Node + browser).
import { evaluateClue, isUnaryClue, isRoomClue, clueOther } from './clues.js';
import { isOccupiable, roomAt, objectAt } from './grid.js';

const prepCache = new WeakMap();

// Precomputed per-puzzle data (also used by hints.js).
export function prepare(puzzle) {
  let P = prepCache.get(puzzle);
  if (P) return P;
  const N = puzzle.size;
  const cells = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cells.push({ r, c });
  const roomOf = cells.map((p) => roomAt(puzzle, p.r, p.c));
  const chars = puzzle.characters;
  const ids = chars.map((ch) => ch.id);
  const victim = chars.find((ch) => ch.victim)?.id ?? null;
  const domains = {};
  const ownBinary = {};   // clues that reference one other character
  const ownOther = {};    // every non-unary clue of the character (binary + room clues)
  const reverse = {};
  const roomClues = [];   // {owner, clue}: depend on everyone in the owner's room
  const alone = [];
  for (const id of ids) reverse[id] = [];
  for (const ch of chars) {
    domains[ch.id] = [];
    for (let i = 0; i < cells.length; i++) {
      const p = cells[i];
      if (!isOccupiable(puzzle, p.r, p.c)) continue;
      const pos = { [ch.id]: p };
      // With only this character placed, unary clues are decided and others are null unless impossible.
      if (ch.clues.every((cl) => evaluateClue(cl, ch.id, pos, puzzle) !== false)) domains[ch.id].push(i);
    }
    ownOther[ch.id] = ch.clues.filter((cl) => !isUnaryClue(cl));
    ownBinary[ch.id] = ch.clues.filter((cl) => !isUnaryClue(cl) && clueOther(cl));
    for (const cl of ownBinary[ch.id]) {
      const o = clueOther(cl);
      if (reverse[o]) reverse[o].push({ owner: ch.id, clue: cl });
    }
    for (const cl of ch.clues) if (isRoomClue(cl)) roomClues.push({ owner: ch.id, clue: cl });
    if (ch.clues.some((cl) => cl.type === 'alone' || cl.type === 'aloneInRoom')) alone.push(ch.id);
  }
  const notes = Array.isArray(puzzle.notes) ? puzzle.notes : [];
  for (const n of notes) {
    if (!['countOnObject', 'noEmptyRoom', 'emptyRooms', 'roomGenders', 'roomParity'].includes(n.type)) throw new Error(`Unknown note type: ${n.type}`);
  }
  // Integer room index + object type per cell (hot-path global checks).
  const roomList = [...new Set(roomOf)];
  const roomInt = roomOf.map((k) => roomList.indexOf(k));
  const objType = cells.map((p) => objectAt(puzzle, p.r, p.c)?.type ?? null);
  const gender = {};
  for (const ch of chars) gender[ch.id] = ch.gender;
  // pair[a][b]: clues linking a and b (either direction), for incremental checks in solve().
  const pair = {};
  for (const id of ids) pair[id] = {};
  for (const ch of chars) for (const cl of ownBinary[ch.id]) {
    const o = clueOther(cl);
    if (!pair[o]) continue;
    (pair[ch.id][o] ||= []).push({ owner: ch.id, clue: cl });
    (pair[o][ch.id] ||= []).push({ owner: ch.id, clue: cl });
  }
  const noteRoomInt = notes.map((n) => (n.type === 'roomGenders' ? roomList.indexOf(n.room) : -1));
  // Numbered rooms for the parity note: [{ ri (room index), par (0 even / 1 odd) }].
  const parityRooms = [];
  roomList.forEach((k, ri) => { const num = puzzle.roomInfo?.[k]?.number; if (num != null) parityRooms.push({ ri, par: num & 1 }); });
  // Binary clues between two characters that support cheap bound / mask propagation (arc pruning).
  const ARC_TYPES = new Set(['dir', 'rowOffset', 'sameRoom', 'roomNumberCompare']);
  const arcs = [];
  for (const ch of chars) for (const cl of ownBinary[ch.id]) {
    if (!ARC_TYPES.has(cl.type) || roomList.length > 30) continue;
    // 'dir' + otherRoom: prune with the weaker plain direction (still sound).
    arcs.push({ a: ch.id, b: clueOther(cl), clue: cl.otherRoom ? { ...cl, otherRoom: false } : cl });
  }
  const roomNum = roomList.map((k) => puzzle.roomInfo?.[k]?.number ?? null);
  P = { N, parityRooms, arcs, roomNum, cells, roomOf, ids, victim, domains, ownBinary, ownOther, reverse, roomClues, alone, notes,
    roomList, roomInt, objType, gender, pair, noteRoomInt };
  prepCache.set(puzzle, P);
  return P;
}

function roomIdx(P, p) {
  return P.roomOf[p.r * P.N + p.c];
}

// Counts over the placed characters except `skip` (used by the global checks).
function makeCtx(P, pos, skip) {
  const R = P.roomList.length;
  const cnt = new Int8Array(R), male = new Int8Array(R);
  const on = {};
  let unplaced = 0, occN = 0;
  for (const id of P.ids) {
    const p = id === skip ? null : pos[id];
    if (!p) { unplaced++; continue; }
    const i = p.r * P.N + p.c, ri = P.roomInt[i];
    if (!cnt[ri]++) occN++;
    if (P.gender[id] === 'm') male[ri]++;
    const t = P.objType[i];
    if (t) on[t] = (on[t] || 0) + 1;
  }
  const vp = P.victim && P.victim !== skip ? pos[P.victim] : null;
  return { cnt, male, on, unplaced, occN, vRoom: vp ? P.roomInt[vp.r * P.N + vp.c] : -1 };
}

// Victim rule + case notes with `id` added at cell i on top of ctx (ctx excludes id).
// Returns false only when they can no longer hold.
function globalOk(P, ctx, id, i) {
  const ri = P.roomInt[i];
  const left = ctx.unplaced - 1; // unplaced after placing id
  if (P.victim) {
    let vr = ctx.vRoom;
    if (id === P.victim) vr = ri;
    if (vr >= 0) {
      const n = ctx.cnt[vr] + (vr === ri ? 1 : 0);
      if (n > 2 || n + left < 2) return false;
    }
  }
  const notes = P.notes;
  for (let k = 0; k < notes.length; k++) {
    const note = notes[k];
    switch (note.type) {
      case 'countOnObject': {
        const n = (ctx.on[note.object] || 0) + (P.objType[i] === note.object ? 1 : 0);
        if (n > note.count || n + left < note.count) return false;
        break;
      }
      case 'noEmptyRoom':
      case 'emptyRooms': {
        const R = P.roomList.length;
        const target = note.type === 'noEmptyRoom' ? R : R - note.count;
        const occ = ctx.occN + (ctx.cnt[ri] ? 0 : 1);
        if (occ > target || occ + left < target) return false;
        break;
      }
      case 'roomParity': {
        // Rooms whose count has the wrong parity each still need >= 1 more person.
        let need = 0;
        const pr = P.parityRooms;
        for (let q = 0; q < pr.length; q++) {
          const c = ctx.cnt[pr[q].ri] + (pr[q].ri === ri ? 1 : 0);
          if ((c & 1) !== pr[q].par) need++;
        }
        if (need > left) return false;
        break;
      }
      case 'roomGenders': {
        const nr = P.noteRoomInt[k];
        const add = nr === ri ? 1 : 0;
        const n = ctx.cnt[nr] + add;
        const m = ctx.male[nr] + (add && P.gender[id] === 'm' ? 1 : 0);
        if (n > 2 || m > 1 || n - m > 1 || n + left < 2) return false;
        break;
      }
    }
  }
  return true;
}

// Can `id` stand at pos[id] given the other entries of pos (partial)? Checks every non-unary
// constraint that a new placement can break (clues, room clues of others, case notes, victim room).
// Row/col and unary clues are the caller's job.
export function consistentWith(P, puzzle, id, pos) {
  for (const cl of P.ownOther[id]) if (evaluateClue(cl, id, pos, puzzle) === false) return false;
  for (const { owner, clue } of P.reverse[id]) {
    if (pos[owner] && evaluateClue(clue, owner, pos, puzzle) === false) return false;
  }
  // Room clues of others can only break when `id` joins their room (the rest is settled at the end).
  const myRoom = roomIdx(P, pos[id]);
  for (const { owner, clue } of P.roomClues) {
    if (owner !== id && pos[owner] && roomIdx(P, pos[owner]) === myRoom &&
        evaluateClue(clue, owner, pos, puzzle) === false) return false;
  }
  return globalOk(P, makeCtx(P, pos, id), id, pos[id].r * P.N + pos[id].c);
}

// Incremental version of consistentWith: `id` at pos[id] was consistent before `newId` was placed.
function deltaOk(P, puzzle, id, pos, newId, ctx) {
  const lst = P.pair[id][newId];
  if (lst) for (const { owner, clue } of lst) if (evaluateClue(clue, owner, pos, puzzle) === false) return false;
  const p = pos[id];
  const i = p.r * P.N + p.c;
  const myRoom = P.roomOf[i];
  if (roomIdx(P, pos[newId]) === myRoom) {
    for (const { owner, clue } of P.roomClues) {
      if (pos[owner] && roomIdx(P, pos[owner]) === myRoom && evaluateClue(clue, owner, pos, puzzle) === false) return false;
    }
  }
  return globalOk(P, ctx, id, i);
}

function fullyValid(P, puzzle, pos) {
  for (const ch of puzzle.characters)
    for (const cl of ch.clues) if (evaluateClue(cl, ch.id, pos, puzzle) !== true) return false;
  // Notes + victim room: with everyone placed, globalOk's bounds are exact.
  const last = P.ids[P.ids.length - 1];
  const p = pos[last];
  return globalOk(P, makeCtx(P, pos, last), last, p.r * P.N + p.c);
}

// nodeLimit (optional): give up after that many search nodes; the result then has aborted: true.
export function solve(puzzle, { limit = 2, fixed = {}, nodeLimit = Infinity } = {}) {
  const P = prepare(puzzle);
  const { N, cells, ids } = P;
  const rowUsed = new Array(N).fill(false);
  const colUsed = new Array(N).fill(false);
  const pos = {};
  const solutions = [];
  let count = 0, nodes = 0, aborted = false;

  // Apply fixed placements.
  for (const id of Object.keys(fixed)) {
    const f = fixed[id];
    if (!P.domains[id]) return { count: 0, solutions: [] };
    const i = f.r * N + f.c;
    if (rowUsed[f.r] || colUsed[f.c] || !P.domains[id].includes(i)) return { count: 0, solutions: [] };
    rowUsed[f.r] = colUsed[f.c] = true;
    pos[id] = cells[i];
  }
  for (const id of Object.keys(fixed)) {
    if (!consistentWith(P, puzzle, id, pos)) return { count: 0, solutions: [] };
  }
  let placed = Object.keys(pos).length;

  // Candidate lists shrink monotonically (every check only fails once it can no longer succeed),
  // so each node filters its parent's lists instead of the full domains.
  function filtered(id, list, newId, ctx) {
    const out = [];
    for (const i of list) {
      const p = cells[i];
      if (rowUsed[p.r] || colUsed[p.c]) continue;
      pos[id] = p;
      if (newId ? deltaOk(P, puzzle, id, pos, newId, ctx) : consistentWith(P, puzzle, id, pos)) out.push(i);
    }
    delete pos[id];
    return out;
  }

  // Parity of numbered rooms: a room with the wrong head-count parity needs one more person, so some
  // unplaced character must still reach it (a single such character is forced into it).
  const PR = P.parityRooms;
  const parityTarget = new Int8Array(P.roomList.length).fill(-1);
  for (const { ri, par } of PR) parityTarget[ri] = par;
  function parityPrune(cur) {
    const R = P.roomList.length;
    const cnt = new Int8Array(R);
    for (const id of ids) if (pos[id]) cnt[roomIdxInt(pos[id])]++;
    const idList = Object.keys(cur);
    const may = new Int8Array(R), lastBy = new Int16Array(R).fill(-1);
    const reach = new Array(R).fill(0); // bitmask of idList indices that can reach each room
    let freeReach = false;              // someone can still reach a room with no parity rule
    for (let a = 0; a < idList.length; a++) {
      let seen = 0;
      for (const i of cur[idList[a]]) {
        const rj = P.roomInt[i];
        if (!((seen >> rj) & 1)) {
          seen |= 1 << rj; may[rj]++; lastBy[rj] = a; reach[rj] |= 1 << a;
          if (parityTarget[rj] < 0) freeReach = true;
        }
      }
    }
    // Rooms with the wrong parity each need their own extra person (bipartite matching).
    const need = [];
    for (const { ri, par } of PR) if ((cnt[ri] & 1) !== par) need.push(ri);
    if (need.length > idList.length) return false;
    const owner = new Int16Array(idList.length).fill(-1);
    const tryRoom = (k, seenMask) => {
      const m = reach[need[k]];
      for (let a = 0; a < idList.length; a++) {
        if (!((m >> a) & 1) || ((seenMask.v >> a) & 1)) continue;
        seenMask.v |= 1 << a;
        if (owner[a] < 0 || tryRoom(owner[a], seenMask)) { owner[a] = k; return true; }
      }
      return false;
    };
    for (let k = 0; k < need.length; k++) if (!tryRoom(k, { v: 0 })) return false;
    // Everyone else joins rooms in pairs unless an unruled room can still absorb them.
    if (!freeReach && ((idList.length - need.length) & 1)) return false;
    for (const ri of need) {
      if (may[ri] === 1) {
        const id = idList[lastBy[ri]];
        cur[id] = cur[id].filter((i) => P.roomInt[i] === ri);
      }
    }
    return true;
  }
  // Arc pruning for relative clues between two still-unplaced characters: drop candidates that no
  // candidate of the other character can support (row/column bounds and masks, room masks).
  function stats(list) {
    let rmin = 99, rmax = -1, cmin = 99, cmax = -1, rowMask = 0, colMask = 0, roomMask = 0, nmin = 1e9, nmax = -1e9;
    for (const i of list) {
      const r = (i / N) | 0, c = i % N, rj = P.roomInt[i];
      if (r < rmin) rmin = r;
      if (r > rmax) rmax = r;
      if (c < cmin) cmin = c;
      if (c > cmax) cmax = c;
      rowMask |= 1 << r; colMask |= 1 << c; roomMask |= 1 << rj;
      const nm = P.roomNum[rj];
      if (nm != null) { if (nm < nmin) nmin = nm; if (nm > nmax) nmax = nm; }
    }
    return { rmin, rmax, cmin, cmax, rowMask, colMask, roomMask, nmin, nmax };
  }
  // Does cell i have support in S (the other character's candidate stats)? owner: i belongs to the clue's owner.
  function supported(cl, i, S, owner) {
    const r = (i / N) | 0, c = i % N, rj = P.roomInt[i];
    switch (cl.type) {
      case 'rowOffset': { const x = owner ? r - cl.delta : r + cl.delta; return x >= 0 && x < N && ((S.rowMask >> x) & 1) === 1; }
      case 'sameRoom': return ((S.roomMask >> rj) & 1) === 1;
      case 'roomNumberCompare': {
        const n = P.roomNum[rj];
        if (n == null) return false;
        return owner === (cl.cmp === 'higher') ? n > S.nmin : n < S.nmax;
      }
      case 'dir': {
        const d = cl.dist;
        if (d != null && (cl.dir === 'north' || cl.dir === 'south')) {
          const sg = cl.dir === 'north' ? 1 : -1;
          const rr = owner ? r + sg * d : r - sg * d;
          return rr >= 0 && rr < N && ((S.rowMask >> rr) & 1) === 1;
        }
        if (d != null && (cl.dir === 'west' || cl.dir === 'east')) {
          const sg = cl.dir === 'west' ? 1 : -1;
          const cc = owner ? c + sg * d : c - sg * d;
          return cc >= 0 && cc < N && ((S.colMask >> cc) & 1) === 1;
        }
        const vert = cl.dir.startsWith('north') ? -1 : cl.dir.startsWith('south') ? 1 : 0; // owner's row vs other's
        const horz = cl.dir.endsWith('west') ? -1 : cl.dir.endsWith('east') ? 1 : 0;
        if (vert) {
          const ok = (owner ? vert < 0 : vert > 0) ? r < S.rmax : r > S.rmin;
          if (!ok) return false;
        }
        if (horz) {
          const ok = (owner ? horz < 0 : horz > 0) ? c < S.cmax : c > S.cmin;
          if (!ok) return false;
        }
        return true;
      }
    }
    return true;
  }
  function arcPrune(cur) {
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (const { a, b, clue } of P.arcs) {
        const la = cur[a], lb = cur[b];
        if (!la || !lb) continue;
        const sb = stats(lb);
        const na = la.filter((i) => supported(clue, i, sb, true));
        if (na.length !== la.length) { if (!na.length) return false; cur[a] = na; changed = true; }
        const sa = stats(cur[a]);
        const nb = lb.filter((i) => supported(clue, i, sa, false));
        if (nb.length !== lb.length) { if (!nb.length) return false; cur[b] = nb; changed = true; }
      }
      if (!changed) break;
    }
    return true;
  }
  const roomIdxInt = (p) => P.roomInt[p.r * N + p.c];

  function search(prev, newId) {
    if (++nodes > nodeLimit) { aborted = true; return; }
    if (placed === ids.length) {
      if (fullyValid(P, puzzle, pos)) {
        count++;
        const sol = {};
        for (const id of ids) sol[id] = { r: pos[id].r, c: pos[id].c };
        solutions.push(sol);
      }
      return;
    }
    // MRV with forward checking.
    let best = null, bestC = null;
    const cur = {};
    const ctx = prev ? makeCtx(P, pos, null) : null; // unplaced ids are absent from pos anyway
    const rowSeen = new Array(N).fill(false), colSeen = new Array(N).fill(false);
    let victimRoomReachable = true;
    let vRoom = null, vNeed = false;
    if (P.victim && pos[P.victim]) {
      vRoom = roomIdx(P, pos[P.victim]);
      let n = 0;
      for (const id of ids) if (pos[id] && roomIdx(P, pos[id]) === vRoom) n++;
      vNeed = n < 2;
      victimRoomReachable = !vNeed;
    }
    for (const id of ids) {
      if (pos[id]) continue;
      const cand = filtered(id, prev ? prev[id] : P.domains[id], prev ? newId : null, ctx);
      if (cand.length === 0) return;
      cur[id] = cand;
      for (const i of cand) {
        rowSeen[cells[i].r] = colSeen[cells[i].c] = true;
        if (vNeed && P.roomOf[i] === vRoom) victimRoomReachable = true;
      }
      if (!bestC || cand.length < bestC.length) { best = id; bestC = cand; }
    }
    if (!victimRoomReachable) return;
    if (P.arcs.length && !arcPrune(cur)) return;
    if (PR.length && !parityPrune(cur)) return;
    // Exact-cover style branching: pick the most constrained of {character, free row, free column}.
    const rowCnt = new Int16Array(N), colCnt = new Int16Array(N);
    best = null; bestC = null;
    for (const id of ids) {
      if (pos[id]) continue;
      const l = cur[id];
      if (!bestC || l.length < bestC.length) { best = id; bestC = l; }
      for (const i of l) { rowCnt[cells[i].r]++; colCnt[cells[i].c]++; }
    }
    let axis = null, axisIdx = -1, axisN = bestC ? bestC.length : 0;
    for (let k = 0; k < N; k++) {
      if (!rowUsed[k]) { if (rowCnt[k] === 0) return; if (rowCnt[k] < axisN) { axisN = rowCnt[k]; axis = 'r'; axisIdx = k; } }
      if (!colUsed[k]) { if (colCnt[k] === 0) return; if (colCnt[k] < axisN) { axisN = colCnt[k]; axis = 'c'; axisIdx = k; } }
    }
    if (axis) {
      for (const id of ids) {
        if (pos[id]) continue;
        for (const i of cur[id]) {
          const p = cells[i];
          if ((axis === 'r' ? p.r : p.c) !== axisIdx) continue;
          pos[id] = p; rowUsed[p.r] = colUsed[p.c] = true; placed++;
          search(cur, id);
          delete pos[id]; rowUsed[p.r] = colUsed[p.c] = false; placed--;
          if (count >= limit || aborted) return;
        }
      }
      return;
    }
    for (const i of bestC) {
      const p = cells[i];
      pos[best] = p; rowUsed[p.r] = colUsed[p.c] = true; placed++;
      search(cur, best);
      delete pos[best]; rowUsed[p.r] = colUsed[p.c] = false; placed--;
      if (count >= limit || aborted) return;
    }
  }

  search(null);
  return aborted ? { count, solutions, aborted } : { count, solutions };
}

export function isUnique(puzzle) {
  return solve(puzzle, { limit: 2 }).count === 1;
}

const solutionCache = new WeakMap();

// The puzzle's unique solution (computed once per puzzle object). Falls back to puzzle.solution.
export function getSolution(puzzle) {
  if (solutionCache.has(puzzle)) return solutionCache.get(puzzle);
  const res = solve(puzzle, { limit: 2 });
  const sol = res.count >= 1 ? res.solutions[0] : (puzzle.solution ?? null);
  solutionCache.set(puzzle, sol);
  return sol;
}

export function checkSolution(puzzle, positions) {
  const sol = getSolution(puzzle);
  const wrongIds = [];
  let complete = true;
  for (const ch of puzzle.characters) {
    const p = positions?.[ch.id];
    if (!p) { complete = false; continue; }
    const s = sol?.[ch.id];
    if (!s || s.r !== p.r || s.c !== p.c) wrongIds.push(ch.id);
  }
  return { complete, correct: complete && wrongIds.length === 0, wrongIds };
}

// The non-victim sharing the victim's room. Uses the puzzle's solution if positions omitted.
export function murdererOf(puzzle, positions) {
  const pos = positions ?? getSolution(puzzle);
  const victim = puzzle.characters.find((ch) => ch.victim);
  if (!pos || !victim || !pos[victim.id]) return null;
  const vp = pos[victim.id];
  const vr = roomAt(puzzle, vp.r, vp.c);
  for (const ch of puzzle.characters) {
    if (ch.victim) continue;
    const p = pos[ch.id];
    if (p && roomAt(puzzle, p.r, p.c) === vr) return ch.id;
  }
  return null;
}

export function withSolution(puzzle) {
  const sol = getSolution(puzzle);
  const copy = { ...puzzle };
  if (sol) {
    copy.solution = {};
    for (const id of Object.keys(sol)) copy.solution[id] = { r: sol[id].r, c: sol[id].c };
    copy.murderer = murdererOf(puzzle, sol);
  }
  return copy;
}
