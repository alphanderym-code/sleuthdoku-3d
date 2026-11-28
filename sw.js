// Tiny Crimes service worker. Regenerate the list with: node tools/sw-list.mjs
const CACHE = 'tinycrimes-v10';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  'js/audio/sfx.js',
  'js/data/content.js',
  'js/game/state.js',
  'js/main.js',
  'js/model/categories.js',
  'js/model/clues.js',
  'js/model/facing.js',
  'js/model/generator.js',
  'js/model/grid.js',
  'js/model/hints.js',
  'js/model/objects.js',
  'js/model/rng.js',
  'js/model/solver.js',
  'js/model/weapons.js',
  'js/puzzles/cases.js',
  'js/puzzles/sample.js',
  'js/render/boardkit.js',
  'js/render/layout.js',
  'js/render/models/common.js',
  'js/render/models/extra.js',
  'js/render/models/extra2.js',
  'js/render/models/figurine.js',
  'js/render/models/foliage.js',
  'js/render/models/kit.js',
  'js/render/models/nature.js',
  'js/render/models/objects.js',
  'js/render/models/weapons3d.js',
  'js/render/models.js',
  'js/render/moods.js',
  'js/render/post.js',
  'js/render/scene.js',
  'js/render/softshade.js',
  'js/render/textures.js',
  'js/render/world/ctx.js',
  'js/render/world/index.js',
  'js/render/world/misc.js',
  'js/render/world/nature.js',
  'js/render/world/props.js',
  'js/render/world/ring.js',
  'js/render/world/shore.js',
  'js/render/world/town.js',
  'js/render/world.js',
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
  // cache:'reload' bypasses the browser HTTP cache, so a new version never precaches stale files.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
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
  const sameOrigin = new URL(req.url).origin === self.location.origin;
  const fromCache = () => caches.match(req, { ignoreSearch: true });
  const fromNetwork = () => fetch(req, sameOrigin ? { cache: 'no-cache' } : undefined).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  });

  if (!sameOrigin) {
    // Fonts and other third-party files rarely change: cache first.
    e.respondWith(fromCache().then((hit) => hit || fromNetwork()));
    return;
  }

  // Game files: network first so a pushed update shows on the next load.
  // Fall back to the cache when offline or when the network takes over 3 s.
  e.respondWith(new Promise((resolve) => {
    let done = false;
    const useCache = () => fromCache().then((hit) => {
      if (done) return;
      if (hit) { done = true; resolve(hit); }
    });
    const timer = setTimeout(useCache, 3000);
    fromNetwork().then((res) => {
      clearTimeout(timer);
      if (!done) { done = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      fromCache().then((hit) => {
        if (done) return;
        done = true;
        resolve(hit || caches.match('./index.html'));
      });
    });
  }));
});
