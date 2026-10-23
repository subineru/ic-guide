import test from 'node:test';
import assert from 'node:assert/strict';
import { compileTimeline, evaluate, frameAtBeatEnd, beatIndexAt, timelineProblems, EASE, LIMITS } from '../../src/domain/timeline.js';

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const INVERTER = [
  { at: 0, caption: '反相器：輸出和輸入相反', focus: 'whole' },
  { at: 2, caption: '輸入是 0', focus: 'input', set: { a: 0 } },
  { at: 4, caption: '上方開關接通', focus: 'swUp', tween: { upClosed: [0, 1, 1] }, pulse: { name: 'ctl', dur: 1 } },
  { at: 6, caption: '水流進輸出端', focus: ['bucket', 'output'], flow: { up: [0, 1, 2] } },
  { at: 9, caption: '輸出是 1', focus: 'output', set: { y: 1 } },
];
const tl = compileTimeline(INVERTER, { initial: { a: 1, upClosed: 0, y: 0 } });

test('duration, beats and their time ranges', () => {
  assert.equal(tl.beats.length, 5);
  assert.deepEqual(tl.beats.map(b => [b.at, b.end]), [[0, 2], [2, 4], [4, 6], [6, 9], [9, 11]]);     // last beat holds 2 s by default
  assert.equal(tl.duration, 11);
});
test('caption and focus follow the current beat; focus is always a list', () => {
  assert.equal(evaluate(tl, 0).caption, '反相器：輸出和輸入相反'); assert.deepEqual(evaluate(tl, 0).focus, ['whole']);
  assert.equal(evaluate(tl, 3.99).caption, '輸入是 0'); assert.equal(evaluate(tl, 4).caption, '上方開關接通');
  assert.deepEqual(evaluate(tl, 7).focus, ['bucket', 'output']);
});
test('set jumps at its time; before that the starting value shows', () => {
  assert.equal(evaluate(tl, 1.99).params.a, 1); assert.equal(evaluate(tl, 2).params.a, 0);
  assert.equal(evaluate(tl, 8.99).params.y, 0); assert.equal(evaluate(tl, 9).params.y, 1);
});
test('tween moves from -> to over its duration, then holds', () => {
  assert.equal(evaluate(tl, 3.9).params.upClosed, 0); near(evaluate(tl, 4.5).params.upClosed, 0.5); assert.equal(evaluate(tl, 5).params.upClosed, 1); assert.equal(evaluate(tl, 10).params.upClosed, 1);
});
test('flows are separate from parameters and default to 0', () => {
  const e = evaluate(tl, 7); near(e.flows.up, 0.5); assert.equal('up' in e.params, false); assert.equal(evaluate(tl, 0).flows.up, 0); assert.equal(evaluate(tl, 11).flows.up, 1);
});
test('a pulse reports its progress while it travels, and null otherwise', () => {
  assert.equal(evaluate(tl, 3).pulses.ctl, null); near(evaluate(tl, 4.25).pulses.ctl, 0.25); assert.equal(evaluate(tl, 5.5).pulses.ctl, null);
});
test('the same t always gives the same answer, in any order (no hidden state)', () => {
  const times = [10, 0, 4.5, 7, 4.5, 11, 2, 7];
  const first = times.map(x => JSON.stringify(evaluate(tl, x)));
  const again = [...times].reverse().map(x => JSON.stringify(evaluate(tl, x))).reverse();
  assert.deepEqual(first, again);
});
test('t outside the timeline is clamped', () => { assert.equal(evaluate(tl, -5).t, 0); assert.equal(evaluate(tl, 99).t, 11); assert.equal(evaluate(tl, 99).atEnd, true); });
test('an omitted "from" continues from where that parameter last was', () => {
  const t2 = compileTimeline([{ at: 0, caption: 'a', tween: { v: { to: 1, dur: 1 } } }, { at: 2, caption: 'b', tween: { v: { to: 0.25, dur: 1 } } }], { initial: { v: 0 } });
  assert.equal(evaluate(t2, 1.5).params.v, 1); near(evaluate(t2, 2.5).params.v, 0.625); assert.equal(evaluate(t2, 3).params.v, 0.25);
});
test('easing functions start at 0, end at 1 and (except back) never leave 0..1', () => {
  for (const [name, f] of Object.entries(EASE)) { near(f(0), 0); near(f(1), 1); if (name !== 'back') for (let x = 0; x <= 1; x += 0.05) assert.ok(f(x) >= -1e-9 && f(x) <= 1 + 1e-9, name); }
  assert.ok(Math.max(...[...Array(21)].map((_, i) => EASE.back(i / 20))) > 1);                       // back overshoots on purpose
});
test('the picture at the end of a beat is the state just before the next beat starts', () => {
  const f = frameAtBeatEnd(tl, 1);                                                                     // end of beat 2 = just before t=4
  assert.equal(f.caption, '輸入是 0'); assert.equal(f.params.upClosed, 0);
  const last = frameAtBeatEnd(tl, 4); assert.equal(last.atEnd, true); assert.equal(last.params.y, 1);
  near(frameAtBeatEnd(tl, 2).flows.up, 0);                                                              // flow had not started yet
});
test('beatIndexAt', () => { assert.equal(beatIndexAt(tl, 0), 0); assert.equal(beatIndexAt(tl, 3.99), 1); assert.equal(beatIndexAt(tl, 99), 4); });

