// Scene identity (which world a puzzle belongs to) and lighting moods (day / golden hour / night).
import * as THREE from 'three';
import { SCENES } from '../data/content.js';

// Hand-picked cases carry their own titles: map them to the scene they were built from.
const CASE_SCENE = {
  'Crumbs at Closing Time': 'bakery', 'The Wilted Orchid': 'greenhouse', "The Curator's Last Exhibit": 'museum',
  'Saltwater and Sabotage': 'boardwalk', 'Ripples on Lake Larkspur': 'lake', 'An Avalanche of Alibis': 'chalet',
  'The Final Encore': 'jazzclub', 'A Toast to the End of the World': 'homestead', 'Ashes in the Lantern Room': 'lighthouse',
  'Nine Floors of Motive': 'apartment', 'The Last Train to Nowhere': 'station',
};
/** Scene key of a puzzle ('farm', 'museum', …) or 'town' when unknown. */
export function sceneKeyOf(puzzle) {
  const t = puzzle?.title || '';
  if (puzzle?.scene) return puzzle.scene;
  if (CASE_SCENE[t]) return CASE_SCENE[t];
  return SCENES.find((s) => s.title === t)?.key || 'town';
}

// World surrounding the board.
const WORLD = {
  town: 'town', bakery: 'town', museum: 'town', jazzclub: 'town', library: 'town', apartment: 'town', station: 'town',
  greenhouse: 'park', park: 'park', zoo: 'park', golf: 'park',
  farm: 'farm', homestead: 'farm',
  campsite: 'forest', lake: 'forest',
  lighthouse: 'coast', boardwalk: 'coast',
  cruise: 'sea', chalet: 'snow', ski: 'snow', airport: 'airport',
};
/** 'town' | 'park' | 'farm' | 'forest' | 'coast' | 'sea' | 'snow' | 'airport' */
export function worldOf(puzzle) { return WORLD[sceneKeyOf(puzzle)] || 'town'; }

const MOOD_OF = {
  museum: 'night', jazzclub: 'night', apartment: 'night', station: 'night', campsite: 'night',
  bakery: 'golden', lighthouse: 'golden', library: 'golden', lake: 'golden',
};
export function defaultMood(puzzle) { return MOOD_OF[sceneKeyOf(puzzle)] || 'day'; }

/**
 * Lighting presets. sunDir points from the board towards the light.
 * grade: exposure, saturation, shadow tint (lift added in the darks), vignette, aoTint (colour of occluded areas).
 * lamp: intensity of the warm local lights; glow: 0..1 how much lamps / windows are lit (world.js, objects).
 */
export const MOODS = {
  day: {
    sky: '#a9dcf5', horizon: '#e9f6e6', ground: '#b9c98a', fog: '#cfeaf0',
    sun: ['#ffe6b8', 3.3], sunDir: [-0.62, 1, 0.42], hemi: ['#a9c4ff', '#ffcf9a', 0.8], fill: ['#b0c0ff', 0.3], rim: ['#fff3dc', 0.4],
    env: 0.36, shadow: 0.92, lamp: 0, glow: 0,
    grade: { exposure: 0.98, saturation: 1.12, contrast: 1.07, shadowTint: '#26378f', tintAmt: 0.14, vignette: 0.16, aoTint: '#463b7c' },
  },
  golden: {
    sky: '#ffc9a0', horizon: '#ffe3b8', ground: '#c9a27a', fog: '#f7cfa8',
    sun: ['#ffbf7a', 3.5], sunDir: [-0.95, 0.85, 0.38], hemi: ['#c3b6ff', '#ffc79a', 0.85], fill: ['#a9a4ff', 0.5], rim: ['#ffd2a0', 0.6],
    env: 0.38, shadow: 0.82, lamp: 1.2, glow: 0.45,
    grade: { exposure: 1.0, saturation: 1.1, contrast: 1.04, shadowTint: '#4a2f8f', tintAmt: 0.14, vignette: 0.22, aoTint: '#54357a' },
  },
  night: {
    sky: '#2f37b8', horizon: '#6a4fd0', ground: '#2c2a86', fog: '#3038a0',
    sun: ['#8ea2ff', 2.1], sunDir: [0.5, 1, 0.45], hemi: ['#6f7cff', '#9a5ad0', 1.25], fill: ['#ff86c8', 0.4], rim: ['#7fc8ff', 0.8],
    env: 0.42, shadow: 0.8, lamp: 9, glow: 1,
    grade: { exposure: 1.1, saturation: 1.22, contrast: 1.1, shadowTint: '#1c1fa8', tintAmt: 0.22, vignette: 0.3, aoTint: '#221f78' },
  },
};

const _envCache = new WeakMap(); // renderer -> { mood: texture }
/** Soft image-based ambient for a mood (tiny procedural sky dome run through PMREM; cached per renderer). */
export function moodEnvironment(renderer, name) {
  let c = _envCache.get(renderer);
  if (!c) { c = {}; _envCache.set(renderer, c); }
  if (!c[name]) {
    const m = MOODS[name];
    const geo = new THREE.SphereGeometry(10, 32, 24);
    const top = new THREE.Color(m.sky), mid = new THREE.Color(m.horizon), bot = new THREE.Color(m.ground), k = new THREE.Color();
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 10;
      if (y >= 0) k.copy(mid).lerp(top, Math.min(1, y * 1.6)); else k.copy(mid).lerp(bot, Math.min(1, -y * 4));
      col[i * 3] = k.r; col[i * 3 + 1] = k.g; col[i * 3 + 2] = k.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const s = new THREE.Scene();
    const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
    s.add(dome);
    // a broad soft key panel gives rounded forms a gentle highlight
    const panel = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(m.sun[0]).multiplyScalar(m.glow === 1 ? 1.5 : 4) }));
    panel.position.set(...m.sunDir).normalize().multiplyScalar(8);
    s.add(panel);
    const pm = new THREE.PMREMGenerator(renderer);
    c[name] = pm.fromScene(s, 0.06).texture;
    pm.dispose(); geo.dispose(); dome.material.dispose(); panel.geometry.dispose(); panel.material.dispose();
  }
  return c[name];
}
