// Hints. Pure ES module (Node + browser).
import { evaluateClue, clueBody, clueOther, isUnaryClue, noteText, rowWord, ordinal } from './clues.js';
import { prepare, consistentWith, getSolution, murdererOf } from './solver.js';
import { objectAt, isBeside } from './grid.js';

const LOOKAHEAD_BUDGET_MS = 150;
const possessive = (ch) => (ch.gender === 'f' ? 'her' : 'his');

const SOLO = new Set(['alone', 'aloneInRoom']);

// Sound, human-style propagation from the current placements.
// Returns { domains: {id:[cellIdx]}, reasons: {id:{kind,...}}, order, contradiction } for unplaced characters.
export function propagate(puzzle, placements) {
  const P = prepare(puzzle);
  const { N, cells, ids } = P;
  const chars = {};
  for (const ch of puzzle.characters) chars[ch.id] = ch;
  const pos = {};
  const rowUsed = new Array(N).fill(false), colUsed = new Array(N).fill(false);
  for (const id of ids) {
    const p = placements[id];
    if (!p) continue;
    pos[id] = cells[p.r * N + p.c];
    rowUsed[p.r] = colUsed[p.c] = true;
  }
  const unplaced = ids.filter((id) => !pos[id]);
  const D = {};
  const reasons = {};
  // Placed characters must be consistent among themselves.
  const placedIds = ids.filter((id) => pos[id]);
  const rows = new Set(placedIds.map((id) => pos[id].r)), cols = new Set(placedIds.map((id) => pos[id].c));
  if (rows.size < placedIds.length || cols.size < placedIds.length ||
      placedIds.some((id) => !P.domains[id].includes(pos[id].r * N + pos[id].c) || !consistentWith(P, puzzle, id, pos))) {
    for (const id of unplaced) D[id] = [];
    return { domains: D, reasons, order: {}, contradiction: true };
  }
  for (const id of unplaced) {
    D[id] = P.domains[id].filter((i) => {
      const p = cells[i];
      if (rowUsed[p.r] || colUsed[p.c]) return false;
      pos[id] = p;
      const ok = consistentWith(P, puzzle, id, pos);
      delete pos[id];
      return ok;
    });
  }
  // Binary pairs among unplaced characters.
  const pairs = [];
  for (const id of unplaced) {
    for (const cl of P.ownBinary[id]) {
      const o = clueOther(cl);
      if (D[o]) pairs.push({ owner: id, other: o, clue: cl });
    }
  }
  // Per-character clue lookups for the room rules.
  const clueOf = (id, type) => chars[id].clues.filter((cl) => cl.type === type);
  const isSolo = (id) => chars[id].clues.some((cl) => SOLO.has(cl.type));
  const notes = P.notes;
  const roomList = [...new Set(P.roomOf)];
  const objType = cells.map((p) => objectAt(puzzle, p.r, p.c)?.type ?? null);

  // order[id]: when the character's domain first shrank to one cell (earlier = simpler reasoning).
  const order = {};
  let seq = 0;
  for (const id of unplaced) if (D[id].length === 1) order[id] = seq++;
  const set = (id, arr, reason) => {
    if (arr.length < D[id].length) {
      D[id] = arr;
      if (arr.length === 1 && order[id] === undefined) {
        order[id] = seq++;
        if (reason) reasons[id] = reason;
      }
      return true;
    }
    return false;
  };
  let changed = true, guard = 0, noteClash = false;
  while (changed && guard++ < 100 && !noteClash) {
    changed = false;
    // Naked singles: a fixed character blocks its row and column.
    for (const id of unplaced) {
      if (D[id].length !== 1) continue;
      const p = cells[D[id][0]];
      for (const o of unplaced) {
        if (o === id) continue;
        if (set(o, D[o].filter((i) => cells[i].r !== p.r && cells[i].c !== p.c), { kind: 'isolate', by: id })) changed = true;
      }
    }
    // Arc consistency on binary clues.
    for (const { owner, other, clue } of pairs) {
      const supported = (x, a, b) => D[b].some((j) => {
        const pa = cells[x], pb = cells[j];
        if (pa.r === pb.r || pa.c === pb.c) return false;
        const tmp = { [a]: pa, [b]: pb };
        return evaluateClue(clue, owner, tmp, puzzle) !== false;
      });
      if (set(owner, D[owner].filter((x) => supported(x, owner, other)), { kind: 'clue', clue })) changed = true;
      if (set(other, D[other].filter((x) => supported(x, other, owner)), { kind: 'link', clue, owner })) changed = true;
    }
    // Room rules (alone, alone with…, the victim rule, room notes), using characters forced into one room.
    const forced = {};
    for (const id of ids) {
      if (pos[id]) forced[id] = P.roomOf[pos[id].r * N + pos[id].c];
      else if (D[id].length && D[id].every((i) => P.roomOf[i] === P.roomOf[D[id][0]])) forced[id] = P.roomOf[D[id][0]];
    }
    const cellsOf = (id) => (pos[id] ? [pos[id].r * N + pos[id].c] : D[id]);
    const forcedIn = (room, except) => ids.filter((id) => id !== except && forced[id] === room);
    const mayBeIn = (room, except) => ids.filter((id) => id !== except && cellsOf(id).some((i) => P.roomOf[i] === room));
    for (const id of unplaced) {
      const me = chars[id];
      const next = D[id].filter((i) => {
        const room = P.roomOf[i];
        const others = forcedIn(room, id);
        if (isSolo(id) && others.length) return false;
        if (others.some(isSolo)) return false;
        for (const cl of clueOf(id, 'aloneWith')) {
          if (others.some((o) => o !== cl.who)) return false;
          if (!mayBeIn(room, id).includes(cl.who)) return false;
        }
        for (const o of others) {
          for (const cl of clueOf(o, 'aloneWith')) if (cl.who !== id) return false;
          for (const cl of clueOf(o, 'aloneWithGender')) {
            if (me.gender !== cl.gender || others.length > 1) return false;
          }
        }
        for (const cl of clueOf(id, 'aloneWithGender')) {
          if (others.length > 1) return false;
          if (others.length === 1 && chars[others[0]].gender !== cl.gender) return false;
          if (!mayBeIn(room, id).some((o) => chars[o].gender === cl.gender)) return false;
        }
        for (const cl of clueOf(id, 'withSomeoneBeside')) {
          const ok = ids.some((o) => o !== id && cellsOf(o).some((j) => P.roomOf[j] === room &&
            puzzle.objects.some((ob) => ob.type === cl.object && isBeside(puzzle, cells[j], ob))));
          if (!ok) return false;
        }
        for (const note of notes) {
          if (note.type !== 'roomGenders' || note.room !== room) continue;
          if (others.length > 1) return false;
          if (others.length === 1 && chars[others[0]].gender === me.gender) return false;
        }
        if (id === P.victim) {
          // victim's room must end with exactly one other person
          if (others.length >= 2 || mayBeIn(room, id).length < 1) return false;
        } else if (P.victim && forced[P.victim] === room) {
          if (others.length >= 2) return false;
        }
        return true;
      });
      if (set(id, next, { kind: 'room' })) changed = true;
    }
    // Case notes that count people.
    for (const note of notes) {
      if (note.type === 'countOnObject') {
        const onObj = (i) => objType[i] === note.object;
        const forcedOn = ids.filter((id) => cellsOf(id).length && cellsOf(id).every(onObj));
        const mayOn = ids.filter((id) => cellsOf(id).some(onObj));
        if (forcedOn.length > note.count || mayOn.length < note.count) noteClash = true;
        else if (forcedOn.length === note.count) {
          for (const id of unplaced) {
            if (forcedOn.includes(id)) continue;
            if (set(id, D[id].filter((i) => !onObj(i)), { kind: 'note', note })) changed = true;
          }
        } else if (mayOn.length === note.count) {
          for (const id of unplaced) {
            if (!mayOn.includes(id)) continue;
            if (set(id, D[id].filter(onObj), { kind: 'note', note })) changed = true;
          }
        }
      } else if (note.type === 'noEmptyRoom' || note.type === 'emptyRooms') {
        const target = note.type === 'noEmptyRoom' ? roomList.length : roomList.length - note.count;
        const occupied = new Set(ids.filter((id) => forced[id] != null).map((id) => forced[id]));
        const possible = roomList.filter((rm) => mayBeIn(rm, null).length > 0);
        if (occupied.size > target || possible.length < target) { noteClash = true; continue; }
        if (occupied.size === target) {
          for (const id of unplaced) {
            if (forced[id] != null) continue;
            if (set(id, D[id].filter((i) => occupied.has(P.roomOf[i])), { kind: 'note', note })) changed = true;
          }
        }
        if (possible.length === target) {
          for (const rm of possible) {
            if (occupied.has(rm)) continue;
            const who = mayBeIn(rm, null);
            if (who.length === 1 && !pos[who[0]]) {
              if (set(who[0], D[who[0]].filter((i) => P.roomOf[i] === rm), { kind: 'note', note })) changed = true;
            }
          }
        }
      } else if (note.type === 'roomGenders') {
        for (const g of ['m', 'f']) {
          if (ids.some((id) => chars[id].gender === g && forced[id] === note.room)) continue;
          const cand = mayBeIn(note.room, null).filter((id) => chars[id].gender === g);
          if (cand.length === 0) noteClash = true;
          else if (cand.length === 1 && !pos[cand[0]]) {
            if (set(cand[0], D[cand[0]].filter((i) => P.roomOf[i] === note.room), { kind: 'note', note })) changed = true;
          }
        }
      }
    }
    // Hidden singles: a free row/column only one character can reach.
    for (const axis of ['r', 'c']) {
      const used = axis === 'r' ? rowUsed : colUsed;
      for (let k = 0; k < N; k++) {
        if (used[k]) continue;
        const who = unplaced.filter((id) => D[id].some((i) => cells[i][axis] === k));
        if (who.length === 1) {
          const id = who[0];
          if (set(id, D[id].filter((i) => cells[i][axis] === k), { kind: axis === 'r' ? 'row' : 'column', index: k })) changed = true;
        }
      }
    }
  }
  let contradiction = noteClash || unplaced.some((id) => D[id].length === 0);
  for (let k = 0; k < N && !contradiction; k++) {
    if (!rowUsed[k] && !unplaced.some((id) => D[id].some((i) => cells[i].r === k))) contradiction = true;
    if (!colUsed[k] && !unplaced.some((id) => D[id].some((i) => cells[i].c === k))) contradiction = true;
  }
  return { domains: D, reasons, order, contradiction };
}

