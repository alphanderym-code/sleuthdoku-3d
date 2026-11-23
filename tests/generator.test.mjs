// Generator + curated cases tests. Run: node tests/generator.test.mjs
import assert from 'node:assert/strict';
import { generatePuzzle, logicProfile } from '../js/model/generator.js';
import { solve, murdererOf } from '../js/model/solver.js';
import { evaluateClue, evaluateNote, clueText, noteText, clueOther } from '../js/model/clues.js';
import { getHint } from '../js/model/hints.js';
import { isOccupiable, roomAt, roomKeys, roomCells } from '../js/model/grid.js';
import { OBJECT_TYPES, FLOOR_TYPES } from '../js/model/objects.js';
import { CASES } from '../js/puzzles/cases.js';
import { SAMPLE_PUZZLE } from '../js/puzzles/sample.js';
import { buildLayout, WALL_TYPES, SEAT_ANCHORS } from '../js/model/generator.js';
import { SCENES } from '../js/data/content.js';
import { makeRng } from '../js/model/rng.js';
import { assignFacing, FRONTED_TYPES, FACING_DIRS } from '../js/model/facing.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.stack.split('\n').slice(0, 3).join('\n       ')}`); }
}

const HAIR = ['short', 'long', 'bun', 'bald', 'curly', 'ponytail', 'spiky'];
const ACC = [null, 'hat', 'glasses', 'beard', 'mustache', 'bowtie', 'scarf'];

function validate(p, { requireLogic = true } = {}) {
  const N = p.size;
  assert.ok(N >= 5 && N <= 9, 'size');
  assert.equal(p.rooms.length, N);
  for (const row of p.rooms) assert.equal(row.length, N);
  // Rooms: contiguous, >= 2 cells, roomInfo complete.
  const keys = roomKeys(p);
  assert.ok(keys.length >= 3, 'at least 3 rooms');
  const names = new Set();
  for (const k of keys) {
    assert.equal(k.length, 1);
    assert.ok(p.roomInfo[k], `roomInfo for ${k}`);
    assert.ok(FLOOR_TYPES.includes(p.roomInfo[k].floor), 'floor type');
    names.add(p.roomInfo[k].name);
    const cells = roomCells(p, k);
    assert.ok(cells.length >= 2, `room ${k} has >= 2 cells`);
    const seen = new Set([`${cells[0].r},${cells[0].c}`]);
    const stack = [cells[0]];
    while (stack.length) {
      const q = stack.pop();
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const r = q.r + dr, c = q.c + dc, key = `${r},${c}`;
        if (roomAt(p, r, c) === k && !seen.has(key)) { seen.add(key); stack.push({ r, c }); }
      }
    }
    assert.equal(seen.size, cells.length, `room ${k} contiguous`);
  }
  assert.equal(names.size, keys.length, 'unique room names');
  assert.equal(Object.keys(p.roomInfo).length, keys.length);
  // Objects.
  const occ = new Set();
  for (const o of p.objects) {
    assert.ok(OBJECT_TYPES[o.type], `object type ${o.type}`);
    assert.ok(o.r >= 0 && o.r < N && o.c >= 0 && o.c < N);
    const key = `${o.r},${o.c}`;
    assert.ok(!occ.has(key), 'one object per cell');
    occ.add(key);
  }
  for (let r = 0; r < N; r++) {
    let free = 0;
    for (let c = 0; c < N; c++) if (isOccupiable(p, r, c)) free++;
    assert.ok(free > 0, `row ${r} not fully blocked`);
  }
  // Characters.
  assert.equal(p.characters.length, N);
  const ids = new Set();
  let victims = 0;
  for (const ch of p.characters) {
    assert.equal(ch.id, ch.name[0].toUpperCase());
    assert.ok(!ids.has(ch.id)); ids.add(ch.id);
    assert.ok(['m', 'f'].includes(ch.gender));
    assert.ok(HAIR.includes(ch.look.hairStyle) && ACC.includes(ch.look.accessory));
    if (ch.victim) victims++;
    assert.ok(ch.clues.length >= 1 && ch.clues.length <= 3, `${ch.id} has 1..3 clues`);
    if (ch.victim) assert.ok(ch.clues.some((cl) => cl.type === 'victim'));
  }
  assert.equal(victims, 1);
  conventions(p);
  // Solution rules.
  const sol = p.solution;
  assert.ok(sol, 'solution present');
  const rows = new Set(), cols = new Set();
  for (const ch of p.characters) {
    const s = sol[ch.id];
    assert.ok(isOccupiable(p, s.r, s.c), `${ch.id} on occupiable cell`);
    rows.add(s.r); cols.add(s.c);
  }
  assert.equal(rows.size, N, 'one per row');
  assert.equal(cols.size, N, 'one per column');
  const victim = p.characters.find((c) => c.victim);
  const vr = roomAt(p, sol[victim.id].r, sol[victim.id].c);
  const inV = p.characters.filter((c) => roomAt(p, sol[c.id].r, sol[c.id].c) === vr);
  assert.equal(inV.length, 2, 'victim room holds exactly 2');
  assert.equal(p.murderer, murdererOf(p, sol));
  assert.ok(p.murderer && p.murderer !== victim.id);
  for (const ch of p.characters)
    for (const cl of ch.clues) assert.equal(evaluateClue(cl, ch.id, sol, p), true, `${ch.id} clue ${JSON.stringify(cl)} true`);
  for (const n of p.notes || []) assert.equal(evaluateNote(n, sol, p), true, `note ${JSON.stringify(n)} true`);
  // Every clue and note has text.
  for (const ch of p.characters) for (const cl of ch.clues) assert.ok(clueText(cl, ch, p).length > 5);
  for (const n of p.notes || []) assert.ok(noteText(n, p).length > 5);
  // Unique.
  const res = solve(p, { limit: 2 });
  assert.equal(res.count, 1, 'unique solution');
  for (const id of Object.keys(sol)) assert.deepEqual(res.solutions[0][id], sol[id]);
  if (requireLogic) {
    const prof = logicProfile(p, sol);
    assert.ok(prof.ok, 'logic profile ok');
    return prof;
  }
  return null;
}

