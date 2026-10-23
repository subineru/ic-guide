/* Layers on top of a chapter's stage that every lesson shares: the focus ring ("look here"), the caption bar (what is
   happening, one line) and the beat dots (where we are in this step).  They only READ the player's state; a view never
   draws them itself.  A view tells us where things are by answering targets(id) with the element(s) to look at. */
import { h, clear } from './dom.js';
import { focusBox } from './focus-geom.js';
import { WHOLE } from '../domain/timeline.js';

export function createStageLayers({ stage, view, bus, targets }) {
  const ring = h('div', { class: 'focus-ring', 'aria-hidden': 'true' });
  const layer = h('div', { class: 'stage-layers', 'aria-hidden': 'true' }, ring);
  const capText = h('div', { class: 'cap-text', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const dots = h('span', { class: 'cap-dots', 'aria-hidden': 'true' }), count = h('span', { class: 'cap-count' });
  const bar = h('div', { class: 'caption-bar', hidden: true }, capText, h('div', { class: 'cap-meta' }, dots, count));
  let resolve = targets, last = null, lastCaption = null, lastFocusKey = null, visible = false, raf = 0, off = [];

  stage.classList.add('has-layers'); view.append(layer); stage.append(bar);

  function place() {
    raf = 0;
    if (!last || !last.focus || last.focus.every(f => f === WHOLE)) return hideRing();
    const v = view.getBoundingClientRect();
    const rects = last.focus.filter(f => f !== WHOLE).flatMap(id => [].concat(resolve(id) || [])).map(e => e.getBoundingClientRect());
    const box = focusBox(rects, v);
    if (!box) return hideRing();
    if (!visible) { ring.classList.add('jump'); }                          // first appearance: no gliding in from wherever it was
    Object.assign(ring.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
    if (!visible) { void ring.offsetWidth; ring.classList.remove('jump'); }
    ring.dataset.on = '1'; visible = true;
  }
  function hideRing() { ring.dataset.on = '0'; visible = false; }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(place); };

  function setDots(n, cur) {
    if (dots.children.length !== n) { clear(dots); for (let i = 0; i < n; i++) dots.append(h('i')); }
    [...dots.children].forEach((d, i) => { d.dataset.s = i < cur ? 'done' : i === cur ? 'now' : 'next'; });
    count.textContent = `${cur + 1} / ${n}`;
  }
  function onState(s) {
    last = s;
    if (!s) { bar.hidden = true; capText.textContent = ''; lastCaption = null; lastFocusKey = null; hideRing(); return; }
    bar.hidden = false;
    if (s.caption !== lastCaption) {
      lastCaption = s.caption; capText.textContent = s.caption;
      capText.classList.remove('swap'); void capText.offsetWidth; capText.classList.add('swap');     // fades in again (CSS; off with reduced motion)
    }
    setDots(s.beatCount, s.beat);
    const key = s.beat + '|' + s.focus.join(',');
    if (key !== lastFocusKey) { lastFocusKey = key; schedule(); }
  }
  off.push(bus.on('player:state', onState));
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  if (ro) ro.observe(view);

  return {
    setTargets(fn) { resolve = fn; schedule(); },
    refresh: schedule,
    dispose() {
      off.forEach(f => f()); if (ro) ro.disconnect(); if (raf) cancelAnimationFrame(raf);
      layer.remove(); bar.remove(); stage.classList.remove('has-layers');
    },
  };
}
