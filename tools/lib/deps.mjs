/* Layer rules for src/.  Dependencies may only point inward; main.js is the composition root and may import anything. */
import fs from 'node:fs';
import path from 'node:path';

export const ALLOW = {
  core: [],
  domain: ['core'],
  content: ['core', 'domain'],
  app: ['core', 'domain'],
  render: ['core', 'domain', 'app'],
  ui: ['core', 'domain', 'app'],
  audio: ['core', 'app'],
};
/* these layers must stay free of browser globals so they run (and are tested) in plain Node */
export const PURE = ['core', 'domain', 'content'];
export const GLOBALS_ALLOWED_IN = ['core/store.js'];
const DOM_RE = /\b(window|document|navigator|localStorage|sessionStorage|location|requestAnimationFrame|performance|HTMLElement)\b/;

export function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}
export function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? listFiles(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []));
}
export function importsOf(src) {
  const code = stripComments(src), out = [];
  const re = /(?:import|export)\s+(?:[^'"`;]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m; while ((m = re.exec(code))) out.push(m[1] || m[2]);
  return out;
}
export const layerOf = rel => { const top = rel.split('/')[0]; return rel.includes('/') ? top : null; };

export function checkDeps(srcDir) {
  const problems = [];
  for (const file of listFiles(srcDir)) {
    const rel = path.relative(srcDir, file).split(path.sep).join('/');
    const layer = layerOf(rel);
    const src = fs.readFileSync(file, 'utf8');
    if (layer && !ALLOW[layer]) problems.push(`${rel}: 未知的層 "${layer}"`);
    if (layer && PURE.includes(layer) && !GLOBALS_ALLOWED_IN.includes(rel)) {
      const m = stripComments(src).match(DOM_RE);
      if (m) problems.push(`${rel}: ${layer} 層不得使用瀏覽器全域 "${m[1]}"`);
    }
    for (const spec of importsOf(src)) {
      if (!spec.startsWith('.')) { problems.push(`${rel}: 不允許裸模組匯入 "${spec}"(只能用相對路徑)`); continue; }
      const target = path.relative(srcDir, path.resolve(path.dirname(file), spec)).split(path.sep).join('/');
      const tl = layerOf(target);
      if (!layer) continue;                                           // main.js: composition root
      if (!tl) { problems.push(`${rel}: 不得匯入組合根 "${spec}"`); continue; }
      if (tl !== layer && !ALLOW[layer].includes(tl)) problems.push(`${rel}: ${layer} 層不得匯入 ${tl} 層("${spec}")`);
      if (!fs.existsSync(path.resolve(path.dirname(file), spec))) problems.push(`${rel}: 找不到 "${spec}"`);
    }
  }
  return problems;
}
