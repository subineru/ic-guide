/* Home animation: a packet of data travels along the main line and changes form where the real signal changes.
   Only `transform` and `opacity` are animated (Web Animations API), so the browser composites it without repainting.
   The shapes are schematic (docs/visual/home-overview.md): short bars = low voltage, tall bars = higher voltage, a wave = analog. */
import { h } from './dom.js';
import { flowTimeline, packetKeyframes, glowKeyframes, pixelKeyframes } from '../app/flow.js';

const BITS = [1, 0, 1, 1];
const CELL = { low: [5, 11], high: [9, 22] };               // px length for bit 0 / bit 1
const SVGNS = 'http://www.w3.org/2000/svg';

/* axis 'y' draws the wave transposed (not rotated by CSS), so its layout box matches what is seen */
const transpose = d => d.replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, '$2 $1');
function wave(kind, axis) {
  const svg = document.createElementNS(SVGNS, 'svg'), p = document.createElementNS(SVGNS, 'path');
  const big = kind === 'strong', W = big ? 46 : 40, H = big ? 24 : 18, vertical = axis === 'y';
  svg.setAttribute('width', String(vertical ? H : W)); svg.setAttribute('height', String(vertical ? W : H)); svg.setAttribute('viewBox', vertical ? '0 0 24 46' : '0 0 46 24');
  const d = big ? 'M2 20 C 10 -2, 18 26, 26 8 S 40 14, 44 4' : 'M2 16 C 10 2, 18 22, 26 10 S 38 12, 44 6';
  p.setAttribute('d', vertical ? transpose(d) : d);
  p.setAttribute('fill', 'none'); p.setAttribute('stroke-linecap', 'round');
  svg.append(p); return svg;
}
/* one packet shape; also used (static) in the legend so the legend always matches what moves */
export function packetEl(kind, axis = 'x') {
  const el = h('div', { class: `pkt ${kind}`, dataset: { kind, axis }, 'aria-hidden': 'true' });
  if (kind === 'low' || kind === 'high') BITS.forEach(b => el.append(h('i', { style: `--h:${CELL[kind][b]}px` })));
  else el.append(wave(kind, axis));
  return el;
}

/* host: positioned element that contains the main-line boxes.  axis 'x' (wide map: coords in cqw, `cross` = top as css length)
   or 'y' (narrow list: coords in px, `cross` = left as css length).  nodes[i] = box of part i; pixel = the panel's lit square. */
export function mountFlow({ host, axis, unit, coords, cross, parts, nodes, pixel }) {
  const tl = flowTimeline(parts, coords);
  const at = c => (axis === 'x' ? `translate(calc(${c}${unit} - 50%), -50%)` : `translate(-50%, calc(${c}${unit} - 50%))`);
  const anims = [], els = [];
  const run = (el, kf) => anims.push(el.animate(kf, { duration: tl.loop, iterations: Infinity, easing: 'linear' }));
  tl.layers.forEach(l => {
    const el = packetEl(l.kind, axis);
    el.style.cssText = axis === 'x' ? `left:0;top:${cross}` : `top:0;left:${cross}`;
    host.append(el); els.push(el); run(el, packetKeyframes(l, tl.loop, at));
  });
  tl.arrivals.forEach((a, i) => { const g = nodes[i] && nodes[i].querySelector('.glow'); if (g) run(g, glowKeyframes(a.t, tl.loop)); });
  if (pixel) run(pixel, pixelKeyframes(tl));
  return {
    tl, anims, els,
    cancel() { anims.forEach(a => a.cancel()); els.forEach(e => e.remove()); anims.length = 0; els.length = 0; },
  };
}

/* Owns the running animation: one place that decides play / pause.
   It runs only when the user has not paused it, the map is on screen, and reduce-motion is off. */
export function createFlowController({ settings, bus }) {
  let current = null, opts = null, userPaused = false, visible = true, io = null, onChange = () => {};
  const reduced = () => !!settings.get('reduceMotion');
  const apply = () => {
    if (!current) return;
    const go = !userPaused && visible;
    current.anims.forEach(a => (go ? a.play() : a.pause()));
    onChange();
  };
  const stop = () => { if (current) { current.cancel(); current = null; } if (io) { io.disconnect(); io = null; } };
  function mount(o) {
    stop(); opts = o;
    o.host.classList.toggle('flow-static', reduced());          // reduce-motion: no packets, the pixel is simply shown lit
    if (reduced()) { onChange(); return; }
    current = mountFlow(o);
    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); apply(); }); io.observe(o.host);
    }
    apply();
  }
  bus.on('settings', k => { if (k === 'reduceMotion' && opts && opts.host.isConnected) mount(opts); });
  return {
    mount, stop,
    get playing() { return !!current && !userPaused; },
    get reduced() { return reduced(); },
    setUserPaused(v) { userPaused = !!v; apply(); },
    toggle() { userPaused = !userPaused; apply(); return !userPaused; },
    onChange(fn) { onChange = fn; },
  };
}
