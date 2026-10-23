/* Step runner.  A step is `async run(api)`; the api only changes named parameters (set / tween / wait)
   and says things.  Drawing is somebody else's job (a render view reads the parameters), so the same step
   works for 2D and 3D views.  Time is virtual: tick(dt) advances it, which makes pause, speed and single-step
   trivial and lets tests run without a clock. */
const CANCELLED = Symbol('cancelled');
const easeInOut = t => t * t * (3 - 2 * t);
export const SPEEDS = [0.25, 0.5, 1, 1.5, 2];

export function createRunner({ bus }) {
  const P = {};
  let tweens = [], waits = [], paused = false, speed = 1, token = 0, active = false;

  const setActive = () => {
    const a = tweens.length + waits.length > 0;
    if (a !== active) { active = a; bus.emit('runner:active', a); }
  };
  /* unwind anything still waiting (its `await` throws CANCELLED, which play() swallows) */
  const dropPending = () => { const all = tweens.concat(waits); tweens = []; waits = []; all.forEach(x => x.fail(CANCELLED)); };

  function makeApi(tok) {
    const live = () => { if (tok !== token) throw CANCELLED; };
    return {
      get: k => P[k],
      set(k, v) { live(); P[k] = v; bus.emit('param', k); },
      say(text) { live(); bus.emit('say', text); },
      focus(f) { live(); bus.emit('focus', f); },
      tween(k, to, sec, o = {}) {
        live();
        const p = new Promise((res, rej) => {
          const from = typeof P[k] === 'number' ? P[k] : 0;
          tweens.push({ k, from, to, dur: Math.max(0.0001, sec), t: 0, ease: o.ease || easeInOut, tok, done: res, fail: rej });
          setActive();
        });
        p.catch(() => {});                              // a step that does not await its tween must not raise an unhandled rejection
        return p;
      },
      wait(sec) {
        live();
        const p = new Promise((res, rej) => { waits.push({ left: sec, tok, done: res, fail: rej }); setActive(); });
        p.catch(() => {});
        return p;
      },
    };
  }

  function advance(dt) {
    for (const tw of tweens.slice()) {
      tw.t += dt;
      const f = Math.min(1, tw.t / tw.dur);
      P[tw.k] = tw.from + (tw.to - tw.from) * tw.ease(f);
      bus.emit('param', tw.k);
      if (f >= 1) { tweens = tweens.filter(x => x !== tw); tw.done(); }
    }
    for (const w of waits.slice()) {
      w.left -= dt;
      if (w.left <= 0) { waits = waits.filter(x => x !== w); w.done(); }
    }
    setActive();
  }

  return {
    P,
    get paused() { return paused; },
    get speed() { return speed; },
    get active() { return active; },
    reset(initial = {}) { token++; dropPending(); Object.keys(P).forEach(k => delete P[k]); Object.assign(P, initial); setActive(); bus.emit('param', '*'); },
    tick(dt) { if (paused) return; advance(dt * speed); },
    /* advance a little while paused (single-step an animation) */
    nudge(sec = 0.25) { advance(sec); },
    pause() { paused = true; bus.emit('runner:paused', true); },
    resume() { paused = false; bus.emit('runner:paused', false); },
    togglePause() { paused ? this.resume() : this.pause(); return paused; },
    setSpeed(s) { speed = Math.min(2, Math.max(0.25, s)); bus.emit('runner:speed', speed); },
    cancel() { token++; dropPending(); setActive(); },
    /* run one step; resolves true when it ran to the end, false when it was replaced or cancelled */
    async play(step) {
      const tok = ++token;
      dropPending(); setActive();
      try { await step.run(makeApi(tok)); return tok === token; }
      catch (e) { if (e === CANCELLED) return false; throw e; }
    },
  };
}
