// Clue + case-note evaluation and text. Pure ES module (Node + browser).
import { objectLabel } from './objects.js';
import { roomAt, isBeside, isCorner, objectAt, roomKeys } from './grid.js';

// Clues that depend only on the owner's own cell.
const UNARY = new Set([
  'victim', 'inRoom', 'notInRoom', 'onObject', 'notOnObject', 'onObjectInRoom',
  'besideObject', 'notBesideObject', 'row', 'column', 'rowOneOf', 'columnOneOf', 'corner',
]);

// Clues that depend on who else is (or is not) in the owner's room.
const ROOM_CLUES = new Set(['alone', 'aloneInRoom', 'aloneWith', 'aloneWithGender', 'withSomeoneBeside']);

export function isUnaryClue(clue) {
  return UNARY.has(clue.type);
}

export function isRoomClue(clue) {
  return ROOM_CLUES.has(clue.type);
}

// The other character a binary clue refers to (or null).
export function clueOther(clue) {
  return clue.who ?? clue.of ?? clue.with ?? null;
}

// Room number of a numbered room (golf holes), or null.
export function roomNumber(puzzle, room) {
  return puzzle.roomInfo?.[room]?.number ?? null;
}

function besideObjectType(puzzle, p, type) {
  for (const o of puzzle.objects || []) {
    if (o.type === type && isBeside(puzzle, p, o)) return true;
  }
  return false;
}

// Others (placed) in `room`, and how many characters (other than `except`) are still unplaced.
function roomStats(puzzle, positions, room, except) {
  const others = [];
  let unplaced = 0;
  for (const ch of puzzle.characters) {
    if (ch.id === except) continue;
    const q = positions[ch.id];
    if (!q) { unplaced++; continue; }
    if (roomAt(puzzle, q.r, q.c) === room) others.push(ch);
  }
  return { others, unplaced };
}

const DIAG = {
  northeast: (dr, dc) => dr < 0 && dc > 0,
  northwest: (dr, dc) => dr < 0 && dc < 0,
  southeast: (dr, dc) => dr > 0 && dc > 0,
  southwest: (dr, dc) => dr > 0 && dc < 0,
};

// positions: {id:{r,c}} (may be partial).
// Returns true | false | null. null = not decided yet (own/referenced character unplaced, or the
// room may still change). false is only returned when the clue can no longer become true.
export function evaluateClue(clue, charId, positions, puzzle) {
  if (clue.type === 'victim') return true;
  const p = positions[charId];
  if (!p) return null;
  const room = roomAt(puzzle, p.r, p.c);
  switch (clue.type) {
    case 'inRoom': return room === clue.room;
    case 'notInRoom': return room !== clue.room;
    case 'onObject': return objectAt(puzzle, p.r, p.c)?.type === clue.object;
    case 'notOnObject': return objectAt(puzzle, p.r, p.c)?.type !== clue.object;
    case 'onObjectInRoom': return room === clue.room && objectAt(puzzle, p.r, p.c)?.type === clue.object;
    case 'besideObject': return besideObjectType(puzzle, p, clue.object);
    case 'notBesideObject': return !besideObjectType(puzzle, p, clue.object);
    case 'row': return p.r === clue.index;
    case 'column': return p.c === clue.index;
    case 'rowOneOf': return clue.indices.includes(p.r);
    case 'columnOneOf': return clue.indices.includes(p.c);
    case 'corner': return isCorner(puzzle, p.r, p.c);
    case 'alone':
    case 'aloneInRoom': {
      if (clue.type === 'aloneInRoom' && room !== clue.room) return false;
      const { others, unplaced } = roomStats(puzzle, positions, room, charId);
      if (others.length) return false;
      return unplaced ? null : true;
    }
    case 'aloneWith': {
      const q = positions[clue.who];
      if (q && roomAt(puzzle, q.r, q.c) !== room) return false;
      const { others, unplaced } = roomStats(puzzle, positions, room, charId);
      if (others.some((o) => o.id !== clue.who)) return false;
      return q && unplaced === 0 ? true : null;
    }
    case 'aloneWithGender': {
      const { others, unplaced } = roomStats(puzzle, positions, room, charId);
      if (others.length > 1) return false;
      if (others.length === 1 && others[0].gender !== clue.gender) return false;
      if (unplaced) return null;
      return others.length === 1;
    }
    case 'withSomeoneBeside': {
      const { others, unplaced } = roomStats(puzzle, positions, room, charId);
      if (others.some((o) => besideObjectType(puzzle, positions[o.id], clue.object))) return true;
      return unplaced ? null : false;
    }
  }
  const q = positions[clueOther(clue)];
  if (!q) return null;
  switch (clue.type) {
    case 'besidePerson': return isBeside(puzzle, p, q);
    case 'sameRoom': return room === roomAt(puzzle, q.r, q.c);
    case 'dir': {
      const dr = p.r - q.r, dc = p.c - q.c;
      let ok;
      switch (clue.dir) {
        case 'north': ok = dr < 0 && (clue.dist == null || -dr === clue.dist); break;
        case 'south': ok = dr > 0 && (clue.dist == null || dr === clue.dist); break;
        case 'west': ok = dc < 0 && (clue.dist == null || -dc === clue.dist); break;
        case 'east': ok = dc > 0 && (clue.dist == null || dc === clue.dist); break;
        default:
          if (!DIAG[clue.dir]) throw new Error(`Unknown dir: ${clue.dir}`);
          ok = DIAG[clue.dir](dr, dc);
      }
      if (ok && clue.otherRoom) ok = room !== roomAt(puzzle, q.r, q.c);
      return ok;
    }
    case 'diagonal': {
      const dr = Math.abs(p.r - q.r), dc = Math.abs(p.c - q.c);
      return dr === dc && dr > 0;
    }
    // Exactly |delta| rows north (delta < 0) or south (delta > 0) of the other character.
    case 'rowOffset': return p.r - q.r === clue.delta;
    // "Higher / lower room number than the other character's room."
    case 'roomNumberCompare': {
      const a = roomNumber(puzzle, room), b = roomNumber(puzzle, roomAt(puzzle, q.r, q.c));
      if (a == null || b == null) return false;
      return clue.cmp === 'higher' ? a > b : a < b;
    }
  }
  throw new Error(`Unknown clue type: ${clue.type}`);
}

