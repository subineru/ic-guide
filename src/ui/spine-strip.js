/* The main line as a thin strip (desktop) or one tappable row (narrow screens).  Highlights the parts a chapter is about. */
import { h, clear } from './dom.js';
import { bi, biPlain } from '../core/text.js';
import { shortLabel } from '../domain/curriculum.js';

export function createSpineStrip(host, spine) {
  let open = false;
  const label = h('span', { class: 'spine-now' });
  const toggle = h('button', { class: 'btn spine-toggle', type: 'button', 'aria-expanded': 'false', onclick: () => { open = !open; host.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); } }, label);
  const list = h('ol', { class: 'spine-list' });
  host.append(toggle, list);
  return {
    render(active = []) {
      clear(list);
      let k = 0;
      spine.forEach(p => {
        const on = active.includes(p.id), tag = p.zone === 'ic' ? ++k : 'IC 外';
        list.append(h('li', { class: (on ? 'on ' : '') + (p.zone === 'ic' ? '' : 'outside'), 'aria-current': on ? 'step' : null, html: `<span class="n">${tag}</span> ${bi(shortLabel(p))}` }));
      });
      const names = spine.filter(p => active.includes(p.id)).map(p => shortLabel(p).zh);
      const what = !names.length ? '基礎知識' : names.length <= 3 ? names.join('、') : `${names.length} 個零件`;
      label.textContent = '主線 · ' + what + ' ▾';
    },
  };
}
