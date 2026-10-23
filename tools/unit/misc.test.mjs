import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { esc, bi, zh, len } from '../../src/core/text.js';
import { parse, href } from '../../src/app/router.js';
import { checkDeps, importsOf, stripComments } from '../lib/deps.mjs';
import { checkChapters } from '../lib/content-rules.mjs';
import { PATH, NODES } from '../../src/domain/curriculum.js';
import { GLOSSARY } from '../../src/content/glossary.js';
import basics from '../../src/content/chapters/basics.js';
import gates from '../../src/content/chapters/gates.js';

test('text helpers escape html and join zh/en', () => {
  assert.equal(esc('<a&"\'>'), '&lt;a&amp;&quot;&#39;&gt;');
  assert.equal(bi({ zh: '電壓', en: 'Voltage' }), '電壓 <span class="en">Voltage</span>');
  assert.equal(zh('x'), 'x'); assert.equal(len('電壓ab'), 4);
});
test('router parses hash routes and ignores everything else', () => {
  assert.deepEqual(parse('#/c/basics'), { name: 'chapter', id: 'basics' });
  assert.deepEqual(parse('#/'), { name: 'home' }); assert.deepEqual(parse(''), { name: 'home' });
  assert.deepEqual(parse('#/c/../x'), { name: 'home' });
  assert.equal(href({ name: 'chapter', id: 'gates' }), '#/c/gates');
});
test('import scanner sees static, re-export and dynamic imports but not comments', () => {
  const src = `import a from './a.js';\nexport { b } from './b.js';\nconst c = () => import('./c.js');\n// import x from './no.js'\n/* import('./no2.js') */`;
  assert.deepEqual(importsOf(src), ['./a.js', './b.js', './c.js']);
  assert.equal(stripComments('a // x\nb').includes('x'), false);
});
function tmpSrc(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ic-deps-'));
  for (const [f, s] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), s); }
  return d;
}
test('layer checker: allowed imports pass; outward imports, DOM globals and bare modules fail', () => {
  const ok = tmpSrc({ 'core/a.js': 'export const a = 1;', 'domain/b.js': "import { a } from '../core/a.js'; export const b = a;", 'main.js': "import '../src/x.js';" });
  const okFiles = checkDeps(ok).filter(p => !p.startsWith('main.js'));
  assert.deepEqual(okFiles, []);
  const bad = tmpSrc({
    'core/a.js': "import { b } from '../domain/b.js'; export const a = b;",
    'domain/b.js': 'export const b = document.title;',
    'content/c.js': "import 'lodash'; import '../ui/u.js';", 'ui/u.js': 'export const u = 1;',
  });
  const msgs = checkDeps(bad).join('\n');
  assert.match(msgs, /core 層不得匯入 domain/); assert.match(msgs, /domain 層不得使用瀏覽器全域 "document"/);
  assert.match(msgs, /裸模組/); assert.match(msgs, /content 層不得匯入 ui/);
});
test('the real src tree passes the layer checker', () => {
  assert.deepEqual(checkDeps(path.resolve(import.meta.dirname, '../../src')), []);
});
const run = chapters => checkChapters({ chapters, glossary: GLOSSARY, path: PATH, nodes: NODES });
test('content checker accepts the shipped placeholder chapters', () => assert.deepEqual(run([basics, gates]), []));
test('content checker: length, positional ids, forward references and extension-only terms are caught', () => {
  const clone = o => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'function' ? undefined : v)));
  const b = clone(basics); b.steps[0].say = '字'.repeat(41); b.steps[1].id = 's2'; b.steps[2].uses = ['inverter'];
  const msgs = run([b]).join('\n');
  assert.match(msgs, /超過 40 字/); assert.match(msgs, /位置式/); assert.match(msgs, /較後面的「gates」章才定義/);
  const g = [{ ...GLOSSARY[0], level: 'ext' }, ...GLOSSARY.slice(1)];
  const c = clone(basics); c.steps[1].uses = ['voltage'];
  assert.match(checkChapters({ chapters: [c], glossary: g, path: PATH, nodes: NODES }).join('\n'), /只在延伸中定義/);
  const d = clone(basics); d.introduces = ['voltage', 'current', 'resistance', 'semiconductor', 'inverter', 'nand'];
  assert.match(run([d]).join('\n'), /核心新名詞 6 個/);
});

test('content checker: a step may use a timeline instead of run, and its beats are linted like everything else', () => {
  const clone = o => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'function' ? undefined : v)));
  const withTl = (timeline, vocab = { params: ['v'], flows: [], pulses: [], targets: ['tank'] }) => {
    const b = clone(basics); b.vocab = vocab;
    b.steps = basics.steps.map((st, i) => (i === 0 ? { ...clone(st), timeline } : st));
    return b;
  };
  const good = [{ at: 0, caption: '水位代表電壓', focus: 'tank', set: { v: 0.2 } }, { at: 2, caption: '水位升高', tween: { v: [0.2, 0.9, 1.5] } }, { at: 5, caption: '電壓變大' }];
  const noRun = ch => { delete ch.steps[0].run; return ch; };
  assert.deepEqual(run([noRun(withTl(good))]), []);
  assert.match(run([noRun(withTl([{ at: 0, caption: '字'.repeat(25) }, ...good.slice(1)]))]).join('\n'), /的時間表：.*字幕 25 字，超過 20 字/);
  assert.match(run([noRun(withTl([{ at: 0, caption: 'x', focus: 'moon' }, ...good.slice(1)]))]).join('\n'), /焦點「moon」/);
  const both = withTl(good); both.steps[0].run = basics.steps[0].run;
  assert.match(run([both]).join('\n'), /不可同時有 run 與 timeline/);
  const neither = clone(basics); delete neither.steps[0].run; assert.match(run([neither]).join('\n'), /需要 run 或 timeline 其中一個/);
});