// Genre conventions (SPEC v2).
const CLUE_BUDGET = { 'very-easy': [1, 1], easy: [1, 1], medium: [1, 2], hard: [1, 2] };
function conventions(p) {
  const N = p.size;
  const want = [...'ABCDEFGHI'.slice(0, N - 1), 'V'];
  assert.deepEqual(p.characters.map((c) => c.id), want, 'ids A, B, C…, V in card order');
  const victim = p.characters[N - 1];
  assert.ok(victim.victim, 'victim is the last card');
  assert.deepEqual(victim.clues, [{ type: 'victim' }], 'victim has only the victim clue');
  const [lo, hi] = CLUE_BUDGET[p.difficulty];
  for (const ch of p.characters) {
    if (ch.victim) continue;
    assert.ok(ch.clues.length >= lo && ch.clues.length <= hi, `${ch.id} has ${ch.clues.length} clues (${p.difficulty})`);
    for (const cl of ch.clues) {
      assert.notEqual(cl.type, 'victim');
      assert.notEqual(clueOther(cl), victim.id, `${ch.id} clue ${JSON.stringify(cl)} references the victim`);
      const text = clueText(cl, ch, p);
      assert.ok(!/victim|murder/i.test(text), `clue text mentions the crime: ${text}`);
      assert.ok(!text.includes(victim.name), `clue text names the victim: ${text}`);
    }
  }
  const notes = p.notes || [];
  assert.ok(Array.isArray(notes) && notes.length <= 2, 'at most 2 case notes');
  for (const n of notes) assert.ok(!/victim|murder/i.test(noteText(n, p)));
}

// Repeatedly apply the real getHint: must reach 'done' using only 'deduce' hints.
function hintWalk(p) {
  const placements = {};
  for (let i = 0; i <= p.size + 1; i++) {
    const h = getHint(p, placements);
    if (h.kind === 'done') return true;
    assert.equal(h.kind, 'deduce', `hint step ${i} is ${h.kind}: ${h.message}`);
    placements[h.charId] = h.cell;
  }
  return false;
}

