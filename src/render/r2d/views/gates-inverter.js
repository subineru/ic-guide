/* The inverter as a lesson timeline: an input switch on the stage, two voltage-controlled switches (one to HIGH, one to
   LOW), and the output drawn as a small water bucket (full = 1, empty = 0).  Water only moves while a switch is closed
   AND the bucket is not yet at that level, so a flow is always a transient and can never contradict the picture.
   Everything is derived from the timeline's parameters:  a (input 0..1), up / down (switch closed 0..1), level (bucket 0..1).
   Level is read from a digit AND colour AND line weight, never colour alone. */
import { s, mountView } from '../stage.js';
import { INVERTER_TABLE } from '../../../domain/sim/logic.js';

const HIGH = 'var(--c-high)', LOW = 'var(--c-low)', WATER = 'var(--c-electron)', LEVEL = v => (v ? HIGH : LOW);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

export function create({ host, settings }) {
  return mountView({
    host, settings, label: '示意圖：反相器。輸入決定上下兩個開關，輸出像一個水桶，水滿是 1、水空是 0',
    layouts: { wide: { W: 800, H: 500 }, narrow: { W: 520, H: 700, pad: 84 } },
    build({ svg, layer, still, txt, narrow: N, W, H }) {
      const ids = {}, box = (id, x, y, w, h) => { ids[id] = s('rect', { x, y, width: w, height: h, fill: 'none', stroke: 'none', 'data-target': id }); layer.append(ids[id]); };
      const cx = N ? 228 : 400, top = 70, bot = N ? 400 : 430, upY = N ? 120 : 125, downY = N ? 270 : 300, nodeY = N ? 220 : 245, sl = 50;
      const bl = N ? 405 : 600, br = N ? 505 : 720, bt = 150, bb = N ? 270 : 300, inner = bb - bt - 6;      // bucket walls and floor
      const inX = N ? 55 : 130, busX = N ? 170 : 300;

      /* ---- fixed drawing: rails, wires, bucket shell ---- */
      const rail = (y, high, zh, en, labelY) => {
        still.append(s('line', { x1: cx - 100, y1: y, x2: cx + 100, y2: y, stroke: high ? HIGH : LOW, 'stroke-width': 7 }));
        txt.make(layer, cx, labelY, zh, en, { bold: true });
      };
      rail(top, true, '高電壓', 'High', top - 40); rail(bot, false, '低電壓（地）', 'Low', bot + 34);
      still.append(s('path', { d: `M${cx} ${top} V${upY} M${cx} ${upY + sl} V${downY} M${cx} ${downY + sl} V${bot} M${cx} ${nodeY} H${bl}` }));
      still.append(s('circle', { cx, cy: nodeY, r: 6, fill: 'var(--ink)' }));
      still.append(s('path', { d: `M${bl} ${bt} V${bb} H${br} V${bt}`, 'stroke-width': 3.2 }));
      txt.make(layer, bl - 8, bt + 16, '1', null, { anchor: 'end', size: 16, bold: true, fill: 'var(--sub)' });       // what a full / an empty bucket means
      txt.make(layer, bl - 8, bb - 2, '0', null, { anchor: 'end', size: 16, bold: true, fill: 'var(--sub)' });

      /* ---- water: level, and flows that exist only while the level is still changing ---- */
      const water = s('rect', { x: bl + 2, width: br - bl - 4, fill: WATER, opacity: '.8' });
      const fillPath = `M${cx} ${top} V${nodeY} H${bl}`, drainPath = `M${bl} ${nodeY} H${cx} V${bot}`;
      const flow = d => s('path', { d, fill: 'none', stroke: WATER, 'stroke-linecap': 'round', 'stroke-dasharray': '2 12' });
      const fillFlow = flow(fillPath), drainFlow = flow(drainPath);
      layer.append(water, fillFlow, drainFlow);
      let phase = 0;

      /* ---- the two switches (levers tilt between open and closed) ---- */
      const vsw = (x, y) => {
        still.append(s('circle', { cx: x, cy: y, r: 5, fill: 'var(--card)' }), s('circle', { cx: x, cy: y + sl, r: 5, fill: 'var(--card)' }));
        const lever = s('line', { x1: x, y1: y, stroke: 'var(--ink)', 'stroke-width': 4, 'stroke-linecap': 'round' }); layer.append(lever);
        return c => { c = clamp(c); lever.setAttribute('x2', x + 18 * (1 - c)); lever.setAttribute('y2', y + sl - 12 * (1 - c)); };
      };
      const setUp = vsw(cx, upY), setDown = vsw(cx, downY);
      box('swUp', cx - 22, upY - 12, 44, sl + 24); box('swDown', cx - 22, downY - 12, 44, sl + 24);
      const swLabel = (y, one, two) => (N ? txt.make(layer, cx + 24, y - 8, two[0], two[1], { anchor: 'start', size: 15, same: true }) : txt.make(layer, cx + 24, y, one, null, { anchor: 'start', size: 15 }));
      swLabel(upY + 30, '輸入 0 時接通', ['輸入 0 時', '接通']); swLabel(downY + 30, '輸入 1 時接通', ['輸入 1 時', '接通']);

      /* ---- input: a slide switch on the stage, and the control wires that carry its level to both switches ---- */
      const trackW = 90, trackX = inX - trackW / 2, trackH = 44, trackY = nodeY - trackH / 2;
      const track = s('rect', { x: trackX, y: trackY, width: trackW, height: trackH, rx: trackH / 2, stroke: 'var(--ink)', 'stroke-width': 2.5 });
      const knob = s('circle', { cy: nodeY, r: 18, stroke: 'var(--ink)', 'stroke-width': 2 });
      layer.append(track, knob);
      const knobDigit = txt.make(layer, inX, nodeY + 7, '0', null, { digit: true, size: 20, bold: true, fill: '#fff' });
      txt.make(layer, inX, trackY - 44, '輸入', 'Input', { bold: true });
      box('input', trackX - 12, trackY - 76, trackW + 24, trackH + 94);
      const x0 = inX + trackW / 2, endX = cx - 16;
      const wireUp = `M${x0} ${nodeY} H${busX} V${upY + sl / 2} H${endX}`, wireDown = `M${x0} ${nodeY} H${busX} V${downY + sl / 2} H${endX}`;
      const wires = s('g', { fill: 'none', 'stroke-linecap': 'round' }); layer.append(wires);
      const wu = s('path', { d: wireUp }), wd = s('path', { d: wireDown }); wires.append(wu, wd);
      const dotU = s('circle', { r: 8, fill: 'var(--accent)', stroke: '#fff', 'stroke-width': 2, opacity: '0' }), dotD = dotU.cloneNode();
      layer.append(dotU, dotD);
      ids.wires = wires; wires.dataset.target = 'wires';

      /* ---- output: the bucket's number badge, and the truth table whose row follows the input ---- */
      const bx = (bl + br) / 2, by = bt - 52;
      const badge = s('circle', { cx: bx, cy: by, r: 24, stroke: 'var(--ink)', 'stroke-width': 2 }); layer.append(badge);
      const badgeDigit = txt.make(layer, bx, by + 8, '1', null, { digit: true, size: 24, bold: true, fill: '#fff' });
      txt.make(layer, bx, by - 74, '輸出', 'Output', { bold: true });
      box('bucket', bl - 30, bt - 8, br - bl + 38, bb - bt + 16); box('output', bx - 40, by - 104, 80, 130);
      const rh = 30, cw = N ? 70 : 64, tx = N ? W / 2 - 64 : 570, ty = N ? 500 : 345, th = ['輸入', '輸出'];
      const hl = s('rect', { x: tx - 8, width: cw * 2 + 16, height: rh, rx: 5, fill: 'var(--accent)', opacity: '.16', stroke: 'var(--accent)', 'stroke-width': 2 });
      layer.append(hl);
      th.forEach((t, i) => txt.make(layer, tx + cw * i + cw / 2, ty + 20, t, null, { size: 15, bold: true, fill: 'var(--sub)' }));
      INVERTER_TABLE.forEach((r, k) => r.forEach((v, i) => txt.make(layer, tx + cw * i + cw / 2, ty + rh * (k + 1) + 21, String(v), null, { size: 17 })));
      still.append(s('rect', { x: tx - 8, y: ty - 2, width: cw * 2 + 16, height: rh * 3 + 8, rx: 6, fill: 'none' }));
      box('table', tx - 12, ty - 6, cw * 2 + 24, rh * 3 + 16);

      const along = (el, dot, p) => { const L = el.getTotalLength(), pt = el.getPointAtLength(L * p); dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y); dot.setAttribute('opacity', '1'); };
      return {
        targets: id => ids[id] || null,
        update(S, dt) {
          const P = S.params || S, pulse = S.pulses && S.pulses.ctl;
          const a = clamp(P.a), up = clamp(P.up), down = clamp(P.down), level = clamp(P.level), aOn = a >= 0.5 ? 1 : 0, y = level >= 0.5 ? 1 : 0;
          knob.setAttribute('cx', trackX + trackH / 2 + (trackW - trackH) * a); knob.setAttribute('fill', LEVEL(aOn)); knobDigit.textContent = String(aOn);
          knobDigit.setAttribute('x', trackX + trackH / 2 + (trackW - trackH) * a);
          track.setAttribute('fill', aOn ? 'rgba(179, 38, 30, .15)' : 'rgba(46, 125, 91, .15)');
          wires.setAttribute('stroke', LEVEL(aOn)); wires.setAttribute('stroke-width', aOn ? 5 : 2.5); wires.setAttribute('stroke-dasharray', aOn ? null : '7 6');
          if (pulse == null) { dotU.setAttribute('opacity', '0'); dotD.setAttribute('opacity', '0'); } else { along(wu, dotU, pulse); along(wd, dotD, pulse); }
          setUp(up); setDown(down);
          const h_ = level * inner; water.setAttribute('y', bb - 2 - h_); water.setAttribute('height', h_);
          const fillAmt = (up >= 0.95 ? 1 : 0) * clamp((1 - level) * 10), drainAmt = (down >= 0.95 ? 1 : 0) * clamp(level * 10);
          phase += (dt || 0) * 70;
          for (const [el, amt, dir] of [[fillFlow, fillAmt, 1], [drainFlow, drainAmt, 1]]) {
            el.setAttribute('stroke-opacity', amt > 0.02 ? 1 : 0); el.setAttribute('stroke-width', 3 + 3 * amt); el.setAttribute('stroke-dashoffset', (-phase * dir).toFixed(1));
          }
          badge.setAttribute('fill', LEVEL(y)); badgeDigit.textContent = String(y);
          hl.setAttribute('y', ty + rh * (aOn + 1) + 2);
          svg.dataset.level = level.toFixed(2); svg.dataset.y = String(y); svg.dataset.a = String(aOn);
          svg.dataset.up = up >= 0.95 ? '1' : '0'; svg.dataset.down = down >= 0.95 ? '1' : '0';
          svg.dataset.flow = fillAmt > 0.02 ? 'fill' : drainAmt > 0.02 ? 'drain' : 'none';
        },
      };
    },
  });
}
