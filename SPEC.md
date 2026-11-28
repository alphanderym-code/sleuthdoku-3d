# Tiny Crimes — Technical Spec (source of truth)

An original 3D murder-mystery logic puzzle game. Original name, characters, scenes, puzzles and art.
Rules are a classic grid-deduction genre: place every character on a grid using clues; find the murderer.

## Game rules
- Grid is N×N (N = 5..9; **Extreme** mode is N = 16, see below). There are exactly N characters: N-1 suspects + 1 victim.
- Exactly **one character per row and one per column**.
- The grid is split into **rooms** (contiguous irregular regions with names).
- Cells can hold **objects**. *Blocking* objects (tree, table…) cannot be occupied. *Occupiable* objects (chair, rug…) can.
- Each character has 1..3 **clue cards**. All clues are true in the solution.
- **Victim rule (global):** the victim's room contains exactly 2 people: the victim and the murderer. That other person is the murderer.
- Every puzzle has exactly **one** solution.

### Clue vocabulary (definitions)
- **beside**: orthogonally adjacent (up/down/left/right) AND in the same room.
- **alone**: nobody else in the character's room (not even the victim).
- **corner**: a cell where two walls of its room meet — i.e. it has a room boundary (other room or grid edge) on two perpendicular sides (N+W, N+E, S+W or S+E).
- **north of X**: in any row strictly above X's row (smaller r). south = larger r. **west of X**: any column strictly left (smaller c). east = larger c.
- **diagonal with X**: on the same diagonal or anti-diagonal as X (|dr| == |dc|, not the same cell).
- **row k / column k**: 0-based internally. Text: "first", "second", "third", …, and "last" for N-1.

## Genre conventions (v2, from studying 10 reference puzzles, very easy → expert)
These are REQUIRED for every generated or hand-made case.
1. **The victim is never referenced by any clue.** No `besidePerson/sameRoom/dir/diagonal/aloneWith/...` may target the victim,
   and the victim has no clue except `victim`. The victim card reads: "The **Victim**. He/She was alone with the murderer."
   The player must deduce where the victim is (usually the last free square) and who shares the room.
2. Clues never directly reveal the murderer (no clue may mention "victim" or "murderer" except the victim card).
3. **Naming:** suspects' names start with consecutive letters A, B, C, D… in card order; the victim's name starts with **V** and is
   the last card. Letter ids are therefore `A, B, C, …, V`.
4. **Few clues:** very-easy/easy: exactly 1 clue per suspect (a single sentence, sometimes a compound like "alone in the Kitchen"
   or "sitting in a chair in the Dining Room"). medium: 1, sometimes 2. hard: 1–2. Global **case notes** fill the gap.
5. **Case notes** (puzzle-wide facts shown above the cards), `puzzle.notes: [noteObj]`:
   - `{ type: 'countOnObject', object, count }` → "There was exactly one person sitting in a chair." / "…on a bed."
   - `{ type: 'noEmptyRoom' }` → "There was no empty room."
   - `{ type: 'emptyRooms', count }` → "There were exactly two empty rooms."
   - `{ type: 'roomGenders', room }` → "There was a man and a woman in the Altar." (exactly 2 people, one m and one f)
   - `{ type: 'roomParity' }` → "Every even-numbered hole held an even number of people (zero counts), and every odd-numbered hole an odd number."
     Applies to every room with `roomInfo[k].number` (golf holes); the solver enforces it.
   - `{ type: 'wound', wound }` and `{ type: 'witness', room }`: see 6b below.
6. **Hints** read like a tutor, using chess-style coordinates (column letter a-p + row number, row 1 = top/north row; `cellName(r,c)`, e.g. `c2` = column c, row 2): "There's only one square beside the boulder for (D):
   d5." / "This isolates (C) in the last free square of column 5: e3." Last hint: "(V) was alone with (B): **Basil** is the murderer!"
