// Model tests. Run: node tests/model.test.mjs
import assert from 'node:assert/strict';
import * as grid from '../js/model/grid.js';
import { evaluateClue, clueText, isUnaryClue, evaluateNote, noteText } from '../js/model/clues.js';
import { solve, isUnique, checkSolution, murdererOf, withSolution } from '../js/model/solver.js';
import { getHint } from '../js/model/hints.js';
import { SAMPLE_PUZZLE } from '../js/puzzles/sample.js';
import { makeRng } from '../js/model/rng.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

const P = SAMPLE_PUZZLE;
const SOL = { A: { r: 0, c: 1 }, V: { r: 1, c: 3 }, C: { r: 2, c: 0 }, B: { r: 3, c: 4 }, D: { r: 4, c: 2 } };
const ch = (id) => P.characters.find((c) => c.id === id);
const sameCells = (a, b) => Object.keys(b).every((k) => a[k] && a[k].r === b[k].r && a[k].c === b[k].c) &&
  Object.keys(a).length === Object.keys(b).length;

console.log('grid');
test('roomAt / objectAt / isOccupiable', () => {
  assert.equal(grid.roomAt(P, 0, 0), 'K');
  assert.equal(grid.roomAt(P, 3, 0), 'F');
  assert.equal(grid.objectAt(P, 0, 0).type, 'oven');
  assert.equal(grid.objectAt(P, 0, 1), null);
  assert.equal(grid.isOccupiable(P, 0, 0), false); // oven blocks
  assert.equal(grid.isOccupiable(P, 3, 0), true);  // chair is occupiable
  assert.equal(grid.isOccupiable(P, 0, 1), true);
});
test('roomKeys / roomCells', () => {
  assert.deepEqual(grid.roomKeys(P), ['K', 'S', 'O', 'F']);
  assert.equal(grid.roomCells(P, 'F').length, 4);
  assert.equal(grid.roomCells(P, 'O').length, 8);
});
test('isBeside respects walls', () => {
  assert.equal(grid.isBeside(P, { r: 0, c: 1 }, { r: 0, c: 2 }), true);   // K-K
  assert.equal(grid.isBeside(P, { r: 0, c: 2 }, { r: 0, c: 3 }), false);  // K|S wall
  assert.equal(grid.isBeside(P, { r: 2, c: 0 }, { r: 3, c: 0 }), false);  // K|F wall
  assert.equal(grid.isBeside(P, { r: 0, c: 1 }, { r: 1, c: 2 }), false);  // diagonal
  assert.equal(grid.isBeside(P, { r: 0, c: 1 }, { r: 0, c: 1 }), false);  // same cell
});
test('isCorner', () => {
  assert.equal(grid.isCorner(P, 0, 0), true);   // grid corner
  assert.equal(grid.isCorner(P, 0, 2), true);   // N edge + E wall (S room)
  assert.equal(grid.isCorner(P, 0, 1), false);  // only N edge
  assert.equal(grid.isCorner(P, 1, 1), false);  // interior of K
  assert.equal(grid.isCorner(P, 2, 0), true);   // W edge + S wall (F)
  assert.equal(grid.isCorner(P, 3, 2), false);  // W wall only (F) — N is O(2,2), S is O(4,2)
  assert.equal(grid.isCorner(P, 4, 4), true);
});