// ---- case notes ----

const roomCountCache = new WeakMap();
function roomCount(puzzle) {
  let n = roomCountCache.get(puzzle);
  if (n === undefined) { n = roomKeys(puzzle).length; roomCountCache.set(puzzle, n); }
  return n;
}

// Puzzle-wide facts. true | false | null (null = not decided by the partial placement yet).
export function evaluateNote(note, positions, puzzle) {
  let unplaced = 0;
  const placed = [];
  for (const ch of puzzle.characters) {
    const p = positions[ch.id];
    if (p) placed.push({ ch, p }); else unplaced++;
  }
  switch (note.type) {
    case 'countOnObject': {
      let k = 0;
      for (const { p } of placed) if (objectAt(puzzle, p.r, p.c)?.type === note.object) k++;
      if (k > note.count || k + unplaced < note.count) return false;
      return unplaced ? null : true;
    }
    case 'noEmptyRoom':
    case 'emptyRooms': {
      const R = roomCount(puzzle);
      const target = note.type === 'noEmptyRoom' ? R : R - note.count;
      const occ = new Set();
      for (const { p } of placed) occ.add(roomAt(puzzle, p.r, p.c));
      if (occ.size > target || occ.size + unplaced < target) return false;
      return unplaced ? null : true;
    }
    case 'roomGenders': {
      const inside = placed.filter(({ p }) => roomAt(puzzle, p.r, p.c) === note.room);
      if (inside.length > 2) return false;
      if (inside.length === 2 && inside[0].ch.gender === inside[1].ch.gender) return false;
      if (inside.length + unplaced < 2) return false;
      return unplaced ? null : true;
    }
    case 'roomParity': {
      // Every numbered room holds a number of people with the same parity as its number (zero is even).
      const cnt = {};
      for (const { p } of placed) { const k = roomAt(puzzle, p.r, p.c); cnt[k] = (cnt[k] || 0) + 1; }
      let need = 0;
      for (const k of Object.keys(puzzle.roomInfo || {})) {
        const num = roomNumber(puzzle, k);
        if (num != null && ((cnt[k] || 0) & 1) !== (num & 1)) need++;
      }
      if (need > unplaced) return false;
      return unplaced ? null : true;
    }
  }
  throw new Error(`Unknown note type: ${note.type}`);
}

// ---- text ----

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

export function ordinal(index, size) {
  if (size && index === size - 1) return 'last';
  return ORDINALS[index] ?? `${index + 1}th`;
}

