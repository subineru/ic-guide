/* Home: the main line IS the main object.  A packet of data travels it (animation), parts are clickable, and the full
   chapter map lives in the learning panel (one place for navigation and progress). */
import { h } from './dom.js';
import { biPlain } from '../core/text.js';
import { createMap } from './map-view.js';
import { createFlowController, packetEl } from './flow-anim.js';

export function createHome(ctx) {
  const flow = createFlowController({ settings: ctx.settings, bus: ctx.bus });
  const animBtn = h('button', { class: 'btn', type: 'button', id: 'bAnim', 'aria-pressed': 'true', onclick: () => flow.toggle() }, '⏸ 暫停動畫');
  const legend = h('ul', { class: 'legend', 'aria-label': '動畫圖例（示意）' },
    [['low', '低電壓的數位資料'], ['high', '較高電壓的數位資料'], ['analog', '類比電壓'], ['strong', '有力氣驅動面板的電壓']].map(([k, t]) =>
      h('li', null, packetEl(k), h('span', null, t))));
  function syncBtn() {
    animBtn.disabled = flow.reduced;
    animBtn.setAttribute('aria-pressed', String(flow.playing));
    animBtn.textContent = flow.reduced ? '動畫已關閉（降低動態）' : flow.playing ? '⏸ 暫停動畫' : '▶ 播放動畫';
  }
  flow.onChange(syncBtn);

  const next = h('div', { class: 'home-next card' });
  function renderNext() {
    const id = ctx.resume(), n = ctx.nodeOf(id), c = ctx.progress.counts(id), r = ctx.progress.rewards();
    next.replaceChildren(
      h('div', null, h('div', { class: 'sub' }, ctx.progress.state(id) === 'new' ? '從這裡開始' : '繼續學習'),
        h('strong', null, biPlain(n.title)), c.core ? h('span', { class: 'sub' }, `　核心步驟 ${c.coreDone}/${c.core}`) : null),
      h('div', { class: 'ink' }, h('span', { title: '墨滴' }, '● 墨滴 ' + r.drops), '　', h('span', { class: 'gold', title: '金墨' }, '◆ 金墨 ' + r.gold)));
  }
  renderNext();
  const offNext = ctx.bus.on('progress', renderNext);

  const map = createMap(ctx, { mode: 'hero', flow });
  const root = h('section', { class: 'home' },
    h('div', { class: 'home-intro' },
      h('h2', null, '一個像素，是怎麼被點亮的？'),
      h('p', null, '從手機傳來一筆資料，到面板上亮起一個點。看資料沿著這條主線，一步步變成亮度。'),
      h('div', { class: 'home-actions' },
        h('button', { class: 'btn primary', type: 'button', id: 'bStart', onclick: () => ctx.openChapter(ctx.resume()) }, '開始學習'),
        h('button', { class: 'btn', type: 'button', id: 'bMap', onclick: () => ctx.openPanel('learn', 'map') }, '學習地圖'),
        animBtn),
      legend),
    map.el,
    next);
  return { el: root, dispose() { map.dispose(); offNext(); flow.stop(); } };
}
