/* Content rules (spec §6.2).  Messages are in Traditional Chinese so the author can act on them directly. */
import { len } from '../../src/core/text.js';

export const LIMITS = { say: 40, why: 60, coreMin: 3, coreMax: 7, extMax: 4, termBudget: 5, takeaways: 3, predictQ: 40, predictOpt: 20, predictWhy: 60 };
const LEVELS = ['core', 'ext', 'deferred'];

export function checkChapters({ chapters, glossary, path, nodes }) {
  const errs = [];
  const err = (ch, m) => errs.push(`${ch}: ${m}`);
  const term = new Map(glossary.map(t => [t.id, t]));
  const idx = id => path.indexOf(id);
  glossary.forEach(t => { if (!nodes.some(n => n.id === t.chapter)) err('術語表', `術語「${t.zh}」指向不存在的章節 "${t.chapter}"`); });

  for (const def of chapters) {
    const id = def.id;
    if (!nodes.some(n => n.id === id)) { err(id, '章節不在課程圖(domain/curriculum.js)中'); continue; }
    const seen = new Set();
    (def.steps || []).forEach((s, i) => {
      const where = `第 ${i + 1} 步「${s.id}」`;
      if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(s.id || '')) err(id, `${where} 的 id 必須是小寫英文與連字號`);
      if (/^s\d+$/.test(s.id || '')) err(id, `${where} 的 id 不可用 s1、s2 這種位置式名稱`);
      if (seen.has(s.id)) err(id, `${where} 的 id 重複`);
      seen.add(s.id);
      if (!LEVELS.includes(s.level)) err(id, `${where} 的 level 必須是 core / ext / deferred`);
      if (s.level === 'deferred') return;
      if (!s.label || !s.label.zh || !s.label.en) err(id, `${where} 的標題需要中文與英文`);
      if (len(s.say || '') === 0) err(id, `${where} 缺少必讀說明`);
      if (len(s.say || '') > LIMITS.say) err(id, `${where} 的必讀說明 ${len(s.say)} 字，超過 ${LIMITS.say} 字`);
      if (len(s.why || '') > LIMITS.why) err(id, `${where} 的「為什麼？」${len(s.why)} 字，超過 ${LIMITS.why} 字`);
      (s.uses || []).forEach(u => {
        const t = term.get(u);
        if (!t) return err(id, `${where} 使用了未登錄的術語 "${u}"`);
        const ti = idx(t.chapter), ci = idx(id);
        if (ti > ci) err(id, `${where} 使用了「${t.zh}」，但它在較後面的「${t.chapter}」章才定義`);
        if (s.level === 'core' && t.level === 'ext') err(id, `${where} 是核心步驟，卻使用了只在延伸中定義的「${t.zh}」`);
      });
    });
    const core = (def.steps || []).filter(s => s.level === 'core'), ext = (def.steps || []).filter(s => s.level === 'ext');
    if (!def.partial && core.length < LIMITS.coreMin) err(id, `核心步驟只有 ${core.length} 步，至少 ${LIMITS.coreMin} 步`);
    if (core.length > LIMITS.coreMax) err(id, `核心步驟 ${core.length} 步，超過 ${LIMITS.coreMax} 步`);
    if (ext.length > LIMITS.extMax) err(id, `延伸步驟 ${ext.length} 步，超過 ${LIMITS.extMax} 步`);
    const intro = def.introduces || [];
    if (intro.length > LIMITS.termBudget) err(id, `核心新名詞 ${intro.length} 個，超過 ${LIMITS.termBudget} 個`);
    intro.forEach(t => { const g = term.get(t); if (!g) err(id, `introduces 的 "${t}" 不在術語表`); else if (g.chapter !== id) err(id, `術語「${g.zh}」在術語表中屬於 "${g.chapter}" 章，不是本章`); });
    glossary.filter(t => t.chapter === id && !intro.includes(t.id)).forEach(t => err(id, `術語「${t.zh}」屬於本章，但沒有列在 introduces`));
    if (!def.partial && (def.takeaways || []).length !== LIMITS.takeaways) err(id, `理解重點需要 ${LIMITS.takeaways} 條，目前 ${(def.takeaways || []).length} 條`);
    const pseen = new Set();
    (def.predicts || []).forEach((q, i) => {
      const where = `先猜第 ${i + 1} 題「${q.id}」`;
      if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(q.id || '')) err(id, `${where} 的 id 必須是小寫英文與連字號`);
      if (pseen.has(q.id)) err(id, `${where} 的 id 重複`); pseen.add(q.id);
      if (len(q.q || '') === 0 || len(q.q) > LIMITS.predictQ) err(id, `${where} 的題目需 1~${LIMITS.predictQ} 字（目前 ${len(q.q || '')} 字）`);
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 3) err(id, `${where} 需要 2~3 個選項`);
      else {
        q.options.forEach((o, k) => { if (len(o) === 0 || len(o) > LIMITS.predictOpt) err(id, `${where} 的選項 ${k + 1} 需 1~${LIMITS.predictOpt} 字（目前 ${len(o)} 字）`); });
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) err(id, `${where} 的 answer 必須是有效的選項編號`);
      }
      if (len(q.why || '') === 0 || len(q.why) > LIMITS.predictWhy) err(id, `${where} 的解釋需 1~${LIMITS.predictWhy} 字（目前 ${len(q.why || '')} 字）`);
    });
    (def.controls || []).forEach(c => { if (!c.param || !c.label || !c.label.zh || !c.label.en) err(id, `控制項 "${c.param}" 需要 param 與中英文標籤`); });
    ['verify', 'sources', 'simplified'].forEach(k => { if (!Array.isArray(def[k])) err(id, `缺少 ${k} 欄位(可為空陣列)`); });
    if (!def.view) err(id, '缺少 view');
  }
  return errs;
}