console.log('clues');
const pos = SOL;
// [clue, owner, expected value in SOL, text]
const cases = [
  [{ type: 'victim' }, 'V', true, 'The **Victim**. He was alone with the murderer.'],
  [{ type: 'victim' }, 'A', true, 'The **Victim**. She was alone with the murderer.'],
  [{ type: 'inRoom', room: 'K' }, 'A', true, 'She was in the **Kitchen**.'],
  [{ type: 'inRoom', room: 'S' }, 'A', false, 'She was in the **Cold Storage**.'],
  [{ type: 'notInRoom', room: 'K' }, 'B', true, 'He was **not** in the **Kitchen**.'],
  [{ type: 'onObject', object: 'rug' }, 'B', false, 'He was **on a rug**.'],
  [{ type: 'onObject', object: 'chair' }, 'C', false, 'She was **sitting in a chair**.'],
  [{ type: 'notOnObject', object: 'rug' }, 'B', true, 'He was **not on a rug**.'],
  [{ type: 'notOnObject', object: 'chair' }, 'C', true, 'She was **not sitting in a chair**.'],
  [{ type: 'onObjectInRoom', object: 'chair', room: 'F' }, 'C', false, 'She was **sitting in a chair** in the **Office**.'],
  [{ type: 'besideObject', object: 'oven' }, 'A', true, 'She was **beside** an **oven**.'],
  [{ type: 'besideObject', object: 'counter' }, 'C', false, 'She was **beside** a **counter**.'], // counter in other room
  [{ type: 'notBesideObject', object: 'plant' }, 'B', true, 'He was **not beside** a **potted plant**.'],
  [{ type: 'besidePerson', who: 'A' }, 'C', false, 'She was **beside** **Ada**.'],
  [{ type: 'sameRoom', who: 'C' }, 'A', true, 'She was in the **same room as** **Clara**.'],
  [{ type: 'row', index: 0 }, 'A', true, 'She was in the **top row**.'],
  [{ type: 'row', index: 4 }, 'D', true, 'He was in the **bottom row**.'],
  [{ type: 'row', index: 2 }, 'C', true, 'She was in the **third row**.'],
  [{ type: 'column', index: 4 }, 'B', true, 'He was in the **last column**.'],
  [{ type: 'column', index: 2 }, 'D', true, 'He was in the **third column**.'],
  [{ type: 'column', index: 0 }, 'C', true, 'She was in the **first column**.'],
  [{ type: 'rowOneOf', indices: [0, 1] }, 'A', true, 'She was in the **top two rows**.'],
  [{ type: 'rowOneOf', indices: [3, 4] }, 'A', false, 'She was in the **bottom two rows**.'],
  [{ type: 'rowOneOf', indices: [1, 2] }, 'C', true, 'She was in the **second or third row**.'],
  [{ type: 'columnOneOf', indices: [0, 1] }, 'C', true, 'She was in the **first two columns**.'],
  [{ type: 'columnOneOf', indices: [1, 2] }, 'C', false, 'She was in the **second or third column**.'],
  [{ type: 'columnOneOf', indices: [3, 4] }, 'D', false, 'He was in the **last two columns**.'],
  [{ type: 'dir', dir: 'south', of: 'C' }, 'B', true, 'He was **south of** **Clara**.'],
  [{ type: 'dir', dir: 'north', of: 'C' }, 'B', false, 'He was **north of** **Clara**.'],
  [{ type: 'dir', dir: 'east', of: 'D' }, 'B', true, 'He was **east of** **Dimitri**.'],
  [{ type: 'dir', dir: 'west', of: 'A' }, 'C', true, 'She was **west of** **Ada**.'],
  [{ type: 'dir', dir: 'south', of: 'A', dist: 3 }, 'B', true, 'He was **exactly three rows south of** **Ada**.'],
  [{ type: 'dir', dir: 'north', of: 'C', dist: 1 }, 'A', false, 'She was **exactly one row north of** **Clara**.'],
  [{ type: 'dir', dir: 'east', of: 'C', dist: 2 }, 'D', true, 'He was **exactly two columns east of** **Clara**.'],
  [{ type: 'dir', dir: 'southeast', of: 'A' }, 'B', true, 'He was **southeast of** **Ada**.'],
  [{ type: 'dir', dir: 'southwest', of: 'B' }, 'D', true, 'He was **southwest of** **Bruno**.'],
  [{ type: 'dir', dir: 'northeast', of: 'C' }, 'D', false, 'He was **northeast of** **Clara**.'],
  [{ type: 'dir', dir: 'northwest', of: 'D' }, 'C', true, 'She was **northwest of** **Dimitri**.'],
  [{ type: 'dir', dir: 'south', of: 'C', otherRoom: true }, 'B', true, 'He was **south of** **Clara**, in a different room.'],
  [{ type: 'dir', dir: 'north', of: 'C', otherRoom: true }, 'A', false, 'She was **north of** **Clara**, in a different room.'],
  [{ type: 'diagonal', with: 'D' }, 'C', true, 'She was on a **diagonal with** **Dimitri**.'],
  [{ type: 'diagonal', with: 'B' }, 'V', false, 'He was on a **diagonal with** **Bruno**.'],
  [{ type: 'alone' }, 'D', true, 'He was **alone**.'],
  [{ type: 'alone' }, 'B', false, 'He was **alone**.'],
  [{ type: 'aloneInRoom', room: 'O' }, 'D', true, 'He was **alone in the** **Shop Floor**.'],
  [{ type: 'aloneInRoom', room: 'K' }, 'D', false, 'He was **alone in the** **Kitchen**.'],
  [{ type: 'aloneWith', who: 'C' }, 'A', true, 'She was **alone with** **Clara**.'],
  [{ type: 'aloneWith', who: 'B' }, 'A', false, 'She was **alone with** **Bruno**.'],
  [{ type: 'aloneWithGender', gender: 'f' }, 'A', true, 'She was **alone with a woman**.'],
  [{ type: 'aloneWithGender', gender: 'm' }, 'B', true, 'He was **alone with a man**.'],
  [{ type: 'aloneWithGender', gender: 'm' }, 'D', false, 'He was **alone with a man**.'],
  [{ type: 'withSomeoneBeside', object: 'oven' }, 'C', true, 'She was **with someone who was beside an oven**.'],
  [{ type: 'withSomeoneBeside', object: 'oven' }, 'A', false, 'She was **with someone who was beside an oven**.'],
  [{ type: 'corner' }, 'C', true, 'She was in a **corner** of her room.'],
  [{ type: 'corner' }, 'A', false, 'She was in a **corner** of her room.'],
];
for (const [clue, id, want, text] of cases) {
  test(`${clue.type} ${JSON.stringify(clue)} on ${id}`, () => {
    assert.equal(evaluateClue(clue, id, pos, P), want);
    assert.equal(clueText(clue, ch(id), P), text);
  });
}
test('outdoor scenes say "area"', () => {
  const O = { ...P, outdoor: true };
  assert.equal(clueText({ type: 'corner' }, ch('B'), O), 'He was in a **corner** of his area.');
  assert.equal(clueText({ type: 'dir', dir: 'south', of: 'C', otherRoom: true }, ch('B'), O), 'He was **south of** **Clara**, in a different area.');
  assert.equal(noteText({ type: 'noEmptyRoom' }, O), 'There was **no empty area**.');
});
test('partial positions: true / false / null', () => {
  assert.equal(evaluateClue({ type: 'onObject', object: 'chair' }, 'C', { C: { r: 3, c: 0 } }, P), true);
  assert.equal(evaluateClue({ type: 'onObjectInRoom', object: 'chair', room: 'F' }, 'C', { C: { r: 3, c: 0 } }, P), true);
  assert.equal(evaluateClue({ type: 'dir', dir: 'south', of: 'A' }, 'B', { B: { r: 3, c: 4 } }, P), null);
  assert.equal(evaluateClue({ type: 'row', index: 0 }, 'A', {}, P), null);
  assert.equal(evaluateClue({ type: 'alone' }, 'D', { D: { r: 4, c: 2 } }, P), null);
  assert.equal(evaluateClue({ type: 'alone' }, 'D', { D: { r: 4, c: 2 }, B: { r: 3, c: 3 } }, P), false);
  assert.equal(evaluateClue({ type: 'aloneInRoom', room: 'K' }, 'D', { D: { r: 4, c: 2 } }, P), false);
  assert.equal(evaluateClue({ type: 'aloneInRoom', room: 'O' }, 'D', { D: { r: 4, c: 2 } }, P), null);
  assert.equal(evaluateClue({ type: 'aloneWith', who: 'C' }, 'A', { A: SOL.A, C: { r: 3, c: 1 } }, P), false); // C in Office
  assert.equal(evaluateClue({ type: 'aloneWith', who: 'C' }, 'A', { A: SOL.A, C: SOL.C }, P), null);       // others unplaced
  assert.equal(evaluateClue({ type: 'aloneWithGender', gender: 'm' }, 'A', { A: SOL.A, C: SOL.C }, P), false);
  assert.equal(evaluateClue({ type: 'withSomeoneBeside', object: 'oven' }, 'C', { A: SOL.A, C: SOL.C }, P), true);
  assert.equal(evaluateClue({ type: 'withSomeoneBeside', object: 'oven' }, 'A', { A: SOL.A }, P), null);
});
test('isUnaryClue', () => {
  assert.equal(isUnaryClue({ type: 'corner' }), true);
  assert.equal(isUnaryClue({ type: 'row', index: 1 }), true);
  assert.equal(isUnaryClue({ type: 'rowOneOf', indices: [1, 2] }), true);
  assert.equal(isUnaryClue({ type: 'onObjectInRoom', object: 'rug', room: 'O' }), true);
  assert.equal(isUnaryClue({ type: 'alone' }), false);
  assert.equal(isUnaryClue({ type: 'aloneInRoom', room: 'O' }), false);
  assert.equal(isUnaryClue({ type: 'dir', dir: 'north', of: 'A' }), false);
});

