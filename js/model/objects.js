// Shared object registry. Pure data — safe in Node and browser.
// blocking: true  -> nobody can stand on this cell
// label: singular noun used in clue text ("beside a tree")
export const OBJECT_TYPES = {
  // blocking
  tree:      { blocking: true,  label: 'tree' },
  bush:      { blocking: true,  label: 'bush' },
  boulder:   { blocking: true,  label: 'boulder' },
  table:     { blocking: true,  label: 'table' },
  counter:   { blocking: true,  label: 'counter' },
  oven:      { blocking: true,  label: 'oven' },
  shelf:     { blocking: true,  label: 'bookshelf' },
  desk:      { blocking: true,  label: 'desk' },
  plant:     { blocking: true,  label: 'potted plant' },
  crate:     { blocking: true,  label: 'crate' },
  statue:    { blocking: true,  label: 'statue' },
  fireplace: { blocking: true,  label: 'fireplace' },
  piano:     { blocking: true,  label: 'piano' },
  campfire:  { blocking: true,  label: 'campfire' },
  tent:      { blocking: true,  label: 'tent' },
  tv:        { blocking: true,  label: 'TV' },
  wardrobe:  { blocking: true,  label: 'wardrobe' },
  register:  { blocking: true,  label: 'cash register' },
  barrel:    { blocking: true,  label: 'barrel' },
  flowers:   { blocking: true,  label: 'flower bed' },
  arcade:    { blocking: true,  label: 'arcade machine' },
  heater:    { blocking: true,  label: 'sauna stove' },
  water:     { blocking: true,  label: 'water' },       // open water tile (lake); rendered by the water floor
  haybale:   { blocking: true,  label: 'hay bale' },
  tractor:   { blocking: true,  label: 'tractor' },
  // occupiable
  stool:     { blocking: false, label: 'stool' },
  car:       { blocking: false, label: 'car' },
  boat:      { blocking: false, label: 'boat' },
  bathtub:   { blocking: false, label: 'bathtub' },
  chair:     { blocking: false, label: 'chair' },
  sofa:      { blocking: false, label: 'sofa' },
  bed:       { blocking: false, label: 'bed' },
  rug:       { blocking: false, label: 'rug' },
  bench:     { blocking: false, label: 'bench' },
  towel:     { blocking: false, label: 'beach towel' },
};

export const FLOOR_TYPES = ['wood', 'tile', 'grass', 'sand', 'stone', 'carpet', 'snow', 'checker', 'water', 'brick', 'dirt'];

export function isBlockingType(type) {
  return !!OBJECT_TYPES[type]?.blocking;
}

export function objectLabel(type) {
  return OBJECT_TYPES[type]?.label ?? type;
}