const DIFF = { 5: 'very-easy', 6: 'easy', 7: 'medium', 8: 'hard', 9: 'hard' };
const SEEDS = [1, 2, 3, 42, 777, 2024, 'alpha', 'zeta'];

console.log('generator');
for (const N of [5, 6, 7, 8, 9]) {
  const times = [];
  for (const seed of SEEDS) {
    test(`size ${N} ${DIFF[N]} seed ${seed}`, () => {
      const t = performance.now();
      const p = generatePuzzle({ size: N, difficulty: DIFF[N], seed });
      times.push(performance.now() - t);
      assert.equal(p.size, N);
      assert.equal(p.difficulty, DIFF[N]);
      assert.equal(p.id, `gen-${seed}-${N}`);
      const prof = validate(p);
      assert.equal(typeof p.outdoor, 'boolean');
      if (DIFF[N] !== 'hard') {
        assert.equal(prof.narrow, 0, 'no narrow steps for non-hard');
        hintWalk(p);
      } else {
        assert.ok(prof.narrow <= 1, 'at most one narrow step for hard');
      }
    });
  }
  test(`size ${N} deterministic per seed`, () => {
    const a = generatePuzzle({ size: N, difficulty: DIFF[N], seed: 12345 });
    const b = generatePuzzle({ size: N, difficulty: DIFF[N], seed: 12345 });
    assert.deepEqual(a, b);
    const c = generatePuzzle({ size: N, difficulty: DIFF[N], seed: 12346 });
    assert.notDeepEqual(a, c);
  });
  if (times.length) {
    const avg = times.reduce((x, y) => x + y, 0) / times.length;
    console.log(`       timing ${N}x${N}: avg ${avg.toFixed(0)} ms, max ${Math.max(...times).toFixed(0)} ms`);
  }
}
test('other difficulty / size combinations', () => {
  for (const d of ['very-easy', 'easy', 'medium', 'hard']) {
    validate(generatePuzzle({ difficulty: d, seed: 9 }));
    validate(generatePuzzle({ size: 7, difficulty: d, seed: 10 }));
  }
});
test('conventions hold across many generated puzzles', () => {
  let notes = 0;
  for (let s = 100; s < 124; s++) {
    const d = ['very-easy', 'easy', 'medium', 'hard'][s % 4];
    const p = generatePuzzle({ difficulty: d, seed: s });
    validate(p);
    notes += (p.notes || []).length;
  }
  console.log(`       ${notes} case notes over 24 puzzles`);
});
test('default size per difficulty', () => {
  assert.equal(generatePuzzle({ difficulty: 'very-easy', seed: 1 }).size, 5);
  assert.equal(generatePuzzle({ difficulty: 'medium', seed: 1 }).size, 7);
  assert.equal(generatePuzzle({ seed: 1 }).size, 6);
});

console.log('cases');
test('11 cases with expected sizes/difficulties', () => {
  assert.equal(CASES.length, 11);
  const sig = CASES.map((c) => `${c.difficulty}:${c.size}`);
  assert.deepEqual(sig, ['very-easy:5', 'very-easy:5', 'easy:6', 'easy:6', 'easy:6', 'medium:7', 'medium:7', 'medium:7', 'hard:8', 'hard:8', 'hard:9']);
  assert.equal(new Set(CASES.map((c) => c.id)).size, 11);
  assert.equal(new Set(CASES.map((c) => c.title)).size, 11);
});
for (const p of CASES) {
  test(`case ${p.id}: valid, unique, logic-solvable`, () => {
    const prof = validate(p);
    assert.equal(prof.narrow, 0);
    const used = new Set(p.characters.map((ch) => roomAt(p, p.solution[ch.id].r, p.solution[ch.id].c)));
    assert.ok(used.size >= 3, '>= 3 rooms used');
    assert.ok(hintWalk(p), 'getHint reaches done');
  });
}

