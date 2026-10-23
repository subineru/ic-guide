/* Production build.  Split build for GitHub Pages (ES modules, one hashed chunk per dynamic import) plus an optional
   single-file build that works from file://.  Usage: node tools/build.mjs */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const R = (...p) => path.join(root, ...p);
const built = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
for (const d of ['dist', 'dist-single']) fs.rmSync(R(d), { recursive: true, force: true });
fs.mkdirSync(R('dist', 'assets'), { recursive: true }); fs.mkdirSync(R('dist-single'), { recursive: true });

const CSS_TAG = '<link rel="stylesheet" href="./src/ui/css/app.css">';
const JS_TAG = '<script type="module" src="./src/main.js"></script>';
const tpl = fs.readFileSync(R('index.html'), 'utf8');
if (!tpl.includes(CSS_TAG) || !tpl.includes(JS_TAG)) throw new Error('index.html 的 css/js 標籤與 build.mjs 不一致');
const stamp = html => html.replace('<title>', `<meta name="build" content="${built}">\n<title>`);

/* 1) split build */
const r = await build({
  entryPoints: { main: R('src/main.js'), app: R('src/ui/css/app.css') },
  bundle: true, splitting: true, format: 'esm', minify: true, metafile: true, outdir: R('dist/assets'),
  entryNames: '[name]-[hash]', chunkNames: 'chunk-[name]-[hash]', target: ['es2020'], logLevel: 'warning',
});
fs.writeFileSync(R('dist-meta.json'), JSON.stringify(r.metafile));
const outs = Object.entries(r.metafile.outputs);
const byEntry = e => outs.find(([, o]) => o.entryPoint && o.entryPoint.endsWith(e));
const [mainOut, mainMeta] = byEntry('src/main.js'), [cssOut] = byEntry('app.css');
const staticImports = (mainMeta.imports || []).filter(i => i.kind === 'import-statement').map(i => path.basename(i.path));
const pre = staticImports.map(f => `<link rel="modulepreload" href="./assets/${f}">`).join('\n');
fs.writeFileSync(R('dist', 'index.html'), stamp(tpl
  .replace(CSS_TAG, `<link rel="stylesheet" href="./assets/${path.basename(cssOut)}">`)
  .replace(JS_TAG, `${pre}${pre ? '\n' : ''}<script type="module" src="./assets/${path.basename(mainOut)}"></script>`)));
fs.writeFileSync(R('dist', '.nojekyll'), '');
if (fs.existsSync(R('public'))) fs.cpSync(R('public'), R('dist'), { recursive: true });

/* 2) single-file build: no splitting (dynamic imports are inlined), works from file:// */
const one = await build({ entryPoints: { main: R('src/main.js'), app: R('src/ui/css/app.css') }, bundle: true, format: 'iife', minify: true, write: false, outdir: 'x', target: ['es2020'], logLevel: 'warning' });
const pick = ext => one.outputFiles.find(f => f.path.endsWith(ext)).text;
const js = pick('.js').replace(/<\/script/g, '<\\/script');
fs.writeFileSync(R('dist-single', 'ic-guide.html'), stamp(tpl.replace(CSS_TAG, `<style>${pick('.css')}</style>`).replace(JS_TAG, `<script>${js}</script>`)));

const kb = f => (fs.statSync(f).size / 1024).toFixed(1) + ' KB';
console.log('built', built);
for (const [f] of outs) console.log('  ' + path.relative(root, R(f)), kb(R(f)));
console.log('  dist-single/ic-guide.html', kb(R('dist-single', 'ic-guide.html')));