export function numberWord(n) {
  return NUMBERS[n] ?? String(n);
}

// "top" / "bottom" / "third" (rows read top-to-bottom).
export function rowWord(index, size) {
  if (index === 0) return 'top';
  if (size && index === size - 1) return 'bottom';
  return ORDINALS[index] ?? `${index + 1}th`;
}

export function article(word) {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

function charName(puzzle, id) {
  return puzzle.characters.find((c) => c.id === id)?.name ?? id;
}

function roomName(puzzle, key) {
  return puzzle.roomInfo?.[key]?.name ?? key;
}

// "the **Kitchen**" / "**Hole 7**" (numbered rooms take no article).
function theRoom(puzzle, key) {
  return roomNumber(puzzle, key) != null ? `**${roomName(puzzle, key)}**` : `the **${roomName(puzzle, key)}**`;
}

// Mass nouns read better with "the": "beside the water" (never "beside a water").
const MASS_NOUNS = new Set(['water', 'shallows']);
function besideNoun(type) {
  const label = objectLabel(type);
  return MASS_NOUNS.has(type) ? `the **${label}**` : `${article(label)} **${label}**`;
}

function objPhrase(type) {
  const label = objectLabel(type);
  return `${article(label)} ${label}`;
}

// How a person "is on" an occupiable object: [singular, plural].
const ON_PHRASE = {
  chair: ['sitting in a chair', 'sitting in chairs'],
  sofa: ['on a sofa', 'on sofas'],
  bed: ['on a bed', 'on beds'],
  rug: ['on a rug', 'on rugs'],
  bench: ['on a bench', 'on benches'],
  towel: ['on a beach towel', 'on beach towels'],
  stool: ['sitting on a stool', 'sitting on stools'],
  tee: ['on a tee box', 'on tee boxes'],
  flag: ['at a flag', 'at flags'],
  bunker: ['in a sand bunker', 'in sand bunkers'],
  cart: ['in a golf cart', 'in golf carts'],
  shallows: ['in the shallows', 'in the shallows'],
  car: ['in a car', 'in cars'],
  boat: ['in a boat', 'in boats'],
  bathtub: ['in a bathtub', 'in bathtubs'],
};
export function onPhrase(type, plural = false) {
  const e = ON_PHRASE[type];
  if (e) return e[plural ? 1 : 0];
  const label = objectLabel(type);
  return plural ? `on ${label}s` : `on ${objPhrase(type)}`;
}
function notOnPhrase(type) {
  return `not ${onPhrase(type)}`;
}

const areaWord = (puzzle) => (puzzle.outdoor ? 'area' : 'room');
// Noun for numbered rooms ("hole"); puzzle.roomNoun, else the generic area word.
const numberedWord = (puzzle) => puzzle.roomNoun || areaWord(puzzle);

function rowsPhrase(indices, size) {
  const [a, b] = [...indices].sort((x, y) => x - y);
  if (a === 0 && b === 1) return '**top two rows**';
  if (a === size - 2 && b === size - 1) return '**bottom two rows**';
  return `**${rowWord(a, size)} or ${rowWord(b, size)} row**`;
}

function colsPhrase(indices, size) {
  const [a, b] = [...indices].sort((x, y) => x - y);
  if (a === 0 && b === 1) return '**first two columns**';
  if (a === size - 2 && b === size - 1) return '**last two columns**';
  return `**${ordinal(a, size)} or ${ordinal(b, size)} column**`;
}

function dirPhrase(clue) {
  if (clue.dist != null) {
    const unit = clue.dir === 'north' || clue.dir === 'south' ? 'row' : 'column';
    return `exactly ${numberWord(clue.dist)} ${unit}${clue.dist === 1 ? '' : 's'} ${clue.dir} of`;
  }
  return `${clue.dir} of`;
}

const possessiveOf = (character) => (character ? (character.gender === 'f' ? 'her' : 'his') : null);

// Predicate part of a clue, e.g. "was **south of** **Clara**" (no subject, no period).
// `character` (optional) lets corner clues say "her room".
export function clueBody(clue, puzzle, character) {
  switch (clue.type) {
    case 'inRoom': return `was in ${theRoom(puzzle, clue.room)}`;
    case 'notInRoom': return `was **not** in ${theRoom(puzzle, clue.room)}`;
    case 'onObject': return `was **${onPhrase(clue.object)}**`;
    case 'notOnObject': return `was **${notOnPhrase(clue.object)}**`;
    case 'onObjectInRoom': return `was **${onPhrase(clue.object)}** in ${theRoom(puzzle, clue.room)}`;
    case 'besideObject': return `was **beside** ${besideNoun(clue.object)}`;
    case 'notBesideObject': return `was **not beside** ${besideNoun(clue.object)}`;
    case 'besidePerson': return `was **beside** **${charName(puzzle, clue.who)}**`;
    case 'sameRoom': return `was in the **same ${areaWord(puzzle)} as** **${charName(puzzle, clue.who)}**`;
    case 'row': return `was in the **${rowWord(clue.index, puzzle.size)} row**`;
    case 'column': return `was in the **${ordinal(clue.index, puzzle.size)} column**`;
    case 'rowOneOf': return `was in the ${rowsPhrase(clue.indices, puzzle.size)}`;
    case 'columnOneOf': return `was in the ${colsPhrase(clue.indices, puzzle.size)}`;
    case 'dir': {
      const base = `was **${dirPhrase(clue)}** **${charName(puzzle, clue.of)}**`;
      return clue.otherRoom ? `${base}, in a different ${areaWord(puzzle)}` : base;
    }
    case 'rowOffset': {
      const dir = clue.delta < 0 ? 'north' : 'south';
      return `was **${dirPhrase({ dir, dist: Math.abs(clue.delta) })}** **${charName(puzzle, clue.of)}**`;
    }
    case 'roomNumberCompare':
      return `was in a **${clue.cmp === 'higher' ? 'higher' : 'lower'}-numbered ${numberedWord(puzzle)}** than **${charName(puzzle, clue.of)}**`;
    case 'diagonal': return `was on a **diagonal with** **${charName(puzzle, clue.with)}**`;
    case 'alone': return 'was **alone**';
    case 'aloneInRoom': return (roomNumber(puzzle, clue.room) != null ? `was **alone in** ${theRoom(puzzle, clue.room)}` : `was **alone in the** **${roomName(puzzle, clue.room)}**`);
    case 'aloneWith': return `was **alone with** **${charName(puzzle, clue.who)}**`;
    case 'aloneWithGender': return `was **alone with ${clue.gender === 'f' ? 'a woman' : 'a man'}**`;
    case 'withSomeoneBeside': return `was **with someone who was beside ${MASS_NOUNS.has(clue.object) ? `the ${objectLabel(clue.object)}` : objPhrase(clue.object)}**`;
    case 'corner': {
      const poss = possessiveOf(character);
      return poss ? `was in a **corner** of ${poss} ${areaWord(puzzle)}` : `was in a **corner** of ${article(areaWord(puzzle))} ${areaWord(puzzle)}`;
    }
    case 'victim': return 'was the **Victim**';
  }
  throw new Error(`Unknown clue type: ${clue.type}`);
}

export function pronoun(character) {
  return character?.gender === 'f' ? 'She' : 'He';
}

export function clueText(clue, character, puzzle) {
  if (clue.type === 'victim') return `The **Victim**. ${pronoun(character)} was alone with the murderer.`;
  return `${pronoun(character)} ${clueBody(clue, puzzle, character)}.`;
}

export function noteText(note, puzzle) {
  switch (note.type) {
    case 'countOnObject': {
      if (note.count === 0) return `Nobody was **${onPhrase(note.object)}**.`;
      if (note.count === 1) return `There was **exactly one** person **${onPhrase(note.object)}**.`;
      return `There were **exactly ${numberWord(note.count)}** people **${onPhrase(note.object, true)}**.`;
    }
    case 'noEmptyRoom': return `There was **no empty ${areaWord(puzzle)}**.`;
    case 'emptyRooms': {
      const w = areaWord(puzzle);
      if (note.count === 1) return `There was **exactly one empty ${w}**.`;
      return `There were **exactly ${numberWord(note.count)} empty ${w}s**.`;
    }
    case 'roomParity': {
      const w = numberedWord(puzzle);
      return `Every **even-numbered** ${w} held an **even** number of people (zero counts), and every **odd-numbered** ${w} an **odd** number.`;
    }
    case 'roomGenders': return `There was **a man and a woman** in ${theRoom(puzzle, note.room)}.`;
  }
  throw new Error(`Unknown note type: ${note.type}`);
}
