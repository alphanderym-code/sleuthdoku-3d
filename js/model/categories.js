// Object categories for personality clues ("Gary never stands beside food"). Pure ES module.
// A category is a set of object types; "beside a category" = orthogonally adjacent AND in the same
// room as ANY object of one of its types (same rule as 'besideObject').
export const CATEGORIES = {
  food:    { noun: 'food',    types: ['oven', 'counter', 'table', 'register', 'campfire', 'barrel'] },
  plants:  { noun: 'plants',  types: ['plant', 'flowers', 'tree', 'bush', 'haybale'] },
  water:   { noun: 'water',   types: ['water', 'shallows', 'bathtub', 'boat'] },
  screens: { noun: 'screens', types: ['tv', 'arcade'] },
  animals: { noun: 'animals', types: ['bear', 'lion', 'elephant', 'penguin', 'croc', 'shark'] },
};

// Phrasings (index stored in clue.v; any index works, modulo the list length). {n} = bold noun.
const LIKE = ['always stands beside {n}', 'loves being beside {n}', 'cannot resist standing beside {n}'];
const DISLIKE = ['never stands beside {n}', "can't stand being beside {n}", 'keeps well away from {n}'];
const EXTRA_DISLIKE = { plants: ['is allergic to {n}'], animals: ['is afraid of {n}', 'is allergic to {n}'], water: ['is afraid of {n}'], screens: ['hates {n}'], food: ['is on a strict diet, so avoids {n}'] };

export function categoryOfType(type) {
  for (const [k, c] of Object.entries(CATEGORIES)) if (c.types.includes(type)) return k;
  return null;
}

export function inCategory(category, type) {
  return !!CATEGORIES[category]?.types.includes(type);
}

// Categories that have at least one object in the puzzle.
export function categoriesPresent(puzzle) {
  const out = new Set();
  for (const o of puzzle.objects || []) { const k = categoryOfType(o.type); if (k) out.add(k); }
  return [...out];
}

export const PERSONALITY_TYPES = new Set(['besideCategory', 'notBesideCategory']);

// Predicate after the name: "never stands beside **food**" (no subject, no period).
export function personalityBody(clue) {
  const cat = CATEGORIES[clue.category];
  if (!cat) throw new Error(`Unknown category: ${clue.category}`);
  const list = clue.type === 'besideCategory' ? LIKE : [...DISLIKE, ...(EXTRA_DISLIKE[clue.category] || [])];
  const v = Math.abs(clue.v ?? 0) % list.length;
  return list[v].replace('{n}', `**${cat.noun}**`);
}
