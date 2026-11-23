// Shared object registry. Pure data — safe in Node and browser.
// blocking: true  -> nobody can stand on this cell
// label: singular noun used in clue text ("beside a tree")
export const OBJECT_TYPES = {
  // blocking
  tree:      { blocking: true,  label: 'tree', desc: 'Leafy and rooted. Nobody is standing here.' },
  bush:      { blocking: true,  label: 'bush', desc: 'Shrubbery. Hiding in it is not allowed.' },
  boulder:   { blocking: true,  label: 'boulder', desc: 'Heavy, grumpy, and going nowhere.' },
  table:     { blocking: true,  label: 'table', desc: 'Plates and elbows only, no people.' },
  counter:   { blocking: true,  label: 'counter', desc: 'Serve from behind it, not on it.' },
  oven:      { blocking: true,  label: 'oven', desc: 'Hot stuff. Keep clear.' },
  shelf:     { blocking: true,  label: 'bookshelf', desc: 'Packed with books. No room for you.' },
  desk:      { blocking: true,  label: 'desk', desc: 'Paperwork lives here, not suspects.' },
  plant:     { blocking: true,  label: 'potted plant', desc: 'Dramatic leaves, zero standing room.' },
  crate:     { blocking: true,  label: 'crate', desc: 'Stacked and sealed. Do not stand on it.' },
  statue:    { blocking: true,  label: 'statue', desc: 'Stands very still, so nobody else can.' },
  fireplace: { blocking: true,  label: 'fireplace', desc: 'Cozy to look at, bad to stand in.' },
  piano:     { blocking: true,  label: 'piano', desc: "Big, black, and in everyone's way." },
  campfire:  { blocking: true,  label: 'campfire', desc: 'Toasty. Stepping in is a bad idea.' },
  tent:      { blocking: true,  label: 'tent', desc: 'Canvas walls, fully occupied by gear.' },
  tv:        { blocking: true,  label: 'TV', desc: 'Screen on, suspects off.' },
  wardrobe:  { blocking: true,  label: 'wardrobe', desc: 'Too tall and too full to stand in.' },
  register:  { blocking: true,  label: 'cash register', desc: 'Cha-ching. Staff only, standing not included.' },
  barrel:    { blocking: true,  label: 'barrel', desc: 'Round, heavy, possibly full of something.' },
  flowers:   { blocking: true,  label: 'flower bed', desc: 'Please do not trample the petunias.' },
  arcade:    { blocking: true,  label: 'arcade machine', desc: 'Blinking lights, no standing space.' },
  heater:    { blocking: true,  label: 'sauna stove', desc: 'Sauna stove. Very hot, very blocked.' },
  water:     { blocking: true,  label: 'water', desc: 'Wet. Nobody is paddling here.' },       // open water tile (lake); rendered by the water floor
  haybale:   { blocking: true,  label: 'hay bale', desc: 'Itchy and stacked. Skip it.' },
  tractor:   { blocking: true,  label: 'tractor', desc: 'Big, green, and parked in the way.' },
  // Zoo animals: one blocking type per species so clues can say "beside a bear". (Extreme scenes)
  bear:      { blocking: true,  label: 'bear', desc: 'Big, fuzzy, and not sharing the spot.' },
  lion:      { blocking: true,  label: 'lion', desc: 'The king of this square. Keep out.' },
  elephant:  { blocking: true,  label: 'elephant', desc: 'Far too large to stand on, or beside.' },
  penguin:   { blocking: true,  label: 'penguin', desc: 'Waddling in place. Square taken.' },
  croc:      { blocking: true,  label: 'crocodile', desc: 'Snappy. Nobody stands here.' },
  shark:     { blocking: true,  label: 'shark', desc: 'A fin circles this tank square.' },
  // occupiable
  stool:     { blocking: false, label: 'stool', desc: 'A small perch. Someone could sit here.' },
  car:       { blocking: false, label: 'car', desc: 'Parked, but someone could be inside.' },
  boat:      { blocking: false, label: 'boat', desc: 'Afloat enough for a suspect or two.' },
  bathtub:   { blocking: false, label: 'bathtub', desc: 'Someone could be soaking in it.' },
  chair:     { blocking: false, label: 'chair', desc: 'Pull it up. Somebody could be sitting.' },
  sofa:      { blocking: false, label: 'sofa', desc: 'Comfy spot for a suspect to lounge.' },
  bed:       { blocking: false, label: 'bed', desc: 'Somebody might be napping in it.' },
  rug:       { blocking: false, label: 'rug', desc: 'Soft floor decor. Stand on it freely.' },
  bench:     { blocking: false, label: 'bench', desc: 'Room to sit or stand.' },
  towel:     { blocking: false, label: 'beach towel', desc: 'A beach spot. Anyone can lounge here.' },
  // Golf + zoo (Extreme scenes). Occupiable water is `shallows`; plain `water` stays blocking.
  tee:       { blocking: false, label: 'tee box', desc: 'Where a hole begins. Stand here freely.' },
  flag:      { blocking: false, label: 'flag', desc: 'The pin on the green. Someone could be here.' },
  bunker:    { blocking: false, label: 'sand bunker', desc: 'A sand pit. Someone could be in it.' },
  cart:      { blocking: false, label: 'golf cart', desc: 'Parked, but someone could be riding.' },
  shallows:  { blocking: false, label: 'shallows', desc: 'Knee-deep water. Wading is allowed.' },
};

export const FLOOR_TYPES = ['wood', 'tile', 'grass', 'sand', 'stone', 'carpet', 'snow', 'checker', 'water', 'brick', 'dirt', 'fairway', 'green'];

export function isBlockingType(type) {
  return !!OBJECT_TYPES[type]?.blocking;
}

// Player-facing info for the objects legend.
export function objectInfo(type) {
  const o = OBJECT_TYPES[type];
  return { label: o?.label ?? type, desc: o?.desc ?? '', blocking: !!o?.blocking };
}

export function objectLabel(type) {
  return OBJECT_TYPES[type]?.label ?? type;
}
