/* Chapter: logic gates up to the shift register.  PARTIAL: the first two steps only (inverter, NAND).
   0 and 1 are defined here for now; when the `digital` chapter exists they move there (only `introduces` changes). */
export default {
  id: 'gates',
  title: { zh: '邏輯閘到移位暫存器', en: 'Gates → shift register' },
  status: 'draft',
  partial: true,
  idea: { zh: '要把資料一格格送到上千條線，需要「記住並傳遞」。先認識最基本的兩個積木：反相器與 NAND。' },
  view: 'gates.logic',
  introduces: ['logic01', 'inverter', 'nand'],
  params: { scene: 1, a: 0, b: 0 },
  controls: [
    { param: 'a', type: 'toggle', label: { zh: '輸入 A', en: 'Input A' }, when: { param: 'scene', in: [1, 2] } },
    { param: 'b', type: 'toggle', label: { zh: '輸入 B', en: 'Input B' }, when: { param: 'scene', in: [2] } },
  ],
  predicts: [],
  steps: [
    { id: 'inverter', level: 'core', label: { zh: '反相器', en: 'Inverter' },
      say: '用低電壓代表 0、高電壓代表 1；反相器把 0 變 1、1 變 0。',
      why: '兩個用電壓控制的開關輪流接通：一個接高電壓，一個接低電壓。', uses: [],
      run: async api => { api.set('scene', 1); api.set('a', 0); await api.wait(1.6); api.set('a', 1); await api.wait(1.6); api.set('a', 0); await api.wait(1); } },
    { id: 'nand-gate', level: 'core', label: { zh: 'NAND 閘', en: 'NAND gate' },
      say: 'NAND 有兩個輸入：只有兩個都是 1，輸出才是 0。',
      why: '上方兩個開關並聯、下方兩個串聯：兩個輸入都是 1 時，才接到低電壓。', uses: ['logic01', 'inverter'],
      run: async api => { api.set('scene', 2); for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { api.set('a', a); api.set('b', b); await api.wait(1.6); } await api.wait(0.6); } },
  ],
  takeaways: ['我能說出反相器的輸入與輸出有什麼關係。'],
  verify: [
    { claim: '反相器輸出與輸入相反：輸入 0 輸出 1，輸入 1 輸出 0', status: 'ok', note: 'Wikipedia「Inverter (logic gate)」' },
    { claim: 'NAND 只有在所有輸入都是 1 時輸出才是 0', status: 'ok', note: 'Wikipedia「NAND gate」真值表與文字說明' },
    { claim: 'NAND 的上拉網路是兩個並聯開關', status: 'ok', note: 'Wikipedia「NAND gate」提到兩個 p 型電晶體並聯' },
    { claim: 'NAND 的下拉網路是兩個串聯開關', status: 'part', note: '該頁沒有明寫串聯；這是標準教科書結構，待審閱者確認' },
    { claim: '反相器由一個接高電壓、一個接低電壓的互補開關組成，任一時刻只有一個接通', status: 'part', note: '該頁說「兩種輸出狀態下都有一個電晶體關閉」，未明寫接電源或接地；待審閱者確認' },
  ],
  sources: [
    { title: 'Inverter (logic gate) (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Inverter_(logic_gate)', note: '旁證' },
    { title: 'NAND gate (Wikipedia)', url: 'https://en.wikipedia.org/wiki/NAND_gate', note: '旁證' },
  ],
  simplified: [
    '把電晶體畫成「用電壓控制的開關」，只表現接通與不通；真實電晶體不是機械開關。',
    '低電壓與高電壓只是示意，不代表任何具體的伏特數。',
    '本章目前只做反相器與 NAND；正反器與移位暫存器之後補上。',
    '「0 與 1」暫時在本章定義，之後會移到「數位與二進位」章。',
  ],
};
