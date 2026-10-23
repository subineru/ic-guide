/* The player: the single source of "what is on screen now".  It owns a clock (virtual: tick(dt) advances it, so tests need
   no real time) and asks domain/timeline.js what that moment looks like.  Everything a learner can do is a way of choosing
   the time t: play / pause / speed (clock), scrub / next beat / previous beat / replay this beat (seek).
   Modes:
     watch     the timeline plays itself (default)
     try       the timeline is paused and the learner changes parameters by hand (overrides)
     beatMode  "reduced motion": no movement; one still picture per beat, advanced by next / previous beat
   Events on the bus: player:state (every change, with the state), player:beat, player:playing, player:end, player:ask,
   player:answer, player:mode. */
import { compileTimeline, evaluate, frameAtBeatEnd, beatIndexAt } from '../domain/timeline.js';

export const SPEEDS = [0.25, 0.5, 1, 1.5, 2];
const RESTART_AFTER = 0.5;          // "previous beat" restarts the current beat when it has been playing longer than this
const EPS = 1e-9;

export function createPlayer({ bus }) {
  let tl = null, t = 0, playing = false, speed = 1, mode = 'watch', beatMode = false, beatIdx = 0;
  let overrides = {}, pending = null, endedFired = false, lastBeat = -1;
  const asked = new Set(), answered = new Map();               // ask beats already presented / already answered (first answer is kept)
  const emit = (ev, arg) => bus.emit(ev, arg);

  const state = () => {
    if (!tl) return null;
    const s = beatMode ? frameAtBeatEnd(tl, beatIdx) : evaluate(tl, t);
    if (mode === 'try') s.params = { ...s.params, ...overrides };
    return Object.assign(s, { mode, playing, beatMode, speed, duration: tl.duration, beatCount: tl.beats.length, pending });
  };
  function changed() {
    const s = state(); if (!s) return;
    if (s.beat !== lastBeat) { lastBeat = s.beat; emit('player:beat', s.beat); }
    emit('player:state', s);
  }
  const setPlaying = v => { if (playing !== v) { playing = v; emit('player:playing', v); } };

  const api = {
    get t() { return beatMode && tl ? tl.beats[beatIdx].at : t; },
    get duration() { return tl ? tl.duration : 0; },
    get playing() { return playing; },
    get speed() { return speed; },
    get mode() { return mode; },
    get beatMode() { return beatMode; },
    get beat() { return beatMode ? beatIdx : tl ? beatIndexAt(tl, t) : 0; },
    get beatCount() { return tl ? tl.beats.length : 0; },
    get pending() { return pending; },
    get timeline() { return tl; },
    state,

    /* spec: a step's timeline.  params / flows: starting values.  autoplay: start playing at once (not in beatMode). */
    load(spec, { initial = {}, flows = {}, autoplay = true } = {}) {
      tl = compileTimeline(spec, { initial, flows });
      t = 0; beatIdx = 0; overrides = {}; pending = null; endedFired = false; asked.clear(); answered.clear(); lastBeat = -1;
      if (mode === 'try') { mode = 'watch'; emit('player:mode', mode); }
      setPlaying(autoplay && !beatMode);
      changed(); return api;
    },
    unload() { tl = null; setPlaying(false); pending = null; },

    /* advance the clock by dt real seconds (the caller passes the frame time) */
    tick(dt) {
      if (!tl || !playing || pending || beatMode || mode === 'try') return;
      const from = t, to = t + dt * speed;
      for (const b of tl.beats) {                                   // a guess-first beat stops the clock exactly on its beat
        if (!b.ask || asked.has(b.index) || answered.has(b.ask.id)) continue;
        if (b.at >= from - EPS && b.at <= to + EPS) {
          t = b.at; asked.add(b.index); pending = { beat: b.index, ask: b.ask }; setPlaying(false); emit('player:ask', pending); changed(); return;
        }
      }
      if (to >= tl.duration - EPS) {
        t = tl.duration; setPlaying(false);
        if (!endedFired) { endedFired = true; emit('player:end', { t }); }
      } else t = to;
      changed();
    },
    play() {
      if (!tl || beatMode || mode === 'try' || pending) return;
      if (t >= tl.duration - EPS) { t = 0; endedFired = false; asked.clear(); }
      setPlaying(true); changed();
    },
    pause() { setPlaying(false); changed(); },
    toggle() { if (playing) api.pause(); else api.play(); },
    setSpeed(s) { speed = Math.min(2, Math.max(0.25, s)); changed(); },

    /* ---- choosing a time ---- */
    seek(sec) {
      if (!tl) return;
      t = Math.min(tl.duration, Math.max(0, sec)); pending = null; endedFired = t >= tl.duration - EPS;
      if (beatMode) beatIdx = beatIndexAt(tl, t);
      changed();
    },
    seekBeat(i) {
      if (!tl) return;
      const k = Math.min(tl.beats.length - 1, Math.max(0, i));
      beatIdx = k; t = tl.beats[k].at; pending = null; endedFired = false;
      const ask = tl.beats[k].ask;                                   // reduced motion has no clock, so arriving at a guess-first beat shows the question
      if (beatMode && ask && !answered.has(ask.id)) { asked.add(k); pending = { beat: k, ask }; emit('player:ask', pending); }
      changed();
    },
    nextBeat() { if (tl) api.seekBeat(Math.min(api.beat + 1, tl.beats.length - 1)); },
    prevBeat() {
      if (!tl) return;
      const i = api.beat, b = tl.beats[i];
      if (!beatMode && t - b.at > RESTART_AFTER) api.seekBeat(i); else api.seekBeat(i - 1);
    },
    replayBeat() { if (!tl) return; api.seekBeat(api.beat); api.play(); },

    /* ---- guess first ---- */
    answer(index) {
      if (!pending) return null;
      const { ask } = pending, ok = index === ask.answer, firstTime = !answered.has(ask.id);
      if (firstTime) answered.set(ask.id, { index, ok });
      pending = null; emit('player:answer', { id: ask.id, index, ok, firstTime, ask });
      if (!beatMode) setPlaying(true);
      changed(); return { ok, firstTime };
    },
    answerOf: id => answered.get(id) || null,

    /* ---- modes ---- */
    enterTry() { if (!tl || beatMode) return; mode = 'try'; overrides = {}; setPlaying(false); pending = null; emit('player:mode', mode); changed(); },
    exitTry() { mode = 'watch'; overrides = {}; emit('player:mode', mode); changed(); },
    setOverride(name, value) { if (mode !== 'try') return; overrides[name] = value; changed(); },
    setBeatMode(on) {
      if (beatMode === !!on) return;
      beatMode = !!on;
      if (beatMode) { beatIdx = tl ? beatIndexAt(tl, t) : 0; setPlaying(false); if (mode === 'try') { mode = 'watch'; overrides = {}; emit('player:mode', mode); } }
      else if (tl) t = tl.beats[beatIdx].at;
      changed();
    },
  };
  return api;
}
