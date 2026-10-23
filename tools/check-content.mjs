import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkChapters } from './lib/content-rules.mjs';
import { NODES, PATH } from '../src/domain/curriculum.js';
import { GLOSSARY } from '../src/content/glossary.js';
import { chapterLoaders } from '../src/content/index.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.join(root, 'src/content/chapters');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
const chapters = [];
for (const f of files) chapters.push((await import(pathToFileURL(path.join(dir, f)).href)).default);
const errs = checkChapters({ chapters, glossary: GLOSSARY, path: PATH, nodes: NODES });
files.forEach(f => { const id = f.replace(/\.js$/, ''); if (!chapterLoaders[id]) errs.push(`${id}: 有章節檔，但沒有登錄在 content/index.js`); });
Object.keys(chapterLoaders).forEach(id => { if (!files.includes(id + '.js')) errs.push(`${id}: 登錄了但找不到章節檔`); });
chapters.forEach(c => { if (c.placeholder) console.log(`  註:${c.id} 仍是版面示意用的暫代內容`); });
if (errs.length) { console.error('內容檢查失敗:\n' + errs.map(e => '  ✗ ' + e).join('\n')); process.exit(1); }
console.log(`內容檢查通過(${chapters.length} 章)`);
