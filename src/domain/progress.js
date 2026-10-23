/* Progress and rewards.  Stored by chapter id + step id (never by position), so inserting or reordering
   chapters and steps never invalidates a learner's record.
   Schema v2: { v:2, chapters: { <id>: { steps:{<stepId>:time}, takeaways:{<i>:true}, predicts:{<id>:{ok:bool}} } } }
   Rewards are derived from this record (never stored), so they cannot drift after a reset or import. */
const KEY = 'ic.progress.v2';
const APP = 'ic-guide';

export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return { v: 2, chapters: {} };
  if (raw.v === 2 && raw.chapters && typeof raw.chapters === 'object') return raw;
  return { v: 2, chapters: {} };                      // unknown/older shape: start clean rather than guess
}

export function createProgress({ store, bus }) {
  let data = migrate(store.get(KEY, null));
  const defs = new Map();                             // chapter id -> loaded chapter definition
  const save = () => { store.set(KEY, data); bus.emit('progress'); };
  const rec = id => data.chapters[id] || (data.chapters[id] = { steps: {}, takeaways: {}, predicts: {} });
  const stepsOf = (id, level) => ((defs.get(id) || {}).steps || []).filter(s => s.level === level);

  const P = {
    register(def) { defs.set(def.id, def); },
    definitions: () => Object.fromEntries(defs),
    stepDone: (id, stepId) => !!(data.chapters[id] && data.chapters[id].steps[stepId]),
    markStep(id, stepId) {
      const r = rec(id);
      if (r.steps[stepId]) return false;
      r.steps[stepId] = Date.now(); save(); return true;
    },
    setTakeaway(id, i, on) { const r = rec(id); if (on) r.takeaways[i] = true; else delete r.takeaways[i]; save(); },
    takeaway: (id, i) => !!(data.chapters[id] && data.chapters[id].takeaways[i]),
    recordPredict(id, predictId, ok) {
      const r = rec(id);
      if (r.predicts[predictId]) return false;        // first answer counts; reward is for trying, never for retrying
      r.predicts[predictId] = { ok: !!ok }; save(); return true;
    },
    predictResult: (id, predictId) => (data.chapters[id] && data.chapters[id].predicts[predictId]) || null,
    counts(id) {
      const def = defs.get(id); if (!def) return { core: 0, coreDone: 0, ext: 0, extDone: 0, checks: 0, checked: 0 };
      const core = stepsOf(id, 'core'), ext = stepsOf(id, 'ext');
      const t = def.takeaways || [];
      return {
        core: core.length, coreDone: core.filter(s => P.stepDone(id, s.id)).length,
        ext: ext.length, extDone: ext.filter(s => P.stepDone(id, s.id)).length,
        checks: t.length, checked: t.filter((_, i) => P.takeaway(id, i)).length,
      };
    },
    /* played all core steps */
    isDone(id) { const c = P.counts(id); return c.core > 0 && c.coreDone === c.core; },
    /* played all core steps AND ticked every understanding point */
    isComplete(id) { const c = P.counts(id); return P.isDone(id) && c.checked === c.checks; },
    state(id) {
      if (!defs.has(id)) return 'soon';
      if (P.isComplete(id)) return 'done';
      const c = P.counts(id);
      return c.coreDone > 0 || c.checked > 0 ? 'doing' : 'new';
    },
    fraction(id) { const c = P.counts(id), t = c.core + c.checks; return t ? (c.coreDone + c.checked) / t : 0; },
    /* ink drops: a step, an understanding point, or trying a predict question (right or wrong).
       gold ink: an extension step, or a predict answered correctly on the first try. */
    rewards() {
      let drops = 0, gold = 0;
      for (const [id, r] of Object.entries(data.chapters)) {
        const def = defs.get(id);
        Object.keys(r.steps).forEach(sid => {
          const s = def && (def.steps || []).find(x => x.id === sid);
          if (!s) return;                             // a step removed from the content no longer counts
          if (s.level === 'ext') gold++; else if (s.level === 'core') drops++;
        });
        drops += Object.keys(r.takeaways).length;
        Object.values(r.predicts).forEach(p => { drops++; if (p.ok) gold++; });
      }
      return { drops, gold };
    },
    cardUnlocked: id => P.isComplete(id),
    summary(path) { const done = path.filter(id => P.isComplete(id)).length; return { total: path.length, done }; },
    snapshot: () => JSON.parse(JSON.stringify(data)),
    restore(snap) { data = migrate(snap); save(); },
    reset() { data = { v: 2, chapters: {} }; save(); },
    resetChapters(ids) { ids.forEach(id => { delete data.chapters[id]; }); save(); },
    exportJSON: () => JSON.stringify({ app: APP, v: 2, saved: new Date().toISOString(), data }, null, 2),
    importJSON(text) {
      let o; try { o = JSON.parse(text); } catch (e) { return '不是有效的 JSON 檔'; }
      if (!o || o.app !== APP || !o.data) return '這不是本教材匯出的進度檔';
      data = migrate(o.data); save(); return null;
    },
  };
  return P;
}