console.log('case notes');
const notes = [
  [{ type: 'countOnObject', object: 'chair', count: 0 }, true, 'Nobody was **sitting in a chair**.'],
  [{ type: 'countOnObject', object: 'rug', count: 1 }, false, 'There was **exactly one** person **on a rug**.'],
  [{ type: 'countOnObject', object: 'bed', count: 2 }, false, 'There were **exactly two** people **on beds**.'],
  [{ type: 'countOnObject', object: 'towel', count: 1 }, false, 'There was **exactly one** person **on a beach towel**.'],
  [{ type: 'noEmptyRoom' }, false, 'There was **no empty room**.'],
  [{ type: 'emptyRooms', count: 1 }, true, 'There was **exactly one empty room**.'],
  [{ type: 'emptyRooms', count: 2 }, false, 'There were **exactly two empty rooms**.'],
  [{ type: 'roomGenders', room: 'K' }, false, 'There was **a man and a woman** in the **Kitchen**.'],
  [{ type: 'roomGenders', room: 'S' }, false, 'There was **a man and a woman** in the **Cold Storage**.'],
];
for (const [note, want, text] of notes) {
  test(`note ${JSON.stringify(note)}`, () => {
    assert.equal(evaluateNote(note, SOL, P), want);
    assert.equal(noteText(note, P), text);
  });
}
test('roomGenders true for a mixed pair', () => {
  const mixed = { ...SOL, C: { r: 3, c: 1 }, D: { r: 2, c: 0 } }; // A(f) + D(m) in Kitchen
  assert.equal(evaluateNote({ type: 'roomGenders', room: 'K' }, mixed, P), true);
});
test('notes on partial positions', () => {
  assert.equal(evaluateNote({ type: 'countOnObject', object: 'chair', count: 0 }, { C: { r: 3, c: 0 } }, P), false);
  assert.equal(evaluateNote({ type: 'countOnObject', object: 'chair', count: 0 }, { C: SOL.C }, P), null);
  assert.equal(evaluateNote({ type: 'emptyRooms', count: 1 }, { A: SOL.A, B: SOL.B, D: SOL.D, C: { r: 3, c: 1 } }, P), false);
  assert.equal(evaluateNote({ type: 'roomGenders', room: 'S' }, {}, P), null);
  assert.equal(evaluateNote({ type: 'roomGenders', room: 'S' }, { B: SOL.B, V: SOL.V }, P), false); // two men
});