test('structure errors are rejected with a message that says where', () => {
  const bad = (beats, re) => assert.throws(() => compileTimeline(beats, { initial: { a: 0 } }), re);
  bad([], /至少要有一個小段/);
  bad([{ at: 1, caption: 'x' }], /at 必須是 0/);
  bad([{ at: 0, caption: 'x' }, { at: 0, caption: 'y' }], /必須比前一小段大/);
  bad([{ at: 0, caption: 'x', tween: { a: [0, 1, 3] } }, { at: 1, caption: 'y', tween: { a: [1, 0, 1] } }], /不可重疊/);
  bad([{ at: 0, caption: 'x', tween: { zz: { to: 1, dur: 1 } } }], /沒有起始值/);
  bad([{ at: 0, caption: 'x', tween: { a: { to: 1, dur: 0 } } }], /秒數 > 0/);
  bad([{ at: 0, caption: 'x', tween: { a: { to: 1, dur: 1, ease: 'wobble' } } }], /未知的緩動/);
  bad({ beats: [{ at: 0, caption: 'x', tween: { a: [0, 1, 5] } }], duration: 3 }, /比最後一個變化/);
  bad([{ at: 0, caption: 'x', pulse: { name: 'p', dur: 2 } }, { at: 1, caption: 'y', pulse: { name: 'p', dur: 1 } }], /脈衝/);
});
test('the timeline lasts until its last change has finished', () => {
  const t3 = compileTimeline([{ at: 0, caption: 'x', tween: { a: [0, 1, 6] } }, { at: 1, caption: 'y' }], { initial: { a: 0 } });
  assert.equal(t3.duration, 6);
});

const VOCAB = { params: ['a', 'upClosed', 'y'], flows: ['up'], pulses: ['ctl'], targets: ['input', 'swUp', 'bucket', 'output'] };
const good = INVERTER.slice();
test('lint: the example is clean', () => assert.deepEqual(timelineProblems(good, VOCAB), []));
test('lint catches long captions, unknown targets / params / flows / pulses, missing captions and a wrong number of beats', () => {
  const msgs = timelineProblems([
    { at: 0, caption: '字'.repeat(LIMITS.caption + 1), focus: 'nowhere' },
    { at: 1, caption: '', set: { nope: 1 } },
    { at: 2, caption: 'ok', flow: { drip: [0, 1, 1] }, pulse: 'zap' },
    { at: 3, caption: 'ok' },
  ], VOCAB).join('\n');
  assert.match(msgs, /字幕 21 字，超過 20 字/); assert.match(msgs, /焦點「nowhere」/); assert.match(msgs, /缺少字幕/);
  assert.match(msgs, /未宣告的參數「nope」/); assert.match(msgs, /未宣告的流動「drip」/); assert.match(msgs, /未宣告的脈衝「zap」/);
  assert.match(timelineProblems([{ at: 0, caption: 'a' }, { at: 1, caption: 'b' }], VOCAB).join(), /小段數量應為 3~8 個，目前 2 個/);
});
test('lint checks guess-first beats and reports compile errors too', () => {
  const ask = { id: 'q', q: '輸出是？', options: ['0', '1'], answer: 1, why: '因為…' };
  assert.deepEqual(timelineProblems([{ at: 0, caption: 'a' }, { at: 1, caption: 'b', ask }, { at: 2, caption: 'c' }], VOCAB), []);
  assert.match(timelineProblems([{ at: 0, caption: 'a' }, { at: 1, caption: 'b', ask: { ...ask, answer: 5 } }, { at: 2, caption: 'c' }], VOCAB).join(), /先猜需要/);
  assert.match(timelineProblems([{ at: 0, caption: 'a' }, { at: 0, caption: 'b' }, { at: 2, caption: 'c' }], VOCAB).join(), /必須比前一小段大/);
});