// One-step "what if": drop candidates of `id` whose placement makes propagation contradict.
function lookahead(puzzle, placements, id, domain) {
  const P = prepare(puzzle);
  return domain.filter((i) => {
    const p = P.cells[i];
    return !propagate(puzzle, { ...placements, [id]: { r: p.r, c: p.c } }).contradiction;
  });
}

// The clue (excluding 'victim') of `ch` that alone leaves the fewest free cells.
function strongestClue(puzzle, ch, placements) {
  const P = prepare(puzzle);
  const usedR = new Set(), usedC = new Set();
  for (const id of P.ids) if (placements[id]) { usedR.add(placements[id].r); usedC.add(placements[id].c); }
  let best = null, bestN = Infinity;
  for (const cl of ch.clues) {
    if (cl.type === 'victim') continue;
    let n = 0;
    for (const p of P.cells) {
      if (usedR.has(p.r) || usedC.has(p.c)) continue;
      const v = evaluateClue(cl, ch.id, { ...placements, [ch.id]: p }, puzzle);
      if (v !== false) n++;
    }
    // Prefer unary clues on ties (they're easier to read).
    if (n < bestN || (n === bestN && best && !isUnaryClue(best) && isUnaryClue(cl))) { best = cl; bestN = n; }
  }
  return best;
}

