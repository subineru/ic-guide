import test from 'node:test';
import assert from 'node:assert/strict';
import { createBus } from '../../src/core/events.js';
import { createStore } from '../../src/core/store.js';
import { createProgress, migrate } from '../../src/domain/progress.js';

const def = {
  id: 'c1', takeaways: ['a', 'b'],
  steps: [{ id: 's-one', level: 'core' }, { id: 's-two', level: 'core' }, { id: 'x-ext', level: 'ext' }, { id: 'gone', level: 'deferred' }],
};
const make = () => {
  const mem = new Map();
  const backend = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) };
  const store = createStore(backend), bus = createBus(); const p = createProgress({ store, bus }); p.register(def);
  return { p, store, bus, backend };
};

test('core steps drive completion; extension steps never block it', () => {
  const { p } = make();
  assert.equal(p.state('c1'), 'new');
  p.markStep('c1', 's-one'); assert.equal(p.state('c1'), 'doing');
  p.markStep('c1', 's-two'); assert.equal(p.isDone('c1'), true); assert.equal(p.isComplete('c1'), false);
  p.setTakeaway('c1', 0, true); p.setTakeaway('c1', 1, true);
  assert.equal(p.isComplete('c1'), true); assert.equal(p.state('c1'), 'done');
  assert.equal(p.counts('c1').extDone, 0);
});
test('unknown chapter reads as "soon"', () => assert.equal(make().p.state('nope'), 'soon'));
test('rewards: drops for steps/checks/any predict, gold for ext and first-try correct predict; nothing is deducted', () => {
  const { p } = make();
  p.markStep('c1', 's-one'); p.setTakeaway('c1', 0, true);
  assert.deepEqual(p.rewards(), { drops: 2, gold: 0 });
  p.markStep('c1', 'x-ext'); assert.equal(p.rewards().gold, 1);
  p.recordPredict('c1', 'q1', false); assert.deepEqual(p.rewards(), { drops: 3, gold: 1 });
  assert.equal(p.recordPredict('c1', 'q1', true), false);              // retrying does not farm rewards
  p.recordPredict('c1', 'q2', true); assert.deepEqual(p.rewards(), { drops: 4, gold: 2 });
  p.setTakeaway('c1', 0, false); assert.equal(p.rewards().drops, 3);   // un-ticking just removes that drop; never negative
});
test('a step removed from the content stops counting without breaking the record', () => {
  const { p } = make(); p.markStep('c1', 'ghost-step');
  assert.equal(p.rewards().drops, 0); assert.equal(p.counts('c1').coreDone, 0);
});
test('markStep is idempotent and persists; progress survives a new instance', () => {
  const { p, store, bus } = make();
  assert.equal(p.markStep('c1', 's-one'), true); assert.equal(p.markStep('c1', 's-one'), false);
  const again = createProgress({ store, bus }); again.register(def);
  assert.equal(again.stepDone('c1', 's-one'), true);
});
test('reset can be undone with a snapshot', () => {
  const { p } = make(); p.markStep('c1', 's-one');
  const snap = p.snapshot(); p.reset(); assert.equal(p.stepDone('c1', 's-one'), false);
  p.restore(snap); assert.equal(p.stepDone('c1', 's-one'), true);
});
test('export/import round-trips and rejects other files', () => {
  const { p } = make(); p.markStep('c1', 's-two');
  const text = p.exportJSON(); p.reset(); assert.equal(p.importJSON(text), null); assert.equal(p.stepDone('c1', 's-two'), true);
  assert.match(p.importJSON('{bad'), /JSON/); assert.match(p.importJSON('{"app":"other","data":{}}'), /不是本教材/);
});
test('migrate starts clean for unknown or older shapes', () => {
  assert.deepEqual(migrate(null), { v: 2, chapters: {} });
  assert.deepEqual(migrate({ v: 1, figs: { a: {} } }), { v: 2, chapters: {} });
});
test('storage failure falls back to memory', () => {
  const store = createStore({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
  store.set('k', { a: 1 }); assert.deepEqual(store.get('k'), { a: 1 }); assert.equal(store.get('missing', 7), 7);
});
