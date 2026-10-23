import test from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler } from '../../src/app/scheduler.js';

function rig(extra = {}) {
  let t = 0; const timers = []; const o = {
    now: () => t, hidden: () => !!extra.hidden, raf: () => {}, setTimer: (fn, ms) => { timers.push({ fn, at: t + ms }); return timers.length; }, clearTimer: () => {}, idleFps: 5,
  };
  const s = createScheduler(o); const frames = [];
  return { s, frames, advance(ms) { t += ms; }, set t(v) { t = v; }, get t() { return t }, start() { s.start((dt) => frames.push(dt)); } };
}
test('idle: redraws at the slow rate, skips in between', () => {
  const r = rig(); r.start();
  r.advance(50); r.s._tick(r.t);                    // 50 ms since last: below the ~194 ms idle gap
  assert.equal(r.s.stats.skipped >= 1, true);
  r.advance(200); r.s._tick(r.t); assert.equal(r.s.stats.rendered >= 1, true);
});
test('busy or poked: full speed (gap 0); the poke expires', () => {
  const r = rig(); r.start();
  assert.ok(r.s.gap() > 100);
  r.s.setBusy('anim', true); assert.equal(r.s.gap(), 0); r.s.setBusy('anim', false); assert.ok(r.s.gap() > 100);
  r.s.poke(700); assert.equal(r.s.gap(), 0); r.advance(701); assert.ok(r.s.gap() > 100);
});
test('hidden tab draws nothing', () => {
  const r = rig({ hidden: true }); r.start(); r.advance(5000); r.s._tick(r.t);
  assert.equal(r.s.stats.rendered, 0);
});
test('a long gap is clamped so animations do not jump', () => {
  const r = rig(); r.start(); r.s.setBusy('a', true); r.advance(10_000); r.s._tick(r.t);
  assert.ok(r.frames.at(-1) <= 0.2);
});
