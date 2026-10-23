/* Shared plumbing for 2D views: builds the <svg>, keeps every label >= 12 CSS px whatever the stage size, and switches
   between a wide and a portrait layout when the stage changes shape (so phone screens are laid out, not just shrunk). */
import { s } from './svg.js';
import { inkDefs, INK } from './ink.js';

function createText(svg, host, W, H) {
  const items = [];
  /* zh line, optional en line; o.size = base size in viewBox units; o.digit = a single big character in a badge */
  const make = (parent, x, y, zh, en, o = {}) => {
    const t = s('text', { x, y, 'text-anchor': o.anchor || 'middle', fill: o.fill || 'var(--ink)', 'font-weight': o.bold ? 700 : null });
    const a = s('tspan', null, zh); t.append(a);
    let b = null; if (en) { b = s('tspan', { x, fill: o.same ? (o.fill || 'var(--ink)') : 'var(--sub)' }); b.textContent = en; t.append(b); }   // o.same: a second line of the same weight, not a gray translation
    if (o.role) t.dataset.role = o.role;
    items.push({ t, b, base: o.size || 16, digit: !!o.digit, same: !!o.same });
    (parent || svg).append(t); return t;
  };
  const fit = () => {
    const scale = Math.max(0.2, Math.min((host.clientWidth || W) / W, (host.clientHeight || H) / H));   // viewBox units -> CSS px
    const want = 12 / scale;                                                                             // units that render as 12 px
    items.forEach(({ t, b, base, digit, same }) => {
      const big = Math.max(base, want * (digit ? 1.6 : 1.1)), small = same ? big : Math.max(base * 0.8, want);
      t.setAttribute('font-size', big.toFixed(1));
      if (b) { b.setAttribute('font-size', small.toFixed(1)); b.setAttribute('dy', (small * 1.35).toFixed(1)); }
    });
  };
  return { make, fit };
}

export function mountView({ host, settings, label, layouts, build }) {
  let cur = null, mode = null, last = null;
  const pick = () => (host.clientWidth && host.clientHeight && host.clientWidth / host.clientHeight < 1.15 ? 'narrow' : 'wide');
  function make() {
    if (cur) cur.svg.remove();
    mode = pick();
    const { W, H, pad = 0 } = layouts[mode];                                  // pad: empty band on top, where the stage chips sit
    const svg = s('svg', { viewBox: `0 0 ${W} ${H + pad}`, role: 'img', 'aria-label': label, preserveAspectRatio: 'xMidYMid meet' });
    const layer = s('g', { transform: pad ? `translate(0 ${pad})` : null });
    const txt = createText(svg, host, W, H + pad);
    const wobble = settings.get('wobble') && !settings.get('reduceMotion');
    svg.append(inkDefs(), layer);
    const still = s('g', { filter: wobble ? 'url(#ink-wobble)' : null, fill: 'none', stroke: INK.stroke, 'stroke-width': INK.width, ...INK.round });
    layer.append(still);
    const view = build({ svg, layer, still, txt, narrow: mode === 'narrow', W, H });
    host.append(svg); txt.fit();
    cur = { svg, txt, view };
    if (last) view.update(last, 0);
  }
  make();
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (pick() !== mode) make(); else cur.txt.fit(); }) : null;
  if (ro) ro.observe(host);
  return {
    update(P, dt) { last = P; cur.view.update(P, dt); },
    dispose() { if (ro) ro.disconnect(); if (cur) cur.svg.remove(); },
  };
}
export { s };
