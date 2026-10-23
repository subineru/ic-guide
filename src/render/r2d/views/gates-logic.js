/* gates: the inverter (P.scene = 1) and the NAND gate (P.scene = 2), drawn as networks of voltage-controlled switches.
   Switches above the output connect it to HIGH, switches below connect it to LOW.  Truth lives in domain/sim/logic.js;
   this file only draws what that model says.  Level is shown by a digit AND colour AND line weight, never colour alone. */
import { s, mountView } from '../stage.js';
import { inverterNetwork, nandNetwork, outputOf, INVERTER_TABLE, NAND_TABLE } from '../../../domain/sim/logic.js';

const HIGH = 'var(--c-high)', LOW = 'var(--c-low)', LEVEL = v => (v ? HIGH : LOW);

export function create({ host, settings }) {
  return mountView({
    host, settings, label: '示意圖：反相器與 NAND 閘，由用電壓控制的開關組成',
    layouts: { wide: { W: 800, H: 500 }, narrow: { W: 520, H: 700, pad: 84 } },
    build({ svg, layer, still, txt, narrow: N, W, H }) {
      const gA = s('g'), gB = s('g'), sa = s('g'), sb = s('g');
      still.append(sa, sb); layer.append(gA, gB);
      const root = svg;

      /* a vertical voltage-controlled switch between (x,y) and (x,y+len); the lever lies across when closed, tilts away when open */
      const vsw = (parent, still_, x, y, len) => {
        still_.append(s('circle', { cx: x, cy: y, r: 5, fill: 'var(--card)' }), s('circle', { cx: x, cy: y + len, r: 5, fill: 'var(--card)' }));
        const lever = s('line', { x1: x, y1: y, stroke: 'var(--ink)', 'stroke-width': 4, 'stroke-linecap': 'round' }); parent.append(lever);
        return closed => { lever.setAttribute('x2', closed ? x : x + 18); lever.setAttribute('y2', closed ? y + len : y + len - 12); };
      };
      /* a round badge with a big digit: the level is read from the digit, the colour only backs it up */
      const badge = (parent, x, y, role) => {
        const c = s('circle', { cx: x, cy: y, r: 24, fill: LOW, stroke: 'var(--ink)', 'stroke-width': 2 }); parent.append(c);
        const t = txt.make(parent, x, y + 8, '0', null, { digit: true, size: 24, bold: true, role, fill: '#fff' });
        return v => { c.setAttribute('fill', LEVEL(v)); t.textContent = String(v); };
      };
      const rail = (g, x0, x1, y, high, zh, en, labelY) => {
        g.append(s('line', { x1: x0, y1: y, x2: x1, y2: y, stroke: high ? HIGH : LOW, 'stroke-width': 7, 'stroke-linecap': 'round' }));
        txt.make(g, (x0 + x1) / 2, labelY, zh, en, { bold: true });
      };
      const table = (g, frameLayer, x, y, rowsData, headers) => {
        const rh = 30, cw = N ? 70 : 64;
        const hl = s('rect', { x: x - 8, width: cw * headers.length + 16, height: rh, rx: 5, fill: 'var(--accent)', opacity: '.16', stroke: 'var(--accent)', 'stroke-width': 2 });
        g.append(hl);
        headers.forEach((t, i) => txt.make(g, x + cw * i + cw / 2, y + 20, t, null, { size: 15, bold: true, fill: 'var(--sub)' }));
        rowsData.forEach((r, k) => r.forEach((v, i) => txt.make(g, x + cw * i + cw / 2, y + rh * (k + 1) + 21, String(v), null, { size: 17 })));
        const frame = s('rect', { x: x - 8, y: y - 2, width: cw * headers.length + 16, height: rh * (rowsData.length + 1) + 8, rx: 6, fill: 'none' }); frameLayer.append(frame);
        return row => { hl.setAttribute('y', y + rh * (row + 1) + 2); };
      };

      /* ---------------- inverter ---------------- */
      const cx = N ? W * 0.52 : W * 0.5, top = N ? 70 : 70, bot = N ? 400 : 430;
      const upY = N ? 120 : 125, downY = N ? 270 : 300, nodeY = N ? 220 : 245, sl = 50;
      rail(gA, cx - 100, cx + 100, top, true, '高電壓', 'High', top - 40);
      rail(gA, cx - 100, cx + 100, bot, false, '低電壓（地）', 'Low', bot + 34);
      sa.append(s('path', { d: `M${cx} ${top} V${upY} M${cx} ${upY + sl} V${downY} M${cx} ${downY + sl} V${bot}` }));
      const setUp = vsw(gA, sa, cx, upY, sl), setDown = vsw(gA, sa, cx, downY, sl);
      /* switch labels: one line on a wide stage, two SHORT lines on a narrow one (CJK font widths differ between machines, so narrow labels stay short) */
      const swLabel = (g, x, y, one, two, anchor) => (N ? txt.make(g, x, y - 8, two[0], two[1], { anchor, size: 15, same: true }) : txt.make(g, x, y, one, null, { anchor, size: 15 }));
      /* narrow: labels go to the LEFT of the wire, the right side belongs to the output badge and its caption */
      swLabel(gA, N ? cx - 24 : cx + 24, upY + 30, '輸入 0 時接通', ['輸入 0 時', '接通'], N ? 'end' : 'start');
      swLabel(gA, N ? cx - 24 : cx + 24, downY + 30, '輸入 1 時接通', ['輸入 1 時', '接通'], N ? 'end' : 'start');
      const inX = N ? 60 : 150, outX = N ? W - 60 : 650;
      const outWire = s('path', { fill: 'none', 'stroke-linecap': 'round' }); gA.append(outWire);
      const outLine = `M${cx} ${nodeY} H${outX - 26}`;
      const inA = badge(gA, inX, nodeY, 'a'), outY = badge(gA, outX, nodeY, 'y');
      txt.make(gA, inX, nodeY - 64, '輸入', 'Input', { bold: true }); txt.make(gA, outX, nodeY - 64, '輸出', 'Output', { bold: true });   // captions sit ABOVE the badges (two lines grow downwards)
      /* no line from the input to the output node: the input only CONTROLS the two switches (the labels say how), it is not wired to the output */
      sa.append(s('circle', { cx, cy: nodeY, r: 6, fill: 'var(--ink)' }));
      const tblA = N ? table(gA, sa, W / 2 - 64, 500, INVERTER_TABLE, ['輸入', '輸出']) : table(gA, sa, 570, 345, INVERTER_TABLE, ['輸入', '輸出']);

      /* ---------------- NAND ---------------- */
      const bx = N ? W * 0.52 : W * 0.5, dx = N ? 85 : 80, btop = 60, ubY = N ? 100 : 105, nY = N ? 190 : 195;
      const d1 = N ? 245 : 250, d2 = N ? 330 : 335, bbot = N ? 420 : 425;
      rail(gB, bx - 140, bx + 140, btop, true, '高電壓', 'High', btop - 40);
      rail(gB, bx - 140, bx + 140, bbot, false, '低電壓（地）', 'Low', bbot + 34);
      sb.append(s('path', { d: `M${bx - dx} ${btop} V${ubY} M${bx + dx} ${btop} V${ubY} M${bx - dx} ${ubY + sl} V${nY} H${bx + dx} V${ubY + sl}` }));
      sb.append(s('path', { d: `M${bx} ${nY} V${d1} M${bx} ${d1 + sl} V${d2} M${bx} ${d2 + sl} V${bbot}` }));
      sb.append(s('circle', { cx: bx, cy: nY, r: 6, fill: 'var(--ink)' }));
      const upA = vsw(gB, sb, bx - dx, ubY, sl), upB = vsw(gB, sb, bx + dx, ubY, sl), dnA = vsw(gB, sb, bx, d1, sl), dnB = vsw(gB, sb, bx, d2, sl);
      swLabel(gB, bx - dx - 22, ubY + 32, 'A＝0 時接通', ['A＝0 時', '接通'], 'end');
      swLabel(gB, bx + dx + 22, ubY + 32, 'B＝0 時接通', ['B＝0 時', '接通'], 'start');
      swLabel(gB, N ? bx - 24 : bx + 24, d1 + 32, 'A＝1 時接通', ['A＝1 時', '接通'], N ? 'end' : 'start');     // narrow: left of the wire, the right side holds the output
      swLabel(gB, N ? bx - 24 : bx + 24, d2 + 32, 'B＝1 時接通', ['B＝1 時', '接通'], N ? 'end' : 'start');
      const aX = N ? 56 : 140, outX2 = N ? W - 56 : 650, aY = N ? 260 : 150, bY = N ? 380 : 330;
      const outWire2 = s('path', { fill: 'none', 'stroke-linecap': 'round' }); gB.append(outWire2);
      const outLine2 = `M${bx} ${nY} H${outX2 - 26}`;
      const inA2 = badge(gB, aX, aY, 'a2'), inB2 = badge(gB, aX, bY, 'b2'), outY2 = badge(gB, outX2, nY, 'y2');
      txt.make(gB, aX, aY - 64, '輸入 A', 'Input A', { bold: true }); txt.make(gB, aX, bY - 64, '輸入 B', 'Input B', { bold: true });
      txt.make(gB, outX2, nY + 58, '輸出', 'Output', { bold: true });
      const tblB = N ? table(gB, sb, W / 2 - 96, 500, NAND_TABLE, ['A', 'B', '輸出']) : table(gB, sb, 560, 305, NAND_TABLE, ['A', 'B', '輸出']);

      return {
        update(P) {
          const scene = P.scene || 1;
          gA.style.display = sa.style.display = scene === 1 ? '' : 'none';
          gB.style.display = sb.style.display = scene === 2 ? '' : 'none';
          if (scene === 1) {
            const a = P.a ? 1 : 0, net = inverterNetwork(a), y = outputOf(net);
            setUp(net.switches.up); setDown(net.switches.down);
            inA(a); outY(y);
            outWire.setAttribute('d', outLine); outWire.setAttribute('stroke', LEVEL(y)); outWire.setAttribute('stroke-width', y ? 6 : 3);
            tblA(a);
            root.dataset.pullup = net.pullUp ? '1' : '0'; root.dataset.pulldown = net.pullDown ? '1' : '0'; root.dataset.scene = '1'; root.dataset.y = String(y);
          } else {
            const a = P.a ? 1 : 0, b = P.b ? 1 : 0, net = nandNetwork(a, b), y = outputOf(net), sw = net.switches;
            upA(sw.upA); upB(sw.upB); dnA(sw.downA); dnB(sw.downB);
            inA2(a); inB2(b); outY2(y);
            outWire2.setAttribute('d', outLine2); outWire2.setAttribute('stroke', LEVEL(y)); outWire2.setAttribute('stroke-width', y ? 6 : 3);
            tblB(a * 2 + b);
            root.dataset.pullup = net.pullUp ? '1' : '0'; root.dataset.pulldown = net.pullDown ? '1' : '0'; root.dataset.scene = '2'; root.dataset.y = String(y);
          }
        },
      };
    },
  });
}