// ---- tutor-style messages ----

export const coord = (p) => `R${p.r + 1} C${p.c + 1}`;
const who = (ch) => `**${ch.name}** (${ch.id})`;
const charById = (puzzle, id) => puzzle.characters.find((c) => c.id === id);
const said = (puzzle, ch, cl) => `${who(ch)} ${clueBody(cl, puzzle, ch)}.`;

function deduceMessage(puzzle, ch, placements, reason, cell) {
  const at = coord(cell);
  switch (reason?.kind) {
    case 'row':
      return `Nobody else can still go in the **${rowWord(reason.index, puzzle.size)} row**, so it must be ${who(ch)}: ${at}.`;
    case 'column':
      return `Nobody else can still go in the **${ordinal(reason.index, puzzle.size)} column**, so it must be ${who(ch)}: ${at}.`;
    case 'isolate':
      return `Rows and columns are filling up: this isolates ${who(ch)} in the last free square that fits: ${at}.`;
    case 'link': {
      const owner = charById(puzzle, reason.owner);
      if (owner) return `${said(puzzle, owner, reason.clue)} That leaves only one square for ${who(ch)}: ${at}.`;
      break;
    }
    case 'clue':
      return `${said(puzzle, ch, reason.clue)} There's only one square that fits: ${at}.`;
    case 'note':
      return `Case note: ${noteText(reason.note, puzzle)} That leaves only one square for ${who(ch)}: ${at}.`;
    case 'room':
      if (ch.victim) return `The Victim was alone with exactly one suspect. Counting who can share each room leaves one square for ${who(ch)}: ${at}.`;
      return `Think about who can share each room: that leaves only one square for ${who(ch)}: ${at}.`;
  }
  const cl = strongestClue(puzzle, ch, placements);
  if (!cl) return `Only one free square is left for ${who(ch)}: ${at}.`;
  return `${said(puzzle, ch, cl)} There's only one square that fits: ${at}.`;
}

