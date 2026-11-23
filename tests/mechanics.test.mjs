// Tests for the clue mechanics: wound / witness notes, personality (category) clues, line of sight.
// Run: node tests/mechanics.test.mjs
import assert from 'node:assert/strict';
import { evaluateClue, evaluateNote, clueText, noteText, lineOfSight, inWitnessZone } from '../js/model/clues.js';
import { solve } from '../js/model/solver.js';
import { getHint } from '../js/model/hints.js';
import { generatePuzzle } from '../js/model/generator.js';
import { SAMPLE_PUZZLE } from '../js/puzzles/sample.js';
import { weaponInfo, woundOf, WEAPONS } from '../js/model/weapons.js';
import { CATEGORIES } from '../js/model/categories.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.stack.split('\n').slice(0, 3).join('\n       ')}`); }
}

const SOL = { A: { r: 0, c: 1 }, V: { r: 1, c: 3 }, C: { r: 2, c: 0 }, B: { r: 3, c: 4 }, D: { r: 4, c: 2 } };
const WEAPON = { A: 'pistol', B: 'knife', C: 'pistol', D: 'rope' };
// Sample + weapons + extra notes (a fresh object each time: the solver caches per puzzle object).
function variant({ notes = [], objects = [], clues = {} } = {}) {
  const p = structuredClone(SAMPLE_PUZZLE);
  p.notes = [...p.notes, ...notes];
  p.objects = [...p.objects, ...objects];
  for (const c of p.characters) {
    if (WEAPON[c.id]) c.weapon = WEAPON[c.id];
    if (clues[c.id]) c.clues = clues[c.id];
  }
  return p;
}

console.log('weapons / wound note');
test('weapons registry is coherent', () => {
  for (const [k, w] of Object.entries(WEAPONS)) { assert.ok(w.label && w.emoji && w.wound, k); assert.equal(woundOf(k), w.wound); }
  assert.equal(weaponInfo('knife').wound, 'stabbed');
});
test('wound note: murderer (B, knife) matches "stabbed" only', () => {
  const p = variant();
  assert.equal(evaluateNote({ type: 'wound', wound: 'stabbed' }, SOL, p), true);
  assert.equal(evaluateNote({ type: 'wound', wound: 'shot' }, SOL, p), false);
  assert.equal(evaluateNote({ type: 'wound', wound: 'shot' }, { V: SOL.V }, p), null); // nobody else placed yet
  assert.equal(noteText({ type: 'wound', wound: 'stabbed' }, p), 'Cause of death: **stabbing**.');
});
test('wound note prunes the solver (wrong wound -> no solution; right -> unchanged)', () => {
  assert.equal(solve(variant({ notes: [{ type: 'wound', wound: 'stabbed' }] }), { limit: 2 }).count, 1);
  assert.equal(solve(variant({ notes: [{ type: 'wound', wound: 'shot' }] }), { limit: 2 }).count, 0);
});
test('wound note narrows who can share the victim room', () => {
  const clues = { B: [{ type: 'besideObject', object: 'plant' }] };
  const free = solve(variant({ clues }), { limit: 200 });
  const noted = solve(variant({ notes: [{ type: 'wound', wound: 'stabbed' }], clues }), { limit: 200 });
  assert.ok(noted.count <= free.count);
  for (const s of noted.solutions) {
    const room = SAMPLE_PUZZLE.rooms[s.V.r][s.V.c];
    const mates = Object.keys(s).filter((id) => id !== 'V' && SAMPLE_PUZZLE.rooms[s[id].r][s[id].c] === room);
    assert.deepEqual(mates, ['B']);
  }
});

console.log('witness zone note');
test('zone = the named room or any room sharing a border with the victim room', () => {
  const p = variant();
  // V is in Cold Storage (S); neighbours: Kitchen (K) and Shop Floor (O); Office (F) is not adjacent.
  for (const [room, ok] of [['S', true], ['K', true], ['O', true], ['F', false]]) {
    assert.equal(evaluateNote({ type: 'witness', room }, SOL, p), ok, room);
    assert.equal(inWitnessZone(p, 'S', room), ok);
  }
  assert.equal(noteText({ type: 'witness', room: 'K' }, p), 'A scream was heard from the **Kitchen**.');
  assert.equal(solve(variant({ notes: [{ type: 'witness', room: 'K' }] }), { limit: 2 }).count, 1);
  assert.equal(solve(variant({ notes: [{ type: 'witness', room: 'F' }] }), { limit: 2 }).count, 0);
});

console.log('personality (category) clues');
test('besideCategory / notBesideCategory semantics (same room, orthogonal)', () => {
  const p = variant();
  assert.equal(evaluateClue({ type: 'besideCategory', category: 'food' }, 'A', SOL, p), true);       // oven (0,0) beside (0,1)
  assert.equal(evaluateClue({ type: 'notBesideCategory', category: 'food' }, 'A', SOL, p), false);
  assert.equal(evaluateClue({ type: 'besideCategory', category: 'plants' }, 'A', SOL, p), false);
  assert.equal(evaluateClue({ type: 'notBesideCategory', category: 'plants' }, 'A', SOL, p), true);
  assert.equal(evaluateClue({ type: 'besideCategory', category: 'food' }, 'A', {}, p), null);
  // (2,1) is beside the counter (2,2): both in the Shop Floor.
  assert.equal(evaluateClue({ type: 'besideCategory', category: 'food' }, 'C', { C: { r: 2, c: 1 } }, p), true);
  assert.ok(CATEGORIES.screens.types.includes('tv'));
});
test('personality text varies and always names the suspect', () => {
  const p = variant();
  const A = p.characters.find((c) => c.id === 'A');
  const seen = new Set();
  for (let v = 0; v < 4; v++) for (const type of ['besideCategory', 'notBesideCategory']) {
    const t = clueText({ type, category: 'plants', v }, A, p);
    assert.match(t, /^\*\*Ada\*\* .*\*\*plants\*\*.*\.$/);
    assert.ok(!/victim|murder/i.test(t));
    seen.add(t);
  }
  assert.ok(seen.size >= 5);
  assert.equal(clueText({ type: 'notBesideCategory', category: 'food', v: 0 }, A, p), '**Ada** never stands beside **food**.');
  assert.equal(clueText({ type: 'besideCategory', category: 'food', v: 0 }, A, p), '**Ada** always stands beside **food**.');
});

