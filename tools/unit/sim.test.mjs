import test from 'node:test';
import assert from 'node:assert/strict';
import { current, clampR, MIN_R } from '../../src/domain/sim/ohm.js';
import { inverter, nand, inverterNetwork, nandNetwork, outputOf, INVERTER_TABLE, NAND_TABLE } from '../../src/domain/sim/logic.js';

test('flow grows with pressure and shrinks as the pipe narrows', () => {
  assert.ok(current(0.8, 0.5) > current(0.4, 0.5));
  assert.ok(current(0.6, 0.3) > current(0.6, 0.9));
  assert.equal(current(0, 0.5), 0);
});
test('flow is proportional to pressure and inversely proportional to resistance (before clamping)', () => {
  assert.ok(Math.abs(current(0.4, 0.5) * 2 - current(0.8, 0.5)) < 1e-12);
  assert.ok(Math.abs(current(0.5, 0.4) - current(0.5, 0.8) * 2) < 1e-12);
});
test('flow stays inside 0..1 and the pipe can never be completely closed (r has a floor)', () => {
  assert.equal(current(1, MIN_R), 1);
  for (const v of [-1, 0, 0.5, 1, 7]) for (const r of [-1, 0, 0.2, 1, 9]) { const i = current(v, r); assert.ok(i >= 0 && i <= 1 && Number.isFinite(i)); }
  assert.equal(clampR(0), MIN_R); assert.equal(clampR(5), 1);
});
test('inverter and NAND truth tables', () => {
  INVERTER_TABLE.forEach(([a, y]) => assert.equal(inverter(a), y));
  NAND_TABLE.forEach(([a, b, y]) => assert.equal(nand(a, b), y));
});
test('the switch networks give the same answer as the truth tables, and exactly one network conducts', () => {
  [0, 1].forEach(a => { const n = inverterNetwork(a); assert.notEqual(n.pullUp, n.pullDown); assert.equal(outputOf(n), inverter(a)); });
  [0, 1].forEach(a => [0, 1].forEach(b => { const n = nandNetwork(a, b); assert.notEqual(n.pullUp, n.pullDown, `a=${a} b=${b}`); assert.equal(outputOf(n), nand(a, b)); }));
});
test('NAND: up switches are in parallel (one is enough), down switches in series (both needed)', () => {
  assert.equal(nandNetwork(0, 1).pullUp, true); assert.equal(nandNetwork(1, 0).pullUp, true); assert.equal(nandNetwork(1, 1).pullUp, false);
  assert.equal(nandNetwork(1, 1).pullDown, true); assert.equal(nandNetwork(1, 0).pullDown, false); assert.equal(nandNetwork(0, 1).pullDown, false);
});
test('outputOf refuses a floating or shorted output', () => {
  assert.throws(() => outputOf({ pullUp: true, pullDown: true }), /shorted/);
  assert.throws(() => outputOf({ pullUp: false, pullDown: false }), /floating/);
});
