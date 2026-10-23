/* End-to-end checks in real Chromium against dist/ served under a sub-path (like GitHub Pages).
   Layout rules from docs/ic-spec.md §10.6: no horizontal scroll, no overlap, hit targets, no text overflow, keyboard,
   plus behaviour: steps, pause, speed, panels, idle redraw rate. Screenshots go to shots/. */
import { createRequire } from 'node:module';
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(execSync('npm root -g').toString().trim() + '/playwright')); }

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const serveRoot = path.join(root, '.serve'), shots = path.join(root, 'shots');
fs.rmSync(serveRoot, { recursive: true, force: true }); fs.rmSync(shots, { recursive: true, force: true });
fs.mkdirSync(shots, { recursive: true });
fs.cpSync(path.join(root, 'dist'), path.join(serveRoot, 'ic-guide'), { recursive: true });   // https://user.github.io/ic-guide/
const port = 8124, base = `http://localhost:${port}/ic-guide/`;
const srv = spawn('npx', ['--no-install', 'http-server', serveRoot, '-p', String(port), '-s', '-c-1'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500));

const SIZES = [
  { n: '1280x800', w: 1280, h: 800 }, { n: '1920x1080', w: 1920, h: 1080 }, { n: '1024x768', w: 1024, h: 768 },
  { n: '768x1024', w: 768, h: 1024, touch: true }, { n: '414x800', w: 414, h: 800, touch: true }, { n: '360x740', w: 360, h: 740, touch: true },
];
const browser = await chromium.launch();
let failures = 0;
const fail = (where, msg) => { failures++; console.log(`  ✗ [${where}] ${msg}`); };

/* Screenshots get their own context: a full-page capture resets Chromium's touch emulation, which would flip
   (pointer: coarse) to fine and make later hit-target checks on the same page meaningless. */
async function shot(size, hash, file, prep) {
  const { ctx, page } = await open(size, hash);
  if (hash.startsWith('#/c/')) await page.waitForSelector('#layout');
  if (prep) await prep(page);
  await page.screenshot({ path: path.join(shots, file), fullPage: !!size.touch });
  await ctx.close();
}
const click = (page, size, sel) => (size.touch ? page.tap(sel) : page.click(sel));

async function open(size, hash = '', extra = '') {
  const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, hasTouch: !!size.touch, isMobile: !!size.touch, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  page.on('pageerror', e => problems.push('pageerror: ' + e));
  page.on('response', r => { if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.goto(base + '?test=1' + extra + hash);
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1');
  return { ctx, page, problems };
}

/* generic page-level checks, run inside the page */
const pageChecks = (hitMin) => {
  const out = [];
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`橫向捲動：scrollWidth ${document.documentElement.scrollWidth} > ${innerWidth}`);
  // hit targets
  document.querySelectorAll('button, a[href], summary, select, input[type=range], label:has(input[type=checkbox])').forEach(e => {
    if (!vis(e) || e.disabled) return;
    const r = e.getBoundingClientRect();
    if (r.height < hitMin - 0.5) out.push(`點擊目標太矮 ${Math.round(r.height)}px < ${hitMin}px：${e.id || e.className || e.tagName} "${(e.textContent || '').trim().slice(0, 16)}"`);
    if (e.tagName !== 'INPUT' && r.width < hitMin - 0.5) out.push(`點擊目標太窄 ${Math.round(r.width)}px < ${hitMin}px：${e.id || e.className || e.tagName}`);
  });
  // when the learning map is open it covers the page: judge only what is inside it (the home behind it is hidden by the backdrop)
  const scope = document.querySelector('#drawer:not([hidden])') || document;
  // text overflow
  scope.querySelectorAll('#cardSay, #cardTitle, .step .sl, .node .nt, .spine-node, .home-intro p').forEach(e => {
    if (vis(e) && e.scrollWidth > e.clientWidth + 1) out.push(`文字溢出：${e.className || e.id} "${e.textContent.trim().slice(0, 16)}"`);
  });
  // map boxes: text must fit inside vertically too, and group titles must not sit under a box
  scope.querySelectorAll('.node, .spine-node').forEach(e => {
    if (vis(e) && e.scrollHeight > e.clientHeight + 1) out.push(`方框內文字垂直溢出：${e.textContent.trim().slice(0, 14)}（${e.scrollHeight}>${e.clientHeight}）`);
    const ee = e.querySelector('.en');
    if (vis(e) && ee && parseFloat(getComputedStyle(ee).fontSize) < 11.5) out.push(`方框內英文太小 ${getComputedStyle(ee).fontSize}：${e.textContent.trim().slice(0, 14)}`);
  });
  scope.querySelectorAll('.map .spine-node').forEach(node => {
    const badge = node.querySelector('.n'), text = node.querySelector('.nt');
    if (!badge || !text || !vis(node)) return;
    const b = badge.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(text);
    [...range.getClientRects()].forEach(r => {
      if (Math.min(b.right, r.right) - Math.max(b.left, r.left) > 0.5 && Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top) > 0.5) out.push(`標籤壓到文字：${badge.textContent.trim()} 與 "${text.textContent.trim().slice(0, 10)}"`);
    });
  });
  scope.querySelectorAll('.group-t').forEach(t => {
    if (!vis(t)) return; const a = t.getBoundingClientRect();
    scope.querySelectorAll('.node, .spine-node').forEach(n => {
      if (!vis(n)) return; const b = n.getBoundingClientRect();
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) out.push(`群組標題被方框壓到："${t.textContent.trim().slice(0, 10)}" 與 "${n.textContent.trim().slice(0, 10)}"`);
    });
  });
  // text inside the drawing: readable (>= 11 CSS px tall) and inside the stage
  const stage = document.getElementById('stage');
  if (stage) {
    const sr = stage.getBoundingClientRect();
    document.querySelectorAll('#view svg text').forEach(t => {
      const r = t.getBoundingClientRect(), label = t.textContent.trim().slice(0, 12);
      if (r.width === 0) return;
      if (r.left < sr.left - 2 || r.right > sr.right + 2 || r.top < sr.top - 2 || r.bottom > sr.bottom + 2) out.push(`圖內文字超出舞台："${label}"`);
      t.querySelectorAll('tspan').forEach(ts => { const h = ts.getBoundingClientRect().height; if (h > 0 && h < 11) out.push(`圖內文字太小 ${h.toFixed(1)}px < 11px："${ts.textContent.trim().slice(0, 12)}"`); });
    });
  }
  // overlap between named regions
  const ids = ['#top', '#spine', '#stage', '#card', '#steps', '#take', '#controls'];
  const rects = ids.map(s => [s, document.querySelector(s)]).filter(([, e]) => e && vis(e)).map(([s, e]) => [s, e.getBoundingClientRect()]);
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i][1], b = rects[j][1];
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ox > 1 && oy > 1) out.push(`區塊重疊：${rects[i][0]} 與 ${rects[j][0]}（${Math.round(ox)}×${Math.round(oy)}px）`);
  }
  // overlap between home-map nodes
  const nodes = [...scope.querySelectorAll('.map .node, .map .spine-node')].filter(vis).map(e => [e.textContent.trim().slice(0, 10), e.getBoundingClientRect()]);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i][1], b = nodes[j][1];
    if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) out.push(`心智圖節點重疊："${nodes[i][0]}" 與 "${nodes[j][0]}"`);
  }
  return out;
};

