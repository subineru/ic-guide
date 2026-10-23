/* The curriculum graph: the single source of truth for chapters, prerequisites and recommended order.
   Order = topological sort of `needs`, ties broken by ORDER.  To add a basics chapter: add a node and
   make existing chapters `needs` it.  To reorder: edit ORDER.  No other code changes. */

export const STAGES = {
  prereq: { zh: '先備', en: 'Prerequisites' },
  chip: { zh: '晶片本身', en: 'The chip' },
  device: { zh: '元件', en: 'Device' },
  logic: { zh: '邏輯', en: 'Logic' },
  system: { zh: '系統', en: 'System' },
  making: { zh: '製造', en: 'Making' },
};

/* Main line = the way data travels from the phone to one lit pixel.
   signal: what travels FROM this part to the next one (used by the home animation; the shapes are schematic, not real waveforms):
     low = digital bits at low voltage | high = digital bits at higher voltage (after the level shifter)
     analog = one analog voltage (after the DAC) | strong = the same voltage, now strong enough to drive the panel (after the buffer)
   zone: 'source' (outside the IC, upstream) | 'ic' (inside the display driver IC; only these are numbered 1-6) | 'panel' (outside, downstream). */
export const SPINE = [
  { id: 'link', zone: 'source', signal: 'low', zh: '介面傳輸', en: 'Interface link' },
  { id: 'receive', zone: 'ic', signal: 'low', zh: '介面接收', en: 'Receiver' },
  { id: 'shift', zone: 'ic', signal: 'low', zh: '移位暫存器', en: 'Shift register' },
  { id: 'latch', zone: 'ic', signal: 'low', zh: '鎖存', en: 'Latch' },
  { id: 'level', zone: 'ic', signal: 'high', zh: '電壓位準轉換', en: 'Level shifter', short: { zh: '位準轉換', en: 'Level shifter' } },
  { id: 'dac', zone: 'ic', signal: 'analog', zh: '數位轉類比', en: 'DAC' },
  { id: 'buffer', zone: 'ic', signal: 'strong', zh: '緩衝器', en: 'Buffer' },
  { id: 'panel', zone: 'panel', zh: '面板', en: 'Panel' },
];
/* label for tight places (main-line strip, map boxes): the short form when a part has one */
export const shortLabel = p => p.short || { zh: p.zh, en: p.en };
export const IC_PARTS = SPINE.filter(p => p.zone === 'ic').map(p => p.id);
export const ALL_PARTS = SPINE.map(p => p.id);
/* 1-6 for parts inside the IC, null for the two ends */
export const partNumber = id => { const i = IC_PARTS.indexOf(id); return i < 0 ? null : i + 1; };

/* view: '2d' | '3d'.
   spine:      which main-line parts the chapter is about (highlights the main line while reading it).
   foundation: true = shared material under EVERY part inside the IC (drawn as a base layer, never as a child of one part).
   hang:       main-line parts a chapter hangs directly under on the home map (it explains how those parts work).
   span:       true = the chapter walks the WHOLE main line (drawn from a rail under the whole line).
   A chapter is exactly one of: foundation, hang, span, or "the chip itself" (stage chip / making).  curriculum tests enforce this. */
