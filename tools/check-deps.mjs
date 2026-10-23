import path from 'node:path';
import { checkDeps } from './lib/deps.mjs';
const src = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'src');
const problems = checkDeps(src);
if (problems.length) { console.error('層級檢查失敗:\n' + problems.map(p => '  ✗ ' + p).join('\n')); process.exit(1); }
console.log('層級檢查通過');
