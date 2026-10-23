/* One chapter: stage (a render view) + side panel (card, steps, understanding points, controls). */
import { h, clear, isTyping } from './dom.js';
import { bi, biPlain, zh } from '../core/text.js';
import { SPEEDS } from '../app/steps.js';
import { createStageLayers } from './stage-layers.js';

export async function createChapterView(ctx, id) {
  const { bus, progress, runner, player, scheduler, settings } = ctx;
  const def = (await ctx.loadChapter(id)).default;
  progress.register(def);
  const steps = def.steps.filter(s => s.level === 'core' || s.level === 'ext');
  let index = -1, disposed = false, tlMode = false;                  // tlMode: the current step is a timeline (player) rather than a run() (runner)
  let curView = null, curViewId = null, wantViewId = def.view, viewTok = 0;

  /* ---------- stage ---------- */
  const viewHost = h('div', { id: 'view' });
  const stage = h('section', { id: 'stage', 'aria-label': '示意圖' }, viewHost,
    h('div', { id: 'stageChips' },
      h('span', { class: 'chip', title: '關係與順序正確，比例不代表實際尺寸' }, '示意 · 非實際比例'),
      h('span', { class: 'chip warn' }, def.placeholder ? '版面示意 · 內容待填' : def.reviewed ? '已審' : '待審' + (def.partial ? ' · 未完成' : ''))));

  /* lesson layers (focus ring, caption bar, beat dots) exist only for chapters that have timeline steps */
  const layers = steps.some(s => s.timeline)
    ? createStageLayers({ stage, view: viewHost, bus, targets: id => (curView && curView.targets ? curView.targets(id) : null) }) : null;

  /* ---------- card ---------- */
  const cardTitle = h('h2', { id: 'cardTitle' }), cardSay = h('p', { id: 'cardSay' });
  const whyBody = h('p'), why = h('details', { id: 'cardWhy' }, h('summary', null, '為什麼？'), whyBody);
  const predictBox = h('div', { id: 'predict' });
  /* trial-reading mode only: "I don't understand this" on the current step, with an optional note */
  const trial = ctx.trial;
  const stuckNote = h('textarea', { id: 'stuckNote', rows: 2, maxlength: 500, placeholder: '哪裡看不懂？（選填，一句話就好）', 'aria-label': '哪裡看不懂' });
  const stuckForm = h('div', { class: 'stuck-form', hidden: true }, stuckNote,
    h('div', { class: 'row' },
      h('button', { class: 'btn small primary', type: 'button', id: 'stuckSend', onclick: () => { trial.stuck(id, index >= 0 ? steps[index].id : 'intro', stuckNote.value); stuckNote.value = ''; stuckForm.hidden = true; stuckCount(); ctx.toast('已記錄，謝謝'); } }, '記下來'),
      h('button', { class: 'btn small', type: 'button', onclick: () => { stuckForm.hidden = true; } }, '取消')));
  const stuckBtn = h('button', { class: 'btn small', type: 'button', id: 'stuckBtn', onclick: () => { stuckForm.hidden = !stuckForm.hidden; if (!stuckForm.hidden) stuckNote.focus(); } }, '這裡看不懂');
  const stuckCountEl = h('span', { class: 'sub', id: 'stuckCount' });
  const stuckCount = () => { const n = trial.entries().filter(e => e.type === 'stuck' && e.chapter === id).length; stuckCountEl.textContent = n ? `本章已記 ${n} 筆` : ''; };
  const trialRow = trial ? h('div', { class: 'trial-row' }, h('div', { class: 'row' }, stuckBtn, stuckCountEl), stuckForm) : null;
  const card = h('section', { id: 'card', class: 'card', 'aria-live': 'polite' }, cardTitle, cardSay, why, predictBox, trialRow);

  /* ---------- steps ---------- */
  const stepsHost = h('section', { id: 'steps', 'aria-label': '步驟' });
  function renderSteps() {
    clear(stepsHost);
    const group = (title, level) => {
      const list = steps.map((s, i) => [s, i]).filter(([s]) => s.level === level);
      if (!list.length) return;
      stepsHost.append(h('h3', null, title));
      stepsHost.append(h('ol', null, list.map(([s, i]) => h('li', null,
        h('button', { class: 'step', type: 'button', 'aria-current': i === index ? 'step' : null, dataset: { done: progress.stepDone(id, s.id) ? '1' : '0' }, onclick: () => select(i) },
          h('span', { class: 'sn' }, progress.stepDone(id, s.id) ? '✓' : String(i + 1)),
          h('span', { class: 'sl', html: bi(s.label) }))))));
    };
    group('核心步驟', 'core'); group('延伸（選修）', 'ext');
  }

  /* ---------- understanding points ---------- */
  const takeSummary = h('summary'), takeList = h('ul');
  const take = h('details', { id: 'take' }, takeSummary, takeList);
  function renderTakeaways() {
    const c = progress.counts(id);
    takeSummary.textContent = `我能…（${c.checked}/${c.checks}）`;
    clear(takeList);
    (def.takeaways || []).forEach((t, i) => takeList.append(h('li', null, h('label', null,
      h('input', { type: 'checkbox', checked: progress.takeaway(id, i) ? true : null, onchange: e => { progress.setTakeaway(id, i, e.target.checked); ctx.poke(); } }),
      h('span', null, zh(t))))));
  }

  /* ---------- controls ---------- */
  const playBtn = h('button', { class: 'btn primary', type: 'button', id: 'bPlay', 'aria-label': '暫停或繼續', onclick: () => { if (tlMode) player.toggle(); else runner.togglePause(); ctx.poke(); } }, '⏸ 暫停');
  const prevBtn = h('button', { class: 'btn', type: 'button', id: 'bPrev', onclick: () => select(Math.max(0, index - 1)) }, '◀ 上一步');
  const nextBtn = h('button', { class: 'btn', type: 'button', id: 'bNext', onclick: () => select(Math.min(steps.length - 1, index + 1)) }, '下一步 ▶');
  const nudgeBtn = h('button', { class: 'btn', type: 'button', id: 'bNudge', title: '暫停時前進一小段（快捷鍵 .）', onclick: () => { runner.nudge(0.25); ctx.poke(); } }, '單步 ⏭');
  const replayBtn = h('button', { class: 'btn', type: 'button', id: 'bReplay', title: '重播目前這一小段', onclick: () => { player.replayBeat(); ctx.poke(); } }, '⟲ 重播這一小段');
  const restartBtn = h('button', { class: 'btn', type: 'button', id: 'bRestart', onclick: () => { player.seekBeat(0); player.play(); ctx.poke(); } }, '⏮ 從頭');
  const tlRow = h('div', { class: 'row tl-row', hidden: true }, replayBtn, restartBtn);
  const speedSel = h('select', { id: 'speed', 'aria-label': '播放速度', onchange: e => { runner.setSpeed(Number(e.target.value)); player.setSpeed(Number(e.target.value)); } },
    SPEEDS.map(v => h('option', { value: v, selected: v === 1 ? true : null }, v + '×')));
  /* chapter controls: a slider (amount) or a toggle (0 / 1); `when` shows a control only for the scenes where it matters */
  const widgets = (def.controls || []).map(c => {
    const out = h('output', null, '0');
    if (c.type === 'toggle') {
      const input = h('input', { type: 'checkbox', 'aria-label': biPlain(c.label), onchange: e => { runner.P[c.param] = e.target.checked ? 1 : 0; bus.emit('param', c.param); ctx.poke(); } });
      return { c, row: h('label', { class: 'toggle' }, h('span', { html: bi(c.label) }), input, out), sync() { const on = !!runner.P[c.param]; if (input.checked !== on) input.checked = on; out.textContent = on ? '1' : '0'; } };
    }
    const input = h('input', { type: 'range', min: c.min == null ? 0 : c.min, max: c.max == null ? 1 : c.max, step: c.step || 0.01, value: runner.P[c.param] || 0, 'aria-label': biPlain(c.label),
      oninput: e => { runner.P[c.param] = Number(e.target.value); bus.emit('param', c.param); ctx.poke(); } });
    return { c, row: h('label', { class: 'slider' }, h('span', { html: bi(c.label) }), input, out), sync() { const v = Number(runner.P[c.param] || 0); if (Number(input.value) !== v) input.value = v; out.textContent = v.toFixed(2); } };
  });
  function syncControls() {
    widgets.forEach(w => { const when = w.c.when; w.row.hidden = tlMode || (!!when && !when.in.includes(runner.P[when.param])); w.sync(); });
    nudgeBtn.hidden = tlMode; tlRow.hidden = !tlMode;
  }
  const more = h('details', { class: 'more' }, h('summary', null, '更多控制'),
    h('div', { class: 'row' }, nudgeBtn, h('label', { class: 'speed' }, h('span', null, '速度'), speedSel)), widgets.map(x => x.row));
  const controls = h('section', { id: 'controls', 'aria-label': '播放控制' }, h('div', { class: 'row primary' }, prevBtn, playBtn, nextBtn), tlRow, more);
  const wideMq = matchMedia('(min-width: 1024px)');
  /* the chapter's own controls are its main interaction, so keep them open (also on phones); only a chapter without controls collapses them */
  const syncMore = () => { more.open = wideMq.matches || widgets.length > 0; }; syncMore(); wideMq.addEventListener('change', syncMore);

  const side = h('aside', { id: 'side' }, card, stepsHost, take, controls);
  const el = h('div', { id: 'layout' }, stage, side);

  /* ---------- behaviour ---------- */
  /* 先猜: optional, never scored.  Trying earns a drop of ink whether right or wrong; right on the first try also earns gold ink. */
  let lastAnswer = null;
  function renderPredict() {
    clear(predictBox);
    const qs = def.predicts || [];
    if (!qs.length || index >= 0) { predictBox.hidden = true; return; }
    predictBox.hidden = false;
    const result = q => progress.predictResult(id, q.id), answered = qs.filter(result), right = answered.filter(q => result(q).ok).length;
    predictBox.append(h('p', { class: 'sub' }, `先猜一猜（不計分，答對答錯都有獎勵）${answered.length}/${qs.length}`));
    if (lastAnswer) {
      const { q, ok } = lastAnswer, more_ = qs.some(x => !result(x));
      predictBox.append(
        h('p', { class: 'pfb ' + (ok ? 'ok' : 'try') }, ok ? '答對了！獲得 1 墨滴、1 金墨。' : `沒關係，答案是「${q.options[q.answer]}」。獲得 1 墨滴。`),
        h('p', { class: 'sub' }, q.why),
        h('button', { class: 'btn', type: 'button', id: 'pNext', onclick: () => { lastAnswer = null; renderPredict(); } }, more_ ? '下一題 ▸' : '看結果 ▸'));
      return;
    }
    const q = qs.find(x => !result(x));
    if (q) {
      predictBox.append(h('p', { class: 'pq' }, q.q), h('div', { class: 'popts', role: 'group', 'aria-label': q.q },
        q.options.map((o, i) => h('button', { class: 'btn popt', type: 'button', onclick: () => { const ok = i === q.answer; progress.recordPredict(id, q.id, ok); lastAnswer = { q, ok }; renderPredict(); ctx.poke(); } }, o))));
      return;
    }
    predictBox.append(h('p', { class: 'pq' }, `你答對了 ${right}/${qs.length} 題。按「下一步」開始。`));
    const next = ctx.nextChapter(id);
    if (right === qs.length && next) predictBox.append(h('button', { class: 'btn', type: 'button', id: 'pSkip', onclick: () => ctx.openChapter(next) }, `我已經懂了，前往下一章：${ctx.nodeOf(next).title.zh}`));
  }
  function showIntro() {
    cardTitle.innerHTML = bi(def.title); cardSay.textContent = zh(def.idea);
    why.hidden = true; renderPredict();
  }
  function select(i) {
    index = i; const s = steps[i];
    cardTitle.innerHTML = bi(s.label); cardSay.textContent = s.say;
    whyBody.textContent = s.why; why.hidden = !s.why; why.open = false;
    prevBtn.disabled = i <= 0; nextBtn.disabled = i >= steps.length - 1;
    tlMode = !!s.timeline; useView(s.view || def.view);
    runner.cancel(); runner.reset(Object.assign({}, def.params, s.params));
    if (tlMode) player.load(s.timeline, { initial: s.params || {}, autoplay: true }); else player.unload();
    syncControls(); syncPlayLabel(); renderPredict();
    renderSteps(); ctx.poke();
    if (trial) trial.add('step-start', { chapter: id, step: s.id });
    if (!tlMode) runner.play(s).then(ok => { if (ok && !disposed) stepDone(s); });
  }
  function stepDone(s) { if (trial) trial.add('step-done', { chapter: id, step: s.id }); if (progress.markStep(id, s.id)) { renderSteps(); renderTakeaways(); } }
  const syncPlayLabel = () => { const p = tlMode ? !player.playing : runner.paused; playBtn.textContent = p ? '▶ 繼續' : '⏸ 暫停'; playBtn.classList.toggle('paused', p); };
  /* a step may bring its own view (the inverter does); the old one is replaced once the new one has loaded */
  async function useView(vid) {
    const tok = ++viewTok; wantViewId = vid;
    if (curViewId === vid) return;
    const mod = await ctx.loadView(vid);
    if (disposed || tok !== viewTok) return;
    if (curView) curView.dispose();
    curView = mod.create({ host: viewHost, bus, settings }); curViewId = vid; ctx.poke();
  }
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'ArrowRight') { select(Math.min(steps.length - 1, index + 1)); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { if (index > 0) select(index - 1); e.preventDefault(); }
    else if (e.key === ' ' && !isTyping(e.target)) { if (tlMode) player.toggle(); else runner.togglePause(); ctx.poke(); e.preventDefault(); }
    else if (e.key === '.' && !isTyping(e.target)) { if (tlMode) player.nextBeat(); else runner.nudge(0.25); ctx.poke(); }
    else if (/^[1-9]$/.test(e.key) && !isTyping(e.target) && steps[Number(e.key) - 1]) select(Number(e.key) - 1);
    else if ((e.key === 'h' || e.key === 'H') && !isTyping(e.target)) document.getElementById('app').classList.toggle('clean');
    else if (e.key === 'Escape') bus.emit('ui:escape');
  }
  document.addEventListener('keydown', onKey);
  const offs = [
    bus.on('runner:paused', () => { if (!tlMode) syncPlayLabel(); }),
    bus.on('runner:active', a => scheduler.setBusy('anim', a)),
    bus.on('player:playing', p => { scheduler.setBusy('player', p); if (tlMode) syncPlayLabel(); }),
    bus.on('player:state', () => { if (!player.playing) scheduler.poke(); }),
    bus.on('player:end', () => { if (tlMode && index >= 0 && !disposed) stepDone(steps[index]); }),
    bus.on('param', () => { scheduler.poke(300); syncControls(); }),
  ];

  runner.reset(Object.assign({}, def.params)); runner.resume();
  renderSteps(); renderTakeaways(); showIntro(); syncControls(); prevBtn.disabled = true;
  ctx.setSpine(def.spine || ctx.nodeOf(id).spine);
  if (trial) { trial.add('enter', { chapter: id }); stuckCount(); }

  await useView(def.view);
  scheduler.start(dt => {
    if (tlMode) player.tick(dt); else runner.tick(dt);
    if (curView && curViewId === wantViewId) curView.update(tlMode ? player.state() : runner.P, dt);
  });

  return {
    el,
    dispose() {
      disposed = true; document.removeEventListener('keydown', onKey); wideMq.removeEventListener('change', syncMore);
      offs.forEach(f => f()); runner.cancel(); player.unload(); scheduler.stop(); scheduler.setBusy('anim', false); scheduler.setBusy('player', false);
      if (curView) curView.dispose();
      if (layers) layers.dispose();
    },
  };
}