// "(V) was alone with (B): **Basil** is the murderer!"
function verdict(puzzle, sol) {
  const victim = puzzle.characters.find((c) => c.victim);
  const mid = sol ? murdererOf(puzzle, sol) : null;
  const m = mid ? charById(puzzle, mid) : null;
  if (!victim || !m) return 'Case closed!';
  return `(${victim.id}) was alone with (${m.id}): **${m.name}** is the murderer!`;
}

export function getHint(puzzle, placements = {}) {
  const sol = getSolution(puzzle);
  const chars = puzzle.characters;
  // (a) wrong placements
  for (const ch of chars) {
    const p = placements[ch.id];
    if (!p) continue;
    const s = sol?.[ch.id];
    if (!s || s.r !== p.r || s.c !== p.c) {
      const n = ch.clues.length;
      return {
        kind: 'wrong', charId: ch.id,
        message: `Something's off with ${who(ch)} on ${coord(p)}. Re-read ${possessive(ch)} clue${n > 1 ? 's' : ''}.`,
      };
    }
  }
  // (c) done
  const unplaced = chars.filter((ch) => !placements[ch.id]);
  if (unplaced.length === 0) return { kind: 'done', message: `Case closed! ${verdict(puzzle, sol)}` };
  const finish = (msg) => (unplaced.length === 1 ? `${msg} ${verdict(puzzle, sol)}` : msg);
  // (b) propagate
  const { domains, reasons, order: found } = propagate(puzzle, placements);
  const P = prepare(puzzle);
  const toCell = (i) => ({ r: P.cells[i].r, c: P.cells[i].c });
  // Prefer the single that was found first (the shortest chain of reasoning).
  const singles = unplaced.filter((ch) => domains[ch.id].length === 1);
  if (singles.length) {
    singles.sort((a, b) => (found[a.id] ?? 1e9) - (found[b.id] ?? 1e9));
    const ch = singles[0];
    const cell = toCell(domains[ch.id][0]);
    return {
      kind: 'deduce', charId: ch.id, cell,
      message: finish(deduceMessage(puzzle, ch, placements, reasons[ch.id], cell)),
    };
  }
  // No direct single: try "what if" reasoning, smallest domains first.
  const order = unplaced.slice().sort((a, b) => domains[a.id].length - domains[b.id].length);
  const t0 = Date.now();
  for (const c of order) {
    if (domains[c.id].length > 12 || Date.now() - t0 > LOOKAHEAD_BUDGET_MS) break;
    const d = lookahead(puzzle, placements, c.id, domains[c.id]);
    if (d.length === 0) continue; // should not happen (sound)
    domains[c.id] = d;
    if (d.length === 1) {
      const cl = strongestClue(puzzle, c, placements);
      const lead = cl ? `${said(puzzle, c, cl)} ` : '';
      const cell = toCell(d[0]);
      return {
        kind: 'deduce', charId: c.id, cell,
        message: finish(`${lead}Try each square that fits ${who(c)}: only ${coord(cell)} leaves room for everyone else.`),
      };
    }
  }
  let ch = unplaced[0];
  for (const c of unplaced) if (domains[c.id].length < domains[ch.id].length) ch = c;
  let cells = domains[ch.id].map(toCell);
  if (cells.length === 0 && sol?.[ch.id]) cells = [sol[ch.id]]; // should not happen (propagation is sound)
  const cl = strongestClue(puzzle, ch, placements);
  const why = cl ? `${said(puzzle, ch, cl)} ` : '';
  return {
    kind: 'narrow', charId: ch.id, cells,
    message: `${why}Taking everything together, ${who(ch)} can only be on one of **${cells.length}** squares` +
      (cells.length <= 6 ? `: ${cells.map(coord).join(', ')}.` : '.'),
  };
}
