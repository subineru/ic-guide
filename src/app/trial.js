/* Trial-reading mode (URL ?trial=1).  A tester marks "I don't understand this" on any step; the page also keeps a small
   activity log (enter chapter, start / finish step).  Everything stays in this browser; the tester exports a text file
   and sends it back.  Without ?trial=1 none of this is created. */
const KEY = 'ic.trial.v1';
const QUESTIONS = [
  '1. 哪些詞或句子你看不懂？',
  '2. 你在哪一步卡住了？卡了多久？',
  '3. 有沒有哪個地方讓你想放棄？為什麼？',
  '4. 讀完之後，用你自己的話說說「電壓」和「半導體」是什麼。',
];

export function createTrial({ store, now = () => Date.now() }) {
  let log = store.get(KEY, []);
  if (!Array.isArray(log)) log = [];
  const save = () => store.set(KEY, log);
  const api = {
    add(type, data = {}) { log.push({ t: now(), type, ...data }); save(); },
    stuck(chapter, step, note) { api.add('stuck', { chapter, step, note: String(note || '').trim().slice(0, 500) }); },
    entries: () => log.slice(),
    count: type => log.filter(e => e.type === type).length,
    clear() { log = []; save(); },
    /* a readable report; `titles` maps chapter id -> title and step id -> label */
    toText({ ua = '', build = '', titles = {}, when = new Date(now()) } = {}) {
      const name = id => titles[id] || id;
      const L = ['IC 解構室　試讀回饋', `日期：${when.toISOString().slice(0, 16).replace('T', ' ')}`, `版本：${build || '（未知）'}`, `瀏覽器：${ua || '（未知）'}`, '',
        '【請回答（直接填在每題下面）】', ...QUESTIONS.flatMap(q => [q, '　', '']), '【自動記錄】'];
      const chapters = [...new Set(log.filter(e => e.chapter).map(e => e.chapter))];
      if (!chapters.length) L.push('（沒有記錄）');
      chapters.forEach(c => {
        const mine = log.filter(e => e.chapter === c), first = mine[0].t, lastDone = mine.filter(e => e.type === 'step-done').map(e => e.t).pop();
        const done = new Set(mine.filter(e => e.type === 'step-done').map(e => e.step)).size;
        L.push(`■ ${name(c)}：完成 ${done} 個步驟` + (lastDone ? `，從進入到最後一個步驟完成約 ${Math.max(1, Math.round((lastDone - first) / 60000))} 分鐘` : '，尚未完成任何步驟'));
        mine.filter(e => e.type === 'stuck').forEach(e => L.push(`　‧ 看不懂：${e.step === 'intro' ? '（章節開頭）' : name(e.step)}　${e.note ? '「' + e.note + '」' : '（沒有補充說明）'}`));
      });
      return L.join('\n');
    },
  };
  return api;
}
