import test from 'node:test';
import assert from 'node:assert/strict';
import { focusBox } from '../../src/ui/focus-geom.js';

const bounds = { left: 100, top: 50, width: 400, height: 300 };
const r = (left, top, width, height) => ({ left, top, width, height });

test('focusBox: pads one rectangle and returns it relative to the stage', () => {
  assert.deepEqual(focusBox([r(200, 100, 60, 40)], bounds), { x: 90, y: 40, w: 80, h: 60 });
});
test('focusBox: several targets become one box around all of them', () => {
  assert.deepEqual(focusBox([r(150, 100, 20, 20), r(300, 200, 40, 40)], bounds, { pad: 0 }), { x: 50, y: 50, w: 190, h: 140 });
});
test('focusBox: tiny targets still get a visible ring', () => {
  const b = focusBox([r(300, 200, 2, 2)], bounds, { pad: 0, min: 32 });
  assert.equal(b.w, 32); assert.equal(b.h, 32);
});
test('focusBox: never leaves the stage', () => {
  const b = focusBox([r(90, 40, 30, 30)], bounds);
  assert.ok(b.x >= 0 && b.y >= 0);
  const c = focusBox([r(480, 340, 40, 40)], bounds);
  assert.ok(c.x + c.w <= bounds.width && c.y + c.h <= bounds.height);
});
test('focusBox: nothing to show -> null (no targets, empty rects, target outside the stage)', () => {
  assert.equal(focusBox([], bounds), null);
  assert.equal(focusBox([r(0, 0, 0, 0)], bounds), null);
  assert.equal(focusBox(null, bounds), null);
  assert.equal(focusBox([r(900, 900, 20, 20)], bounds), null);
  assert.equal(focusBox([r(200, 100, 20, 20)], { left: 0, top: 0, width: 0, height: 0 }), null);
});
