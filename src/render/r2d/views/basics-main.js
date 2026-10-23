/* basics: three pictures, one per step (P.scene = 1, 2, 3).
   1  water pipe: tank height = voltage, pipe narrowness = resistance, flow = current
   2  three pipes: a conductor always flows, an insulator never, a semiconductor flows as much as a control lets it
   3  a voltage-controlled switch lighting a lamp
   Only "current" is drawn (never electrons), left to right.  Every number is a drawing amount, not a real unit. */
import { s, mountView } from '../stage.js';
import { current } from '../../../domain/sim/ohm.js';

const clamp01 = x => Math.min(1, Math.max(0, x));

export function create({ host, settings }) {
  return mountView({
    host, settings, label: '示意圖：水管比喻、導體絕緣體與半導體、用電壓控制的開關',
    layouts: { wide: { W: 800, H: 500 }, narrow: { W: 520, H: 640, pad: 84 } },
    build({ layer, still, txt, narrow: N, W, H }) {
      const X = f => f * W, Y = f => f * H;
      const g1 = s('g'), g2 = s('g'), g3 = s('g'), dyn = [g1, g2, g3];
      const sg = [s('g'), s('g'), s('g')];                                    // static parts of each scene (these get the ink wobble)
      sg.forEach(g => still.append(g)); layer.append(g1, g2, g3);
      const flowAttrs = (extra) => Object.assign({ fill: 'none', stroke: 'var(--c-data)', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-dasharray': '12 12' }, extra);

      /* ---- scene 1: water pipe ---- */
      const tank = { x: X(0.13), y: Y(N ? 0.16 : 0.16), w: X(0.22), h: Y(N ? 0.50 : 0.58) }, yc = Y(N ? 0.58 : 0.64), ph = N ? 56 : 60;
      const px0 = tank.x + tank.w, px1 = X(0.86), cx0 = X(0.52), cw = X(0.12);
      sg[0].append(s('rect', { x: tank.x, y: tank.y, width: tank.w, height: tank.h, rx: 6 }),
        s('path', { d: `M${px0} ${yc - ph / 2} H${px1} M${px0} ${yc + ph / 2} H${px1}` }));
      const water = s('rect', { x: tank.x + 4, width: tank.w - 8, fill: 'var(--c-electron)', opacity: '.38' });
      const blockT = s('rect', { x: cx0, width: cw, fill: 'var(--c-hole)', opacity: '.8' }), blockB = s('rect', { x: cx0, width: cw, fill: 'var(--c-hole)', opacity: '.8' });
      const flow1 = s('path', flowAttrs({ d: `M${px0 + 10} ${yc} H${px1 - 8}` }));
      const arrow = s('path', { d: `M${px1 + 2} ${yc - 12} L${px1 + 22} ${yc} L${px1 + 2} ${yc + 12} z`, fill: 'var(--c-data)' });
      const meterBg = s('rect', { x: X(0.13), y: Y(N ? 0.88 : 0.86), width: X(0.73), height: 20, rx: 4, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2 });
      const meter = s('rect', { x: X(0.13) + 2, y: Y(N ? 0.88 : 0.86) + 2, height: 16, rx: 3, fill: 'var(--c-data)' });
      const leader = s('path', { d: `M${cx0 + cw / 2} ${yc + ph / 2 + 6} V${yc + ph / 2 + 22}`, stroke: 'var(--sub)', 'stroke-width': 1.5, fill: 'none' });
      g1.append(water, blockT, blockB, flow1, arrow, meterBg, meter, leader);
      txt.make(g1, tank.x + tank.w / 2, tank.y - 42, '電壓', 'Voltage', { bold: true });
      txt.make(g1, (px0 + px1) / 2 + (N ? 10 : 40), yc - ph / 2 - (N ? 52 : 44), '電流', 'Current', { bold: true });
      txt.make(g1, cx0 + cw / 2, yc + ph / 2 + (N ? 44 : 42), '電阻', 'Resistance', { bold: true });
      txt.make(g1, X(0.13), Y(N ? 0.88 : 0.86) - 8, '電流大小', null, { anchor: 'start', size: 14 });

      /* ---- scene 2: three pipes ---- */
      const rows = [Y(N ? 0.22 : 0.22), Y(N ? 0.50 : 0.50), Y(N ? 0.78 : 0.78)], ph2 = 52;
      const p2x0 = N ? X(0.10) : X(0.34), p2x1 = N ? X(0.88) : X(0.80);
      rows.forEach(y => sg[1].append(s('path', { d: `M${p2x0} ${y - ph2 / 2} H${p2x1} M${p2x0} ${y + ph2 / 2} H${p2x1}` })));
      const wallX = (p2x0 + p2x1) / 2 - 12;
      const wall = s('rect', { x: wallX, y: rows[1] - ph2 / 2, width: 24, height: ph2, fill: 'var(--ink)' });
      const valveT = s('rect', { x: wallX, width: 24, fill: 'var(--c-hole)', opacity: '.85' }), valveB = s('rect', { x: wallX, width: 24, fill: 'var(--c-hole)', opacity: '.85' });
      const f2 = rows.map(y => s('path', flowAttrs({ d: `M${p2x0 + 8} ${y} H${p2x1 - 8}` })));
      g2.append(wall, valveT, valveB, ...f2);
      const names = [['導體', 'Conductor', '一直導電'], ['絕緣體', 'Insulator', '不導電'], ['半導體', 'Semiconductor', '可以被控制']];
      names.forEach(([zh, en, note], i) => {
        if (N) { txt.make(g2, p2x0, rows[i] - ph2 / 2 - 24, zh, null, { anchor: 'start', bold: true }); txt.make(g2, p2x1, rows[i] - ph2 / 2 - 24, note, null, { anchor: 'end', size: 15 }); }
        else { txt.make(g2, X(0.18), rows[i] - 4, zh, en, { bold: true }); txt.make(g2, X(0.90), rows[i] + 5, note, null, { size: 15 }); }
      });

      /* ---- scene 3: voltage-controlled switch ---- */
      const mx = N ? X(0.14) : X(0.14), my0 = Y(0.18), mh = Y(0.60), mw = 40;
      sg[2].append(s('rect', { x: mx, y: my0, width: mw, height: mh, rx: 5 }), s('path', { d: `M${mx - 8} ${my0 + mh / 2} H${mx + mw + 8}`, 'stroke-width': 1.5 }));
      const ctl = s('rect', { x: mx + 3, width: mw - 6, fill: 'var(--c-high)', opacity: '.8' });
      const yL = N ? Y(0.60) : Y(0.55), sx0 = N ? X(0.38) : X(0.40), sx1 = N ? X(0.64) : X(0.60), lampX = N ? X(0.84) : X(0.82);
      sg[2].append(s('path', { d: `M${mx + mw + 10} ${yL} H${sx0}` }), s('path', { d: `M${sx1} ${yL} H${lampX - 36}` }),
        s('circle', { cx: sx0, cy: yL, r: 5, fill: 'var(--card)' }), s('circle', { cx: sx1, cy: yL, r: 5, fill: 'var(--card)' }),
        s('circle', { cx: lampX, cy: yL, r: 34 }));
      const lever = s('line', { x1: sx0, y1: yL, stroke: 'var(--ink)', 'stroke-width': 4, 'stroke-linecap': 'round' });
      const lampGlow = s('circle', { cx: lampX, cy: yL, r: 30, fill: '#ffd54a', opacity: 0, style: 'filter: drop-shadow(0 0 10px rgba(255,190,30,.9))' });
      const flow3 = s('path', flowAttrs({ d: `M${mx + mw + 14} ${yL} H${lampX - 40}`, 'stroke-width': 4 }));
      const dotted = s('path', { d: `M${mx + mw + 6} ${my0 + 14} C ${sx0} ${my0 + 14}, ${sx0 + 20} ${my0 + 14}, ${(sx0 + sx1) / 2} ${yL - 26}`, fill: 'none', stroke: 'var(--sub)', 'stroke-width': 1.8, 'stroke-dasharray': '3 6' });
      g3.append(dotted, ctl, flow3, lever, lampGlow);
      txt.make(g3, mx + mw / 2, my0 - 18, '控制電壓', 'Control', { bold: true });
      txt.make(g3, (sx0 + sx1) / 2, yL + (N ? 52 : 56), '開關', 'Switch', { bold: true });
      txt.make(g3, lampX, yL + 62, '燈泡', 'Lamp', { bold: true });

      let off1 = 0, off2 = [0, 0, 0], off3 = 0;
      return {
        update(P, dt = 0) {
          const scene = P.scene || 1;
          dyn.forEach((g, i) => { g.style.display = i + 1 === scene ? '' : 'none'; sg[i].style.display = i + 1 === scene ? '' : 'none'; });
          if (scene === 1) {
            const v = clamp01(P.v == null ? 0.3 : P.v), r = P.r == null ? 0.4 : P.r, i = current(v, r);
            const wh = (tank.h - 8) * v; water.setAttribute('y', tank.y + tank.h - 4 - wh); water.setAttribute('height', wh);
            const hb = ((Math.min(1, Math.max(0.2, r)) - 0.2) / 0.8) * (ph / 2 - 6);
            blockT.setAttribute('y', yc - ph / 2); blockT.setAttribute('height', hb);
            blockB.setAttribute('y', yc + ph / 2 - hb); blockB.setAttribute('height', hb);
            off1 -= dt * (10 + 200 * i); flow1.setAttribute('stroke-dashoffset', off1); flow1.setAttribute('opacity', (0.12 + 0.88 * Math.min(1, i * 2.2)).toFixed(2));
            flow1.setAttribute('stroke-width', (3 + 5 * Math.min(1, i * 1.6)).toFixed(1));
            meter.setAttribute('width', Math.max(0, (X(0.73) - 4) * i));
          } else if (scene === 2) {
            const c = clamp01(P.c || 0), open = 2 + (ph2 - 4) * c, hh = (ph2 - open) / 2, y = rows[2];
            valveT.setAttribute('y', y - ph2 / 2); valveT.setAttribute('height', hh); valveB.setAttribute('y', y + ph2 / 2 - hh); valveB.setAttribute('height', hh);
            const amount = [0.8, 0, c];
            f2.forEach((f, k) => { off2[k] -= dt * (10 + 150 * amount[k]); f.setAttribute('stroke-dashoffset', off2[k]); f.setAttribute('opacity', amount[k] < 0.03 ? 0 : (0.2 + 0.8 * amount[k]).toFixed(2)); });
          } else {
            const c = clamp01(P.c || 0), closed = clamp01((c - 0.4) / 0.2);
            const h = mh - 6, fh = h * c; ctl.setAttribute('y', my0 + mh - 3 - fh); ctl.setAttribute('height', fh);
            const ang = (-30 * (1 - closed)) * Math.PI / 180, L = sx1 - sx0;
            lever.setAttribute('x2', sx0 + L * Math.cos(ang)); lever.setAttribute('y2', yL + L * Math.sin(ang));
            lampGlow.setAttribute('opacity', closed.toFixed(2));
            off3 -= dt * (10 + 180 * closed); flow3.setAttribute('stroke-dashoffset', off3); flow3.setAttribute('opacity', closed < 0.05 ? 0 : (0.2 + 0.8 * closed).toFixed(2));
          }
        },
      };
    },
  });
}
