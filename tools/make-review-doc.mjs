/* Builds docs/review/review-pack.md for a human reviewer, straight from the chapter data (so it can never drift from what
   the page says): every sentence shown to learners, every claim with its verification status, every simplification. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PATH, NODES } from '../src/domain/curriculum.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.join(root, 'src/content/chapters');
const chapters = {};
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) { const d = (await import(pathToFileURL(path.join(dir, f)).href)).default; chapters[d.id] = d; }
const ST = { ok: '已查證', part: '部分查證', pending: '待查證', diff: '與來源不一致' };
const esc = t => String(t).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const L = [
  '# 給審閱者:內容審閱包', '',
  '這份文件由程式從章節資料自動產生,內容與網頁上顯示的完全一致。請審閱:**說明文字是否正確、簡化是否可接受、畫面是否會誤導**。',
  '審閱者不需要懂程式;請直接在「我的意見」欄寫下意見,或回覆「正確 / 需修改(原因)」。', '',
  '背景:對象是**沒有理工背景的成人(例如人資)**,所以刻意用生活比喻、少名詞、每步一個概念;凡簡化之處都列在各章的「簡化聲明」。', '',
  '每章的畫面規格與審閱表在 `docs/visual/`;畫面截圖與動畫影片在 `review/`。', '',
];
for (const id of PATH) {
  const c = chapters[id]; if (!c) continue;
  const n = NODES.find(x => x.id === id);
  L.push(`## ${n.title.zh} ${n.title.en}　(章節 id:\`${id}\`${c.partial ? '，**未完成章節，目前只有前幾個步驟**' : ''})`, '');
  L.push(`**這一章要說什麼:** ${c.idea.zh}`, '');
  if ((c.predicts || []).length) {
    L.push('### 先猜(章節開頭的小測驗,不計分)', '', '| 題目 | 選項(第一個是正確答案) | 解釋 |', '|---|---|---|');
    c.predicts.forEach(q => L.push(`| ${esc(q.q)} | ${q.options.map((o, i) => (i === q.answer ? `**${o}**` : o)).join('、')} | ${esc(q.why)} |`));
    L.push('');
  }
  L.push('### 步驟與說明文字', '', '| # | 步驟 | 必讀說明 | 「為什麼?」展開 | 我的意見 |', '|---|---|---|---|---|');
  c.steps.filter(s => s.level === 'core' || s.level === 'ext').forEach((s, i) => L.push(`| ${i + 1}${s.level === 'ext' ? '（延伸）' : ''} | ${esc(s.label.zh)} ${esc(s.label.en)} | ${esc(s.say)} | ${esc(s.why)} | |`));
  const kept = c.steps.filter(s => s.level === 'deferred');
  if (kept.length) L.push('', `（保留未顯示的延伸步驟:${kept.map(s => s.label.zh).join('、')}）`);
  L.push('', '### 我們要審閱者確認的主張', '', '| 主張 | 查證狀態 | 說明 | 我的意見 |', '|---|---|---|---|');
  (c.verify || []).forEach(v => L.push(`| ${esc(v.claim)} | ${ST[v.status] || v.status} | ${esc(v.note || '')} | |`));
  L.push('', '### 簡化聲明(我們刻意簡化的地方,請確認不會誤導)', '');
  (c.simplified || []).forEach((s, i) => L.push(`${i + 1}. ${s}　→ 我的意見:`));
  L.push('', '### 來源', '');
  (c.sources || []).forEach(s => L.push(`- [${s.title}](${s.url})${s.note ? '（' + s.note + '）' : ''}`));
  L.push('');
}
L.push('---', '', '## 全站共通的簡化(請一併確認)', '',
  '1. **主線**:`介面傳輸(IC 外)→ 介面接收 → 移位暫存器 → 鎖存 → 電壓位準轉換 → 數位轉類比(DAC)→ 緩衝器 → 面板(IC 外)`。省略了時序控制、影像記憶體、影像處理、電源產生等方塊。是否可接受?',
  '2. **首頁動畫**:封包形態變化(低電壓位元 → 較高電壓位元 → 類比電壓 → 有力氣的電壓)是否會誤導?詳見 `docs/visual/home-overview.md`。',
  '3. **共同基礎**:「驅動 IC 內的每個零件都由電晶體組成」,兩端(介面傳輸、面板)在 IC 外。面板中的像素電路是否也應視為電晶體組成,只是不在驅動 IC 內?',
  '4. **名詞**:「電壓位準轉換」對應 level shifter(把低電壓訊號轉成高電壓訊號),不是電源端的升壓電路。', '');
fs.mkdirSync(path.join(root, 'docs/review'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/review/review-pack.md'), L.join('\n'));
console.log('docs/review/review-pack.md', L.length, 'lines');
