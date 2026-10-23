import { h, clear } from './dom.js';
export function createToast(host) {
  let timer = 0;
  return function toast(msg, action) {
    clear(host); host.hidden = false;
    host.append(h('span', null, msg));
    if (action) host.append(h('button', { class: 'btn small', onclick: () => { action.fn(); host.hidden = true; } }, action.label));
    clearTimeout(timer); timer = setTimeout(() => { host.hidden = true; }, action ? 7000 : 3500);
  };
}
