/* Timeline of beats: the one way an explanation moves.  Pure maths, no DOM, no clock: `evaluate(tl, t)` returns what the
   screen shows at time t (parameters, flows, pulses, caption, focus), and always the same thing for the same t.  That is
   what makes scrubbing, replaying, single-stepping, speed and reduced motion trivial: they only choose which t to ask for.

   A step's `timeline` is a list of beats (docs/timeline-format.md):
     { at, caption, focus, set, tween, flow, pulse, ask, hold }
       at       seconds from the start of the step (first beat at 0, strictly increasing)
       caption  one short line shown while this beat is current (<= 20 characters)
       focus    what to look at: a target id or a list of ids ('whole' = the whole drawing)
       set      { param: value }                    jump at `at`
       tween    { param: [from, to, dur] | { to, dur, from?, delay?, ease? } }   change over time
       flow     { name:  [from, to, dur] | { to, dur, from?, delay?, ease? } }   water / current amount 0..1
       pulse    'name' | { name, dur?, delay? }     a one-shot signal travelling along a named path
       ask      { id, q, options, answer, why }     pause here and let the learner guess first (never scored)
       hold     only for the last beat: how long it stays after its changes finish (default 2 s)  */
import { len } from '../core/text.js';

export const EASE = {
  linear: t => t,
  inOut: t => t * t * (3 - 2 * t),
  in: t => t * t,
  out: t => 1 - (1 - t) * (1 - t),
  /* overshoots a little, like a lever snapping into place; views must clamp what they draw */
  back: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
export const LIMITS = { caption: 20, beatsMin: 3, beatsMax: 8 };
export const WHOLE = 'whole';
const EPS = 1e-9;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const asList = f => (f == null ? [WHOLE] : Array.isArray(f) ? f : [f]);

function parseChange(v, where) {
  const o = Array.isArray(v) ? { from: v[0], to: v[1], dur: v[2] } : v;
  if (!o || typeof o !== 'object' || typeof o.to !== 'number' || !(o.dur > 0)) throw new Error(`${where}: 需要 [from, to, 秒數] 或 { to, dur }，且秒數 > 0`);
  const ease = o.ease || 'inOut';
  if (!EASE[ease]) throw new Error(`${where}: 未知的緩動 "${ease}"`);
  return { from: o.from, to: o.to, dur: o.dur, delay: o.delay || 0, ease };
}

/* spec: array of beats, or { beats, duration? }.  initial: starting value of every parameter the timeline touches. */
export function compileTimeline(spec, { initial = {}, flows: flowInitial = {} } = {}) {
  const beatsIn = Array.isArray(spec) ? spec : (spec && spec.beats);
  if (!Array.isArray(beatsIn) || !beatsIn.length) throw new Error('時間表至少要有一個小段');
  const tracks = new Map(), pulses = new Map();
  let maxEnd = 0;
  const track = (kind, name) => { const k = kind + ':' + name; if (!tracks.has(k)) tracks.set(k, { kind, name, segs: [] }); return tracks.get(k); };
  const startValue = (tr, fallback) => { const last = tr.segs[tr.segs.length - 1]; return last ? last.to : (fallback != null ? fallback : (tr.kind === 'flow' ? 0 : undefined)); };
  const push = (tr, seg, where) => {
    const last = tr.segs[tr.segs.length - 1];
    if (last && seg.t0 < last.t1 - EPS) throw new Error(`${where}: "${tr.name}" 在 ${seg.t0.toFixed(2)} 秒開始，但前一段變化到 ${last.t1.toFixed(2)} 秒才結束（同一個參數的變化不可重疊）`);
    tr.segs.push(seg); maxEnd = Math.max(maxEnd, seg.t1);
  };

  beatsIn.forEach((b, i) => {
    const where = `第 ${i + 1} 小段`;
    if (typeof b.at !== 'number' || b.at < 0) throw new Error(`${where}: at 必須是 0 以上的秒數`);
    if (i === 0 && b.at !== 0) throw new Error('第 1 小段的 at 必須是 0（開頭就要有字幕）');
    if (i > 0 && !(b.at > beatsIn[i - 1].at)) throw new Error(`${where}: at 必須比前一小段大`);
    for (const [name, v] of Object.entries(b.set || {})) {
      push(track('param', name), { t0: b.at, t1: b.at, from: v, to: v, ease: 'linear' }, where);
    }
    for (const [name, raw] of Object.entries(b.tween || {})) {
      const c = parseChange(raw, `${where} tween.${name}`), tr = track('param', name);
      const from = c.from != null ? c.from : startValue(tr, initial[name]);
      if (from == null) throw new Error(`${where}: 參數 "${name}" 沒有起始值（請在 params 設定，或寫 [from, to, dur]）`);
      push(tr, { t0: b.at + c.delay, t1: b.at + c.delay + c.dur, from, to: c.to, ease: c.ease }, where);
    }
    for (const [name, raw] of Object.entries(b.flow || {})) {
      const c = parseChange(raw, `${where} flow.${name}`), tr = track('flow', name);
      const from = c.from != null ? c.from : startValue(tr, flowInitial[name]);
      push(tr, { t0: b.at + c.delay, t1: b.at + c.delay + c.dur, from, to: c.to, ease: c.ease }, where);
    }
    if (b.pulse) {
      const p = typeof b.pulse === 'string' ? { name: b.pulse } : b.pulse, dur = p.dur || 1, t0 = b.at + (p.delay || 0), list = pulses.get(p.name) || [];
      const last = list[list.length - 1];
      if (last && t0 < last.t1 - EPS) throw new Error(`${where}: 脈衝 "${p.name}" 與前一次重疊`);
      list.push({ t0, t1: t0 + dur }); pulses.set(p.name, list); maxEnd = Math.max(maxEnd, t0 + dur);
    }
  });

  const lastAt = beatsIn[beatsIn.length - 1].at, hold = beatsIn[beatsIn.length - 1].hold;
  const duration = (spec && spec.duration) != null ? spec.duration : Math.max(lastAt + (hold == null ? 2 : hold), maxEnd);
  if (duration < maxEnd - EPS) throw new Error(`duration (${duration}) 比最後一個變化的結束時間 (${maxEnd.toFixed(2)}) 還短`);
  if (duration <= lastAt) throw new Error('最後一小段至少要停留一點時間');
  const beats = beatsIn.map((b, i) => ({ index: i, at: b.at, end: i + 1 < beatsIn.length ? beatsIn[i + 1].at : duration, caption: b.caption || '', focus: asList(b.focus), ask: b.ask || null }));
  const names = kind => [...tracks.values()].filter(t => t.kind === kind).map(t => t.name);
  return { duration, beats, tracks: [...tracks.values()], pulses, initial: { ...initial }, flowInitial: { ...flowInitial }, touched: { params: names('param'), flows: names('flow'), pulses: [...pulses.keys()] } };
}

function valueAt(tr, t, base) {
  const segs = tr.segs;
  if (!segs.length || t < segs[0].t0 - EPS) return base != null ? base : segs[0].from;
  let seg = segs[0];
  for (const s of segs) { if (s.t0 <= t + EPS) seg = s; else break; }
  if (t >= seg.t1 - EPS) return seg.to;
  return seg.from + (seg.to - seg.from) * EASE[seg.ease]((t - seg.t0) / (seg.t1 - seg.t0));
}

export function beatIndexAt(tl, t) {
  let idx = 0;
  for (const b of tl.beats) { if (b.at <= t + EPS) idx = b.index; else break; }
  return idx;
}

/* What is on screen at time t.  Same t, same answer: no hidden state. */
export function evaluate(tl, t) {
  const tt = clamp(t, 0, tl.duration), params = { ...tl.initial }, flows = { ...tl.flowInitial }, pulses = {};
  for (const tr of tl.tracks) {
    if (tr.kind === 'param') params[tr.name] = valueAt(tr, tt, tl.initial[tr.name]);
    else flows[tr.name] = valueAt(tr, tt, tl.flowInitial[tr.name] != null ? tl.flowInitial[tr.name] : 0);
  }
  for (const [name, list] of tl.pulses) {
    pulses[name] = null;
    for (const p of list) if (tt >= p.t0 - EPS && tt <= p.t1 + EPS) pulses[name] = clamp((tt - p.t0) / (p.t1 - p.t0), 0, 1);
  }
  const beat = tl.beats[beatIndexAt(tl, tt)];
  return { t: tt, params, flows, pulses, beat: beat.index, caption: beat.caption, focus: beat.focus, ask: beat.ask, atEnd: tt >= tl.duration - EPS };
}

/* The still picture at the end of beat i: used by "reduced motion" (no movement, one beat at a time). */
export function frameAtBeatEnd(tl, i) {
  const b = tl.beats[clamp(i, 0, tl.beats.length - 1)];
  return evaluate(tl, b.end >= tl.duration - EPS ? tl.duration : b.end - 1e-6);
}

/* Problems a content author should fix, in plain Chinese.  vocab = { params, flows, pulses, targets } declared by the chapter. */
export function timelineProblems(spec, vocab = {}, limits = LIMITS) {
  const out = [], beats = Array.isArray(spec) ? spec : (spec && spec.beats) || [];
  const known = (list, id) => !list || list.includes(id);
  if (beats.length < limits.beatsMin || beats.length > limits.beatsMax) out.push(`小段數量應為 ${limits.beatsMin}~${limits.beatsMax} 個，目前 ${beats.length} 個`);
  beats.forEach((b, i) => {
    const where = `第 ${i + 1} 小段`;
    if (!b.caption || !len(b.caption)) out.push(`${where}缺少字幕`);
    else if (len(b.caption) > limits.caption) out.push(`${where}的字幕 ${len(b.caption)} 字，超過 ${limits.caption} 字`);
    asList(b.focus).forEach(f => { if (f !== WHOLE && !known(vocab.targets, f)) out.push(`${where}的焦點「${f}」不是這個畫面宣告的目標`); });
    Object.keys(b.set || {}).concat(Object.keys(b.tween || {})).forEach(p => { if (!known(vocab.params, p)) out.push(`${where}使用了未宣告的參數「${p}」`); });
    Object.keys(b.flow || {}).forEach(f => { if (!known(vocab.flows, f)) out.push(`${where}使用了未宣告的流動「${f}」`); });
    if (b.pulse) { const n = typeof b.pulse === 'string' ? b.pulse : b.pulse.name; if (!known(vocab.pulses, n)) out.push(`${where}使用了未宣告的脈衝「${n}」`); }
    if (b.ask) {
      const a = b.ask;
      if (!a.id || !a.q || !Array.isArray(a.options) || a.options.length < 2 || a.options.length > 3 || !Number.isInteger(a.answer) || a.answer < 0 || a.answer >= a.options.length || !a.why) out.push(`${where}的先猜需要 id、題目、2~3 個選項、有效的 answer 與解釋`);
    }
  });
  try { compileTimeline(spec, { initial: Object.fromEntries((vocab.params || []).map(p => [p, 0])) }); } catch (e) { out.push(e.message); }
  return out;
}
