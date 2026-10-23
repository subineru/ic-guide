/* Timeline for the home animation: one packet of data travels the main line, changing form where the real signal changes.
   Pure maths (no DOM), so it is unit-tested.  The view only turns these times into Web Animations.
   coords = where each main-line part sits along the travel path, in any unit (must increase). */
export const LOOP_MS = 12000;      // one full loop
export const TRAVEL_MS = 8800;     // packet leaves the first part and reaches the panel
export const LIT_MS = 2000;        // the pixel stays lit
export const FADE_MS = 140;
export const GLOW_LEAD_MS = 250, GLOW_HOLD_MS = 500;

export function flowTimeline(parts, coords, o = {}) {
  const travel = o.travel || TRAVEL_MS, lit = o.lit || LIT_MS, loop = o.loop || LOOP_MS, n = parts.length;
  if (coords.length !== n) throw new Error(`need ${n} positions, got ${coords.length}`);
  for (let i = 1; i < n; i++) if (!(coords[i] > coords[i - 1])) throw new Error('positions must increase along the path');
  for (let i = 0; i < n - 1; i++) if (!parts[i].signal) throw new Error(`part "${parts[i].id}" has no signal kind`);
  if (travel + lit + 400 > loop) throw new Error('loop is too short for travel + lit time');
  const total = coords[n - 1] - coords[0], tAt = c => ((c - coords[0]) / total) * travel;
  const arrivals = parts.map((p, i) => ({ id: p.id, t: tAt(coords[i]) }));
  const layers = [];                                    // consecutive segments of the same kind share one packet shape
  for (let i = 0; i < n - 1;) {
    const kind = parts[i].signal; let j = i + 1;
    while (j < n - 1 && parts[j].signal === kind) j++;
    layers.push({ kind, from: i, to: j, c0: coords[i], c1: coords[j], t0: tAt(coords[i]), t1: tAt(coords[j]) });
    i = j;
  }
  return { loop, travel, arrivals, layers, pixel: { t0: travel, t1: travel + lit } };
}

/* Web Animations keyframes (offsets 0..1 over the loop).  `at(c)` turns a coordinate into a CSS transform. */
export function packetKeyframes(layer, loop, at) {
  const dur = layer.t1 - layer.t0, f = Math.min(FADE_MS, dur / 4);
  const pos = t => layer.c0 + ((layer.c1 - layer.c0) * (t - layer.t0)) / dur, o = t => t / loop;
  return [
    { offset: 0, opacity: 0, transform: at(layer.c0) },
    { offset: o(layer.t0), opacity: 0, transform: at(layer.c0) },
    { offset: o(layer.t0 + f), opacity: 1, transform: at(pos(layer.t0 + f)) },
    { offset: o(layer.t1 - f), opacity: 1, transform: at(pos(layer.t1 - f)) },
    { offset: o(layer.t1), opacity: 0, transform: at(layer.c1) },
    { offset: 1, opacity: 0, transform: at(layer.c1) },
  ];
}
export function glowKeyframes(tArrive, loop) {
  const pts = [[Math.max(0, tArrive - GLOW_LEAD_MS), 0], [tArrive, 1], [tArrive + GLOW_HOLD_MS, 0]];
  if (pts[0][0] > 0) pts.unshift([0, 0]);
  pts.push([loop, 0]);
  return pts.map(([t, v]) => ({ offset: t / loop, opacity: v }));
}
export function pixelKeyframes(tl) {
  const o = t => Math.min(1, t / tl.loop);
  return [{ offset: 0, opacity: 0 }, { offset: o(tl.pixel.t0), opacity: 0 }, { offset: o(tl.pixel.t0 + 120), opacity: 1 }, { offset: o(tl.pixel.t1), opacity: 1 }, { offset: o(tl.pixel.t1 + 400), opacity: 0 }, { offset: 1, opacity: 0 }];
}
/* which main-line part the packet is passing at time t (for tests and captions) */
export function partAt(tl, t) {
  let best = tl.arrivals[0];
  tl.arrivals.forEach(a => { if (a.t <= t + 1e-6) best = a; });
  return best.id;
}