// ---- room furnishing coherence
const recTypes = (rec) => new Set([...rec.items.flatMap((i) => [i.t, i.seat?.[0], i.extra]), rec.flood].filter(Boolean));
function checkFurnishing(P, scene, { small = 2 } = {}) {
  const N = P.size;
  const byName = Object.fromEntries(scene.rooms.map((rm) => [rm.name, rm]));
  const at = {};
  for (const o of P.objects) at[`${o.r},${o.c}`] = o.type;
  const perRoom = {};
  for (const o of P.objects) {
    const k = P.rooms[o.r][o.c];
    const rec = byName[P.roomInfo[k].name];
    assert.ok(rec, 'room has recipe');
    assert.ok(recTypes(rec).has(o.type), `${o.type} not allowed in ${rec.name} (${scene.key})`);
    if (WALL_TYPES.has(o.type) || (rec.items.find((i) => i.t === o.type)?.wall)) {
      const same = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dr, dc]) => {
        const r = o.r + dr, c = o.c + dc;
        return r >= 0 && c >= 0 && r < N && c < N && P.rooms[r][c] === k;
      }).length;
      assert.ok(same < 4, `${o.type} in ${rec.name} must touch a room boundary`);
    }
    if (SEAT_ANCHORS[o.type]) {
      const ok = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => SEAT_ANCHORS[o.type].includes(at[`${o.r + dr},${o.c + dc}`]));
      assert.ok(ok, `${o.type} in ${rec.name} needs an adjacent table/desk/counter`);
    }
    const pr = (perRoom[k] = perRoom[k] || {});
    pr[o.type] = (pr[o.type] || 0) + 1;
    if (o.type !== rec.flood) pr._n = (pr._n || 0) + 1;
    const item = rec.items.find((i) => i.t === o.type);
    if (item && !item.seat && !item.size && !rec.flood) assert.ok(pr[o.type] <= Math.max(item.max, 1) + 0, `too many ${o.type} in ${rec.name}`);
  }
  for (const [k, pr] of Object.entries(perRoom)) {
    const name = P.roomInfo[k].name;
    const bedRec = byName[name].items.find((i) => i.t === 'bed');
    assert.ok((pr.bed || 0) <= (bedRec?.size ? bedRec.size[1] : 1), `bed count in ${name}`);
    if (name === 'Sauna') assert.ok(!pr.bed && !pr.crate, 'no bed/crate in Sauna');
    if (name === 'Boot Room') assert.ok(!pr.bed && (pr.crate || 0) <= 1, 'Boot Room');
    if (roomCells(P, k).length <= 4) assert.ok(pr._n <= small, `small room ${name} has <= ${small} objects`);
  }
  let empty = 0;
  for (const k of roomKeys(P)) {
    const name = P.roomInfo[k].name;
    if (!perRoom[k]) {
      empty++;
      assert.ok(!['Kitchen', 'Bedroom', 'Loft', 'Study', 'Sauna', 'Boot Room'].includes(name), `${name} not bare`);
    }
  }
  return empty;
}

test('layouts: per-room allow-lists, wall pieces, beds, seats (all scenes/sizes)', () => {
  let n = 0;
  for (const scene of SCENES) {
    for (let N = 5; N <= 9; N++) {
      for (let seed = 0; seed < 30; seed++) {
        const L = buildLayout(makeRng(`lay|${scene.key}|${N}|${seed}`), N, scene);
        if (!L) continue;
        const P = { size: N, rooms: L.rooms, roomInfo: L.roomInfo, objects: L.objects };
        const empty = checkFurnishing(P, scene);
        assert.ok(empty <= 1, `at most one empty room (${scene.key})`);
        n++;
      }
    }
  }
  assert.ok(n > 1000, 'layouts checked: ' + n);
});

test('generated puzzles: coherent furnishing in every scene', () => {
  for (const scene of SCENES) {
    for (const size of [5, 7]) {
      const p = generatePuzzle({ size, difficulty: 'easy', seed: `fur-${scene.key}-${size}`, scene: scene.key });
      checkFurnishing(p, scene, { small: 3 });
    }
  }
  for (const p of [...CASES, SAMPLE_PUZZLE]) {
    const names = Object.values(p.roomInfo).map((v) => v.name);
    const matches = SCENES.filter((sc) => names.every((nm) => sc.rooms.some((rm) => rm.name === nm)));
    assert.ok(matches.length, 'scene found for ' + p.id);
    let err = null;
    for (const scene of matches) { try { checkFurnishing(p, scene, { small: 3 }); err = null; break; } catch (e) { err = e; } }
    if (err) throw err;
  }
});