console.log('line of sight');
test('lineOfSight: diagonal, same room, no blocking object between', () => {
  const p = variant();
  assert.equal(lineOfSight(p, { r: 2, c: 1 }, { r: 4, c: 3 }), true);    // Shop Floor cells; (3,2) is empty
  assert.equal(lineOfSight(p, { r: 4, c: 3 }, { r: 2, c: 1 }), true);    // symmetric
  assert.equal(lineOfSight(p, { r: 0, c: 1 }, { r: 3, c: 4 }), false);   // crosses room walls
  assert.equal(lineOfSight(p, { r: 2, c: 1 }, { r: 2, c: 3 }), false);   // same row: not a diagonal
  const blocked = variant({ objects: [{ type: 'crate', r: 3, c: 2 }] });
  assert.equal(lineOfSight(blocked, { r: 2, c: 1 }, { r: 4, c: 3 }), false);
  const open = variant({ objects: [{ type: 'bench', r: 3, c: 2 }] }); // occupiable objects do not block
  assert.equal(lineOfSight(open, { r: 2, c: 1 }, { r: 4, c: 3 }), true);
});
test('sees clue: evaluation, text, solver', () => {
  const p = variant();
  const cl = { type: 'sees', who: 'B' };
  assert.equal(evaluateClue(cl, 'A', { A: { r: 2, c: 1 }, B: { r: 4, c: 3 } }, p), true);
  assert.equal(evaluateClue(cl, 'A', { A: SOL.A, B: SOL.B }, p), false);
  assert.equal(evaluateClue(cl, 'A', { A: SOL.A }, p), null);
  assert.equal(clueText(cl, p.characters.find((c) => c.id === 'A'), p), 'She could **see** **Bruno**.');
  // C (2,0) and D (4,2) are on a diagonal but cross the Office / Shop Floor wall: no solution.
  assert.equal(solve(variant({ clues: { C: [{ type: 'sees', who: 'D' }] } }), { limit: 2 }).count, 0);
});

console.log('hints + consistency');
test('getHint works with every new note present', () => {
  const p = variant({ notes: [{ type: 'wound', wound: 'stabbed' }, { type: 'witness', room: 'K' }] });
  const h = getHint(p, {});
  assert.ok(h && h.kind);
});

console.log('generated puzzles');
const TALLY = { besideCategory: 0, notBesideCategory: 0, sees: 0, wound: 0, witness: 0 };
function generated(difficulty, size, seeds) {
  for (const seed of seeds) {
    const p = generatePuzzle({ difficulty, size, seed: `mech-${seed}` });
    const r = solve(p, { limit: 2 });
    assert.equal(r.count, 1, `${difficulty} ${seed}: exactly one solution`);
    assert.deepEqual(r.solutions[0], p.solution);
    for (const c of p.characters) {
      if (!c.victim) assert.ok(weaponInfo(c.weapon), `${c.name} carries a weapon`);
      for (const cl of c.clues) {
        if (TALLY[cl.type] !== undefined) TALLY[cl.type]++;
        assert.ok(cl.type === 'victim' || !/victim|murder/i.test(clueText(cl, c, p)));
        assert.equal(evaluateClue(cl, c.id, p.solution, p), true);
      }
    }
    for (const n of p.notes) {
      if (TALLY[n.type] !== undefined) TALLY[n.type]++;
      assert.ok(!/victim|murder/i.test(noteText(n, p)));
      assert.equal(evaluateNote(n, p.solution, p), true);
    }
  }
}
test('generated puzzles with the new mechanics stay unique (very-easy .. hard)', () => {
  generated('very-easy', 5, [1, 2, 3, 4, 5, 6]);
  generated('easy', 6, [1, 2, 3, 4, 5, 6]);
  generated('medium', 7, [1, 2, 3, 4, 5, 6, 7, 8]);
  generated('hard', 8, [1, 2, 3, 4, 5, 6]);
  generated('hard', 9, [1, 2, 3]);
  for (const k of Object.keys(TALLY)) assert.ok(TALLY[k] > 0, `${k} never generated: ${JSON.stringify(TALLY)}`);
  console.log(`       tally: ${JSON.stringify(TALLY)}`);
});
test('extreme 16x16 mixes every mechanic, unique, fast', () => {
  const before = { ...TALLY };
  const t0 = performance.now();
  generated('extreme', 16, [1, 2, 3]);
  const dt = (performance.now() - t0) / 3;
  const got = Object.keys(TALLY).filter((k) => TALLY[k] > before[k]);
  assert.ok(got.length >= 4, `extreme mix too thin: ${got}`);
  console.log(`       extreme avg gen+check: ${dt.toFixed(0)} ms`);
  assert.ok(dt < 2500);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
