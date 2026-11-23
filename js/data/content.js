// Content data for Tiny Crimes. Pure ES module (Node/browser safe).

const M = 'm', F = 'f';
const n = (name, gender) => ({ name, gender });

export const NAME_POOL = [
  n('Alice', F), n('Amir', M), n('Anya', F), n('Akira', M), n('Adaeze', F), n('Aldo', M), n('Astrid', F), n('Arjun', M), n('Aisha', F),
  n('Ben', M), n('Beatrix', F), n('Boris', M), n('Bao', M), n('Bianca', F), n('Bruno', M), n('Binta', F), n('Bjorn', M),
  n('Carla', F), n('Chen', M), n('Cyrus', M), n('Cora', F), n('Callum', M), n('Chiara', F), n('Cemal', M), n('Cleo', F),
  n('Daria', F), n('Dev', M), n('Dmitri', M), n('Dalia', F), n('Dino', M), n('Delphine', F), n('Dong', M), n('Dilnoza', F),
  n('Elena', F), n('Emeka', M), n('Eva', F), n('Esteban', M), n('Eun', F), n('Eero', M), n('Ebony', F), n('Eitan', M),
  n('Fatima', F), n('Felix', M), n('Fiona', F), n('Farid', M), n('Freya', F), n('Fabio', M), n('Fumiko', F),
  n('Gina', F), n('Gustavo', M), n('Greta', F), n('Gael', M), n('Gulnara', F), n('Goran', M), n('Gabriela', F), n('Giorgos', M),
  n('Hana', F), n('Hugo', M), n('Hassan', M), n('Hiro', M), n('Helga', F), n('Hamid', M), n('Hye', F), n('Henrik', M), n('Halima', F),
  n('Ingrid', F), n('Ivan', M), n('Isla', F), n('Idris', M), n('Ilse', F), n('Ichiro', M), n('Imani', F), n('Ines', F),
  n('Jamal', M), n('Julia', F), n('Jin', M), n('Joaquin', M), n('Jelena', F), n('Jomo', M), n('Johanna', F), n('Jasper', M),
  n('Kofi', M), n('Katya', F), n('Kenji', M), n('Karim', M), n('Kalinda', F), n('Kwame', M), n('Keiko', F), n('Kasper', M), n('Kirsten', F),
  n('Lucia', F), n('Liam', M), n('Leila', F), n('Lars', M), n('Lakshmi', F), n('Lorenzo', M), n('Lindiwe', F), n('Luka', M),
  n('Mateo', M), n('Mei', F), n('Maya', F), n('Malik', M), n('Marguerite', F), n('Mikko', M), n('Mirela', F), n('Musa', M), n('Magnus', M),
  n('Nadia', F), n('Noah', M), n('Nikos', M), n('Nell', F), n('Naveen', M), n('Nuria', F), n('Niamh', F), n('Nils', M), n('Nkechi', F), n('Nasser', M),
  n('Olga', F), n('Omar', M), n('Olivia', F), n('Osei', M), n('Odalys', F), n('Orsolya', F), n('Oskar', M), n('Ottavio', M), n('Oren', M),
  n('Priya', F), n('Pablo', M), n('Petra', F), n('Pavel', M), n('Paloma', F), n('Pierre', M), n('Phong', M), n('Penelope', F), n('Pilar', F),
  n('Quentin', M), n('Qiana', F), n('Quincy', M), n('Qadir', M), n('Quynh', F),
  n('Rosa', F), n('Raj', M), n('Rafael', M), n('Rania', F), n('Ruth', F), n('Reza', M), n('Renata', F), n('Ronan', M), n('Rahul', M),
  n('Sofia', F), n('Sven', M), n('Saki', F), n('Soren', M), n('Samira', F), n('Salim', M), n('Seren', F), n('Simone', F), n('Stellan', M), n('Sunita', F),
  n('Tariq', M), n('Tanya', F), n('Theo', M), n('Tomas', M), n('Tamsin', F), n('Tendai', M), n('Thandi', F), n('Takumi', M), n('Tove', F),
  n('Uma', F), n('Ulrich', M), n('Udo', M), n('Ursula', F), n('Umberto', M), n('Uzma', F), n('Ugo', M),
  n('Valeria', F), n('Viktor', M), n('Vera', F), n('Violet', F), n('Vincent', M), n('Vivian', F), n('Vlad', M), n('Vasco', M), n('Vanessa', F), n('Vesna', F), n('Vidar', M), n('Vito', M),
  n('Wanda', F), n('Wei', M), n('Willem', M), n('Waleed', M), n('Wendell', M), n('Winona', F), n('Wojtek', M),
  n('Xavier', M), n('Ximena', F), n('Xiomara', F), n('Xin', F), n('Xolani', M), n('Xander', M),
  n('Yuki', F), n('Yusuf', M), n('Yara', F), n('Yannick', M), n('Yelena', F), n('Yaw', M), n('Yasmin', F), n('Yves', M),
  n('Zoe', F), n('Zane', M), n('Zara', F), n('Zainab', F), n('Zeno', M), n('Zsofia', F), n('Zuri', F), n('Zubin', M),
];

