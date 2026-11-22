// Produces js/puzzles/cases.js: searches generator seeds per curated slot and keeps the best.
// Run: node tools/make-cases.mjs   (writes the file; prints the chosen seeds)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatePuzzle, logicProfile } from '../js/model/generator.js';
import { roomAt } from '../js/model/grid.js';

const SLOTS = [
  { id: 'crumbs-at-closing-time', title: 'Crumbs at Closing Time', scene: 'bakery', size: 5, difficulty: 'very-easy' },
  { id: 'the-wilted-orchid', title: 'The Wilted Orchid', scene: 'greenhouse', size: 5, difficulty: 'very-easy' },
  { id: 'the-curators-last-exhibit', title: "The Curator's Last Exhibit", scene: 'museum', size: 6, difficulty: 'easy' },
  { id: 'saltwater-and-sabotage', title: 'Saltwater and Sabotage', scene: 'boardwalk', size: 6, difficulty: 'easy' },
  { id: 'ripples-on-lake-larkspur', title: 'Ripples on Lake Larkspur', scene: 'lake', size: 6, difficulty: 'easy' },
  { id: 'an-avalanche-of-alibis', title: 'An Avalanche of Alibis', scene: 'chalet', size: 7, difficulty: 'medium' },
  { id: 'the-final-encore', title: 'The Final Encore', scene: 'jazzclub', size: 7, difficulty: 'medium' },
  { id: 'a-toast-to-the-end-of-the-world', title: 'A Toast to the End of the World', scene: 'homestead', size: 7, difficulty: 'medium' },
  { id: 'ashes-in-the-lantern-room', title: 'Ashes in the Lantern Room', scene: 'lighthouse', size: 8, difficulty: 'hard' },
  { id: 'nine-floors-of-motive', title: 'Nine Floors of Motive', scene: 'apartment', size: 8, difficulty: 'hard' },
  { id: 'the-last-train-to-nowhere', title: 'The Last Train to Nowhere', scene: 'station', size: 9, difficulty: 'hard' },
];

const TRIAL_RANGE = { 'very-easy': [0, 0], easy: [0, 1], medium: [1, 3], hard: [2, 99] };
const NOTE_BONUS = { 'very-easy': 0.6, easy: 0.8, medium: 1.2, hard: 1.6 };

function score(p, slot) {
  const prof = logicProfile(p, p.solution);
  if (!prof.ok || prof.narrow > 0) return -Infinity;
  const [lo, hi] = TRIAL_RANGE[slot.difficulty];
  if (prof.trial < lo || prof.trial > hi) return -Infinity;
  const used = new Set(p.characters.map((ch) => roomAt(p, p.solution[ch.id].r, p.solution[ch.id].c))).size;
  if (used < 3) return -Infinity;
  const notes = (p.notes || []).length;
  // More case notes on harder cases: medium needs at least one, hard two.
  if ((slot.difficulty === 'medium' && notes < 1) || (slot.difficulty === 'hard' && notes < 2)) return -Infinity;
  const clues = p.characters.flatMap((ch) => ch.clues).filter((cl) => cl.type !== 'victim');
  const kind = (cl) => (cl.type === 'dir' ? `dir-${cl.dist != null}-${!!cl.otherRoom}-${cl.dir.length > 5}` : cl.type);
  const types = new Set(clues.map(kind)).size;
  const doubles = p.characters.filter((ch) => ch.clues.length === 2).length;
  const balance = -doubles * (slot.difficulty === 'medium' ? 0.4 : 0.15);
  // Exact-distance clues are strong but read mechanically: keep them occasional.
  const dist = clues.filter((cl) => cl.dist != null).length;
  const objTypes = new Set(p.objects.map((o) => o.type)).size;
  return (types / Math.sqrt(clues.length)) * 6 + used + objTypes * 0.5 + balance - Math.max(0, dist - 1) * 0.8 +
    notes * NOTE_BONUS[slot.difficulty] + Math.min(prof.trial, 4) * (slot.difficulty === 'hard' ? 1 : 0);
}

const q = (s) => (s.includes("'") ? JSON.stringify(s) : `'${s}'`);
function inline(v) {
  if (v === null) return 'null';
  if (typeof v === 'string') return q(v);
  if (typeof v !== 'object') return String(v);
  if (Array.isArray(v)) return `[${v.map(inline).join(', ')}]`;
  return `{ ${Object.entries(v).map(([k, x]) => `${k}: ${inline(x)}`).join(', ')} }`;
}

function serialize(p) {
  const L = [];
  L.push('  {');
  L.push(`    id: ${q(p.id)},`);
  L.push(`    title: ${q(p.title)},`);
  L.push(`    difficulty: ${q(p.difficulty)},`);
  L.push(`    size: ${p.size},`);
  L.push(`    outdoor: ${!!p.outdoor},`);
  L.push('    rooms: [');
  for (const r of p.rooms) L.push(`      ${q(r)},`);
  L.push('    ],');
  L.push('    roomInfo: {');
  for (const [k, v] of Object.entries(p.roomInfo)) L.push(`      ${k}: ${inline(v)},`);
  L.push('    },');
  L.push('    objects: [');
  for (const o of p.objects) L.push(`      ${inline(o)},`);
  L.push('    ],');
  L.push('    notes: [');
  for (const n of p.notes || []) L.push(`      ${inline(n)},`);
  L.push('    ],');
  L.push('    characters: [');
  for (const ch of p.characters) {
    L.push('      {');
    L.push(`        id: ${q(ch.id)}, name: ${q(ch.name)}, gender: ${q(ch.gender)}, victim: ${ch.victim},`);
    L.push(`        look: ${inline(ch.look)},`);
    L.push('        clues: [');
    for (const cl of ch.clues) L.push(`          ${inline(cl)},`);
    L.push('        ],');
    L.push('      },');
  }
  L.push('    ],');
  L.push(`    solution: ${inline(p.solution)},`);
  L.push(`    murderer: ${q(p.murderer)},`);
  L.push('  },');
  return L.join('\n');
}

const chosen = [];
for (const slot of SLOTS) {
  let best = null, bestS = -Infinity, bestSeed = null;
  const seeds = slot.size >= 8 ? 60 : 150;
  for (let seed = 1; seed <= seeds; seed++) {
    let p;
    try { p = generatePuzzle({ size: slot.size, difficulty: slot.difficulty, seed: `case-${seed}`, scene: slot.scene }); }
    catch { continue; }
    const s = score(p, slot);
    if (s > bestS) { bestS = s; best = p; bestSeed = seed; }
  }
  if (!best) throw new Error(`No puzzle found for ${slot.id}`);
  const prof = logicProfile(best, best.solution);
  console.log(`${slot.id}: seed case-${bestSeed} score ${bestS.toFixed(1)} trial ${prof.trial} notes ${(best.notes || []).length}`);
  chosen.push({ ...best, id: slot.id, title: slot.title });
}

const out = `// Hand-curated cases (generated by tools/make-cases.mjs, then frozen as literal data).
// Every case has a unique solution, is solvable by the hint engine's logic alone, and follows the
// genre conventions (suspects A, B, C…, a victim V who is never referenced by a clue, case notes).
export const CASES = [
${chosen.map(serialize).join('\n')}
];
`;
const target = fileURLToPath(new URL('../js/puzzles/cases.js', import.meta.url));
writeFileSync(target, out);
console.log(`wrote ${target}`);
