/* App frame: top bar, main-line strip, routed main area, panels, toast. */
import { h, clear } from './dom.js';
import { biPlain } from '../core/text.js';
import { createSpineStrip } from './spine-strip.js';
import { createHome } from './home.js';
import { createChapterView } from './chapter-view.js';
import { createLearnPanel, createSettingsPanel } from './panels.js';
import { createToast } from './toast.js';

export function mountShell(ctx, root) {
  const back = h('a', { id: 'bBack', class: 'btn', href: '#/', hidden: true }, '‹ 首頁');
  const title = h('h1', { id: 'ttl' });
  const learnBtn = h('button', { class: 'btn', type: 'button', id: 'bLearn', 'aria-expanded': 'false', onclick: () => togglePanel('learn') }, '學習地圖');
  const setBtn = h('button', { class: 'btn', type: 'button', id: 'bSet', 'aria-expanded': 'false', onclick: () => togglePanel('settings') }, '設定');
  const top = h('header', { id: 'top' }, back, title,
    ctx.trial ? h('span', { id: 'trialChip', class: 'chip', title: '試讀模式：可以在每個步驟標記「這裡看不懂」' }, '試讀模式') : null,
    h('span', { id: 'badge', class: 'chip warn', title: '試作版：內容尚未經過專業審核' }, h('span', { class: 'full' }, '試作版，內容未經專業審核'), h('span', { class: 'short' }, '未經審核')),
    h('nav', { id: 'topBtns' }, learnBtn, setBtn));
  const spineHost = h('nav', { id: 'spine', 'aria-label': '主線', hidden: true });
  const main = h('main', { id: 'main' });
  const learnHost = h('aside', { id: 'drawer', hidden: true, role: 'dialog', 'aria-label': '學習地圖' });
  const backdrop = h('div', { id: 'backdrop', hidden: true, onclick: () => closePanels() });
  const setHost = h('aside', { id: 'settings', hidden: true, 'aria-label': '設定' });
  const toastHost = h('div', { id: 'toast', role: 'status', hidden: true });
  root.append(top, spineHost, main, backdrop, learnHost, setHost, toastHost);

  const strip = createSpineStrip(spineHost, ctx.spine);
  const learn = createLearnPanel(ctx, learnHost), sett = createSettingsPanel(ctx, setHost);
  ctx.toast = createToast(toastHost);
  ctx.setSpine = ids => strip.render(ids);

  let opener = null;
  function closePanels() {
    const was = !learnHost.hidden || !setHost.hidden;
    learnHost.hidden = setHost.hidden = backdrop.hidden = true; learn.close();
    learnBtn.setAttribute('aria-expanded', 'false'); setBtn.setAttribute('aria-expanded', 'false');
    if (was && opener && opener.isConnected) opener.focus();
    opener = null;
  }
  function togglePanel(which, tab) {
    const host = which === 'learn' ? learnHost : setHost, btn = which === 'learn' ? learnBtn : setBtn, wasOpen = !host.hidden;
    const from = document.activeElement;
    closePanels();
    if (wasOpen && !tab) return;
    (which === 'learn' ? learn : sett).render(tab); host.hidden = false; backdrop.hidden = false; btn.setAttribute('aria-expanded', 'true');
    opener = from && from !== document.body ? from : btn;
    const first = host.querySelector('[aria-selected="true"], button'); if (first) first.focus();
  }
  ctx.closePanels = closePanels;
  ctx.openPanel = togglePanel;
  /* one way to go to a chapter from anywhere: closes panels, or says it is not ready yet */
  ctx.openChapter = id => {
    if (ctx.isAvailable(id)) { closePanels(); location.hash = '#/c/' + id; }
    else ctx.toast('「' + ctx.nodeOf(id).title.zh + '」即將推出');
  };
  ctx.bus.on('ui:escape', closePanels);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanels(); });          // on every page, not only inside a chapter
  const applyMotion = () => document.documentElement.dataset.motion = ctx.settings.get('reduceMotion') ? 'reduced' : 'full';
  applyMotion(); ctx.bus.on('settings', applyMotion);

  let current = null, seq = 0;
  async function show(route) {
    const my = ++seq;
    if (current) { current.dispose(); current = null; }
    clear(main); closePanels(); root.classList.remove('clean');
    if (route.name === 'chapter' && ctx.isAvailable(route.id)) {
      const n = ctx.nodeOf(route.id);
      title.innerHTML = ''; title.append(h('span', null, n.title.zh), ' ', h('span', { class: 'en' }, n.title.en));
      back.hidden = false; spineHost.hidden = false; document.title = n.title.zh + ' · IC 解構室';
      main.append(h('p', { class: 'loading' }, '載入中…'));
      let view;
      try { view = await createChapterView(ctx, route.id); } catch (e) { clear(main); main.append(h('p', { class: 'loading' }, '章節載入失敗：' + e.message)); throw e; }
      if (my !== seq) { view.dispose(); return; }
      clear(main); main.append(view.el); current = view;
    } else {
      title.innerHTML = ''; title.append(h('span', null, 'IC 解構室'), ' ', h('span', { class: 'en' }, 'Display driver IC'));
      back.hidden = true; spineHost.hidden = true; document.title = 'IC 解構室 · 顯示驅動 IC';
      ctx.scheduler.stop();
      const home = createHome(ctx); main.append(home.el); current = home;
    }
  }
  ctx.bus.on('route', show);
  show(ctx.router.current);
}
