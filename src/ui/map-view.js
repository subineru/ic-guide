/* The main line and the chapter map, drawn two ways from the same layout:
     mode 'hero'  -> only the main line, its rail and the chapters that hang from it (home page; carries the animation)
     mode 'full'  -> everything: + the shared foundation under the IC bracket and the chip group (learning map panel)
   Main line (top): phone-side interface link -> six parts INSIDE the driver IC (numbered 1-6, inside a bracket) -> panel.
   Four kinds of chapter, four places (decided by domain/curriculum.js, never by this file):
     foundation -> a base layer under the whole IC bracket (shared by every part inside the IC; never a child of one part)
     hang       -> hangs directly under the main-line part(s) it explains
     span       -> walks the whole main line: hangs from a rail under the entire line
     chip       -> "the chip itself" group (layers, making, package)
   Two relations are drawn differently: data FLOW (thick arrows) vs "needs" (thin dashed; direct prerequisites only).
   Screens >= 960 px get the hand-placed map; narrower ones get the same structure as a list (a shrunken map is unreadable). */
import { h, clear } from './dom.js';
import { bi, biPlain } from '../core/text.js';
import { placementOf, directNeeds, partNumber, shortLabel } from '../domain/curriculum.js';

/* 1000-wide box; height 560 (full) or 216 (hero).  Main-line boxes: ends 104 wide, IC parts 106 wide, 58 high.  Chapter boxes 160 x 66. */
const SPINE_Y = 70, CH = 66;
const SX = { link: 74, receive: 195, shift: 317, latch: 439, level: 561, dac: 683, buffer: 805, panel: 926 };
const SW = { link: 104, panel: 104 };
const IC = { x0: 134, x1: 866, y0: 34, y1: 105 };
const RAIL_Y = 118;
const BAND = { x0: IC.x0, x1: IC.x1, y0: 250, y1: 372 };
const POS = {
  gates: [378, 168], datapath: [650, 168], scan: [905, 168],
  basics: [226, 322], mosfet: [498, 322], digital: [770, 322],
  die: [556, 478], fab: [736, 478], package: [916, 478],
};
const HERO_IDS = ['gates', 'datapath', 'scan'];
const WIDTH = { gates: 190, scan: 150, die: 158, fab: 158, package: 158 };
const CHIP_BOX = { cx: 733, cy: 475, w: 531, h: 130 };
const HEIGHT = { hero: 216, full: 560 };
const EDGE = {
  'basics>mosfet': 'M306 322 H418', 'mosfet>digital': 'M578 322 H690',
  'digital>gates': 'M770 289 C 770 240, 378 250, 378 201',
  'gates>datapath': 'M473 168 H570', 'scan>datapath': 'M830 168 H730',
  'basics>die': 'M226 355 V478 H477', 'mosfet>fab': 'M455 355 V526 H736 V511',
  'die>fab': 'M635 478 H657', 'fab>package': 'M815 478 H837',
};
const SVGNS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); return e; };
const arrowDefs = () => {
  const d = sv('defs');
  [['arr-flow', 'var(--c-data)'], ['arr-needs', 'var(--sub)']].forEach(([id, color]) => {
    const m = sv('marker', { id, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '9', markerHeight: '9', orient: 'auto', markerUnits: 'userSpaceOnUse' });
    m.append(sv('path', { d: 'M1 1 L9 5 L1 9 z', fill: color, stroke: 'none' })); d.append(m);
  });
  return d;
};

