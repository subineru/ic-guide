import test from 'node:test';
import assert from 'node:assert/strict';
import { createBus } from '../../src/core/events.js';
import { createPlayer, SPEEDS } from '../../src/app/player.js';

const BEATS = [
  { at: 0, caption: 'A', focus: 'x' },
  { at: 2, caption: 'B', tween: { v: [0, 1, 2] } },
  { at: 4, caption: 'C', set: { w: 5 } },
  { at: 6, caption: 'D' },
];
const make = (beats = BEATS, opts = { initial: { v: 0, w: 0 } }) => {
  const bus = createBus(), log = [];
  ['player:beat', 'player:playing', 'player:end', 'player:ask', 'player:answer', 'player:mode'].forEach(e => bus.on(e, a => log.push([e, a])));
  const p = createPlayer({ bus }); p.load(beats, opts); return { p, log, bus };
};
const run = (p, sec, step = 0.1) => { for (let i = 0; i < Math.round(sec / step); i++) p.tick(step); };
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test('plays from the start, advances with ticks, stops at the end and says so once', () => {
  const { p, log } = make(); assert.equal(p.playing, true); assert.equal(p.t, 0);
  run(p, 1); near(p.t, 1); run(p, 10);
  assert.equal(p.t, p.duration); assert.equal(p.playing, false); assert.equal(log.filter(([e]) => e === 'player:end').length, 1);
  p.tick(1); assert.equal(log.filter(([e]) => e === 'player:end').length, 1);
});
test('speed scales the clock and is clamped to 0.25..2', () => {
  const { p } = make(); p.setSpeed(2); run(p, 1); near(p.t, 2);
  p.setSpeed(99); assert.equal(p.speed, 2); p.setSpeed(0); assert.equal(p.speed, 0.25); assert.deepEqual(SPEEDS, [0.25, 0.5, 1, 1.5, 2]);
});
test('pause freezes the clock; play continues; play at the end restarts', () => {
  const { p } = make(); run(p, 1); p.pause(); run(p, 5); near(p.t, 1); p.play(); run(p, 1); near(p.t, 2);
  run(p, 20); p.play(); assert.equal(p.t, 0); assert.equal(p.playing, true);
});
test('state follows the time: caption, focus, tweens', () => {
  const { p } = make(); p.pause(); p.seek(3);
  const s = p.state(); assert.equal(s.caption, 'B'); near(s.params.v, 0.5); assert.equal(s.beat, 1); assert.equal(s.duration, 8);
  p.seek(0); assert.deepEqual(p.state().focus, ['x']);
});
test('scrubbing back and forth gives the same picture for the same time', () => {
  const { p } = make(); p.pause();
  p.seek(3); const a = JSON.stringify(p.state().params); p.seek(7); p.seek(1); p.seek(3); assert.equal(JSON.stringify(p.state().params), a);
});
test('seek is clamped', () => { const { p } = make(); p.seek(-3); assert.equal(p.t, 0); p.seek(99); assert.equal(p.t, p.duration); });
test('beat navigation: next, previous (restarts a beat that has played a while), replay', () => {
  const { p } = make(); p.pause();
  p.nextBeat(); assert.equal(p.beat, 1); near(p.t, 2); p.nextBeat(); p.nextBeat(); p.nextBeat(); assert.equal(p.beat, 3);
  p.seek(4.8); p.prevBeat(); assert.equal(p.beat, 2); near(p.t, 4);                          // played 0.8 s (> 0.5 s) into beat C: restart C
  p.seek(4.2); p.prevBeat(); assert.equal(p.beat, 1); near(p.t, 2);                          // only 0.2 s in: go to the previous beat
  p.seek(4); p.nextBeat();
  p.seek(4); p.prevBeat(); assert.equal(p.beat, 1); near(p.t, 2);                            // exactly at its start: go to the previous beat
  p.prevBeat(); p.prevBeat(); assert.equal(p.beat, 0);
  p.seek(3.5); p.replayBeat(); near(p.t, 2); assert.equal(p.playing, true);
});
test('the beat event fires only when the beat changes', () => {
  const { p, log } = make(); run(p, 6.2);
  assert.deepEqual(log.filter(([e]) => e === 'player:beat').map(([, i]) => i), [0, 1, 2, 3]);
});