export const SKIN_TONES = ['#ffdfc4', '#f5cba7', '#e0ac69', '#c68642', '#a0693f', '#8d5524', '#6b4226', '#f1c27d'];
export const HAIR_COLORS = ['#2b1b10', '#4a2c17', '#7a4a21', '#d9a441', '#f2d680', '#b5371f', '#111111', '#9a9a9a', '#e8e8e8', '#3fa7d6', '#c451c4'];
export const OUTFIT_COLORS = [
  '#e63946', '#f4a261', '#ffd23f', '#2ec4b6', '#3a86ff', '#8338ec',
  '#ff6fb5', '#06d6a0', '#ff7b00', '#00b4d8', '#9ef01a', '#b5179e', '#118ab2', '#ef476f',
];
export const HAIR_STYLES = ['short', 'long', 'bun', 'bald', 'curly', 'ponytail', 'spiky'];
export const ACCESSORIES = [null, 'hat', 'glasses', 'beard', 'mustache', 'bowtie', 'scarf'];

// ---------------------------------------------------------------- scenes & room furnishing recipes
//
// Every room carries its own furnishing recipe (never a scene-wide object pool):
//   room = { name, floor, fill: [lo, hi], items: [...], big?: 1|-1, open?: true }
//   fill  fraction of the room's cells that hold objects (generator caps rooms <= 4 cells at 2 objects)
//   big   1 = prefers a large region, -1 = prefers a small one (room-to-region matching bias)
//   always  never dropped when the scene has more rooms than the grid has regions (Lake, Pond)
//   flood: type  after furnishing, remaining free cells become that blocking type (water) while keeping
//                >= 2 free cells per row/column and ~30% of the room free; cells that cannot be flooded get a boat
//   open  fill lo is 0: the room may be left naturally empty (at most one empty room per puzzle)
//   item  = { t: objectType, w: weight, min: guaranteed count, max: max count in the room,
//             wall?: bool   force/forbid wall cells (cells touching the room boundary);
//                           defaults to true for wall-only types (bed, shelf, tv, counter, ...)
//             corner?: bool prefer corner-ish cells (beds),
//             size?: [a,b]  contiguous patch of the same type (tables, counters, rugs, benches),
//             seat?: [type, [a,b]]  seats placed adjacent to the item (chairs at a table, stools at a
//                           counter, benches around a campfire),
//             extra?: type  wall piece placed next to the item (register by a counter) }
const it = (t, max = 1, w = 1, o = {}) => ({ t, max, w, min: 0, ...o });
const must = (t, max = 1, w = 1, o = {}) => it(t, max, w, { min: 1, ...o });
const table = (size, seat, max = 1, w = 2, o = {}) => it('table', max, w, { size, seat: ['chair', seat], ...o });
const shop = (size, stools, o = {}) => it('counter', 1, 3, { size, extra: 'register', seat: ['stool', stools], ...o });
const rug = (w = 2, size = [2, 3]) => it('rug', 1, w, { size });
const room = (name, floor, fill, items, o = {}) => ({ name, floor, fill, items, ...o });

const OCC = new Set(['stool', 'chair', 'sofa', 'bed', 'rug', 'bench', 'towel', 'car', 'boat', 'bathtub']);

function scene(key, title, outdoor, rooms) {
  const used = new Set();
  for (const rm of rooms) for (const i of rm.items) { used.add(i.t); if (i.seat) used.add(i.seat[0]); if (i.extra) used.add(i.extra); }
  const list = [...used];
  return {
    key, title, outdoor, rooms,
    // Derived unions (informational / tests); placement uses the per-room recipes.
    blocking: list.filter((t) => !OCC.has(t)),
    occupiable: list.filter((t) => OCC.has(t)),
  };
}