for (const size of SIZES) {
  const hitMin = size.touch ? 44 : 32;
  console.log(`\n== ${size.n}${size.touch ? '（觸控）' : ''}`);

  // ---- home
  let { ctx, page, problems } = await open(size);
  (await page.evaluate(pageChecks, hitMin)).forEach(m => fail('首頁 ' + size.n, m));
  // learning map panel: both views, same layout rules
  for (const tab of ['map', 'list']) {
    await click(page, size, '#bLearn'); await page.waitForSelector('#drawer:not([hidden])');
    await click(page, size, `#drawer .tab[data-tab="${tab}"]`); await page.waitForSelector(tab === 'map' ? '#drawer .map-holder' : '#drawer .plist');
    (await page.evaluate(pageChecks, hitMin)).forEach(m => fail(`學習地圖(${tab}) ` + size.n, m));
    const fits = await page.evaluate(() => { const d = document.getElementById('drawer').getBoundingClientRect(); return { l: d.left, r: d.right, w: innerWidth }; });
    if (fits.l < -1 || fits.r > fits.w + 1) fail(`學習地圖(${tab}) ` + size.n, '面板超出視窗寬度');
    await page.keyboard.press('Escape');
    if (!(await page.isHidden('#drawer'))) fail(`學習地圖(${tab}) ` + size.n, 'Esc 沒有關閉面板');
  }
  problems.forEach(m => fail('首頁 ' + size.n, m)); await ctx.close();
  await shot(size, '', `home-${size.n}.png`);
  for (const tab of ['map', 'list']) await shot(size, '', `panel-${tab}-${size.n}.png`, async pg => { await click(pg, size, '#bLearn'); await click(pg, size, `#drawer .tab[data-tab="${tab}"]`); await pg.waitForTimeout(250); });

  // ---- chapter
  ({ ctx, page, problems } = await open(size, '#/c/basics'));
  await page.waitForSelector('#layout');
  (await page.evaluate(pageChecks, hitMin)).forEach(m => fail('章節 ' + size.n, m));
  const st = await page.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); return { h: r.height, w: r.width, vh: innerHeight }; });
  if (!size.touch && size.w >= 1024 && st.h < 520) fail('章節 ' + size.n, `舞台高度 ${Math.round(st.h)} < 520`);
  if (size.w < 1024 && st.h < st.vh * 0.5 - 1) fail('章節 ' + size.n, `舞台高度 ${Math.round(st.h)} < 視窗高度的 50%（${Math.round(st.vh * 0.5)}）`);
  // select a step, screenshot it with the card filled
  await click(page, size, '.step >> nth=1'); await page.waitForTimeout(400);
  (await page.evaluate(pageChecks, hitMin)).forEach(m => fail('章節(第 2 步) ' + size.n, m));
  problems.forEach(m => fail('章節 ' + size.n, m)); await ctx.close();
  await shot(size, '#/c/basics', `chapter-${size.n}.png`);
  await shot(size, '#/c/basics', `chapter-step-${size.n}.png`, async pg => { await click(pg, size, '.step >> nth=1'); await pg.waitForTimeout(500); });
}

