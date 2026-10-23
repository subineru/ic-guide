/* Learning map panel (map + list of the same chapters and progress) and the settings panel. */
import { h, clear } from './dom.js';
import { bi } from '../core/text.js';
import { createMap } from './map-view.js';

export function createLearnPanel(ctx, host) {
  const { progress, nodes, path, settings } = ctx;
  const ST = { new: '○', doing: '◐', done: '✓', soon: '–' };
  const NAME = { new: '尚未開始', doing: '進行中', done: '已完成', soon: '即將推出' };
  let map = null, tab = 'map';
  const body = h('div', { class: 'panel-body' });
  const inkEl = h('p', { class: 'ink' }), sumEl = h('p', { class: 'sub' });
  const tabBtn = (id, label) => h('button', { class: 'tab', type: 'button', role: 'tab', dataset: { tab: id }, onclick: () => show(id) }, label);
  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': '檢視方式' }, tabBtn('map', '地圖'), tabBtn('list', '清單'));

  function counts() {
    const r = progress.rewards(), sum = progress.summary(path.filter(id => ctx.isAvailable(id)));
    inkEl.replaceChildren(h('span', { title: '墨滴' }, '● 墨滴 ' + r.drops), '　', h('span', { class: 'gold', title: '金墨' }, '◆ 金墨 ' + r.gold));
    sumEl.textContent = `已完成 ${sum.done} / ${sum.total} 章（目前開放的章節）`;
  }
  function list() {
    return h('ol', { class: 'plist' }, path.map((id, i) => {
      const n = nodes.find(x => x.id === id), st = ctx.isAvailable(id) ? progress.state(id) : 'soon';
      return h('li', null, h('a', { class: 'prow ' + st, href: ctx.isAvailable(id) ? '#/c/' + id : null, 'aria-disabled': st === 'soon' ? 'true' : null, onclick: () => ctx.closePanels() },
        h('span', { class: 'sn', 'aria-hidden': 'true' }, ST[st]), h('span', { class: 'sl', html: `${i + 1}. ` + bi(n.title) }), h('span', { class: 'sub' }, NAME[st])));
    }));
  }
  function show(id) {
    tab = id; settings.set('panelTab', id);
    if (map) { map.dispose(); map = null; }
    clear(body);
    tabs.querySelectorAll('.tab').forEach(b => { const on = b.dataset.tab === id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    if (id === 'map') { map = createMap(ctx, { mode: 'full', flow: null }); body.append(map.el); } else body.append(list());
  }
  function render(wanted) {
    clear(host);
    host.append(
      h('div', { class: 'panel-h' }, h('h2', null, '學習地圖'), tabs, h('button', { class: 'btn small', type: 'button', onclick: () => ctx.closePanels() }, '關閉')),
      h('div', { class: 'panel-sub' }, inkEl, sumEl), body);
    counts(); show(wanted || settings.get('panelTab') || tab);
  }
  ctx.bus.on('progress', () => { if (!host.hidden) { counts(); if (tab === 'list') show('list'); } });
  return { render, close() { if (map) { map.dispose(); map = null; } } };
}

export function createSettingsPanel(ctx, host) {
  const { settings, progress } = ctx;
  const input = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async e => {
    const f = e.target.files[0]; if (!f) return; const err = progress.importJSON(await f.text()); ctx.toast(err || '已匯入進度'); e.target.value = ''; } });
  const toggle = (key, label, hint, disabled) => h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: settings.get(key) ? true : null, disabled: disabled ? true : null,
    onchange: e => settings.set(key, e.target.checked) }), h('span', null, label), h('small', null, hint));
  function render() {
    clear(host);
    host.append(
      h('div', { class: 'panel-h' }, h('h2', null, '設定'), h('button', { class: 'btn small', type: 'button', onclick: () => ctx.closePanels() }, '關閉')),
      toggle('reduceMotion', '降低動態', '關閉手繪抖動與多餘動畫'),
      toggle('wobble', '手繪抖動', '讓線條微微晃動（降低動態時自動關閉）'),
      toggle('sound', '音效與音樂', '之後的版本提供', true),
      h('h3', null, '快捷鍵'),
      h('dl', { class: 'keys' }, ...[['← →', '上一步／下一步'], ['空白鍵', '暫停／繼續'], ['.', '單步（暫停時前進一小段）'], ['1–9', '跳到第 N 步'], ['H', '隱藏介面'], ['Esc', '關閉面板']]
        .flatMap(([k, v]) => [h('dt', null, h('kbd', null, k)), h('dd', null, v)])),
      ctx.trial ? h('h3', null, '試讀') : null,
      ctx.trial ? h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', id: 'trialExport', onclick: () => {
          const titles = {}; ctx.nodes.forEach(n => { titles[n.id] = n.title.zh; });
          Object.values(ctx.defs()).forEach(d => d.steps.forEach(s => { titles[s.id] = s.label.zh; }));
          const text = ctx.trial.toText({ ua: navigator.userAgent, build: ctx.build, titles });
          const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })), download: 'ic-guide-trial-feedback.txt' }); a.click();
        } }, '匯出試讀回饋'),
        h('button', { class: 'btn', type: 'button', onclick: () => { ctx.trial.clear(); ctx.toast('已清除試讀記錄'); } }, '清除試讀記錄')) : null,
      ctx.trial ? h('p', { class: 'sub' }, '試讀結束後，請按「匯出試讀回饋」，把下載的文字檔寄回給我們。') : null,
      h('h3', null, '進度'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: () => {
          const a = h('a', { href: URL.createObjectURL(new Blob([progress.exportJSON()], { type: 'application/json' })), download: 'ic-guide-progress.json' }); a.click(); } }, '匯出進度'),
        h('button', { class: 'btn', type: 'button', onclick: () => input.click() }, '匯入進度'),
        h('button', { class: 'btn', type: 'button', onclick: () => { const snap = progress.snapshot(); progress.reset(); ctx.toast('已重置全部進度', { label: '復原', fn: () => progress.restore(snap) }); } }, '重置進度')),
      input);
  }
  return { render };
}