console.log('solver');
test('SAMPLE_PUZZLE has a unique solution = intended', () => {
  const r = solve(P, { limit: 5 });
  assert.equal(r.count, 1);
  assert.ok(sameCells(r.solutions[0], SOL));
  assert.equal(isUnique(P), true);
  assert.ok(sameCells(P.solution, SOL));
});
test('case notes are constraints (sample is not unique without its note)', () => {
  assert.ok(solve({ ...P, notes: [] }, { limit: 5 }).count > 1);
});
test('sample follows the conventions', () => {
  assert.deepEqual(P.characters.map((c) => c.id), ['A', 'B', 'C', 'D', 'V']);
  for (const c of P.characters) {
    assert.equal(c.name[0], c.id);
    if (c.victim) assert.deepEqual(c.clues, [{ type: 'victim' }]);
    else assert.equal(c.clues.length, 1);
  }
});
test('murderer is B; withSolution', () => {
  assert.equal(murdererOf(P, SOL), 'B');
  assert.equal(murdererOf(P), 'B');
  const w = withSolution({ ...P, solution: undefined, murderer: undefined });
  assert.ok(sameCells(w.solution, SOL));
  assert.equal(w.murderer, 'B');
});
test('solve with fixed', () => {
  assert.equal(solve(P, { fixed: { C: { r: 3, c: 0 } } }).count, 0);
  assert.equal(solve(P, { fixed: { D: { r: 4, c: 2 } } }).count, 1);
});
test('nodeLimit aborts', () => {
  const r = solve({ ...P, notes: [] }, { limit: 50, nodeLimit: 2 });
  assert.equal(r.aborted, true);
});
test('checkSolution', () => {
  assert.deepEqual(checkSolution(P, SOL), { complete: true, correct: true, wrongIds: [] });
  assert.deepEqual(checkSolution(P, { A: SOL.A }), { complete: false, correct: false, wrongIds: [] });
  const bad = { ...SOL, B: { r: 2, c: 4 }, C: { r: 3, c: 0 } };
  const r = checkSolution(P, bad);
  assert.equal(r.complete, true);
  assert.equal(r.correct, false);
  assert.deepEqual(r.wrongIds.sort(), ['B', 'C']);
});

