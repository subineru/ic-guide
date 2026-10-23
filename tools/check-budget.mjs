/* Transfer budget (gzip, what a visitor actually downloads).  First load = html + main + its static imports + css.
   Every lazily loaded chunk has its own, smaller budget.  Brotli is NOT assumed (GitHub Pages serves gzip). */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const BUDGET = { firstLoadKB: 150, chunkKB: 60 };
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const gz = f => zlib.gzipSync(fs.readFileSync(f), { level: 9 }).length / 1024;
const meta = JSON.parse(fs.readFileSync(path.join(root, 'dist-meta.json'), 'utf8'));
const outs = Object.entries(meta.outputs);
const main = outs.find(([, o]) => o.entryPoint && o.entryPoint.endsWith('src/main.js'));
const css = outs.find(([, o]) => o.entryPoint && o.entryPoint.endsWith('app.css'));
const staticSet = new Set([main[0], css[0], ...(main[1].imports || []).filter(i => i.kind === 'import-statement').map(i => i.path)]);
const abs = p => (path.isAbsolute(p) ? p : path.join(root, p));
let first = gz(path.join(root, 'dist/index.html')), bad = 0;
for (const p of staticSet) first += gz(abs(p));
console.log(`首頁傳輸量(gzip) ${first.toFixed(1)} KB / 預算 ${BUDGET.firstLoadKB} KB`);
if (first > BUDGET.firstLoadKB) { bad++; console.error('  ✗ 首頁超過預算'); }
for (const [p] of outs) {
  if (staticSet.has(p)) continue;
  const kb = gz(abs(p)); const over = kb > BUDGET.chunkKB; if (over) bad++;
  console.log(`  ${over ? '✗' : '✓'} ${path.basename(p)}  ${kb.toFixed(1)} KB / ${BUDGET.chunkKB} KB`);
}
process.exit(bad ? 1 : 0);
