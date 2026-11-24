// Shared board layout constants and tiny helpers (used by scene.js, boardkit.js, world.js).
import * as THREE from 'three';

export const DEG = Math.PI / 180;
export const FRAME_W = 0.5;       // outer frame width
export const FRAME_TOP = 0.18;    // frame top above the floor
export const WALL_T = 0.11;       // room wall thickness
export const WALL_H = 0.17;       // room wall height (incl. cap)
export const OUTDOOR = new Set(['grass', 'sand', 'snow']);
export const keyOf = (r, c) => `${r},${c}`;
export const noRaycast = () => {};

/** Rounded-rectangle THREE.Shape centred at the origin. */
export function roundedRectShape(hw, hh, rad) {
  const s = new THREE.Shape();
  s.moveTo(-hw + rad, -hh);
  s.lineTo(hw - rad, -hh); s.quadraticCurveTo(hw, -hh, hw, -hh + rad);
  s.lineTo(hw, hh - rad); s.quadraticCurveTo(hw, hh, hw - rad, hh);
  s.lineTo(-hw + rad, hh); s.quadraticCurveTo(-hw, hh, -hw, hh - rad);
  s.lineTo(-hw, -hh + rad); s.quadraticCurveTo(-hw, -hh, -hw + rad, -hh);
  return s;
}
/** Extruded slab (shape in XZ) whose top face sits at y = top. */
export function extrudeSlab(shape, depth, top, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, top - depth - bevel, 0);
  return g;
}
/** Box geometry placed at (x, y, z), non-indexed-compatible for merging. */
export function boxAt(w, h, d, x, y, z) { return new THREE.BoxGeometry(w, h, d).translate(x, y, z); }