export function createMap(ctx, { mode, flow }) {
  const { progress, nodes, spine, path } = ctx;
  const H = HEIGHT[mode], hero = mode === 'hero';
  const STATE = { new: '尚未開始', doing: '進行中', done: '已完成', soon: '即將推出' };
  const stateOf = id => (ctx.isAvailable(id) ? progress.state(id) : 'soon');
  const pos = (cx, cy, w, hh) => `left:${((cx - w / 2) / 10).toFixed(2)}%;top:${((cy - hh / 2) / (H / 100)).toFixed(2)}%;width:${(w / 10).toFixed(2)}%;height:${((hh / H) * 100).toFixed(2)}%`;
  const box = (x0, y0, x1, y1) => pos((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0);
  const chip = id => {
    const n = nodes.find(x => x.id === id), st = stateOf(id);
    return h('button', { class: `node ${st}`, type: 'button', dataset: { id }, 'aria-label': `${biPlain(n.title)}，${STATE[st]}`, onclick: () => ctx.openChapter(id) },
      h('span', { class: 'ring', 'aria-hidden': 'true' }, st === 'done' ? '✓' : ''),
      h('span', { class: 'nt', html: bi(n.title) }));
  };
  const spineBox = p => {
    const num = partNumber(p.id);
    return h('div', { class: 'spine-node' + (p.zone === 'ic' ? '' : ' outside'), dataset: { part: p.id, zone: p.zone } },
      h('span', { class: 'glow', 'aria-hidden': 'true' }),
      h('span', { class: num ? 'n' : 'n out' }, num ? String(num) : 'IC 外'), h('span', { class: 'nt', html: bi(shortLabel(p)) }),
      p.id === 'panel' ? [h('span', { class: 'px', 'aria-hidden': 'true' }), h('span', { class: 'px-lit', 'aria-hidden': 'true' })] : null);
  };

  const holder = h('div', { class: 'map-holder ' + mode });
  let view = null, ro = null;

  function wide() {
    const map = h('div', { class: 'map', style: `aspect-ratio: 1000 / ${H}` });
    const svg = sv('svg', { viewBox: `0 0 1000 ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    svg.append(arrowDefs());
    const line = (d, cls, extra) => { const p = sv('path', Object.assign({ d, class: cls }, extra || {})); svg.append(p); return p; };
    const half = id => (SW[id] || 106) / 2;
    const shown = id => !hero || HERO_IDS.includes(id);
    spine.forEach((p, i) => { if (i) { const a = spine[i - 1].id; line(`M${SX[a] + half(a)} ${SPINE_Y} H${SX[p.id] - half(p.id)}`, 'flow'); } });
    line(`M${SX.link} 99 V${RAIL_Y} H${SX.panel} V99`, 'rail');
    spine.forEach(p => line(`M${SX[p.id]} 99 V${RAIL_Y}`, 'rail'));
    nodes.filter(n => placementOf(n) === 'span' && shown(n.id)).forEach(n => line(`M${POS[n.id][0]} ${RAIL_Y} V${POS[n.id][1] - CH / 2}`, 'branch'));
    nodes.filter(n => placementOf(n) === 'hang' && shown(n.id)).forEach(n => n.hang.forEach(pid => line(`M${SX[pid]} ${RAIL_Y} V${POS[n.id][1] - CH / 2}`, 'branch')));
    directNeeds(nodes).filter(([f, t]) => shown(f) && shown(t)).forEach(([from, to]) => {
      const d = EDGE[from + '>' + to] || (POS[from] && POS[to] ? `M${POS[from][0]} ${POS[from][1]} L${POS[to][0]} ${POS[to][1]}` : null);
      if (d) line(d, 'needs', { 'data-edge': from + '>' + to });
    });
    map.append(svg);
    map.append(h('div', { class: 'zone-ic', style: box(IC.x0, IC.y0, IC.x1, IC.y1) }),
      h('span', { class: 'zone-t', style: pos((IC.x0 + IC.x1) / 2, 17, 400, 20), html: '驅動 IC <span class="en">Display driver IC</span>' }));
    spine.forEach(p => { const b = spineBox(p); b.style.cssText = pos(SX[p.id], SPINE_Y, SW[p.id] || 106, 58); map.append(b); });
    if (!hero) {
      map.append(
        h('div', { class: 'group foundation', style: box(BAND.x0, BAND.y0, BAND.x1, BAND.y1) },
          h('span', { class: 'group-t', html: '共同基礎 <span class="en">Foundation</span>：驅動 IC 內的每個零件（1～6），都由電晶體組成' })),
        h('div', { class: 'group', style: pos(CHIP_BOX.cx, CHIP_BOX.cy, CHIP_BOX.w, CHIP_BOX.h) },
          h('span', { class: 'group-t', html: '晶片本身 <span class="en">The chip</span>' })));
    }
    Object.keys(POS).filter(shown).forEach(id => { const el = chip(id); el.style.cssText = pos(POS[id][0], POS[id][1], WIDTH[id] || 160, CH); map.append(el); });
    map.mountFlow = () => flow && flow.mount({
      host: map, axis: 'x', unit: 'cqw', coords: spine.map(p => SX[p.id] / 10), cross: `${(RAIL_Y / (H / 100)).toFixed(2)}%`,
      parts: spine, nodes: [...map.querySelectorAll('.spine-node')], pixel: map.querySelector('.px-lit'),
    });
    return map;
  }

  function narrow() {
    const wrap = h('div', { class: 'maplist' });
    const under = {};
    nodes.filter(n => placementOf(n) === 'hang').forEach(n => { (under[n.hang[0]] = under[n.hang[0]] || []).push(n.id); });
    wrap.append(h('h3', null, '資料流向 ', h('span', { class: 'en' }, 'Data flow')));
    nodes.filter(n => placementOf(n) === 'span').forEach(n => wrap.append(h('p', { class: 'sub' }, '沿著整條主線走一遍：'), h('div', { class: 'chips' }, chip(n.id))));
    const ol = h('ol', { class: 'flowlist' });
    spine.forEach(p => ol.append(h('li', null, spineBox(p), (under[p.id] || []).map(chip))));
    wrap.append(ol);
    if (!hero) {
      const ids = kind => path.filter(id => placementOf(nodes.find(n => n.id === id)) === kind);
      wrap.append(h('h3', { html: '共同基礎 <span class="en">Foundation</span>' }),
        h('p', { class: 'sub' }, '驅動 IC 內的每個零件（1～6），都由電晶體組成。'),
        h('div', { class: 'chips' }, ids('foundation').map(chip)),
        h('h3', { html: '晶片本身與製造 <span class="en">The chip &amp; making</span>' }),
        h('div', { class: 'chips' }, ids('chip').map(chip)));
    }
    wrap.mountFlow = () => {
      if (!flow) return;
      const boxes = [...ol.querySelectorAll('.spine-node')], top = ol.getBoundingClientRect().top;
      flow.mount({ host: ol, axis: 'y', unit: 'px', coords: boxes.map(b => { const r = b.getBoundingClientRect(); return r.top - top + r.height / 2; }), cross: '-1.5px', parts: spine, nodes: boxes, pixel: ol.querySelector('.px-lit') });
    };
    return wrap;
  }

  const mq = matchMedia('(min-width: 960px)');
  const draw = () => {
    clear(holder);
    view = mq.matches ? wide() : narrow();
    holder.append(view);
    if (flow) requestAnimationFrame(() => { if (view && view.isConnected) view.mountFlow(); });      // after layout, so measured positions are real
    if (ro) { ro.disconnect(); ro = null; }
    if (flow && !mq.matches && typeof ResizeObserver === 'function') { ro = new ResizeObserver(() => { if (view && view.isConnected) view.mountFlow(); }); ro.observe(holder); }
  };
  /* progress changes only recolour the chapter boxes: the map is NOT rebuilt, so the animation keeps running */
  const refresh = () => holder.querySelectorAll('.node[data-id]').forEach(el => {
    const id = el.dataset.id, st = stateOf(id), n = nodes.find(x => x.id === id);
    el.className = `node ${st}`; el.setAttribute('aria-label', `${biPlain(n.title)}，${STATE[st]}`); el.querySelector('.ring').textContent = st === 'done' ? '✓' : '';
  });
  draw(); mq.addEventListener('change', draw);
  const off = ctx.bus.on('progress', refresh);
  return { el: holder, dispose() { mq.removeEventListener('change', draw); off(); if (ro) ro.disconnect(); if (flow) flow.stop(); } };
}