export const SCENES = [
  scene('lighthouse', "The Keeper's Last Light", false, [
    room('Lantern Room', 'wood', [0.2, 0.35], [table([1, 1], [1, 1]), it('shelf', 1, 1), it('plant'), rug(1)], { big: -1 }),
    room('Kitchen', 'tile', [0.35, 0.5], [must('oven'), it('counter', 1, 3, { size: [2, 3] }), table([1, 2], [1, 2]), it('shelf')]),
    room('Study', 'carpet', [0.3, 0.5], [must('desk', 1, 1, { seat: ['chair', [1, 1]] }), it('shelf', 2, 2), it('fireplace'), rug(2), it('plant'), it('sofa', 1, 1)]),
    room('Bedroom', 'wood', [0.3, 0.5], [must('bed', 1, 1, { corner: true }), it('wardrobe', 1, 2), rug(2), it('plant'), it('fireplace', 1, 0.5)]),
    room('Cellar', 'stone', [0.25, 0.45], [it('crate', 3, 3), it('barrel', 3, 3), it('shelf', 1, 1)]),
    room('Pantry', 'checker', [0.3, 0.5], [it('shelf', 2, 4), it('barrel', 1, 2), it('crate', 1, 1)], { big: -1 }),
    room('Front Porch', 'sand', [0, 0.25], [it('bench', 1, 2, { wall: true }), it('plant', 2, 2), it('barrel'), it('flowers')], { open: true }),
  ]),
  scene('chalet', 'The Frozen Chalet', false, [
    room('Great Room', 'wood', [0.3, 0.45], [must('fireplace'), it('sofa', 2, 3), table([1, 2], [1, 3]), it('tv'), rug(2, [2, 4]), it('plant'), it('shelf')], { big: 1 }),
    room('Sauna', 'wood', [0.3, 0.45], [must('heater'), it('bench', 2, 3, { size: [1, 3], wall: true }), it('towel', 1, 1)], { big: -1 }),
    room('Boot Room', 'stone', [0.3, 0.45], [it('bench', 1, 3, { wall: true }), it('shelf', 1, 2), it('wardrobe'), it('crate', 1, 1)], { big: -1 }),
    room('Kitchen', 'tile', [0.35, 0.5], [must('oven'), it('counter', 1, 3, { size: [2, 3] }), table([1, 2], [1, 2]), it('shelf')]),
    room('Loft', 'carpet', [0.3, 0.45], [must('bed', 1, 1, { corner: true }), it('wardrobe', 1, 2), rug(2), it('shelf'), it('plant')]),
    room('Terrace', 'snow', [0, 0.25], [it('bench', 2, 3, { wall: true }), it('plant'), it('barrel')], { open: true }),
    room('Game Room', 'checker', [0.3, 0.5], [must('arcade', 1, 3, { size: [2, 3] }), table([2, 3], [0, 1], 1, 3), it('sofa', 1, 2), it('tv'), rug(1)], { big: 1 }),
  ]),
  scene('museum', 'Night at the Museum', false, [
    room('Grand Hall', 'checker', [0.25, 0.4], [it('statue', 3, 3), it('bench', 2, 2, { size: [1, 2], wall: true }), it('plant', 2, 1), rug(1)], { big: 1 }),
    room('Dinosaur Wing', 'stone', [0.2, 0.4], [it('statue', 3, 4), it('bench', 2, 2, { wall: true }), it('plant'), it('crate')], { big: 1 }),
    room('Gallery', 'wood', [0.25, 0.4], [it('statue', 2, 3), it('bench', 2, 3, { wall: true }), it('plant'), rug(1)]),
    room('Gift Shop', 'tile', [0.35, 0.5], [shop([2, 3], [0, 2]), it('shelf', 2, 3), table([1, 1], [0, 0], 1, 1), it('plant')]),
    room('Archive', 'carpet', [0.35, 0.5], [it('shelf', 3, 4), must('desk', 1, 2, { seat: ['chair', [1, 1]] }), it('crate'), rug(1), it('plant')], { big: -1 }),
    room('Sculpture Garden', 'grass', [0, 0.35], [it('statue', 3, 3), it('bush', 2, 2), it('flowers', 2, 2), it('bench', 2, 2, { wall: true }), it('tree')], { open: true }),
  ]),
  scene('bakery', 'Bakery after Hours', false, [
    room('Shop Floor', 'checker', [0.3, 0.5], [shop([2, 3], [1, 2]), table([1, 2], [1, 2], 1, 2), it('shelf', 2, 2), it('plant'), rug(1)], { big: 1 }),
    room('Kitchen', 'tile', [0.35, 0.5], [must('oven', 2, 1), it('counter', 1, 3, { size: [2, 3] }), table([1, 2], [1, 2]), it('shelf')], { big: 1 }),
    room('Cold Storage', 'stone', [0.3, 0.5], [it('crate', 2, 3), it('barrel', 2, 3), it('shelf', 2, 2)], { big: -1 }),
    room('Office', 'wood', [0.3, 0.5], [must('desk', 1, 1, { seat: ['chair', [1, 1]] }), it('shelf', 2, 2), it('plant'), rug(1)]),
    room('Flour Loft', 'wood', [0.25, 0.45], [it('barrel', 3, 3), it('crate', 2, 3), it('shelf', 1, 2)]),
    room('Back Alley', 'stone', [0, 0.25], [it('crate', 2, 3), it('barrel', 2, 3), it('plant'), it('bench', 1, 1, { wall: true })], { open: true }),
  ]),
  scene('campsite', 'Murder at Lake Pinewood', true, [
    room('Lakeshore', 'sand', [0.15, 0.3], [it('towel', 2, 3), it('boulder', 2, 2), it('bush'), it('tree')]),
    room('Pine Grove', 'grass', [0.25, 0.4], [it('tree', 4, 4), it('bush', 2, 2), it('boulder'), it('tent', 1, 1)], { big: 1 }),
    room('Campfire Circle', 'grass', [0.2, 0.4], [must('campfire', 1, 1, { seat: ['bench', [2, 3]] }), it('boulder'), it('bush'), it('tent')]),
    room('Boulder Field', 'stone', [0.25, 0.4], [it('boulder', 4, 4), it('bush'), it('tree')], { big: 1 }),
    room('Meadow', 'grass', [0, 0.25], [it('flowers', 2, 3), it('bush'), it('tree'), it('towel')], { open: true }),
    room('Picnic Area', 'grass', [0.2, 0.4], [must('table', 1, 1, { size: [1, 2], seat: ['bench', [2, 3]] }), it('tree', 2, 2), it('bush'), it('barrel')]),
    room('Trailhead', 'sand', [0, 0.25], [it('crate'), it('barrel'), it('bench', 1, 1, { wall: true }), it('bush'), it('tree')], { open: true }),
  ]),
  scene('greenhouse', 'The Withering Greenhouse', false, [
    room('Orchid House', 'tile', [0.3, 0.5], [it('plant', 4, 4), it('flowers', 2, 2), table([1, 2], [0, 1], 1, 2), it('bench', 1, 1, { wall: true })]),
    room('Fern Room', 'stone', [0.3, 0.5], [it('plant', 3, 4), it('bush', 2, 2), it('flowers'), it('bench', 1, 1, { wall: true })]),
    room('Potting Shed', 'wood', [0.3, 0.5], [table([1, 2], [1, 1], 1, 3), it('shelf', 2, 2), it('crate', 2, 2), it('barrel')], { big: -1 }),
    room('Tropical Dome', 'grass', [0.25, 0.4], [it('tree', 3, 4), it('bush', 2, 2), it('flowers', 2, 2), it('plant'), it('bench', 2, 2, { wall: true })], { big: 1 }),
    room('Seed Vault', 'checker', [0.3, 0.5], [it('shelf', 3, 4), it('crate', 2, 2), it('barrel')], { big: -1 }),
    room('Tea Corner', 'carpet', [0.3, 0.5], [must('table', 1, 1, { size: [1, 2], seat: ['chair', [1, 3]] }), it('sofa'), rug(2), it('plant'), it('shelf')]),
  ]),
  scene('jazzclub', 'Blue Note Blackout', false, [
    room('Main Stage', 'wood', [0.2, 0.4], [must('piano', 1, 1, { seat: ['stool', [0, 1]] }), table([1, 1], [1, 2], 2, 2), rug(2, [2, 4]), it('plant')], { big: 1 }),
    room('Bar', 'checker', [0.35, 0.5], [must('counter', 1, 1, { size: [2, 4], extra: 'register', seat: ['stool', [2, 3]] }), it('shelf', 2, 2), table([1, 2], [1, 2]), it('barrel')]),
    room('Green Room', 'carpet', [0.35, 0.5], [it('sofa', 2, 3), table([1, 1], [1, 2], 1, 2), it('wardrobe'), rug(1), it('tv'), it('plant')], { big: -1 }),
    room('Lounge', 'carpet', [0.3, 0.5], [it('sofa', 2, 3), table([1, 2], [1, 2], 1, 2), rug(2, [2, 4]), it('plant'), it('fireplace'), it('tv', 1, 0.5)], { big: 1 }),
    room('Kitchen', 'tile', [0.35, 0.5], [must('oven'), it('counter', 1, 3, { size: [2, 3] }), table([1, 2], [1, 2]), it('shelf')]),
    room('Cellar', 'stone', [0.25, 0.45], [it('barrel', 3, 3), it('crate', 2, 3), it('shelf')], { big: -1 }),
  ]),
  scene('boardwalk', 'Foul Play on the Boardwalk', true, [
    room('Pier', 'wood', [0, 0.3], [it('bench', 2, 3, { wall: true }), it('barrel', 2, 2), it('crate')], { open: true }),
    room('Beach', 'sand', [0.15, 0.3], [it('towel', 3, 4), it('boulder'), it('bush'), it('bench', 1, 1, { wall: true })], { big: 1 }),
    room('Arcade', 'checker', [0.35, 0.55], [must('arcade', 4, 4, { size: [2, 4] }), shop([2, 3], [0, 2], { w: 1 }), it('bench', 1, 1, { wall: true }), it('plant')], { big: 1 }),
    room('Ice Cream Stand', 'tile', [0.3, 0.5], [must('counter', 1, 1, { size: [2, 3], extra: 'register', seat: ['stool', [1, 2]] }), table([1, 1], [1, 2], 1, 2), it('plant')], { big: -1 }),
    room('Dunes', 'sand', [0, 0.25], [it('bush', 3, 3), it('boulder'), it('towel'), it('tree')], { open: true }),
    room('Promenade', 'stone', [0.1, 0.3], [it('bench', 3, 3, { wall: true }), it('tree', 2, 2), it('flowers'), it('plant')]),
    room('Lifeguard Lawn', 'grass', [0.2, 0.35], [it('tree', 2, 2), it('bush'), it('flowers'), it('bench', 1, 1, { wall: true }), it('tent'), it('towel')]),
  ]),
  scene('library', 'The Silent Stacks', false, [
    room('Reading Room', 'carpet', [0.35, 0.5], [must('table', 1, 1, { size: [1, 3], seat: ['chair', [2, 3]] }), it('shelf', 3, 3), it('sofa'), it('fireplace'), rug(2, [2, 4]), it('plant')], { big: 1 }),
    room('Rare Books', 'wood', [0.35, 0.5], [must('shelf', 4, 5), table([1, 2], [1, 2]), it('statue'), it('plant')]),
    room('Reference Desk', 'tile', [0.3, 0.45], [must('desk', 1, 1, { size: [1, 2], seat: ['chair', [1, 2]] }), it('shelf', 2, 2), it('plant')]),
    room('Map Room', 'stone', [0.3, 0.45], [must('table', 1, 1, { size: [1, 3], seat: ['chair', [0, 2]] }), it('shelf', 2, 2), it('desk'), it('crate')]),
    room("Children's Corner", 'carpet', [0.35, 0.5], [rug(3, [2, 4]), it('shelf', 2, 2), table([1, 1], [1, 2], 1, 2), it('plant'), it('sofa', 1, 1)], { big: -1 }),
    room('Reading Garden', 'grass', [0, 0.35], [it('bench', 2, 3, { wall: true }), it('flowers', 2, 2), it('tree', 2, 2), it('bush'), it('statue')], { open: true }),
  ]),
  scene('station', 'Last Call at the Station Café', false, [
    room('Ticket Hall', 'checker', [0.25, 0.4], [must('counter', 1, 1, { size: [2, 3], extra: 'register' }), it('bench', 3, 3, { wall: true }), it('plant'), it('barrel', 1, 0.5)], { big: 1 }),
    room('Café', 'tile', [0.35, 0.5], [shop([2, 3], [1, 2]), table([1, 2], [1, 2], 1, 3), it('shelf'), it('plant'), it('oven', 1, 0.5)]),
    room('Platform', 'stone', [0, 0.25], [it('bench', 3, 3, { wall: true }), it('crate', 2, 2), it('barrel'), it('plant')], { open: true, big: 1 }),
    room('Waiting Room', 'wood', [0.3, 0.5], [it('bench', 2, 3, { size: [1, 3], wall: true }), it('sofa'), table([1, 1], [1, 2], 1, 2), it('plant'), it('tv')]),
    room('Luggage Office', 'wood', [0.35, 0.5], [it('crate', 3, 4), it('barrel'), it('shelf', 2, 2), it('counter', 1, 1, { size: [1, 2], extra: 'register' })], { big: -1 }),
    room("Stationmaster's Office", 'carpet', [0.3, 0.45], [must('desk', 1, 1, { seat: ['chair', [1, 1]] }), it('shelf', 2, 2), it('wardrobe'), it('plant'), rug(1), it('sofa', 1, 1)]),
  ]),
  scene('homestead', 'Doomsday at Hollow Ridge', false, [
    room('Yard', 'grass', [0.15, 0.3], [it('bush', 3, 3), it('crate', 1, 2), it('tree', 1, 1), it('flowers'), it('car', 1, 1)], { big: 1 }),
    room('Driveway', 'dirt', [0.1, 0.3], [it('car', 2, 4), it('barrel'), it('crate'), it('bush')], { open: true }),
    room('Kitchen', 'tile', [0.35, 0.5], [must('counter', 1, 3, { size: [3, 4] }), table([1, 2], [1, 2], 1, 3), it('oven', 1, 1), it('shelf')]),
    room('Living Room', 'wood', [0.3, 0.45], [it('tv', 1, 2), it('shelf', 2, 2), it('sofa', 2, 3), table([1, 1], [1, 2], 1, 2), rug(2), it('plant')], { big: 1 }),
    room('Bedroom', 'wood', [0.3, 0.5], [must('bed', 1, 1, { size: [1, 2], corner: true }), table([1, 1], [0, 1], 1, 2), it('shelf', 1, 2), it('wardrobe'), rug(1), it('plant')]),
    room('Bathroom', 'tile', [0.3, 0.5], [must('bathtub', 1, 1, { wall: true }), it('shelf'), it('plant'), it('towel')], { big: -1 }),
    room('Safe Room', 'stone', [0.35, 0.5], [must('bed', 1, 1, { size: [1, 2], corner: true }), it('tv'), table([1, 2], [1, 2], 2, 2), it('shelf', 2, 2), it('crate')]),
    room('Secret Stairs', 'stone', [0, 0.2], [it('crate', 1, 2), it('barrel', 1, 1)], { open: true, big: -1 }),
    room('Supply Room', 'checker', [0.4, 0.55], [it('shelf', 4, 4), it('crate', 5, 5), it('barrel', 2, 2)]),
  ]),
  scene('apartment', 'Penthouse Poison', false, [
    room('Guest Bedroom', 'carpet', [0.3, 0.45], [must('bed', 1, 1, { corner: true }), it('shelf', 1, 2), it('wardrobe'), rug(2), it('plant')]),
    room('Main Bedroom', 'carpet', [0.35, 0.5], [must('bed', 1, 2, { size: [1, 2], corner: true }), it('shelf', 2, 2), it('plant', 2, 2), rug(3), it('wardrobe'), it('tv', 1, 0.5)], { big: 1 }),
    room('Living Room', 'wood', [0.3, 0.45], [it('tv', 1, 2), must('rug', 1, 3, { size: [3, 6] }), it('sofa', 2, 3), table([1, 2], [1, 3], 1, 2), it('plant'), it('shelf')], { big: 1 }),
    room('Bathroom', 'tile', [0.3, 0.5], [must('bathtub', 1, 1, { wall: true }), it('shelf'), it('plant'), it('towel')], { big: -1 }),
    room('Dining Room', 'wood', [0.3, 0.45], [must('table', 1, 1, { size: [3, 5], seat: ['chair', [3, 5]] }), it('shelf'), it('plant'), rug(1), it('wardrobe', 1, 0.5)]),
    room('Kitchen', 'checker', [0.35, 0.5], [must('oven'), it('counter', 1, 3, { size: [2, 4] }), table([1, 2], [1, 2]), it('shelf')]),
    room('Home Office', 'carpet', [0.3, 0.45], [must('desk', 1, 1, { seat: ['chair', [1, 1]] }), it('shelf', 2, 2), it('plant'), it('sofa', 1, 1), rug(1)], { big: -1 }),
    room('Balcony', 'stone', [0, 0.3], [it('plant', 2, 3), it('bench', 1, 2, { wall: true }), it('flowers'), it('barrel', 1, 0.5)], { open: true, big: -1 }),
  ]),
  scene('lake', 'Dead Calm on Lake Larkspur', true, [
    room('Lake', 'water', [0.1, 0.25], [must('boat', 2, 3)], { big: 3, always: true, flood: 'water' }),
    room('North Shore', 'grass', [0.25, 0.4], [it('tree', 3, 4), it('bush', 2, 2), it('boulder'), it('flowers')]),
    room('South Shore', 'grass', [0.25, 0.4], [it('tree', 3, 3), it('bush', 2, 3), it('boulder', 2, 2), it('towel')]),
    room('Dock', 'brick', [0.15, 0.35], [it('bench', 2, 3, { wall: true }), it('barrel', 2, 2), it('crate', 2, 2)], { always: true }),
    room('Rocky Shore', 'stone', [0.3, 0.45], [it('boulder', 4, 5), it('bush'), it('tree', 1, 0.5)], { big: 1 }),
    room('Picnic Meadow', 'grass', [0.1, 0.3], [must('table', 1, 1, { size: [1, 2], seat: ['bench', [2, 3]] }), it('tree'), it('flowers'), it('tent')], { open: true }),
  ]),
  scene('farm', 'The Scarecrow Never Lies', true, [
    room('Barn', 'dirt', [0.3, 0.5], [it('haybale', 4, 4), it('crate', 2, 2), it('barrel', 2, 2), it('tractor', 1, 0.5)], { big: 1 }),
    room('Pasture', 'grass', [0.15, 0.3], [it('haybale', 2, 2), it('tree', 2, 2), it('bush'), it('boulder'), it('flowers')], { big: 1 }),
    room('Vegetable Patch', 'dirt', [0.2, 0.4], [it('bush', 3, 4), it('flowers', 3, 3), it('barrel'), it('crate')]),
    room('Farmhouse Porch', 'wood', [0.25, 0.45], [it('bench', 2, 3, { wall: true }), it('barrel'), it('plant', 2, 2), it('crate')], { big: -1 }),
    room('Tractor Shed', 'dirt', [0.3, 0.45], [must('tractor', 1, 1), it('barrel', 2, 2), it('crate', 1, 1), it('shelf', 1, 1)], { big: -1 }),
    room('Pond', 'water', [0.1, 0.25], [must('boat', 1, 2)], { always: true, flood: 'water' }),
    room('Orchard', 'grass', [0.25, 0.4], [it('tree', 5, 5), it('bush', 2, 2), it('towel'), it('flowers')], { big: 1 }),
  ]),
];