test('water rooms (lake / pond): mostly water, boats only on water, rows stay solvable', () => {
  const waterScenes = SCENES.filter((sc) => sc.rooms.some((rm) => rm.flood));
  assert.ok(waterScenes.length >= 2, 'lake + farm scenes');
  let frac = 0, nLakes = 0;
  for (const scene of waterScenes) {
    const floodNames = new Set(scene.rooms.filter((rm) => rm.flood).map((rm) => rm.name));
    for (let N = 5; N <= 9; N++) {
      for (let seed = 0; seed < 30; seed++) {
        const L = buildLayout(makeRng(`wat|${scene.key}|${N}|${seed}`), N, scene);
        if (!L) continue;
        const P = { size: N, rooms: L.rooms, roomInfo: L.roomInfo, objects: L.objects };
        const wet = roomKeys(P).filter((k) => floodNames.has(P.roomInfo[k].name));
        assert.ok(wet.length >= 1, `${scene.key}: water room always present`);
        for (const o of P.objects) {
          const nm = P.roomInfo[P.rooms[o.r][o.c]].name;
          if (o.type === 'boat' || o.type === 'water') assert.ok(floodNames.has(nm), `${o.type} outside water room (${nm})`);
          if (o.type === 'boat') assert.equal(P.roomInfo[P.rooms[o.r][o.c]].floor, 'water');
        }
        for (const k of wet) {
          const cells = roomCells(P, k);
          const w = cells.filter((c) => L.objects.some((o) => o.type === 'water' && o.r === c.r && o.c === c.c)).length;
          const boats = cells.filter((c) => L.objects.some((o) => o.type === 'boat' && o.r === c.r && o.c === c.c)).length;
          assert.ok(boats >= 1, 'at least one boat');
          assert.equal(P.roomInfo[k].floor, 'water');
          if (cells.length >= 6) { frac += w / cells.length; nLakes++; assert.ok(w / cells.length >= 0.3, `${scene.key} ${N}: only ${w}/${cells.length} water`); }
        }
        for (let r = 0; r < N; r++) {
          let free = 0, freeC = 0;
          for (let c = 0; c < N; c++) { if (!L.blocked[r * N + c]) free++; if (!L.blocked[c * N + r]) freeC++; }
          assert.ok(free >= 2 && freeC >= 2, 'free cells per row/col');
        }
      }
    }
  }
  console.log(`       avg water fraction (rooms >= 6 cells): ${(frac / nLakes).toFixed(2)} over ${nLakes}`);
});

test('clue text reads naturally for new object types', () => {
  const p = { size: 5, outdoor: false, roomInfo: { A: { name: 'Lake', floor: 'water' } }, characters: [{ id: 'A', name: 'Ann' }] };
  const t = (clue) => clueText(clue, p.characters[0], p).replace(/\*\*/g, '');
  assert.match(t({ type: 'besideObject', object: 'water' }), /beside the water.?$/);
  assert.match(t({ type: 'besideObject', object: 'haybale' }), /beside a hay bale.?$/);
  assert.match(t({ type: 'notBesideObject', object: 'tractor' }), /not beside a tractor.?$/);
  assert.match(t({ type: 'onObject', object: 'boat' }), /in a boat.?$/);
  assert.match(t({ type: 'onObjectInRoom', object: 'boat', room: 'A' }), /in a boat in the Lake.?$/);
  assert.match(t({ type: 'onObject', object: 'car' }), /in a car.?$/);
  assert.match(t({ type: 'onObject', object: 'bathtub' }), /in a bathtub.?$/);
  assert.match(t({ type: 'withSomeoneBeside', object: 'water' }), /beside the water.?$/);
});

