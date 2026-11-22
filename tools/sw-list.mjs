// Prints the precache file list (relative to project root) for sw.js.
import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (d) => readdirSync(join(root, d)).sort().flatMap((n) => {
  const p = d + '/' + n;
  return statSync(join(root, p)).isDirectory() ? walk(p) : [p];
});
['js', 'css', 'vendor', 'icons'].flatMap(walk).forEach((f) => console.log(f));
