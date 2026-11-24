// The world around the board (see worldOf in moods.js).
import * as THREE from 'three';
import { softMat } from './models.js';
import { noRaycast } from './layout.js';

/** Returns { group, lampSpots: Vector3[], setMood(name, preset), update(t, dt) }. Added to the board group, disposed with it. */
export function buildWorld(view, puzzle) {
  const group = new THREE.Group(); group.name = 'world';
  const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 48).rotateX(-Math.PI / 2), softMat({ color: '#a3b956', roughness: 0.95 }));
  ground.position.y = -0.42; ground.receiveShadow = true;
  group.add(ground);
  group.traverse((o) => { o.raycast = noRaycast; });
  return { group, lampSpots: [], setMood() {}, update() {} };
}
