/* Redraw scheduler: full speed only while something is moving or the user just did something;
   otherwise a slow idle rate, and nothing at all in a hidden tab.  Ported from the car project's engine loop
   (gap/loop/schedule), made injectable so it can be tested without a browser. */
export function createScheduler(opts = {}) {
  const now = opts.now || (() => performance.now());
  const hidden = opts.hidden || (() => document.hidden);
  const raf = opts.raf || (fn => requestAnimationFrame(fn));
  const setTimer = opts.setTimer || ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer || (id => clearTimeout(id));
  let idleFps = opts.idleFps || 5;
  let frame = null, running = false, last = 0, lastRender = 0, wakeUntil = 0, tickId = 0, timerId = 0;
  const busy = new Set();
  const stats = { rendered: 0, skipped: 0 };

  /* minimum ms between redraws right now (0 = full speed) */
  function gap(t) {
    if (busy.size || t < wakeUntil) return 0;
    return Math.max(0, 1000 / idleFps - 6);
  }
  function tick(t) {
    if (!running) return;
    if (hidden()) { schedule(1000); return; }
    const need = gap(t), since = t - lastRender;
    if (since >= need) {
      const dt = Math.min(0.2, Math.max(0, (t - last) / 1000)); last = t; lastRender = t;
      stats.rendered++; if (frame) frame(dt, t);
      schedule(0);
    } else { stats.skipped++; schedule(need - since); }
  }
  /* requestAnimationFrame can be paused or throttled in sandboxed iframes: a timer fallback keeps the page alive */
  function schedule(delay) {
    const id = ++tickId; let fired = false;
    const go = () => { if (fired || id !== tickId) return; fired = true; clearTimer(timerId); tick(now()); };
    if (delay > 20) { timerId = setTimer(go, delay); return; }
    raf(go); timerId = setTimer(go, 100);
  }
  return {
    stats,
    gap: () => gap(now()),
    start(fn) { frame = fn; if (running) return; running = true; last = lastRender = now(); schedule(0); },
    stop() { running = false; tickId++; clearTimer(timerId); },
    poke(ms = 700) { wakeUntil = Math.max(wakeUntil, now() + ms); if (running) schedule(0); },
    setBusy(key, on) { if (on) busy.add(key); else busy.delete(key); if (on && running) schedule(0); },
    setIdleFps(n) { idleFps = Math.max(1, Math.min(30, n)); },
    _tick: tick,                                      // for tests
  };
}
