import test from 'node:test';
import assert from 'node:assert/strict';
import { SPINE } from '../../src/domain/curriculum.js';
import { flowTimeline, packetKeyframes, glowKeyframes, pixelKeyframes, partAt, LOOP_MS, TRAVEL_MS } from '../../src/app/flow.js';

const COORDS = [7.4, 19.5, 31.7, 43.9, 56.1, 68.3, 80.5, 92.6];
const tl = flowTimeline(SPINE, COORDS);

test('the signal changes form exactly where the real signal changes: bits -> higher-voltage bits (level shifter) -> analog (DAC) -> stronger (buffer)', () => {
  assert.deepEqual(tl.layers.map(l => l.kind), ['low', 'high', 'analog', 'strong']);
  const id = i => SPINE[i].id;
  assert.deepEqual(tl.layers.map(l => [id(l.from), id(l.to)]), [['link', 'level'], ['level', 'dac'], ['dac', 'buffer'], ['buffer', 'panel']]);
});
test('layers are contiguous and in time order; the packet reaches the panel at TRAVEL_MS; the pixel lights after that', () => {
  tl.layers.forEach((l, i) => { assert.ok(l.t1 > l.t0); if (i) assert.equal(l.t0, tl.layers[i - 1].t1); });
  assert.equal(tl.layers[0].t0, 0); assert.ok(Math.abs(tl.layers.at(-1).t1 - TRAVEL_MS) < 1e-6);
  assert.deepEqual(tl.arrivals.map(a => a.id), SPINE.map(p => p.id));
  tl.arrivals.forEach((a, i) => { if (i) assert.ok(a.t > tl.arrivals[i - 1].t); });
  assert.ok(tl.pixel.t0 >= TRAVEL_MS && tl.pixel.t1 < LOOP_MS);
});
test('time is proportional to distance along the path', () => {
  const k = TRAVEL_MS / (COORDS.at(-1) - COORDS[0]);
  tl.arrivals.forEach((a, i) => assert.ok(Math.abs(a.t - (COORDS[i] - COORDS[0]) * k) < 1e-6));
});
test('which part the packet is at', () => {
  assert.equal(partAt(tl, 0), 'link'); assert.equal(partAt(tl, tl.arrivals[4].t + 10), 'level'); assert.equal(partAt(tl, TRAVEL_MS), 'panel');
});
test('keyframes are valid Web Animations input: offsets 0..1 and never decrease', () => {
  const ok = kf => { assert.equal(kf[0].offset, 0); assert.equal(kf.at(-1).offset, 1); kf.forEach((f, i) => { assert.ok(f.offset >= 0 && f.offset <= 1); if (i) assert.ok(f.offset >= kf[i - 1].offset, `offset order at ${i}`); }); };
  tl.layers.forEach(l => ok(packetKeyframes(l, tl.loop, c => `translate(${c}px,0)`)));
  tl.arrivals.forEach(a => ok(glowKeyframes(a.t, tl.loop))); ok(pixelKeyframes(tl));
});
test('a packet is hidden outside its own time window and visible inside it', () => {
  const l = tl.layers[2], kf = packetKeyframes(l, tl.loop, c => `x${c}`);
  const opacityAt = off => { for (let i = 1; i < kf.length; i++) if (off <= kf[i].offset) { const a = kf[i - 1], b = kf[i]; return b.offset === a.offset ? b.opacity : a.opacity + ((b.opacity - a.opacity) * (off - a.offset)) / (b.offset - a.offset); } return 0; };
  assert.equal(opacityAt((l.t0 - 100) / tl.loop), 0); assert.equal(opacityAt(((l.t0 + l.t1) / 2) / tl.loop), 1); assert.equal(opacityAt((l.t1 + 100) / tl.loop), 0);
});
test('bad input is rejected', () => {
  assert.throws(() => flowTimeline(SPINE, COORDS.slice(1)), /need 8/);
  assert.throws(() => flowTimeline(SPINE, [1, 2, 3, 3, 5, 6, 7, 8]), /increase/);
  assert.throws(() => flowTimeline([{ id: 'a', signal: 'low' }, { id: 'b' }, { id: 'c' }], [1, 2, 3]), /no signal kind/);
  assert.throws(() => flowTimeline(SPINE, COORDS, { loop: 5000 }), /too short/);
});