console.log('hints');
test('wrong', () => {
  const h = getHint(P, { A: SOL.A, B: { r: 2, c: 4 } });
  assert.equal(h.kind, 'wrong');
  assert.equal(h.charId, 'B');
  assert.equal(h.message, "Something's off with **Bruno** (B) on e3. Re-read his clue.");
});
test('done names the murderer', () => {
  const h = getHint(P, SOL);
  assert.equal(h.kind, 'done');
  assert.equal(h.message, 'Case closed! (V) was alone with (B): **Bruno** is the murderer!');
});
test('deduce from empty board, and walking hints solves the sample', () => {
  const placed = {};
  let last = null;
  for (let step = 0; step < 10; step++) {
    const h = getHint(P, placed);
    if (h.kind === 'done') break;
    assert.equal(h.kind, 'deduce', h.message);
    assert.deepEqual(h.cell, SOL[h.charId]);
    assert.ok(h.message.includes('**'), h.message);
    assert.ok(h.message.includes(grid.cellName(h.cell.r, h.cell.c)), h.message);
    assert.ok(h.message.includes(`(${h.charId})`), h.message);
    console.log(`       ${h.message}`);
    placed[h.charId] = h.cell;
    last = h;
  }
  assert.equal(getHint(P, placed).kind, 'done');
  assert.ok(last.message.endsWith('(V) was alone with (B): **Bruno** is the murderer!'), last.message);
});
test('narrow', () => {
  // Weakly-clued variant: everyone except the victim loses their clues.
  const weak = {
    ...P,
    notes: [],
    characters: P.characters.map((c) => (c.victim ? c : { ...c, clues: [{ type: 'notInRoom', room: 'Z' }] })),
  };
  // Not unique any more, but hints still work against the first found solution.
  const h = getHint(weak, {});
  assert.equal(h.kind, 'narrow');
  assert.ok(h.cells.length > 1);
  console.log(`       narrow hint: ${h.message} (${h.cells.length} cells)`);
});
test('hints use case notes', () => {
  // Without the note the sample is ambiguous; with it every step is a deduction.
  const h = getHint({ ...P, characters: P.characters, notes: P.notes }, { A: SOL.A, B: SOL.B, D: SOL.D });
  assert.equal(h.kind, 'deduce');
});

