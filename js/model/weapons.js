// Suspect weapons and wounds (case note "The victim was stabbed."). Pure ES module.
// Each suspect carries one weapon; each weapon causes one wound. Several weapons share a wound.
export const WEAPONS = {
  knife:        { label: 'knife',         emoji: '🔪', wound: 'stabbed' },
  letteropener: { label: 'letter opener', emoji: '🗡️', wound: 'stabbed', indoor: true },
  shears:       { label: 'garden shears', emoji: '✂️', wound: 'stabbed', outdoor: true },
  pistol:       { label: 'pistol',        emoji: '🔫', wound: 'shot' },
  crossbow:     { label: 'crossbow',      emoji: '🏹', wound: 'shot', outdoor: true },
  rope:         { label: 'rope',          emoji: '🪢', wound: 'strangled' },
  scarf:        { label: 'silk scarf',    emoji: '🧣', wound: 'strangled', indoor: true },
  candlestick:  { label: 'candlestick',   emoji: '🕯️', wound: 'bludgeoned', indoor: true },
  wrench:       { label: 'wrench',        emoji: '🔧', wound: 'bludgeoned' },
  hammer:       { label: 'hammer',        emoji: '🔨', wound: 'bludgeoned' },
  golfclub:     { label: 'golf club',     emoji: '⛳', wound: 'bludgeoned', scenes: ['golf'] },
  shovel:       { label: 'shovel',        emoji: '⛏️', wound: 'bludgeoned', outdoor: true },
  poison:       { label: 'poison vial',   emoji: '🧪', wound: 'poisoned' },
  syringe:      { label: 'syringe',       emoji: '💉', wound: 'poisoned', indoor: true },
};

export const WOUNDS = ['stabbed', 'shot', 'strangled', 'bludgeoned', 'poisoned'];

// Cause-of-death noun for note text ("Cause of death: **stabbing**."). The note never says "victim"
// (genre convention: only the victim card names the victim).
const CAUSE = { stabbed: 'stabbing', shot: 'a gunshot', strangled: 'strangulation', bludgeoned: 'blunt force', poisoned: 'poison' };
export function woundText(wound) {
  return CAUSE[wound] ?? wound;
}

export function weaponInfo(key) {
  return WEAPONS[key] ?? null;
}

export function woundOf(key) {
  return WEAPONS[key]?.wound ?? null;
}

// Weapons that fit a scene's flavor ({ key, outdoor }).
export function weaponsForScene(scene) {
  return Object.entries(WEAPONS)
    .filter(([, w]) => (w.scenes ? w.scenes.includes(scene.key) : !(w.indoor && scene.outdoor) && !(w.outdoor && !scene.outdoor)))
    .map(([k]) => k);
}

// Hand-authored cases have no weapons: give each suspect a scene-flavored one, seeded by the case id.
// Cosmetic only (no wound note), so the solution and its uniqueness are unchanged.
export function assignFlavorWeapons(puzzle) {
  let h = 2166136261;
  for (const ch of String(puzzle.id ?? puzzle.title ?? '')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const list = weaponsForScene({ key: puzzle.scene ?? puzzle.id, outdoor: !!puzzle.outdoor });
  for (const ch of puzzle.characters || []) {
    if (ch.victim || ch.weapon || !list.length) continue;
    h = Math.imul(h ^ ch.id.charCodeAt(0), 16777619) >>> 0;
    ch.weapon = list[h % list.length];
  }
  return puzzle;
}
