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
    if (!['countOnObject', 'noEmptyRoom', 'emptyRooms', 'roomGenders'].includes(n.type)) throw new Error(`Unknown note type: ${n.type}`);
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
  P = { N, cells, roomOf, ids, victim, domains, ownBinary, ownOther, reverse, roomClues, alone, notes,
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
    for (let k = 0; k < N; k++) {
      if ((!rowUsed[k] && !rowSeen[k]) || (!colUsed[k] && !colSeen[k])) return;
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