test('layout: no same-type cluster > 2 (except natural clumps), sane per-room counts', () => {
  const OK = new Set(['water', 'flowers', 'haybale', 'tree', 'bush', 'rug', 'boat']);
  let n = 0;
  for (const scene of SCENES) for (let N = 5; N <= 9; N++) for (let seed = 1; seed <= 12; seed++) {
    const lay = buildLayout(makeRng(seed * 977 + N), N, scene);
    if (!lay) continue;
    n++;
    const at = new Map(lay.objects.map((o) => [o.r * N + o.c, o.type]));
    const seen = new Set();
    for (const o of lay.objects) {
      if (OK.has(o.type) || seen.has(o.r * N + o.c)) continue;
      const comp = [o.r * N + o.c]; seen.add(comp[0]);
      for (let q = 0; q < comp.length; q++) {
        const r = Math.floor(comp[q] / N), c = comp[q] % N;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = (r + dr) * N + c + dc;
          if (r + dr >= 0 && r + dr < N && c + dc >= 0 && c + dc < N && at.get(k) === o.type && !seen.has(k)) { seen.add(k); comp.push(k); }
        }
      }
      assert.ok(comp.length <= 2, `${scene.key} N=${N} seed=${seed}: ${comp.length} ${o.type} connected`);
    }
    const per = {};
    for (const o of lay.objects) {
      if (OK.has(o.type)) continue;
      const k = lay.rooms[o.r][o.c];
      per[k + o.type] = (per[k + o.type] || 0) + 1;
    }
    for (const [key, cnt] of Object.entries(per)) {
      const size = lay.rooms.join('').split(key[0]).length - 1;
      assert.ok(cnt <= Math.max(2, Math.ceil(size * 0.35)), `${scene.key} N=${N}: ${cnt} x ${key.slice(1)} in room of ${size}`);
    }
  }
  assert.ok(n > 200, 'enough layouts sampled');
});

test('facing: fronted objects never face a wall/edge when an alternative exists; chairs face adjacent table', () => {
  const check = (p, label) => {
    const N = p.size, at = new Map(p.objects.map((o) => [o.r * N + o.c, o]));
    const roomOf = (r, c) => (r >= 0 && c >= 0 && r < N && c < N ? p.rooms[r][c] : null);
    for (const o of p.objects) {
      if (!FRONTED_TYPES.has(o.type)) { assert.equal(o.facing, undefined, `${label}: ${o.type} has no front`); continue; }
      assert.ok(FACING_DIRS[o.facing], `${label}: ${o.type} facing set`);
      const here = roomOf(o.r, o.c);
      const open = (d) => roomOf(o.r + FACING_DIRS[d][0], o.c + FACING_DIRS[d][1]) === here;
      if (!open(o.facing)) assert.ok(!['n', 'e', 's', 'w'].some(open), `${label}: ${o.type} at ${o.r},${o.c} faces a wall though open side exists`);
      if (o.type === 'chair') {
        const tables = ['n', 'e', 's', 'w'].filter((d) => {
          const q = at.get((o.r + FACING_DIRS[d][0]) * N + o.c + FACING_DIRS[d][1]);
          return q && ['table', 'desk', 'counter'].includes(q.type) && open(d);
        });
        if (tables.length) assert.ok(tables.includes(o.facing), `${label}: chair at ${o.r},${o.c} faces away from adjacent table`);
      }
    }
  };
  let n = 0;
  for (const scene of SCENES) for (let N = 5; N <= 9; N++) for (let seed = 1; seed <= 6; seed++) {
    const lay = buildLayout(makeRng(seed * 31 + N), N, scene);
    if (!lay) continue;
    const p = assignFacing({ size: N, rooms: lay.rooms, objects: lay.objects.map((o) => ({ ...o })) });
    check(p, `${scene.key} ${N} ${seed}`); n++;
  }
  assert.ok(n > 100);
  for (const c of CASES) check(c, c.id);
  check(SAMPLE_PUZZLE, 'sample');
  for (const seed of [1, 2, 3]) check(generatePuzzle({ size: 6, difficulty: 'easy', seed }), `gen${seed}`);
});

console.log(`
${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
