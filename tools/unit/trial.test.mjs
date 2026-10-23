import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../src/core/store.js';
import { createTrial } from '../../src/app/trial.js';

const make = (t0 = 1_700_000_000_000) => { let t = t0; const store = createStore(null); const tr = createTrial({ store, now: () => t }); return { tr, store, tick: ms => { t += ms; } }; };

test('stuck notes are stored with chapter and step, and trimmed', () => {
  const { tr } = make(); tr.stuck('basics', 'water-analogy', '  水管比喻看不懂  ');
  assert.equal(tr.count('stuck'), 1); assert.deepEqual([tr.entries()[0].chapter, tr.entries()[0].step, tr.entries()[0].note], ['basics', 'water-analogy', '水管比喻看不懂']);
  tr.stuck('basics', 'intro', 'x'.repeat(900)); assert.equal(tr.entries()[1].note.length, 500);
});
test('the report lists the questions, the time spent and every "don\'t understand"', () => {
  const { tr, tick } = make();
  tr.add('enter', { chapter: 'basics' }); tick(60_000); tr.add('step-done', { chapter: 'basics', step: 'water-analogy' });
  tick(120_000); tr.stuck('basics', 'semiconductor-controllable', '導體和半導體分不出來'); tr.stuck('basics', 'intro', '');
  tick(120_000); tr.add('step-done', { chapter: 'basics', step: 'semiconductor-controllable' });
  const txt = tr.toText({ ua: 'TestBrowser', build: '2026-10-22', titles: { basics: '電與半導體', 'semiconductor-controllable': '半導體可以被控制' } });
  assert.match(txt, /哪些詞或句子你看不懂/); assert.match(txt, /哪個地方讓你想放棄/);
  assert.match(txt, /■ 電與半導體：完成 2 個步驟，從進入到最後一個步驟完成約 5 分鐘/);
  assert.match(txt, /看不懂：半導體可以被控制\s+「導體和半導體分不出來」/); assert.match(txt, /看不懂：（章節開頭）\s+（沒有補充說明）/);
  assert.match(txt, /TestBrowser/);
});
test('an empty log says so, and clear() empties it', () => {
  const { tr } = make(); assert.match(tr.toText(), /（沒有記錄）/);
  tr.add('enter', { chapter: 'gates' }); tr.clear(); assert.equal(tr.entries().length, 0);
});
test('the log survives a new instance (same storage)', () => {
  const { tr, store } = make(); tr.stuck('gates', 'inverter', '不懂');
  assert.equal(createTrial({ store }).count('stuck'), 1);
});