7. Phrasing: rows "top row" / "bottom row" / "third row"; columns "first column" / "last column" / "fifth column".
   Occupiable objects read naturally: "sitting in a chair", "on a bed", "on a sofa", "on a rug", "on a bench", "on a beach towel".
   For outdoor scenes say "area" instead of "room" in corner clues ("in a corner of her area").

6b. **Weapon / witness notes** (v3; both only ever mention the victim indirectly, never the word "victim"):
   - Every suspect carries one weapon (`character.weapon`, key of `js/model/weapons.js`: knife, letteropener, shears, pistol, crossbow, rope, scarf,
     candlestick, wrench, hammer, golfclub, shovel, poison, syringe; picked by scene flavor, golf club only on the golf course). The victim has none.
     Each weapon causes one wound (stabbed, shot, strangled, bludgeoned, poisoned); several suspects share a wound. The HUD card shows emoji + label.
   - `{ type: 'wound', wound }` -> "Cause of death: **stabbing**." (also "a gunshot", "strangulation", "blunt force", "poison").
     Semantics: the murderer (the one non-victim in the victim's room) carries a weapon with that wound. So any suspect whose weapon does not match
     can never share the victim's room. The solver treats it as: no mismatching suspect may be placed in the victim's room.
   - `{ type: 'witness', room }` -> "A scream was heard from the **Garden**." Semantics: the victim's room IS the named room, or SHARES A BORDER with it
     (some cell of one is orthogonally adjacent to some cell of the other). `roomAdjacency(puzzle)` / `inWitnessZone` in clues.js. The solver also
     restricts the victim's domain to the zone.
   - A "weapon found in room X" note is NOT implemented (it would only duplicate `witness`).

### Clue types added in v2
| type | fields | text |
|---|---|---|
| `aloneWith` | `who` | "She was **alone with** **Gannon**." (exactly these two in the room; `who` is never the victim) |
| `aloneInRoom` | `room` | "He was **alone in the** **Lifeguard Tower**." |
| `onObjectInRoom` | `object`, `room` | "He was **sitting in a chair** in the **Dining Room**." |
| `notOnObject` | `object` | "He was **not on a rug**." |
| `dir` + `dist` | `dir`, `of`, `dist` (optional exact number of rows/cols) | "He was **exactly one row north of** **Ivan**." |
| `dir` diagonal dirs | `dir` ∈ `northeast|northwest|southeast|southwest` | "He was **northeast of** **Crystal**." (both strictly) |
| `dir` + `otherRoom` | `otherRoom: true` | "She was **south of** **Hazel**, in a different room." |
| `columnOneOf` / `rowOneOf` | `indices: [a,b]` | "He was in the **first or second column**." |
| `withSomeoneBeside` | `object` | "She was **with someone who was beside a tree**." (shares room with ≥1 other person who is beside one) |
| `aloneWithGender` | `gender` | "She was **alone with a man**." (exactly 2 in room, the other has that gender; the other MAY be the victim) |
| `rowOffset` | `of`, `delta` (owner row − other row; < 0 = north, > 0 = south) | "She was **exactly two rows north of** **Adaeze**." (generated at N ≥ 12) |
| `roomNumberCompare` | `of`, `cmp` ∈ `higher|lower` | "He was in a **higher-numbered hole** than **Naveen**." Needs numbered rooms (`roomInfo[k].number`); false when either room is unnumbered. Noun comes from `puzzle.roomNoun` (default "room"/"area"). |
| `besideCategory` | `category`, `v` (phrasing index) | "**Hugo** always stands beside **plants**." / "loves being beside", "cannot resist standing beside". Personality clue: the cell is orthogonally adjacent AND in the same room as ANY object whose type is in the category (same rule as `besideObject`). Categories (`js/model/categories.js`): food (oven, counter, table, register, campfire, barrel), plants (plant, flowers, tree, bush, haybale), water (water, shallows, bathtub, boat), screens (tv, arcade), animals (bear, lion, elephant, penguin, croc, shark). Text starts with the suspect's name (not a pronoun). |
| `notBesideCategory` | `category`, `v` | "**Gary** never stands beside **food**." / "can't stand being beside", "keeps well away from", plus "is allergic to" (plants, animals), "is afraid of" (animals, water). Negation of `besideCategory`. |
| `sees` | `who` | "She could **see** **Bruno**." Line of sight. Characters never share a row or column, so it is DIAGONAL: abs(dr) == abs(dc) > 0, WALLS BLOCK (every cell on the line, both ends included, lies in the same room), and no blocking object on a cell strictly between them. Occupiable objects (chairs, rugs...) do not block. Symmetric. `lineOfSight()` in clues.js; the solver prunes with room + diagonal masks (arc pruning). Negative "could not see anyone" is not implemented. **No longer generated** (players found it unclear); still evaluated so older puzzles load. |

## Extreme mode (16×16)
- `difficulty: 'extreme'` (HUD: "Extreme (16×16)"; the size select is ignored) → N = 16: 15 suspects + the victim (initials A–O, V).
  1–2 clues per suspect plus 0–3 case notes. Scenes with `extreme: true` (`golf`, `zoo`, `park`, `cruise`, `ski`, `airport`) are used; every one of them is eligible at any size >= 10; other scenes are
  still available at any size via `scene:`; extreme scenes carry `minSize: 10`, so random picks at smaller sizes skip them.
- Scene metadata (content.js `scene(key,title,outdoor,rooms,meta)`): `roomCount: [lo,hi]` (rooms at N ≥ 10), `numbered` (rooms flagged
  `numbered:true` become "Hole n"; numbers are dealt **after** the solution is placed so that each hole's head count has the parity
  of its number), `noun`, `parity` (adds the always-on `roomParity` case note).
- Generation: strong start (room clue + row/column clue per suspect, always unique and fast to verify), then clues are
  weakened one at a time (drop the second clue / swap for a weaker true clue) while the solver still proves uniqueness
  (`nodeLimit` 8000), for ~0.9 s. Typical generation 0.7–1.5 s, worst seen < 2 s. No logic-profile (hint replay) at 16×16.
- **New object types** (js/model/objects.js, `OBJECT_TYPES`):
  - occupiable: `tee` (tee box), `flag` (pin on the green), `bunker` (sand pit), `cart` (golf cart), `shallows` (occupiable water: "in the shallows").
    The existing `water` type is unchanged (blocking; old scenes).
  - blocking animals, one type per species so clues can say "beside a bear": `bear`, `lion`, `elephant`, `penguin`, `croc` (label "crocodile"), `shark`.
  - Clue phrases: tee "on a tee box", flag "at a flag", bunker "in a sand bunker", cart "in a golf cart", shallows "in the shallows".
- **Scenes**: `golf` ("Fore! Foul Play at Birdie Hollow"): 9 hole recipes (named "Hole A".."Hole I" internally; `roomInfo[k].recipe`
  keeps that name) + Clubhouse; fairway/green/grass floors with tee, flag, bunkers, water, trees, carts. `zoo`
  ("Mischief at Marigold Zoo"): Bear Den, Lion Savanna, Elephant Yard, Penguin Cove, Crocodile Swamp, Shark Tank, Main Plaza,
  Entrance, Viewing Deck, Concessions.
- **More large-board scenes** (all `extreme: true, minSize: 10, roomCount: [9, 10]`; generated at 10-16 in ~1.0-1.9 s):
  `park` ("Foul Play on the Giggle Gardens Midway", outdoor): Carousel Court, Ferris Wheel Plaza, Funnel Cake Row, Bumper Car Arena,
  Haunted Mansion Ride, Log Flume Lagoon, Midway Games, Main Gate, Picnic Lawn, Prize Pavilion. `cruise` ("Man Overboard on the S.S.
  Marmalade", outdoor): Sun Deck, Pool Deck, Captain's Bridge, Galley, Grand Dining Salon, Royal Suite, Engine Room, Lifeboat Station,
  Casino Lounge, Gangway Dock, Bunk Cabin. `ski` ("Avalanche of Alibis at Mount Fondue", outdoor): Bunny Slope, Summit Run, Lift Station,
  Grand Lodge, Apres-Ski Bar, Alpine Cabin, Ski Rental Shop, Snowman Meadow, First-Aid Hut, Fondue Hut. `airport` ("Last Call for Murder
  at Cloudport", indoor, numbered `noun: 'gate'`, no parity note): Gates A-F (become "Gate n") + Check-In Hall, Duty-Free Shop, Food Court,
  Baggage Claim, VIP Lounge (roomNumberCompare clues appear here).
  - New occupiable types: `carhorse` (carousel horse), `ferriscab` (ferris wheel cabin), `deckchair`, `liftchair` (ski lift chair).
    New blocking types: `foodstall` (category food), `lifebuoy`, `snowman`, `luggage` (luggage cart). Models in `js/render/models/extra2.js`
    (merged into extra.js); fronted: foodstall, deckchair, liftchair, carhorse.
  - New scene-only weapons: `mallet` (park, bludgeoned), `flaregun` (cruise, shot), `skipole` (ski, stabbed).
- Rendering: `js/render/models/extra.js` (`buildExtra`, `EXTRA_STAND`); the camera fit (`_computeFit`) is size-generic (board half-width N/2).

## Coordinates
- `r` = row, 0 = north (top / far side of the board). `c` = column, 0 = west (left).
- Cell key string: `"r,c"`, e.g. `"2,3"`.
- 3D world: cell size 1. `x = c - (N-1)/2`, `z = r - (N-1)/2`, `y` up. Board top surface at y = 0.

## Puzzle data format (plain JSON-able object)
```js
{
  id: 'midnight-bakery',            // unique string
  title: 'The Midnight Bakery',
  difficulty: 'very-easy' | 'easy' | 'medium' | 'hard' | 'extreme',
  size: 5,
  rooms: ['KKKSS','KKKSS','KOOOS','FFOOS','FFOOO'],   // N strings of N chars, one char = room key
  roomInfo: { K: { name: 'Kitchen', floor: 'tile' }, ... },  // floor ∈ FLOOR_TYPES; optional number (golf holes: { name: 'Hole 3', number: 3 })
  roomNoun: 'hole',                 // optional: noun for numbered rooms in clue / note text
  notes: [ { type: 'roomParity' } ],  // optional case notes
  objects: [ { type: 'oven', r: 0, c: 0, facing: 's' }, ... ],  // type ∈ keys of OBJECT_TYPES (js/model/objects.js);
                                                               // optional facing 'n'|'e'|'s'|'w' (n = row r-1, e = col c+1) for objects with a front
                                                               // (see js/model/facing.js; filled by the generator / assignFacing at load for curated cases)
  characters: [
    { id: 'A', name: 'Ada', gender: 'f', victim: false,
      look: { skin: '#f1c27d', hair: '#3b2a1a', outfit: '#4f86c6', hairStyle: 'bun', accessory: 'glasses' },
      clues: [ { type: 'inRoom', room: 'K' }, ... ] },
    ...
  ],
  solution: { A: { r: 0, c: 1 }, ... },   // optional in authored data; solver can fill it
  murderer: 'B'                           // optional; derivable from solution
}
```
- `id` of a character is ONE uppercase letter = first letter of its name, unique within the puzzle.
- Exactly one character has `victim: true`.
- Optional `weapon` (suspects only): key of `js/model/weapons.js`; used by the `wound` note.
- `hairStyle` ∈ `short | long | bun | bald | curly | ponytail | spiky`; `accessory` ∈ `null | hat | glasses | beard | mustache | bowtie | scarf`.
- FLOOR_TYPES: `wood | tile | grass | sand | stone | carpet | snow | checker | water | brick | dirt | fairway | green` (fairway/green = mown golf turf).

### Clue objects
| type | fields | meaning / text example |
|---|---|---|
| `victim` | – | "The **victim**." (shown on the victim's card; the alone-with-murderer rule is global) |
| `inRoom` | `room` | "was in the **Kitchen**." |
| `notInRoom` | `room` | "was **not** in the **Kitchen**." |
| `onObject` | `object` | "was on a **chair**." (cell holds that occupiable object) |
| `besideObject` | `object` | "was **beside** a **tree**." (any instance, same room) |
| `notBesideObject` | `object` | "was **not beside** a **tree**." |
| `besidePerson` | `who` | "was **beside** **Ada**." |
| `sameRoom` | `who` | "was in the **same room as** **Ada**." |
| `row` | `index` | "was in the **first row**." |
| `column` | `index` | "was in the **last column**." |
| `dir` | `dir` (`north|south|east|west`), `of` | "was **south of** **Clara**." |
| `diagonal` | `with` | "was on a **diagonal with** **Ada**." |
| `alone` | – | "was **alone**." |
| `corner` | – | "was in a **corner** of a room." |

Clue text is returned as a string using `**bold**` markers (HUD converts to `<b>`). Subject pronoun is implicit:
the card shows the name, the text starts with "He/She was …" based on gender.

## File layout & ownership
```
index.html            UI agent   (importmap for three@0.170.0 from cdn.jsdelivr.net)
css/style.css         UI agent
js/main.js            UI agent   (wires everything)
js/game/state.js      UI agent
js/ui/hud.js          UI agent
js/model/objects.js   orchestrator (shared, do not change signatures)
js/model/rng.js       orchestrator (shared)
js/model/grid.js      model agent  (geometry helpers: roomAt, neighbors, isCorner, occupiable …)
js/model/clues.js     model agent  (evaluate + text)
js/model/solver.js    model agent
js/model/hints.js     model agent
js/model/generator.js generator agent (phase 2)
js/puzzles/sample.js  orchestrator (dev sample; model agent may fix clues for uniqueness)
js/puzzles/cases.js   generator agent (phase 2: hand-made cases)
js/data/content.js    content agent (names, looks, scenes)
js/audio/sfx.js       content agent
js/render/scene.js    render agent (BoardView)
js/render/{layout,textures,boardkit}.js   board measurements, canvas textures, floors + walls + kerb
js/render/{moods,softshade,post,world}.js  lighting moods, soft shading, post-processing, world around the board
js/render/models.js   render agent (procedural soft toy models in models/; kit.js = materials + geometry helpers)
tests/*.mjs           model/generator agents (run with `node tests/x.mjs`)
```
All model code (`js/model/*`, `js/data/*`, `js/puzzles/*`) must be pure ES modules: no DOM, no three.js — runnable in Node.

## Module APIs (contracts)

### js/model/grid.js
```js
export function roomAt(puzzle, r, c)            // room key
export function objectAt(puzzle, r, c)          // object or null
export function isOccupiable(puzzle, r, c)      // false if blocking object
export function isBeside(puzzle, a, b)          // a,b = {r,c}; orth adjacent + same room
export function isCorner(puzzle, r, c)
export function roomCells(puzzle, roomKey)      // [{r,c}]
export function roomKeys(puzzle)                // ['K','S',...] in first-seen order
```
### js/model/clues.js
```js
export function evaluateClue(clue, charId, positions, puzzle) // positions: {id:{r,c}} (may be partial)
  // returns true | false | null (null = undetermined because a referenced character is unplaced)
export function clueText(clue, character, puzzle)  // "He was **south of** **Clara**."
export function isUnaryClue(clue)               // depends only on own position
```
### js/model/solver.js
```js
export function solve(puzzle, { limit = 2, fixed = {} } = {})  // -> { count, solutions: [ {id:{r,c}} ] }
export function isUnique(puzzle)                                // count === 1
export function checkSolution(puzzle, positions)                // -> { complete, correct, wrongIds: [] }
export function murdererOf(puzzle, positions)                   // id
export function withSolution(puzzle)                            // returns copy with solution + murderer filled
```
Must solve a 9×9 in < 200 ms (backtracking with unary-domain filtering + row/col/forward checks).
16×16 extreme puzzles (1–2 clues each) verify uniqueness in roughly 5–150 ms (measured; generator nodeLimit 8000–20000).
Search: MRV + forward checking, then exact-cover branching on the most constrained of {character, free row, free column};
arc pruning (row/column bounds and masks, room masks) for relative clues between unplaced characters (`dir`, `rowOffset`,
`sameRoom`, `roomNumberCompare`); parity pruning (rooms with the wrong head-count parity need distinct reachable people
via bipartite matching, forced single reachers, leftover-parity check) for the `roomParity` note.

### js/model/hints.js
```js
export function getHint(puzzle, placements)
// placements: {id:{r,c}} as currently placed by the player
// -> { kind: 'wrong', charId, message }                      // a placed char is not in the solution cell
//  | { kind: 'deduce', charId, cell:{r,c}, message }         // a forced placement, with a reason
//  | { kind: 'narrow', charId, cells:[{r,c}], message }      // candidate cells for someone
//  | { kind: 'done', message }
```

### js/model/generator.js (phase 2)
```js
export function generatePuzzle({ size = 6, difficulty = 'easy', seed = Date.now(), scene = null, budgetMs = 1400 } = {}) // -> puzzle (unique)
// difficulty 'extreme' forces size 16 and picks golf or zoo (scenes with extreme:true); budgetMs is the weakening time budget.
```
Furnishing (`buildLayout`): rooms of the scene are matched to partition regions (big:1 recipes get large regions),
then each room is furnished from its own recipe: budget = size*U(fill) cells (rooms <= 4 cells: <= 2 objects; at most
one room left empty, never a bare Kitchen/Bedroom). Wall-only types (shelf, wardrobe, tv, bed, counter, oven, fireplace,
piano, desk, register, arcade, heater) stand only on cells touching a room boundary (beds prefer corners, <= 1 per room);
chairs/stools are always orthogonally adjacent to a table/desk/counter(/piano). Blocking objects keep >= 2 free cells per
row/column and per room. After the solution is chosen, occupiable objects the room's recipe allows are added on solution
cells so object clues exist (`addOccupiableAt`).
Clustering: no more than 2 objects of one type orthogonally connected, and at most max(2, ceil(35% of room)) of one type per room;
exempt: water, flower beds, hay bales, trees, bushes, rugs, boats. Facing (`js/model/facing.js`, `assignFacing`): objects with a front
(fireplace, oven, tv, piano, desk, shelf, wardrobe, arcade, register, counter, heater, chair, sofa, bed, bench, tractor, car) never face a
room wall / board edge if any side is open, prefer back to a wall; chairs face an adjacent table/desk/counter; sofas face a tv/fireplace in the
room, else another sofa, else the room centre; benches face a nearby feature or the centre. The renderer rotates models (front = +z).
Water: a recipe with `flood: 'water'` (Lake, Pond; floor `water`) places its boats (occupiable) first, then, after all other
rooms, `floodRoom` fills the remaining free cells with blocking `water`, keeping >= 2 free cells per row/column and ~30% of the
room free; a cell that cannot be flooded gets a boat. Water is exempt from the room density cap and per-type tallies. Boats
exist only in flood rooms. `always: true` recipes (Lake, Dock, Pond) are never dropped from the region matching.
Scenes (14): lighthouse, chalet, museum, bakery, campsite, greenhouse, jazzclub, boardwalk, library, station, plus
homestead (prepper house + yard/driveway, safe room), apartment (city flat), lake (outdoor) and farm (outdoor, pond).
Clue phrasing: "beside the water" (mass noun), "in a boat", "in a car", "in a bathtub", "beside a hay bale".

### js/data/content.js
```js
export const NAME_POOL     // [{ name, gender }] ≥ 60 names, ≥ 1 per letter A–Z where possible
export const SKIN_TONES, HAIR_COLORS, OUTFIT_COLORS, HAIR_STYLES, ACCESSORIES
export const SCENES        // [{ key, title, outdoor, rooms: [Recipe], blocking, occupiable }]  (blocking/occupiable = derived unions)
// Recipe (per room, never scene-wide): { name, floor, fill: [lo, hi], big?: 1|-1, open?: true,
//   always?: true, flood?: 'water',
//   items: [{ t, w, min, max, wall?, corner?, size?: [a,b], seat?: [type,[a,b]], extra?: type }] }
// fill = share of room cells holding objects; items = the ONLY types allowed in that room, with weight,
// min/max count, optional wall-only/corner flag, contiguous patch size (tables, counters, rugs, benches),
// seats adjacent to it (chairs at table/desk, stools at counter/piano, benches around campfire) and an
// extra wall piece (register by a counter). big: prefers a large region (-1 small). open: may stay empty.
export function randomLook(rng, gender)   // -> look object
export function pickCast(rng, n)          // -> n {name, gender} with distinct initials
```
### js/audio/sfx.js
```js
export const sfx = { select(), note(), place(), remove(), mark(), undo(), error(), hint(), win(), click(), hover(),
                     setMuted(bool), get muted() }
// WebAudio synth only (no files). Lazily creates/resumes AudioContext on first call. Never throws.
```

### js/render/scene.js
```js
export class BoardView {
  constructor(containerEl)                   // creates renderer, camera, lights, OrbitControls, resize handling
  loadPuzzle(puzzle)                         // builds board, floors, walls, labels, objects, tokens (hidden)
  setState(view)                             // full sync; diff internally to animate
    // view = { placements:{id:{r,c}}, notes:{'r,c':[ids]}, marks:['r,c'], autoMarks:['r,c'],
    //          selected: id|null, hover: {r,c}|null }
  highlightCells(cells, color = '#ffd84d', ms = 2000)
  playWrong(ids)                             // shake + red flash those tokens
  playWin({ victimId, murdererId })          // victim topples, murderer spotlight + bounce, confetti
  on(event, cb)  // 'cellTap' {r,c} | 'cellHold' {r,c} (after 350 ms, emits once) | 'cellPaint' {r,c} (drag onto a new cell while pressed)
                 // | 'cellHover' {r,c}|null | 'tokenTap' {id}
  resetCamera()
  static portrait(character, size = 160)     // -> dataURL PNG of the figurine head/torso (offscreen render)
  dispose()
}
```
Input: LEFT mouse / ONE finger = gameplay (tap / hold / paint). RIGHT mouse or TWO fingers = rotate; wheel/pinch = zoom.
Camera: tilted ~60° from horizontal looking at board, limited orbit (azimuth ±35°, polar 20°–65°), zoom clamped.

## Visual style
Sunny vinyl-toy diorama; the full direction is in `dev/ART_GUIDE.md`. Chunky rounded models in soft matte materials
(MeshStandardMaterial patched by `render/softshade.js`), no outlines and no toon steps, painted CanvasTexture floors, low
rounded walls, a pale kerb around the board, room names on small plaques. The board sits in a themed world
(`render/world.js`: town, park, farm, forest, coast, sea, snow, airport). Three moods (`render/moods.js`): day, golden,
night; each scene has a default and the player can switch (button or key L). Post-processing (`render/post.js`): ambient
occlusion, bloom, tone mapping and grading, with quality levels 3..0 that adapt to the frame rate (`?gfx=0..3` locks one).
Figurines: round-bodied people with big heads (outfit, skin, hair by style, accessory) and a base disc showing the letter.
Victim figurine has a pale tint. Placement = hop + squash/stretch; removal = pop.
Notes = small floating letter chips on a cell; X marks = red painted X decal; auto marks = faint grey X.

## Controls / UX
- Click a suspect card (or token) → select.
- Tool **Note** (default): tap cell → toggle pencil note for selected char; drag paints notes.
- **Press & hold** a cell (350 ms, with fill ring) → place selected char (moves it if already placed). Hold on the char's own cell → remove.
- Tool **X**: tap toggles X mark. Tool **Eraser**: tap clears the cell (note/mark/token). Hold eraser button → clear all.
- **Undo** (Ctrl+Z too). Auto-X: placing someone greys out their row and column.
- **Hint** button → getHint(). **Submit** enabled when all placed → checkSolution → win or show wrong ones.
- Progress saved to localStorage per puzzle id (try/catch). Timer.