/* ---------------- home map: the picture must say the right thing ---------------- */
console.log('\n== 心智圖的位置關係（1280x800、1920x1080、1024x768）');
const IC_IDS = ['receive', 'shift', 'latch', 'level', 'dac', 'buffer'];
for (const size of SIZES.filter(x => x.w >= 1024)) {
  const { ctx, page, problems } = await open(size);
  await page.click('#bLearn'); await page.waitForSelector('#drawer .map');
  await page.click('#drawer .tab[data-tab="map"]');
  const r = await page.evaluate(ids => {
    const rect = e => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, cx: (b.left + b.right) / 2 }; };
    const part = id => rect(document.querySelector(`#drawer .spine-node[data-part="${id}"]`));
    const chip = id => rect(document.querySelector(`#drawer .node[data-id="${id}"]`));
    return {
      zone: rect(document.querySelector('#drawer .zone-ic')), band: rect(document.querySelector('#drawer .group.foundation')),
      link: part('link'), panel: part('panel'), ic: ids.map(part),
      numbers: [...document.querySelectorAll('#drawer .map .spine-node .n:not(.out)')].map(n => n.textContent.trim()),
      outsideBadges: [...document.querySelectorAll('#drawer .map .spine-node .n.out')].map(n => n.textContent.trim()),
      chip: Object.fromEntries(['basics', 'mosfet', 'digital', 'gates', 'datapath', 'scan', 'die', 'fab', 'package'].map(id => [id, chip(id)])),
      rail: !!document.querySelector('#drawer .map .rail'),
      edges: [...document.querySelectorAll('#drawer .map .needs')].map(p => p.dataset.edge).sort(),
    };
  }, IC_IDS);
  const w = `心智圖 ${size.n}`, T = 3;
  // the IC bracket wraps exactly the six IC parts; the two ends are outside it and say so
  if (r.zone.l > r.ic[0].l - 2 || r.zone.r < r.ic[5].r + 2) fail(w, '驅動 IC 方框沒有包住 1～6');
  if (r.link.r > r.zone.l + T || r.panel.l < r.zone.r - T) fail(w, '介面傳輸或面板被畫進了驅動 IC 方框內');
  if (JSON.stringify(r.numbers) !== JSON.stringify(['1', '2', '3', '4', '5', '6'])) fail(w, `編號應只有 1～6，實際：${r.numbers}`);
  if (JSON.stringify(r.outsideBadges) !== JSON.stringify(['IC 外', 'IC 外'])) fail(w, `兩端都應標示「IC 外」，實際：${r.outsideBadges}`);
  // the foundation band is exactly as wide as the IC bracket and sits below the whole main line
  if (Math.abs(r.band.l - r.zone.l) > T || Math.abs(r.band.r - r.zone.r) > T) fail(w, '共同基礎層與驅動 IC 方框的寬度不一致');
  if (r.band.t < Math.max(r.link.b, r.panel.b, ...r.ic.map(p => p.b))) fail(w, '共同基礎層不在主線下方');
  ['basics', 'mosfet', 'digital'].forEach(id => { const c = r.chip[id]; if (c.l < r.band.l - T || c.r > r.band.r + T || c.t < r.band.t - T || c.b > r.band.b + T) fail(w, `${id} 不在共同基礎層內`); });
  // chapters that explain parts hang under them, outside the band
  ['gates', 'datapath', 'scan'].forEach(id => { if (r.chip[id].b > r.band.t) fail(w, `${id} 不應該壓到共同基礎層`); });
  const inside = (c, p) => p.cx >= c.l - 1 && p.cx <= c.r + 1;
  if (!inside(r.chip.gates, r.ic[1]) || !inside(r.chip.gates, r.ic[2])) fail(w, '邏輯閘章不在移位暫存器與鎖存的正下方');
  if (!inside(r.chip.scan, r.panel)) fail(w, '面板掃描章不在面板的正下方');
  if (!r.rail) fail(w, '缺少「整條主線」的軌道');
  if (r.chip.datapath.t < Math.max(...r.ic.map(p => p.b), r.link.b, r.panel.b)) fail(w, '資料到像素章應該在主線下方');
  if (r.chip.datapath.cx < r.link.r || r.chip.datapath.cx > r.panel.l) fail(w, '資料到像素章應該位於整條主線中段');
  // only direct prerequisites are drawn
  const want = ['basics>die', 'basics>mosfet', 'die>fab', 'digital>gates', 'fab>package', 'gates>datapath', 'mosfet>digital', 'mosfet>fab', 'scan>datapath'].sort();
  if (JSON.stringify(r.edges) !== JSON.stringify(want)) fail(w, `先修連線不符：${r.edges.join(' ')}`);
  problems.forEach(m => fail(w, m)); await ctx.close();
}
// chapter pages highlight the right main-line parts
{
  const size = SIZES[0];
  for (const [id, expect] of [['basics', 6], ['gates', 2]]) {
    const { ctx, page, problems } = await open(size, '#/c/' + id);
    await page.waitForSelector('#layout');
    const n = await page.$$eval('.spine-list li.on', l => l.length);
    if (n !== expect) fail(`主線高亮 ${id}`, `應高亮 ${expect} 個零件，實際 ${n}`);
    const nums = await page.$$eval('.spine-list li .n', l => l.map(x => x.textContent.trim()));
    if (JSON.stringify(nums) !== JSON.stringify(['IC 外', '1', '2', '3', '4', '5', '6', 'IC 外'])) fail(`主線列 ${id}`, `編號/標示不符：${nums}`);
    problems.forEach(m => fail('主線高亮', m)); await ctx.close();
  }
}

