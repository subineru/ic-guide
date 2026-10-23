/* Review material for a human reviewer (docs/ic-spec.md §8.4): key frames of every step at desktop and phone size,
   plus a real-time video of each chapter.  Not a product feature.  Usage: node tools/review-capture.mjs  ->  review/ */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'review'), serve = path.join(root, '.serve');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(out, 'video'), { recursive: true });
fs.rmSync(serve, { recursive: true, force: true }); fs.cpSync(path.join(root, 'dist'), path.join(serve, 'ic-guide'), { recursive: true });
const srv = spawn('npx', ['--no-install', 'http-server', serve, '-p', '8125', '-s', '-c-1'], { stdio: 'ignore', cwd: root });
await new Promise(r => setTimeout(r, 1500));
const base = 'http://localhost:8125/ic-guide/';
const CHAPTERS = [['basics', ['water-analogy', 'semiconductor-controllable', 'voltage-as-switch'], [0.5, 3.0, 5.5]], ['gates', ['inverter', 'nand-gate'], [0.4, 2.2, 3.9, 5.8]]];
const browser = await chromium.launch();

for (const [vpName, vp, touch] of [['desktop', { width: 1280, height: 800 }, false], ['phone', { width: 414, height: 800 }, true]]) {
  for (const [chapter, steps, times] of CHAPTERS) {
    const ctx = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch });
    const page = await ctx.newPage();
    await page.goto(base + '?test=1#/c/' + chapter); await page.waitForSelector('#layout');
    await page.screenshot({ path: path.join(out, `${chapter}-0-intro-${vpName}.png`), fullPage: touch });
    for (let i = 0; i < steps.length; i++) {
      await (touch ? page.tap(`.step >> nth=${i}`) : page.click(`.step >> nth=${i}`));
      await page.keyboard.press('Space');                                                       // freeze, then step the clock ourselves
      let t = 0;
      for (const target of times) {
        while (t < target - 1e-6) { await page.evaluate(() => icDebug.runner.nudge(0.25)); t += 0.25; await page.waitForTimeout(25); }
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(out, `${chapter}-${i + 1}-${steps[i]}-t${target.toFixed(1)}-${vpName}.png`), fullPage: touch });
      }
      await page.keyboard.press('Space');
    }
    await ctx.close();
  }
}
/* real-time videos (desktop): each step plays to its end */
for (const [chapter, steps] of CHAPTERS) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: path.join(out, 'video'), size: { width: 1280, height: 800 } } });
  const page = await ctx.newPage();
  await page.goto(base + '#/c/' + chapter); await page.waitForSelector('#layout'); await page.waitForTimeout(800);
  for (let i = 0; i < steps.length; i++) { await page.click(`.step >> nth=${i}`); await page.waitForFunction(i => document.querySelectorAll('.step[data-done="1"]').length > i, i, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(500); }
  const v = page.video(); await ctx.close(); fs.renameSync(await v.path(), path.join(out, 'video', `${chapter}-walkthrough.webm`));
}
await browser.close(); srv.kill(); fs.rmSync(serve, { recursive: true, force: true });
console.log(fs.readdirSync(out).filter(f => f.endsWith('.png')).length + ' 張畫格;影片:' + fs.readdirSync(path.join(out, 'video')).join(', '));
