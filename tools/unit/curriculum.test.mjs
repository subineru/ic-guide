import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPath, PATH, ORDER, NODES, prerequisites } from '../../src/domain/curriculum.js';

test('the real curriculum builds, covers every node once and respects needs', () => {
  assert.equal(PATH.length, NODES.length);
  assert.equal(new Set(PATH).size, PATH.length);
  NODES.forEach(n => n.needs.forEach(d => assert.ok(PATH.indexOf(d) < PATH.indexOf(n.id), `${d} before ${n.id}`)));
});
test('recommended order is the engineer order with digital after mosfet', () => {
  assert.deepEqual(PATH, ['basics', 'die', 'mosfet', 'digital', 'gates', 'scan', 'datapath', 'fab', 'package']);
  assert.deepEqual(PATH, ORDER);
});
test('inserting a new basics chapter only needs a node and a needs edge', () => {
  const nodes = NODES.map(n => ({ ...n, needs: n.id === 'basics' ? ['electricity'] : n.needs }))
    .concat([{ id: 'electricity', needs: [], spine: [], title: { zh: '電是什麼', en: 'What is electricity' } }]);
  const p = buildPath(nodes, ['electricity', ...ORDER]);
  assert.equal(p[0], 'electricity'); assert.equal(p[1], 'basics');
});
test('needs win over ORDER when they disagree', () => {
  const nodes = [{ id: 'a', needs: ['b'] }, { id: 'b', needs: [] }];
  assert.deepEqual(buildPath(nodes, ['a', 'b']), ['b', 'a']);
});
test('cycles, unknown needs, duplicates and unknown ORDER entries throw', () => {
  assert.throws(() => buildPath([{ id: 'a', needs: ['b'] }, { id: 'b', needs: ['a'] }], []), /cycle/);
  assert.throws(() => buildPath([{ id: 'a', needs: ['x'] }], []), /unknown/);
  assert.throws(() => buildPath([{ id: 'a', needs: [] }, { id: 'a', needs: [] }], []), /duplicate/);
  assert.throws(() => buildPath([{ id: 'a', needs: [] }], ['zzz']), /unknown/);
});
test('prerequisites are transitive and in path order', () => {
  assert.deepEqual(prerequisites('gates'), ['basics', 'mosfet', 'digital']);
  assert.deepEqual(prerequisites('basics'), []);
});