console.log('performance');
// Synthetic 9x9: 3x3 block rooms, a random permutation solution, ~15 clues true in the solution.
function synthetic(seed) {
  const rng = makeRng(seed);
  const N = 9;
  const keys = 'ABCDEFGHI';
  const rooms = [];
  for (let r = 0; r < N; r++) {
    let s = '';
    for (let c = 0; c < N; c++) s += keys[Math.floor(r / 3) * 3 + Math.floor(c / 3)];
    rooms.push(s);
  }
  const roomInfo = {};
  for (const k of keys) roomInfo[k] = { name: `Room ${k}`, floor: 'wood' };
  let perm, victimIdx;
  for (;;) {
    perm = rng.shuffle([...Array(N).keys()]);
    const counts = {};
    perm.forEach((c, r) => { const k = rooms[r][c]; counts[k] = (counts[k] || 0) + 1; });
    victimIdx = perm.findIndex((c, r) => counts[rooms[r][c]] === 2);
    if (victimIdx >= 0) break;
  }
  const names = ['Ada', 'Bruno', 'Clara', 'Dimitri', 'Edgar', 'Fiona', 'Gus', 'Hana', 'Ivo'];
  const solPos = names.map((_, i) => ({ r: i, c: perm[i] }));
  const objects = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (perm[r] !== c && rng.chance(0.12)) objects.push({ type: 'tree', r, c });
  }
  const pz = { size: N, rooms, roomInfo, objects, characters: [] };
  const sol = {};
  names.forEach((n, i) => { sol[n[0]] = solPos[i]; });
  const makeClue = (i) => {
    const me = solPos[i];
    const o = rng.int(0, N - 1);
    const other = names[o === i ? (o + 1) % N : o][0];
    const op = sol[other];
    const opts = [
      { type: 'inRoom', room: rooms[me.r][me.c] },
      { type: 'row', index: me.r },
      { type: 'column', index: me.c },
      { type: 'dir', dir: me.r < op.r ? 'north' : 'south', of: other },
      { type: 'dir', dir: me.c < op.c ? 'west' : 'east', of: other },
    ];
    return rng.pick(opts);
  };
  names.forEach((n, i) => {
    pz.characters.push({ id: n[0], name: n, gender: 'f', victim: i === victimIdx, clues: i === victimIdx ? [{ type: 'victim' }] : [] });
  });
  let total = 0;
  while (total < 15) {
    const i = rng.int(0, N - 1);
    if (i === victimIdx) continue;
    pz.characters[i].clues.push(makeClue(i));
    total++;
  }
  return { pz, sol };
}
test('9x9 synthetic puzzles solve in < 200 ms each', () => {
  let worst = 0;
  for (let s = 1; s <= 20; s++) {
    const { pz, sol } = synthetic(s);
    const t0 = performance.now();
    const r = solve(pz, { limit: 2 });
    const dt = performance.now() - t0;
    worst = Math.max(worst, dt);
    assert.ok(r.count >= 1, `seed ${s} found no solution`);
    if (r.count === 1) assert.deepEqual(r.solutions[0], sol);
    assert.ok(dt < 200, `seed ${s} took ${dt.toFixed(1)} ms`);
  }
  console.log(`       worst solve: ${worst.toFixed(1)} ms`);
});
test('9x9 getHint is fast', () => {
  const { pz } = synthetic(7);
  const t0 = performance.now();
  getHint(pz, {});
  const dt = performance.now() - t0;
  assert.ok(dt < 400, `took ${dt.toFixed(1)} ms`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
