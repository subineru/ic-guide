import test from 'node:test';
import assert from 'node:assert/strict';
import { NODES, SPINE, IC_PARTS, ALL_PARTS, partNumber, placementOf, directNeeds } from '../../src/domain/curriculum.js';

const spineIds = SPINE.map(p => p.id);
const node = id => NODES.find(n => n.id === id);

test('the main line has the phone-side link, six parts inside the IC, and the panel', () => {
  assert.deepEqual(spineIds, ['link', 'receive', 'shift', 'latch', 'level', 'dac', 'buffer', 'panel']);
  assert.deepEqual(IC_PARTS, ['receive', 'shift', 'latch', 'level', 'dac', 'buffer']);
  assert.deepEqual(SPINE.filter(p => p.zone !== 'ic').map(p => p.id), ['link', 'panel']);
});
test('only parts inside the IC are numbered, 1 to 6', () => {
  assert.deepEqual(IC_PARTS.map(partNumber), [1, 2, 3, 4, 5, 6]);
  assert.equal(partNumber('link'), null); assert.equal(partNumber('panel'), null);
});
test('every chapter has exactly one place on the map: foundation, hang, span, or the chip itself', () => {
  NODES.forEach(n => {
    const places = [!!n.foundation, !!(n.hang && n.hang.length), !!n.span, ['chip', 'making'].includes(n.stage)].filter(Boolean).length;
    assert.equal(places, 1, `${n.id} must be exactly one of foundation / hang / span / chip (found ${places})`);
    assert.ok(['foundation', 'hang', 'span', 'chip'].includes(placementOf(n)));
  });
});
test('hang and spine references point at real main-line parts', () => {
  NODES.forEach(n => [...(n.hang || []), ...n.spine].forEach(id => assert.ok(spineIds.includes(id), `${n.id} references unknown part "${id}"`)));
});
test('the transistor relates to every part inside the IC, and not to the two ends', () => {
  const m = node('mosfet');
  assert.ok(m.foundation, 'mosfet is a foundation chapter, not a child of one part');
  assert.deepEqual([...m.spine].sort(), [...IC_PARTS].sort());
  assert.ok(!m.spine.includes('panel') && !m.spine.includes('link'));
});
test('foundation chapters are never hung under a single main-line part', () => {
  NODES.filter(n => n.foundation).forEach(n => { assert.ok(!(n.hang && n.hang.length), `${n.id}`); assert.ok(n.spine.length >= 2, `${n.id} should relate to several parts`); });
});
test('chapters that hang under parts also highlight those parts', () => {
  NODES.filter(n => placementOf(n) === 'hang').forEach(n => n.hang.forEach(id => assert.ok(n.spine.includes(id), `${n.id} hangs under ${id} but does not highlight it`)));
});
test('gates sits between shift register and latch; scan under the panel; the data-path chapter spans the whole line', () => {
  assert.deepEqual(node('gates').hang, ['shift', 'latch']);
  assert.deepEqual(node('scan').hang, ['panel']);
  const d = node('datapath');
  assert.equal(placementOf(d), 'span'); assert.deepEqual([...d.spine].sort(), [...ALL_PARTS].sort());
});
test('direct prerequisites: redundant edges are dropped, the rest kept', () => {
  const key = e => e.join('>');
  assert.deepEqual(directNeeds().map(key).sort(), ['basics>die', 'basics>mosfet', 'die>fab', 'digital>gates', 'fab>package', 'gates>datapath', 'mosfet>digital', 'mosfet>fab', 'scan>datapath'].sort());
  const chain = [{ id: 'a', needs: [] }, { id: 'b', needs: ['a'] }, { id: 'c', needs: ['a', 'b'] }];
  assert.deepEqual(directNeeds(chain).map(key), ['a>b', 'b>c']);
  const diamond = [{ id: 'a', needs: [] }, { id: 'b', needs: ['a'] }, { id: 'c', needs: ['a'] }, { id: 'd', needs: ['b', 'c'] }];
  assert.deepEqual(directNeeds(diamond).map(key).sort(), ['a>b', 'a>c', 'b>d', 'c>d']);
});

test('every part except the last says what signal leaves it, and the sequence only ever moves forward: low -> high -> analog -> strong', () => {
  const order = ['low', 'high', 'analog', 'strong'];
  const kinds = SPINE.slice(0, -1).map(p => p.signal);
  kinds.forEach((k, i) => { assert.ok(order.includes(k), `${SPINE[i].id}: ${k}`); if (i) assert.ok(order.indexOf(k) >= order.indexOf(kinds[i - 1]), `${SPINE[i].id} goes backwards`); });
  assert.equal(SPINE.at(-1).signal, undefined);
  assert.equal(SPINE.find(p => p.id === 'level').signal, 'high');          // the level shifter is where bits become higher-voltage bits
  assert.equal(SPINE.find(p => p.id === 'dac').signal, 'analog');         // the DAC is where they become an analog voltage
});
