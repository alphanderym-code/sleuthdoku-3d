import assert from 'node:assert/strict';
import { NAME_POOL, SKIN_TONES, HAIR_COLORS, OUTFIT_COLORS, HAIR_STYLES, ACCESSORIES, SCENES, randomLook, pickCast } from '../js/data/content.js';
import { OBJECT_TYPES, FLOOR_TYPES } from '../js/model/objects.js';
import { makeRng } from '../js/model/rng.js';

assert.ok(NAME_POOL.length >= 60);
const counts = {};
for (const p of NAME_POOL) {
  assert.ok(p.gender === 'm' || p.gender === 'f');
  counts[p.name[0]] = (counts[p.name[0]] || 0) + 1;
}
for (const l of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') assert.ok(counts[l] >= 2, 'letter ' + l);
assert.ok(SKIN_TONES.length >= 6 && HAIR_COLORS.length >= 8);
assert.ok(new Set(OUTFIT_COLORS).size === OUTFIT_COLORS.length && OUTFIT_COLORS.length >= 12);
assert.equal(HAIR_STYLES.length, 7);
assert.equal(ACCESSORIES.length, 7);
assert.ok(SCENES.length >= 8);
for (const s of SCENES) {
  assert.ok(s.key && s.title && typeof s.outdoor === 'boolean');
  assert.ok(s.rooms.length >= 6, s.key);
  for (const rm of s.rooms) assert.ok(FLOOR_TYPES.includes(rm.floor), s.key + ' floor ' + rm.floor);
  for (const t of s.blocking) assert.ok(OBJECT_TYPES[t]?.blocking === true, s.key + ' blocking ' + t);
  for (const t of s.occupiable) assert.ok(OBJECT_TYPES[t] && OBJECT_TYPES[t].blocking === false, s.key + ' occ ' + t);
}
for (let seed = 1; seed <= 200; seed++) {
  const rng = makeRng(seed);
  const cast = pickCast(rng, 9);
  assert.equal(cast.length, 9);
  assert.equal(new Set(cast.map((c) => c.name[0])).size, 9);
  // Genre convention: suspects A, B, C… in order, victim (last) starts with V.
  assert.equal(cast.map((c) => c.name[0]).join(''), 'ABCDEFGHV');
  assert.equal(pickCast(makeRng(seed), 5).map((c) => c.name[0]).join(''), 'ABCDV');
  for (const c of cast) {
    const look = randomLook(rng, c.gender);
    assert.ok(look.skin && look.hair && look.outfit && look.hairStyle);
    if (c.gender === 'f') assert.ok(look.accessory !== 'beard' && look.accessory !== 'mustache');
  }
}
console.log('content tests passed');
