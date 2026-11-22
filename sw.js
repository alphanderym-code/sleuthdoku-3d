// Tiny Crimes service worker. Regenerate the list with: node tools/sw-list.mjs
const CACHE = 'tinycrimes-v2';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  'js/audio/sfx.js',
  'js/data/content.js',
  'js/game/state.js',
  'js/main.js',
  'js/model/clues.js',
  'js/model/generator.js',
  'js/model/grid.js',
  'js/model/hints.js',
  'js/model/objects.js',
  'js/model/rng.js',
  'js/model/solver.js',
  'js/puzzles/cases.js',
  'js/puzzles/sample.js',
  'js/render/models/figurine.js',
  'js/render/models/kit.js',
  'js/render/models/objects.js',
  'js/render/models.js',
  'js/render/scene.js',
  'js/ui/hud.js',
  'css/style.css',
  'vendor/three/build/three.module.js',
  'vendor/three/examples/jsm/controls/OrbitControls.js',
  'vendor/three/examples/jsm/geometries/RoundedBoxGeometry.js',
  'vendor/three/examples/jsm/utils/BufferGeometryUtils.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
