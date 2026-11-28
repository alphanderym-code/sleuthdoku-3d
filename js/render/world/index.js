// buildWorld(view, puzzle): picks the theme builder, merges/instances everything, returns the world handle.
import { worldOf } from '../moods.js';
import { Ctx, GY } from './ctx.js';
import { buildTown } from './town.js';
import { buildPark, buildFarm, buildForest } from './nature.js';
import { buildCoast, buildSea } from './shore.js';
import { buildSnow, buildAirport } from './misc.js';

const THEMES = { town: buildTown, park: buildPark, farm: buildFarm, forest: buildForest, coast: buildCoast, sea: buildSea, snow: buildSnow, airport: buildAirport };

/** Returns { group, lampSpots: Vector3[], setMood(name, preset), update(t, dt) }. Added to the board group, disposed with it. */
export function buildWorld(view, puzzle) {
  const theme = worldOf(puzzle);
  const c = new Ctx(view, puzzle, theme);
  (THEMES[theme] || buildTown)(c);
  c.finish();
  const anims = c.anims, moodFns = c.moodFns;
  // One failing hook only drops itself, never the whole world's motion.
  const step = (t, dt) => {
    for (let i = 0; i < anims.length; i++) {
      try { anims[i](t, dt); } catch (e) { console.error(e); anims.splice(i--, 1); }
    }
  };
  // Pose everything once: instanced movers start at the identity matrix (the board centre), so without this
  // a frame-less world (reduced motion, or a hook that never runs) leaves a car and its smoke parked mid-board.
  step(0, 0);
  return {
    group: c.group,
    lampSpots: c.lampSpots.slice(0, 4),
    setMood(name, preset) {
      if (c.blobGroup && preset?.sunDir) { // blob shadows lean away from the sun
        const s = preset.sunDir, k = 0.5 / Math.max(0.3, s[1]);
        c.blobGroup.position.set(-s[0] * k, 0, -s[2] * k);
      }
      if (c.clouds) c.clouds.material.opacity = name === 'night' ? 0.18 : 0.3;
      for (const f of moodFns) f(name, preset);
    },
    update: step,
  };
}