/* ---------------- home animation ---------------- */
console.log('\n== 首頁動畫');
/* Sample the animation at fixed times (paused, currentTime set) and read what is on screen. */
const sampleAt = (page, ms) => page.evaluate(t => {
  const anims = document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.home'));
  anims.forEach(a => { a.pause(); a.currentTime = t; });
  const rect = e => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
  const op = e => parseFloat(getComputedStyle(e).opacity);
  const visible = [...document.querySelectorAll('.home .pkt')].filter(e => !e.closest('.legend') && op(e) > 0.5).map(e => ({ kind: e.dataset.kind, rect: rect(e) }));
  const glow = Object.fromEntries([...document.querySelectorAll('.spine-node')].map(n => [n.dataset.part, op(n.querySelector('.glow'))]));
  const boxes = [...document.querySelectorAll('.home .node, .home .spine-node')].map(rect);
  const host = document.querySelector('.map') || document.querySelector('.flowlist');
  return { n: anims.length, visible, glow, boxes, host: rect(host), pixel: op(document.querySelector('.px-lit')) };
}, ms);
const hits = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5;
{
  const desktop = SIZES[0];
  const { ctx, page, problems } = await open(desktop);
  await page.waitForFunction(() => document.getAnimations().length >= 13);
  const w = '首頁動畫 1280x800';
  const base = await sampleAt(page, 100);
  if (base.n !== 13) fail(w, `動畫數量應為 13（4 個封包、8 個發光、1 個像素），實際 ${base.n}`);
  // what travels, and when (times follow the distance along the main line)
  for (const [t, kind] of [[1000, 'low'], [4000, 'low'], [5600, 'high'], [6900, 'analog'], [8200, 'strong']]) {
    const r = await sampleAt(page, t);
    const k = r.visible.map(v => v.kind);
    if (k.length !== 1 || k[0] !== kind) fail(w, `t=${t}ms 應只看到「${kind}」封包，實際：${k.join(',') || '無'}`);
    r.visible.forEach(v => { if (v.rect.l < r.host.l || v.rect.r > r.host.r) fail(w, `t=${t}ms 封包跑到地圖外`); r.boxes.forEach(b => { if (hits(v.rect, b)) fail(w, `t=${t}ms ${kind} 封包壓到方框`); }); });
  }
  // the box lights up when the packet reaches it
  let r = await sampleAt(page, 2509); if (r.glow.shift < 0.5 || r.glow.dac > 0.1) fail(w, `t=2509ms 應是移位暫存器亮起：${JSON.stringify(r.glow)}`);
  r = await sampleAt(page, 5030); if (r.glow.level < 0.5) fail(w, '封包到達位準轉換時它沒有亮起');
  r = await sampleAt(page, 6291); if (r.glow.dac < 0.5 || r.glow.shift > 0.1) fail(w, 't=6291ms 應是 DAC 亮起');
  // the pixel lights only after the packet has arrived, then goes dark again before the loop restarts
  r = await sampleAt(page, 8000); if (r.pixel > 0.1) fail(w, '封包還沒到面板，像素就亮了');
  r = await sampleAt(page, 9500); if (r.pixel < 0.9 || r.visible.length) fail(w, `t=9500ms 應只有像素亮起：像素 ${r.pixel}，封包 ${r.visible.length}`);
  r = await sampleAt(page, 11800); if (r.pixel > 0.1) fail(w, '下一輪開始前像素應該已熄滅');
  // play / pause button
  await page.click('#bAnim');
  if ((await page.getAttribute('#bAnim', 'aria-pressed')) !== 'false' || !/播放/.test(await page.textContent('#bAnim'))) fail(w, '按下暫停後按鈕狀態不對');
  const states = await page.evaluate(() => document.getAnimations().filter(a => a.effect.target.closest('.home')).map(a => a.playState));
  if (states.some(x => x === 'running')) fail(w, '暫停後仍有動畫在執行');
  await page.click('#bAnim');
  await page.waitForTimeout(150);
  if (!(await page.evaluate(() => document.getAnimations().some(a => a.playState === 'running' && a.effect.target.closest('.home'))))) fail(w, '再按一次沒有繼續播放');
  // progress updates only recolour boxes: the map (and so the animation) must not be rebuilt
  await page.evaluate(() => { document.querySelector('.map').__keep = 1; icDebug.progress.markStep('basics', 'water-analogy'); });
  await page.waitForTimeout(100);
  if (!(await page.evaluate(() => document.querySelector('.map').__keep === 1))) fail(w, '進度更新重建了整張地圖（動畫會被重置）');
  // reduce motion: no moving parts, the pixel is simply shown lit, the button says why it is off
  await page.click('#bSet'); await page.check('#settings label:has-text("降低動態") input'); await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  const rm = await page.evaluate(() => ({ anims: document.getAnimations().filter(a => a.effect.target.closest && a.effect.target.closest('.home')).length, lit: parseFloat(getComputedStyle(document.querySelector('.px-lit')).opacity), pk: [...document.querySelectorAll('.pkt')].some(e => !e.closest('.legend') && getComputedStyle(e).display !== 'none'), dis: document.getElementById('bAnim').disabled }));
  if (rm.anims !== 0 || rm.pk) fail(w, `降低動態時不應有動畫或封包：${JSON.stringify(rm)}`);
  if (rm.lit < 0.9) fail(w, '降低動態時應直接顯示亮起的像素'); if (!rm.dis) fail(w, '降低動態時動畫按鈕應停用');
  await page.click('#bSet'); await page.uncheck('#settings label:has-text("降低動態") input'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  if ((await page.evaluate(() => document.getAnimations().filter(a => a.effect.target.closest && a.effect.target.closest('.home')).length)) < 13) fail(w, '關閉降低動態後動畫沒有恢復');
  problems.forEach(m => fail(w, m)); await ctx.close();

  // narrow screens: the packet runs down the purple line of the list
  const m = SIZES.find(x => x.n === '414x800');
  const mob = await open(m);
  await mob.page.waitForFunction(() => document.getAnimations().length >= 13);
  const wm = '首頁動畫 414x800';
  const info = await mob.page.evaluate(() => { const b = [...document.querySelectorAll('.flowlist .spine-node')].map(e => e.getBoundingClientRect()); return { first: (b[0].top + b[0].bottom) / 2, last: (b.at(-1).top + b.at(-1).bottom) / 2 }; });
  for (const [t, kind] of [[1000, 'low'], [5600, 'high'], [6900, 'analog'], [8200, 'strong']]) {
    const r = await sampleAt(mob.page, t);
    const k = r.visible.map(v => v.kind);
    if (k.length !== 1 || k[0] !== kind) fail(wm, `t=${t}ms 應只看到「${kind}」封包，實際：${k.join(',') || '無'}`);
    r.visible.forEach(v => {
      const cy = (v.rect.t + v.rect.b) / 2; if (cy < info.first - 14 || cy > info.last + 14) fail(wm, `t=${t}ms 封包跑出清單範圍`);
      r.boxes.forEach(b => { if (hits(v.rect, b)) fail(wm, `t=${t}ms ${kind} 封包壓到方框`); });
    });
  }
  const r2 = await sampleAt(mob.page, 9500); if (r2.pixel < 0.9) fail(wm, '手機版結尾面板像素沒有亮起');
  mob.problems.forEach(x => fail(wm, x)); await mob.ctx.close();
}

/* ---------------- chapter content: 先猜, logic gates, text inside the drawings ---------------- */
console.log('\n== 章節內容');
{
  const size = SIZES[0], w = '先猜';
  const rewards = page => page.evaluate(() => icDebug.progress.rewards());
  // wrong first, then right: trying is rewarded either way and nothing is ever taken away
  let { ctx, page, problems } = await open(size, '#/c/basics');
  await page.waitForSelector('#predict:not([hidden])');
  if (!/先猜一猜/.test(await page.textContent('#predict'))) fail(w, '章節開頭沒有先猜');
  const opts = () => page.$$('#predict .popt');
  if ((await opts()).length !== 3) fail(w, '第 1 題應有 3 個選項');
  await (await opts())[1].click();                                                                  // a wrong answer
  if (!/沒關係/.test(await page.textContent('#predict .pfb')) || !(await page.$('#predict .pfb.try'))) fail(w, '答錯時應溫和提示，不是懲罰');
  let r = await rewards(page); if (r.drops !== 1 || r.gold !== 0) fail(w, `答錯一題應得 1 墨滴、0 金墨，實際 ${JSON.stringify(r)}`);
  await page.click('#pNext'); await (await opts())[0].click();                                      // right
  if (!(await page.$('#predict .pfb.ok'))) fail(w, '答對時沒有顯示答對');
  r = await rewards(page); if (r.drops !== 2 || r.gold !== 1) fail(w, `答對一題後應為 2 墨滴、1 金墨，實際 ${JSON.stringify(r)}`);
  await page.click('#pNext'); await (await opts())[0].click(); await page.click('#pNext');
  const summary = await page.textContent('#predict');
  if (!/答對了 2\/3/.test(summary)) fail(w, `應顯示答對 2/3，實際：${summary}`);
  if (await page.$('#pSkip')) fail(w, '沒有全對時不應出現「跳過」');
  await page.reload(); await page.waitForSelector('#predict:not([hidden])');                       // answers are remembered
  if (!/答對了 2\/3/.test(await page.textContent('#predict'))) fail(w, '重新整理後應記得先前的答案');
  await page.click('.step >> nth=0'); if (!(await page.isHidden('#predict'))) fail(w, '開始步驟後先猜應收起');
  problems.forEach(m => fail(w, m)); await ctx.close();
  // all right: may skip ahead, and the skip itself changes nothing about progress
  ({ ctx, page, problems } = await open(size, '#/c/basics'));
  await page.waitForSelector('#predict:not([hidden])');
  for (let i = 0; i < 3; i++) { await (await page.$$('#predict .popt'))[0].click(); await page.click('#pNext'); }
  if (!(await page.$('#pSkip'))) fail(w, '全對時應出現「我已經懂了」');
  r = await rewards(page); if (r.drops !== 3 || r.gold !== 3) fail(w, `全對應為 3 墨滴、3 金墨，實際 ${JSON.stringify(r)}`);
  await page.click('#pSkip');
  await page.waitForFunction(() => /邏輯閘/.test(document.getElementById('cardTitle')?.textContent || ''));          // wait for the NEW chapter, not the old page
  if (!/#\/c\/gates$/.test(page.url())) fail(w, '跳過後應前往下一個開放的章節（邏輯閘）');
  if (!(await page.isHidden('#predict'))) fail(w, '沒有先猜題的章節不應顯示先猜');
  const done = await page.evaluate(() => icDebug.progress.counts('basics').coreDone); if (done !== 0) fail(w, '跳過不應把步驟標成已完成');
  problems.forEach(m => fail(w, m)); await ctx.close();
}
{
  const size = SIZES[0], w = '邏輯閘';
  const { ctx, page, problems } = await open(size, '#/c/gates');
  await page.waitForSelector('#layout'); await page.keyboard.press('Space');                       // freeze the step so manual toggles stick
  const set = async (name, on) => { const box = page.locator(`label.toggle:has-text("${name}") input`); if ((await box.isChecked()) !== !!on) await box.click(); };
  const read = async () => { await page.waitForTimeout(350); return page.evaluate(() => { const v = document.querySelector('#view svg'); const t = r => (document.querySelector(`#view svg text[data-role="${r}"]`) || {}).textContent; return { y: v.dataset.y, up: v.dataset.pullup, down: v.dataset.pulldown, scene: v.dataset.scene, a: t('a'), b: t('b2'), a2: t('a2'), y1: t('y'), y2: t('y2') }; }); };
  await page.click('.step >> nth=0');
  if (!(await page.isHidden('label.toggle:has-text("輸入 B")'))) fail(w, '反相器只有一個輸入，不應顯示輸入 B');
  for (const a of [0, 1]) {
    await set('輸入 A', a); const r = await read(); const want = a ? 0 : 1;
    if (r.scene !== '1' || r.y !== String(want) || r.y1 !== String(want) || r.a !== String(a)) fail(w, `反相器 A=${a} 應輸出 ${want}，畫面：${JSON.stringify(r)}`);
    if (r.up === r.down) fail(w, `反相器 A=${a}：上拉與下拉不該同時（或同時不）導通：${JSON.stringify(r)}`);
  }
  await page.click('.step >> nth=1');
  if (await page.isHidden('label.toggle:has-text("輸入 B")')) fail(w, 'NAND 應顯示輸入 B');
  for (const [a, b] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
    await set('輸入 A', a); await set('輸入 B', b); const r = await read(); const want = a && b ? 0 : 1;
    if (r.scene !== '2' || r.y !== String(want) || r.y2 !== String(want) || r.a2 !== String(a) || r.b !== String(b)) fail(w, `NAND A=${a} B=${b} 應輸出 ${want}，畫面：${JSON.stringify(r)}`);
    if (r.up === r.down) fail(w, `NAND A=${a} B=${b}：上拉與下拉不該同時（或同時不）導通：${JSON.stringify(r)}`);
  }
  problems.forEach(m => fail(w, m)); await ctx.close();
}
// every step of every chapter, every size: labels inside the drawing must not overlap each other, nor leave the stage
for (const size of SIZES.filter(x => ['1280x800', '1024x768', '414x800', '360x740'].includes(x.n))) {
  for (const [chapter, nSteps] of [['basics', 3], ['gates', 2]]) {
    const { ctx, page, problems } = await open(size, '#/c/' + chapter);
    await page.waitForSelector('#layout'); await page.keyboard.press('Space');
    for (let i = 0; i < nSteps; i++) {
      await (size.touch ? page.tap(`.step >> nth=${i}`) : page.click(`.step >> nth=${i}`)); await page.waitForTimeout(450);
      const bad = await page.evaluate(() => {
        const out = [], stage = document.getElementById('stage').getBoundingClientRect();
        const texts = [...document.querySelectorAll('#view svg text')].filter(t => t.getBoundingClientRect().width > 0 && getComputedStyle(t.closest('g') || t).display !== 'none').map(t => ({ t, r: t.getBoundingClientRect(), s: t.textContent.trim().slice(0, 10) }));
        const chips = [...document.querySelectorAll('#stageChips .chip')].map(c => c.getBoundingClientRect());
        texts.forEach(({ r, s }) => chips.forEach(c => { if (Math.min(r.right, c.right) - Math.max(r.left, c.left) > 1 && Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top) > 1) out.push(`文字被舞台標籤蓋住："${s}"`); }));
        texts.forEach(({ r, s }) => { if (r.left < stage.left - 2 || r.right > stage.right + 2 || r.top < stage.top - 2 || r.bottom > stage.bottom + 2) out.push(`文字超出舞台："${s}"`); });
        for (let a = 0; a < texts.length; a++) for (let b = a + 1; b < texts.length; b++) {
          const p = texts[a].r, q = texts[b].r;
          if (Math.min(p.right, q.right) - Math.max(p.left, q.left) > 1 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 1) out.push(`文字互相重疊："${texts[a].s}" 與 "${texts[b].s}"`);
        }
        return out;
      });
      bad.forEach(m => fail(`圖內文字 ${chapter} 第 ${i + 1} 步 ${size.n}`, m));
    }
    problems.forEach(m => fail(`圖內文字 ${chapter} ${size.n}`, m)); await ctx.close();
  }
}

/* ---------------- trial-reading mode (?trial=1) ---------------- */
console.log('\n== 試讀模式');
{
  const size = SIZES[0], w = '試讀模式';
  // off by default: a normal visitor never sees any of it
  let { ctx, page, problems } = await open(size, '#/c/basics');
  await page.waitForSelector('#layout');
  if ((await page.$('#stuckBtn')) || (await page.$('#trialChip'))) fail(w, '沒有 ?trial=1 時不應出現試讀功能');
  problems.forEach(m => fail(w, m)); await ctx.close();
  // on: record, export
  ({ ctx, page, problems } = await open(size, '#/c/basics', '&trial=1'));
  await page.waitForSelector('#layout');
  if (!(await page.isVisible('#trialChip'))) fail(w, '頂列應有「試讀模式」標示');
  await page.click('.step >> nth=0'); await page.waitForTimeout(300);
  await page.click('#stuckBtn'); if (!(await page.isVisible('#stuckNote'))) fail(w, '按「這裡看不懂」後應出現說明欄');
  await page.fill('#stuckNote', '水管比喻看不懂'); await page.click('#stuckSend');
  if (!/本章已記 1 筆/.test(await page.textContent('#stuckCount'))) fail(w, '記下之後應顯示筆數');
  if (!(await page.isHidden('#stuckNote'))) fail(w, '記下之後應收起說明欄');
  await page.click('#stuckBtn'); await page.click('#stuckSend');                               // an empty note is allowed
  await page.click('#bSet'); const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#trialExport')]);
  const text = fs.readFileSync(await dl.path(), 'utf8');
  for (const need of ['哪些詞或句子你看不懂', '電與半導體', '水管比喻看不懂', '電壓、電流、電阻', '（沒有補充說明）']) if (!text.includes(need)) fail(w, `匯出檔缺少「${need}」`);
  if (dl.suggestedFilename() !== 'ic-guide-trial-feedback.txt') fail(w, `匯出檔名不對：${dl.suggestedFilename()}`);
  await page.click('#settings button:has-text("清除試讀記錄")');
  await page.keyboard.press('Escape');
  problems.forEach(m => fail(w, m)); await ctx.close();
  // trial mode must not break the layout rules, on a laptop and on a phone
  for (const sz of [SIZES[0], SIZES.find(x => x.n === '414x800')]) {
    const hit = sz.touch ? 44 : 32;
    ({ ctx, page, problems } = await open(sz, '#/c/basics', '&trial=1'));
    await page.waitForSelector('#layout');
    (await page.evaluate(pageChecks, hit)).forEach(m => fail(`${w} ${sz.n}`, m));
    await (sz.touch ? page.tap('#stuckBtn') : page.click('#stuckBtn'));
    (await page.evaluate(pageChecks, hit)).forEach(m => fail(`${w} ${sz.n}（說明欄展開）`, m));
    problems.forEach(m => fail(`${w} ${sz.n}`, m)); await ctx.close();
  }
}

/* ---------------- behaviour (desktop 1280x800) ---------------- */
console.log('\n== 行為（1280x800）');
{
  const size = SIZES[0];
  let { ctx, page, problems } = await open(size, '#/c/basics');
  await page.waitForSelector('#layout');
  const title = () => page.textContent('#cardTitle');
  const t0 = await title();
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100);
  const t1 = await title(); if (t1 === t0 || !/電壓/.test(t1)) fail('鍵盤', `→ 沒有切到第 1 步：${t0} → ${t1}`);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100);
  const t2 = await title(); if (t2 === t1) fail('鍵盤', '第二次 → 沒有換步');
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(100);
  if ((await title()) !== t1) fail('鍵盤', '← 沒有回到上一步');

  await page.keyboard.press('Space'); await page.waitForTimeout(100);
  if (!/繼續/.test(await page.textContent('#bPlay'))) fail('暫停', '空白鍵沒有暫停');
  const before = await page.evaluate(() => icDebug.runner.P.v);
  await page.waitForTimeout(500);
  if ((await page.evaluate(() => icDebug.runner.P.v)) !== before) fail('暫停', '暫停後動畫仍在前進');
  for (let i = 0; i < 6; i++) await page.keyboard.press('.');                                  // 6 x 0.25 s: past the opening pause, into the animation
  await page.waitForTimeout(150);
  if ((await page.evaluate(() => icDebug.runner.P.v)) === before) fail('單步', '按 . 沒有前進一小段');
  await page.keyboard.press('Space'); await page.waitForTimeout(100);
  if (!/暫停/.test(await page.textContent('#bPlay'))) fail('暫停', '再按空白鍵沒有繼續');

  await page.selectOption('#speed', '0.25');
  if ((await page.evaluate(() => icDebug.runner.speed)) !== 0.25) fail('調速', '速度沒有變成 0.25×');
  await page.selectOption('#speed', '2'); await page.keyboard.press('ArrowRight');   // new step at 2x
  for (let i = 0; i < 10; i++) { await page.evaluate(() => icDebug.runner.nudge(30)); await page.waitForTimeout(40); }   // each await in the step needs its own push
  await page.waitForFunction(() => document.querySelectorAll('.step[data-done="1"]').length >= 1, null, { timeout: 3000 }).catch(() => fail('進度', '步驟播完後沒有標記完成'));
  const drops = await page.evaluate(() => icDebug.progress.rewards().drops);
  if (drops < 1) fail('獎勵', `完成一步後墨滴應 ≥ 1，實際 ${drops}`);

  await page.keyboard.press('h'); if (!(await page.evaluate(() => document.getElementById('app').classList.contains('clean')))) fail('快捷鍵', 'H 沒有隱藏介面');
  await page.keyboard.press('h');

  await page.click('#bLearn'); if (await page.isHidden('#drawer')) fail('學習面板', '沒有打開');
  await page.screenshot({ path: path.join(shots, 'panel-learn-1280x800.png') });
  await page.keyboard.press('Escape'); if (!(await page.isHidden('#drawer'))) fail('學習面板', 'Esc 沒有關閉');
  await page.click('#bSet'); if (await page.isHidden('#settings')) fail('設定', '沒有打開');
  await page.screenshot({ path: path.join(shots, 'panel-settings-1280x800.png') });
  await page.check('#settings label:has-text("降低動態") input');
  if ((await page.evaluate(() => document.documentElement.dataset.motion)) !== 'reduced') fail('設定', '降低動態沒有生效');
  await page.keyboard.press('Escape');

  // idle redraw rate: nothing is moving any more, so the scheduler must drop to its slow rate
  await page.evaluate(() => icDebug.runner.nudge(60)); await page.waitForTimeout(1200);
  const s0 = await page.evaluate(() => icDebug.scheduler.stats.rendered); await page.waitForTimeout(3000);
  const per = ((await page.evaluate(() => icDebug.scheduler.stats.rendered)) - s0) / 3;
  console.log(`  靜止重繪 ${per.toFixed(1)} 次/秒（目標 ≤ 6）`);
  if (per > 6.5) fail('效能', `靜止時重繪 ${per.toFixed(1)} 次/秒，超過 6`);
  problems.forEach(m => fail('行為', m)); await ctx.close();

  // home: the main line is the main object; the full map lives in the learning map panel
  ({ ctx, page, problems } = await open(size));
  if ((await page.$$('.home .node[data-id="basics"], .home .group')).length) fail('首頁', '共同基礎層與晶片群組應該只在學習地圖裡，不在首頁');
  if ((await page.$$('.home .node')).length !== 3) fail('首頁', '首頁主線上應只有 3 個章節方框（邏輯閘、資料到像素、面板掃描）');
  await page.click('.home .node[data-id="gates"]'); await page.waitForSelector('#layout');
  if (!/#\/c\/gates$/.test(page.url())) fail('導覽', '點主線上的章節方框沒有進入章節');
  await page.click('#bBack'); await page.waitForSelector('.home');
  await page.click('#bStart'); await page.waitForSelector('#layout');
  if (!/#\/c\/basics$/.test(page.url())) fail('導覽', '「開始學習」應進入第一個尚未完成的章節（電與半導體）');
  await page.click('#bBack'); await page.waitForSelector('.home');
  await page.click('.home .node[data-id="scan"]'); await page.waitForTimeout(150);
  if (!/即將推出/.test((await page.textContent('#toast')) || '')) fail('導覽', '尚未開放的章節沒有顯示「即將推出」');
  // learning map panel: opens from the home button, shows the map, switches to the list and back, and a chapter box navigates + closes it
  await page.click('#bMap'); if (await page.isHidden('#drawer')) fail('學習地圖', '「學習地圖」按鈕沒有打開面板');
  if ((await page.getAttribute('#drawer .tab[aria-selected="true"]', 'data-tab')) !== 'map') fail('學習地圖', '預設應為地圖');
  if (!(await page.isVisible('#drawer .group.foundation'))) fail('學習地圖', '地圖裡缺少共同基礎層');
  await page.click('#drawer .tab[data-tab="list"]'); if (!(await page.isVisible('#drawer .plist'))) fail('學習地圖', '切到清單後沒有顯示清單');
  await page.keyboard.press('Escape'); await page.click('#bLearn');
  if ((await page.getAttribute('#drawer .tab[aria-selected="true"]', 'data-tab')) !== 'list') fail('學習地圖', '應記住上次的檢視（清單）');
  await page.click('#drawer .tab[data-tab="map"]');
  await page.click('#drawer .node[data-id="die"]'); await page.waitForTimeout(150);
  if (await page.isHidden('#drawer')) fail('學習地圖', '點尚未開放的章節時面板不應關閉');
  await page.click('#drawer .node[data-id="basics"]'); await page.waitForSelector('#layout');
  if (!(await page.isHidden('#drawer'))) fail('學習地圖', '點開放中的章節後面板應關閉');
  if (!/#\/c\/basics$/.test(page.url())) fail('學習地圖', '點地圖上的章節沒有進入章節');
  await page.click('#bBack'); await page.waitForSelector('.home');
  await page.reload(); await page.waitForSelector('.home');                                 // hash route survives a reload
  problems.forEach(m => fail('導覽', m)); await ctx.close();

  // reload on a chapter URL keeps working (hash routing under a sub-path)
  ({ ctx, page, problems } = await open(size, '#/c/gates'));
  await page.waitForSelector('#layout'); await page.reload(); await page.waitForSelector('#layout');
  problems.forEach(m => fail('重新整理', m)); await ctx.close();

  // mobile: the main-line row is collapsed by default and expands on tap
  const m = SIZES.find(x => x.n === '414x800');
  ({ ctx, page, problems } = await open(m, '#/c/basics'));
  await page.waitForSelector('#layout');
  if (await page.isVisible('.spine-list')) fail('手機', '主線地圖應預設收合');
  await page.tap('.spine-toggle'); if (!(await page.isVisible('.spine-list'))) fail('手機', '點擊後主線地圖沒有展開');
  problems.forEach(x => fail('手機', x)); await ctx.close();
}

await browser.close(); srv.kill(); fs.rmSync(serveRoot, { recursive: true, force: true });
console.log(failures ? `\n${failures} 項失敗` : '\n版面與行為檢查全部通過');
process.exit(failures ? 1 : 0);
