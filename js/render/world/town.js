// Town: cream pavement plaza, warm lilac roads with traffic, toy shops and houses, street furniture.
import { GY, EXT, PAL, lawnBase } from './ctx.js';
import { ringFill, ringTrees } from './ring.js';
import { lamp, cornerLamps, bench, bin, planter, house, traffic, fliers, drifters, hedgeRow } from './props.js';

const WALLS = ['#f6d9a6', '#f2b8a0', '#cfe6c4', '#bfd9f0', '#f4e3a4', '#e8c7e8', '#f7cfa0'];
const ROOFS = ['#d9694f', '#5aa39f', '#8b6fb0', '#e39a45', '#c75a6a', '#4c88c8'];
const AWN = [PAL.coral, PAL.teal, PAL.sun, PAL.plum, PAL.sky];

export function buildTown(c) {
  const H = c.H, xr = H + 5.8, zr = H + 5.8, rw = 3.2, S = 1.7;
  const northZ = -(H + 3.7);
  c.buildGround({
    base: lawnBase(c.r() * 50),
    paint(P) {
      for (let i = 0; i < 26; i++) P.blot(c.rr(-EXT, EXT), c.rr(-EXT, EXT), c.rr(2.5, 6), c.pick([PAL.lawnL, PAL.lawnD, '#a8a64e']), 0.22);
      const pv = PAL.pave, pvD = '#b9996c';
      // sidewalks along the roads, shop pavement to the north and west, plaza ring around the board
      const sw = (x0, z0, x1, z1) => { P.rect(x0 - 0.06, z0 - 0.06, x1 + 0.06, z1 + 0.06, pvD, 0.45, 0.8); P.rect(x0, z0, x1, z1, pv, 0.4); };
      sw(xr - rw / 2 - 1.6, -EXT, xr + rw / 2 + 1.6, EXT);
      sw(-EXT, zr - rw / 2 - 1.6, EXT, zr + rw / 2 + 1.6);
      sw(-EXT, northZ - 1.2, xr - rw / 2 - 1.5, -(H + 2.0));
      sw(-(H + 2.2), -(H + 2.2), H + 2.2, H + 2.2);
      sw(-(H + 8.3), -(H + 3), -(H + 2.2), -(H + 2.0) + 0.1);
      // roads
      P.road([[xr, -EXT - 1], [xr, EXT + 1]], rw);
      P.road([[-EXT - 1, zr], [EXT + 1, zr]], rw, { crack: true });
      P.rect(xr - rw / 2 - 0.1, zr - rw / 2 - 0.1, xr + rw / 2 + 0.1, zr + rw / 2 + 0.1, PAL.asphalt, 0.1);
      // zebra crossings
      const zc = -H * 0.3, xc = -3;
      for (let i = 0; i < 6; i++) P.rect(xr - rw / 2 + 0.22 + i * 0.5, zc - 0.6, xr - rw / 2 + 0.55 + i * 0.5, zc + 0.6, '#d8cfc4', 0.06, 0.9);
      for (let i = 0; i < 6; i++) P.rect(xc - 0.6, zr - rw / 2 + 0.22 + i * 0.5, xc + 0.6, zr - rw / 2 + 0.55 + i * 0.5, '#d8cfc4', 0.06, 0.9);
      // parking lot
      const lx0 = -(H + 11), lx1 = -(H + 4.5), lz0 = zr + rw / 2 + 1.7, lz1 = lz0 + 3.6;
      P.rect(lx0, lz0, lx1, lz1, PAL.asphaltD, 0.3);
      for (let x = lx0 + 0.8; x < lx1; x += 1.3) P.rect(x, lz0 + 0.3, x + 0.06, lz1 - 0.3, '#d8cfc4', 0.02, 0.8);
    },
  });

  const T = traffic(c);
  c.claimRect(xr - rw / 2 - 2, -EXT, xr + rw / 2 + 2, EXT); c.claimRect(-EXT, zr - rw / 2 - 2, EXT, zr + rw / 2 + 2);
  c.claimRect(-(H + 2.5), -(H + 2.5), H + 2.5, H + 2.5);
  // moving traffic
  const L0 = -EXT - 2, L1 = EXT + 2;
  T.mover('car', 'z', xr - 0.8, 1, 1.5, L0, L1); T.mover('van', 'z', xr + 0.8, -1, 1.2, L0, L1); T.mover('car', 'z', xr + 0.8, -1, 1.7, L0, L1);
  T.mover('van', 'x', zr + 0.8, 1, 1.3, L0, L1); T.mover('car', 'x', zr - 0.8, -1, 1.6, L0, L1);
  if (c.N > 8) T.mover('car', 'x', zr - 0.8, -1, 1.1, L0, L1);
  // parked cars in the lot
  const lx0 = -(H + 11), lx1 = -(H + 4.5), lz0 = zr + rw / 2 + 1.7;
  c.claimRect(lx0, lz0, lx1, lz0 + 3.6);
  for (let x = lx0 + 1.45, i = 0; x < lx1 - 0.6; x += 1.3, i++) if (i % 3 !== 2) T.parked(i % 4 === 1 ? 'van' : 'car', x, lz0 + 1.85, Math.PI / 2 * (i % 2 ? 1 : -1) * 0 + (i % 2 ? 0 : Math.PI), null);

  // lamps, street furniture around the plaza
  cornerLamps(c, (cc, x, z, o) => lamp(cc, x, z, o), 1.5);
  for (const z of [-H * 0.5, H * 0.5]) { lamp(c, xr - rw / 2 - 1.2, z); lamp(c, xr + rw / 2 + 1.2, z + 1.5); }
  lamp(c, -(H + 6), zr - 2.6); lamp(c, H + 2.2, zr - 2.7);
  const ny = -(H + 1.7);
  for (const x of [-H * 0.55, H * 0.55]) { bench(c, x, ny - 0.15, 0); }
  planter(c, -H * 0.1 - 0.9, ny - 0.1, 0); planter(c, H * 0.1 + 0.9, ny - 0.1, 0);
  bin(c, -H * 0.55 + 1.0, ny - 0.15); bin(c, H * 0.55 - 1.0, ny - 0.15);
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) { planter(c, sx * (H + 1.9), sz * (H * 0.5), Math.PI / 2, 0.8); }
  bench(c, -(H + 1.7), -H * 0.2, Math.PI / 2 * 1); bench(c, H + 1.7, H * 0.2 - 1, -Math.PI / 2);
  bin(c, -(H + 1.7), H * 0.45); bin(c, H + 1.7, -H * 0.45);
  // low hedges and bushes in the front band
  hedgeRow(c, -(H + 1.5) - 3.5, H + 3.0, -(H + 1.5) - 0.2, H + 3.0);
  hedgeRow(c, H + 1.7, H + 3.0, H + 1.7 + 3.6, H + 3.0);
  for (let i = 0; i < 3; i++) c.bush(i % 2 ? 'round' : 'flower', c.rr(-H - 3, H + 3), H + c.rr(3.2, 3.8), c.rr(0.8, 1.1));

  // buildings north
  let x = -EXT + 3, k = 0;
  while (x < EXT - 3) {
    const w = c.rr(2.1, 3.0);
    const cx = x + w / 2;
    if (cx > xr - rw / 2 - 2.5 && cx < xr + rw / 2 + 2.5) { x += rw + 5; continue; }
    const shop = k % 3 !== 1;
    house(c, cx, northZ - 0.0 - (shop ? 0 : 0.3), { w, d: 2.0, h: c.rr(1.3, 1.9), wall: c.pick(WALLS), roof: c.pick(ROOFS), awning: shop ? c.pick(AWN) : null, shop, barrel: k % 2 === 0, ry: 0 });
    x += w + c.rr(0.15, 0.5); k++;
  }
  x = -EXT + 4;
  while (x < EXT - 4) {
    const w = c.rr(2.4, 3.4), cx = x + w / 2;
    if (!(cx > xr - rw / 2 - 2.5 && cx < xr + rw / 2 + 2.5)) house(c, cx, northZ - 3.9, { w, d: 2.4, h: c.rr(2.2, 3.2), wall: c.pick(WALLS), roof: c.pick(ROOFS), ry: 0, shop: false, barrel: c.r() < 0.4 });
    x += w + c.rr(0.4, 1.2);
  }
  // houses west and east (facing the board)
  for (const side of [-1, 1]) {
    const cx = side < 0 ? -(H + 4.4) : xr + rw / 2 + 4.2;
    for (let z = -(H + 2); z < H - 1.6; z += 3.3) {
      if (c.lowOnly(cx, z + 1.5)) continue;
      house(c, cx + c.rr(-0.3, 0.3), z + 0.5, { w: c.rr(1.9, 2.6), d: 2.0, h: c.rr(1.3, 1.9), wall: c.pick(WALLS), roof: c.pick(ROOFS), ry: side < 0 ? Math.PI / 2 : -Math.PI / 2, shop: z % 2 > 0.5 && side < 0, awning: z % 2 > 0.5 && side < 0 ? c.pick(AWN) : null, barrel: c.r() < 0.4 });
    }
    for (let z = -(H + 2); z < H - 3; z += 3.6) { if (c.lowOnly(cx - side * 8, z)) continue; house(c, cx + side * 3.9, z + 0.7, { w: 2.3, d: 2.1, h: c.rr(1.5, 2.3), wall: c.pick(WALLS), roof: c.pick(ROOFS), ry: side < 0 ? Math.PI / 2 : -Math.PI / 2, shop: false }); }
  }
  // trees and shrubs on remaining lawns
  c.scatter(26, 2.2, 20, (px, pz) => c.tree(c.pick(['round', 'round', 'tall', 'cherry']), px, pz, c.rr(0.8, 1.15)), { r: 1.0, tall: true, area: (px, pz) => Math.abs(px - xr) > 3.2 && Math.abs(pz - zr) > 3.2 && pz > northZ + 1.5 });
  c.scatter(8, 2.0, 18, (px, pz) => c.bush(c.pick(['round', 'flower', 'round', 'grass']), px, pz, c.rr(0.7, 1.1)), { r: 0.5, area: (px, pz) => Math.abs(px - xr) > 3.0 && Math.abs(pz - zr) > 3.0 });
  c.scatter(30, 2.0, 22, (px, pz) => (c.r() < 0.5 ? c.tuft(px, pz, c.rr(0.8, 1.3)) : c.flower(px, pz, c.pick([PAL.coral, PAL.sun, '#ffffff', '#ff9ec0']), c.rr(0.9, 1.3))), { r: 0.25 });
  ringTrees(c, ['round', 'round', 'tall', 'cherry'], 6, { s0: 0.7, s1: 0.95 });
  ringFill(c, { bushes: ['round', 'flower', 'grass'], bushN: 16, tufts: 70, flowers: 36, cols: [PAL.coral, PAL.sun, '#ffffff', '#ff9ec0'], rocks: 0 });
  T.finish();
  const pts = []; for (let i = 0; i < 5; i++) { const a = c.r() * 6.28, d = c.rr(H + 4, H + 12); pts.push([Math.cos(a) * d, Math.sin(a) * d]); }
  fliers(c, 'bf', pts, ['#ff9ec0', PAL.sun, '#ffffff', PAL.sky, PAL.coral], { rad: 1.6, h: 0.9 });
  drifters(c, 16, ['#f4b9c8', '#ffe3a0', '#ffffff'], { size: 0.12, fall: 0.25 });
}