export const NODES = [
  { id: 'basics', stage: 'prereq', view: '2d', needs: [], foundation: true, spine: IC_PARTS, title: { zh: '電與半導體', en: 'Electricity & semiconductors' } },
  { id: 'die', stage: 'chip', view: '3d', needs: ['basics'], spine: [], title: { zh: '晶粒的層疊', en: 'Die layers' } },
  { id: 'mosfet', stage: 'device', view: '2d', needs: ['basics'], foundation: true, spine: IC_PARTS, title: { zh: '電晶體', en: 'Transistor' } },
  { id: 'digital', stage: 'prereq', view: '2d', needs: ['mosfet'], foundation: true, spine: ['link', 'receive', 'shift', 'latch', 'dac'], title: { zh: '數位與二進位', en: 'Digital & binary' } },
  { id: 'gates', stage: 'logic', view: '2d', needs: ['mosfet', 'digital'], hang: ['shift', 'latch'], spine: ['shift', 'latch'], title: { zh: '邏輯閘到移位暫存器', en: 'Gates → shift register' } },
  { id: 'scan', stage: 'system', view: '2d', needs: [], hang: ['panel'], spine: ['panel'], title: { zh: '面板如何掃描', en: 'Scanning a panel' } },
  { id: 'datapath', stage: 'system', view: '2d', needs: ['gates', 'scan', 'digital'], span: true, spine: ALL_PARTS, title: { zh: '從資料到像素', en: 'Data to pixel' } },
  { id: 'fab', stage: 'making', view: '2d', needs: ['die', 'mosfet'], spine: [], title: { zh: '製程與設計分工', en: 'Fabrication' } },
  { id: 'package', stage: 'chip', view: '3d', needs: ['die', 'fab'], spine: [], title: { zh: '封裝與腳位', en: 'Package & pins' } },
];

/* Where a chapter sits on the home map. */
export const placementOf = n => (n.foundation ? 'foundation' : n.span ? 'span' : n.hang && n.hang.length ? 'hang' : 'chip');

/* Prerequisite edges worth drawing: drop A->B when B already depends on A through another chapter
   (transitive reduction), so the map shows the direct "needs" only. */
export function directNeeds(nodes = NODES) {
  const needs = new Map(nodes.map(n => [n.id, n.needs]));
  const dependsOn = (list, target) => list.some(d => d === target || dependsOn(needs.get(d) || [], target));
  const edges = [];
  nodes.forEach(n => n.needs.forEach(d => {
    const viaOther = n.needs.some(o => o !== d && dependsOn(needs.get(o) || [], d));
    if (!viaOther) edges.push([d, n.id]);
  }));
  return edges;
}

/* Preferred reading order (engineer's bottom-up order, with `digital` after `mosfet`). */
export const ORDER = ['basics', 'die', 'mosfet', 'digital', 'gates', 'scan', 'datapath', 'fab', 'package'];

/* Stable topological order.  Throws on unknown ids, duplicate ids or cycles so mistakes surface in tests. */
export function buildPath(nodes = NODES, order = ORDER) {
  const byId = new Map();
  nodes.forEach(n => { if (byId.has(n.id)) throw new Error('duplicate chapter id: ' + n.id); byId.set(n.id, n); });
  nodes.forEach(n => n.needs.forEach(d => { if (!byId.has(d)) throw new Error(`chapter "${n.id}" needs unknown "${d}"`); }));
  order.forEach(id => { if (!byId.has(id)) throw new Error('ORDER lists unknown chapter: ' + id); });
  const rank = id => { const i = order.indexOf(id); return i < 0 ? Infinity : i; };
  const placed = [], left = new Set(byId.keys());
  while (left.size) {
    const ready = [...left].filter(id => byId.get(id).needs.every(d => placed.includes(d)));
    if (!ready.length) throw new Error('prerequisite cycle among: ' + [...left].join(', '));
    ready.sort((a, b) => rank(a) - rank(b));
    placed.push(ready[0]); left.delete(ready[0]);
  }
  return placed;
}

export const PATH = buildPath();
export const node = id => NODES.find(n => n.id === id);
export const indexInPath = id => PATH.indexOf(id);
/* chapters that must come first according to `needs` (transitive), in path order */
export function prerequisites(id, nodes = NODES) {
  const byId = new Map(nodes.map(n => [n.id, n])), seen = new Set();
  const walk = x => byId.get(x).needs.forEach(d => { if (!seen.has(d)) { seen.add(d); walk(d); } });
  walk(id);
  return PATH.filter(p => seen.has(p));
}