const ASK = { id: 'q1', q: '輸出會是？', options: ['0', '1'], answer: 1, why: '因為…' };
const WITH_ASK = [{ at: 0, caption: 'A' }, { at: 2, caption: 'B', ask: ASK }, { at: 4, caption: 'C', set: { w: 1 } }, { at: 6, caption: 'D' }];
test('a guess-first beat stops the clock exactly on its beat and waits for an answer', () => {
  const { p, log } = make(WITH_ASK); run(p, 10);
  near(p.t, 2); assert.equal(p.playing, false); assert.equal(p.pending.ask.id, 'q1'); assert.equal(log.filter(([e]) => e === 'player:ask').length, 1);
  p.tick(5); near(p.t, 2);                                                                      // still waiting
});
test('answering never punishes: right or wrong the timeline continues; only the first answer counts', () => {
  const { p, log } = make(WITH_ASK); run(p, 10);
  const r = p.answer(0); assert.deepEqual(r, { ok: false, firstTime: true }); assert.equal(p.playing, true); assert.equal(p.pending, null);
  run(p, 10); assert.equal(p.t, p.duration);
  p.seek(0); p.play(); run(p, 10); assert.equal(p.pending, null, 'an answered question is not asked again');
  assert.deepEqual(p.answerOf('q1'), { index: 0, ok: false });
  assert.equal(log.filter(([e]) => e === 'player:answer').length, 1);
});
test('answer with nothing pending does nothing', () => { const { p } = make(); assert.equal(p.answer(0), null); });
test('try mode: the timeline stops and parameters can be changed by hand; leaving clears the changes', () => {
  const { p } = make(); run(p, 3); p.enterTry();
  assert.equal(p.playing, false); assert.equal(p.mode, 'try'); const before = p.t; run(p, 3); assert.equal(p.t, before);
  p.setOverride('w', 9); assert.equal(p.state().params.w, 9); p.play(); assert.equal(p.playing, false, 'play does nothing in try mode');
  p.exitTry(); assert.equal(p.state().params.w, 0); assert.equal(p.mode, 'watch');
  p.setOverride('w', 3); assert.equal(p.state().params.w, 0, 'overrides only work in try mode');
});
test('reduced motion: no clock, one still picture per beat, next/previous move between them', () => {
  const { p } = make(); p.setBeatMode(true);
  assert.equal(p.playing, false); run(p, 5); assert.equal(p.beat, 0); p.play(); assert.equal(p.playing, false);
  p.nextBeat(); assert.equal(p.beat, 1);
  const s = p.state(); assert.equal(s.caption, 'B'); near(s.params.v, 1);                       // the end of beat B: the tween is finished
  p.nextBeat(); p.nextBeat(); assert.equal(p.beat, 3); p.nextBeat(); assert.equal(p.beat, 3);
  p.prevBeat(); assert.equal(p.beat, 2);
  p.setBeatMode(false); near(p.t, 4);
});
test('reduced motion: arriving at a guess-first beat shows the question, answering lets you go on', () => {
  const { p, log } = make(WITH_ASK); p.setBeatMode(true); p.nextBeat();
  assert.equal(p.pending.ask.id, 'q1'); assert.equal(log.filter(([e]) => e === 'player:ask').length, 1);
  p.answer(1); assert.equal(p.pending, null); assert.equal(p.playing, false);
});
test('entering try mode is ignored in reduced motion; turning reduced motion on leaves try mode', () => {
  const a = make().p; a.setBeatMode(true); a.enterTry(); assert.equal(a.mode, 'watch');
  const b = make().p; b.enterTry(); b.setBeatMode(true); assert.equal(b.mode, 'watch');
});
test('state events carry the full state', () => {
  const { p, bus } = make(); let last; bus.on('player:state', s => { last = s; });
  p.seek(3); assert.equal(last.caption, 'B'); assert.equal(last.mode, 'watch'); assert.equal(last.beatCount, 4);
});
