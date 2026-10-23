import test from 'node:test';
import assert from 'node:assert/strict';
import { createBus } from '../../src/core/events.js';
import { createRunner } from '../../src/app/steps.js';

const make = () => { const bus = createBus(), r = createRunner({ bus }); return { bus, r }; };
const flush = () => new Promise(res => setImmediate(res));

test('tween moves a parameter with virtual time and resolves at the end', async () => {
  const { r } = make(); r.reset({ v: 0 });
  let done = false; const p = r.play({ run: async api => { await api.tween('v', 1, 2, { ease: t => t }); done = true; } });
  r.tick(1); assert.equal(r.P.v, 0.5); await flush(); assert.equal(done, false);
  r.tick(1); await flush(); assert.equal(r.P.v, 1); assert.equal(await p, true);
});
test('pause freezes time, nudge advances it, resume continues', async () => {
  const { r } = make(); r.reset({ v: 0 });
  r.play({ run: api => api.tween('v', 1, 4, { ease: t => t }) });
  r.tick(1); r.pause(); r.tick(10); assert.equal(r.P.v, 0.25);
  r.nudge(0.5); assert.equal(r.P.v, 0.375);
  r.resume(); r.tick(1); assert.equal(r.P.v, 0.625);
});
test('speed scales time and is clamped to 0.25..2', () => {
  const { r } = make(); r.reset({ v: 0 });
  r.play({ run: api => api.tween('v', 1, 4, { ease: t => t }) });
  r.setSpeed(2); r.tick(1); assert.equal(r.P.v, 0.5);
  r.setSpeed(99); assert.equal(r.speed, 2); r.setSpeed(0); assert.equal(r.speed, 0.25);
});
test('starting another step cancels the first: it resolves false and cannot touch parameters any more', async () => {
  const { r } = make(); r.reset({ v: 0, w: 0 });
  const first = r.play({ run: async api => { await api.wait(1); api.set('v', 99); } });
  const second = r.play({ run: async api => { api.set('w', 5); } });
  r.tick(5); assert.equal(await first, false); assert.equal(await second, true);
  assert.equal(r.P.v, 0); assert.equal(r.P.w, 5);
});
test('wait works and the active flag follows running animations', async () => {
  const { r, bus } = make(); const flags = []; bus.on('runner:active', a => flags.push(a)); r.reset({});
  const p = r.play({ run: async api => { await api.wait(1); } });
  assert.equal(r.active, true); r.tick(1.1); await p; assert.equal(r.active, false); assert.deepEqual(flags, [true, false]);
});
test('errors other than cancellation propagate', async () => {
  const { r } = make(); await assert.rejects(r.play({ run: async () => { throw new Error('boom'); } }), /boom/);
});
