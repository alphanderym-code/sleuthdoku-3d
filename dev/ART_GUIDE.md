# Tiny Crimes art guide: "sunny vinyl-toy diorama"

Target look: a cosy, hand-made toy town seen from above. Everything is original to this game (no copies of other games'
characters, props, logos or signs).

- **Forms**: chunky, inflated, rounded. Generous bevels, no thin sticks, no knife edges, slightly exaggerated proportions.
  Every silhouette must read from the default camera (48° above the horizon, a cell is 60-110 px wide).
- **Materials**: matte to satin, painted-toy feel. No outlines, no toon steps. Flat colour plus a little hand-painted variation
  (two or three close tones, a lighter top, a darker base), never noisy textures.
- **Colour**: saturated and warm in light, blue-violet in shadow. Lemon-lime grass (`#b9cf45` family, shifting to `#d9dc5a` in
  sunny patches and `#8fb848` in shade), peach/tan dirt, warm grey-lilac asphalt, pale cream-beige kerbs and paving, teal water.
  Accents: coral red, sunflower, teal, plum, sky blue. Avoid pure black and pure white (darkest `#2e2a45`, lightest `#fff8ea`).
- **Foliage**: real leaf shapes. Trees and bushes are dense balls of rounded leaf cards (geometry, not alpha textures),
  light lemon at the sunny top to deeper green at the base. Shared helpers in `js/render/models/foliage.js`.
- **Light**: done globally (moods day / golden / night, AO, bloom). Do not bake strong shadows or highlights in textures.
- **Night**: things that would glow (lamps, screens, windows, signs, fires) use `glowMat()` so they light up after dark.

## Technical contract

- three.js r170, no build step, plain ES modules, **no downloads, no image files, no CDN**: geometry and canvas textures only.
- Materials come from `js/render/models/kit.js`: `toon(color, {flat, emissive, emissiveIntensity, double, rough, metal})` (shared, cached),
  `toonOwn` (not shared), `toonVC()` (vertex colours), `texToon(key,w,h,draw)`, `softMat(params)`, `glowMat(color, emissive, {day, night})`.
  All are `MeshStandardMaterial`s patched by `softshade.js`. `addOutlines` is a no-op; `noOutline` options are ignored.
- Geometry: `RB` (rounded box), `CYL`, `SPH`, `CAPS`, `TOR`, `LatheGeometry`… from kit; `add`, `addVC` (merged vertex-coloured parts),
  `addMerged`. Prefer merging many small parts (`addVC`) over many meshes: aim for **at most 12 draw calls and 6k triangles per object**,
  because boards go up to 16x16 with about 100 objects. Cache heavy geometry at module level and reuse it across instances.
- A model fits a 1x1 cell centred on x/z = 0, rests on y = 0, front faces +z. Keep public function names, signatures, builder keys,
  `STAND` heights (a figurine must still stand/sit plausibly on occupiable types) and `g.userData.idle(t)` hooks.
- Never call `Math.random()`: use the seeded `r()` passed to builders.
- Screenshots (local server on port 8765 is already running; nothing to start):
  `bash tools/shot.sh <abs/out.png> "<query>" [WxH]`, then Read the PNG. Queries (`dev/shot.html`):
  `scene=farm&solve=1` (a generated board with every character placed), `&zoom=0.5` (closer), `&polar=60&az=20`, `&tx=1&tz=-1`,
  `&mood=day|golden|night`, `m=objects&o=tree,bush&floor=grass&zoom=0.8` (model sheet), `m=figs&floor=tile` (characters), `m=weapons`,
  `m=floors` (all floors), `case=0..10`, `size=16&scene=zoo`. Errors show as red text in the picture. Write PNGs to the scratchpad only.
- Scene keys: lighthouse chalet museum bakery campsite greenhouse jazzclub boardwalk library station homestead apartment lake farm golf zoo park cruise ski airport.