export function randomLook(rng, gender) {
  const male = gender === 'm';
  let hairStyle;
  do {
    hairStyle = rng.pick(HAIR_STYLES);
  } while (hairStyle === 'bald' && !male && !rng.chance(0.1));
  if (male && hairStyle === 'bald' && rng.chance(0.4)) hairStyle = rng.pick(HAIR_STYLES);
  let accessory = rng.pick(ACCESSORIES);
  if (!male && (accessory === 'beard' || accessory === 'mustache')) accessory = rng.chance(0.5) ? null : 'glasses';
  return {
    skin: rng.pick(SKIN_TONES),
    hair: rng.pick(HAIR_COLORS),
    outfit: rng.pick(OUTFIT_COLORS),
    hairStyle,
    accessory,
  };
}

const byInitial = (l) => NAME_POOL.filter((p) => p.name[0].toUpperCase() === l);

// Genre convention: n-1 suspects named with consecutive initials A, B, C… (card order),
// then the victim, whose name starts with V (last card). Returns n {name, gender}.
export function pickCast(rng, n) {
  const out = [];
  for (let k = 0; k < n - 1; k++) {
    const p = rng.pick(byInitial(String.fromCharCode(65 + k)));
    out.push({ name: p.name, gender: p.gender });
  }
  const v = rng.pick(byInitial('V'));
  out.push({ name: v.name, gender: v.gender });
  return out;
}
