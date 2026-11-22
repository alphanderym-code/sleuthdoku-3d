// Procedural low-poly cartoon models for Tiny Crimes.
// Everything is built from three.js primitives, toon-shaded, with inverted-hull outlines.
// Conventions: each model fits a 1x1 cell, centred on x/z = 0, resting on y = 0, "front" faces +z (south).
// Implementation lives in ./models/ (kit.js = helpers, objects.js = furniture/scenery, figurine.js = characters).
// Animated models expose group.userData.idle = (t seconds) => {...}; call it every frame.
import * as THREE from 'three';
import { addOutlines } from "./models/kit.js";
import { buildObject, standInfo } from './models/objects.js';

export { OUTLINE_COLOR, gradientMap, toon, toonOwn, addOutlines, disposeObject } from './models/kit.js';
export { standInfo } from './models/objects.js';
export { createFigurine } from './models/figurine.js';

/**
 * Builds a cell-sized object model. Unknown types become a little box.
 * Optional `seed` (e.g. derived from the cell position) makes decoration variants deterministic.
 */
export function createObject(type, seed) {
  const g = new THREE.Group();
  g.name = `object:${type}`;
  const s = (seed === undefined || seed === null) ? Math.floor(Math.random() * 1e9) : (seed >>> 0);
  buildObject(type, g, s);
  addOutlines(g, 0.018);
  g.userData.type = type;
  g.userData.stand = standInfo(type);
  return g;
}
