# 時間表格式(給寫內容的人)

一個步驟 = 一份**時間表**,由幾個**小段(beat)**組成。時間表是資料,不是程式碼;播放器對任何時間點都能算出畫面該是什麼樣子。
原則與動機見 [`proposals/lesson-player.md`](proposals/lesson-player.md)。

## 一個小段
```js
{ at: 6, caption: '高電壓流進輸出端的水桶', focus: 'bucket',
  tween: { upClosed: [0, 1, 0.5] },        // 參數在 0.5 秒內從 0 變到 1
  flow:  { up: [0, 1, 2.5] },              // 水流量從 0 漸增到 1,歷時 2.5 秒
  pulse: 'ctl',                            // 一個脈衝沿 ctl 這條路徑跑一次
  set:   { a: 0 } }                        // 瞬間設定
```
| 欄位 | 意思 | 規則 |
|---|---|---|
| `at` | 這一小段從第幾秒開始 | 第 1 小段必須是 0;之後嚴格遞增 |
| `caption` | 這一小段的字幕 | **必填、≤ 20 字、一件事、不引入新名詞** |
| `focus` | 要看哪裡 | 該畫面宣告過的目標 id,或 `[id, id]`;`'whole'` = 整張圖;省略 = `whole` |
| `set` | 瞬間改變參數 | 參數必須在章節 `vocab.params` 宣告 |
| `tween` | 在一段時間內改變參數 | `[from, to, 秒]` 或 `{ to, dur, from?, delay?, ease? }`;省略 `from` = 接續上次的值;**同一參數的變化不可重疊** |
| `flow` | 水/電流的量(0~1) | 與 `tween` 同格式;名稱必須在 `vocab.flows` 宣告;**流動要在到位後回到 0**(暫態) |
| `pulse` | 一次性的訊號沿路徑移動 | `'名稱'` 或 `{ name, dur?, delay? }`;預設 1 秒;同名脈衝不可重疊 |
| `ask` | 先猜:到這裡暫停,等學習者選 | `{ id, q, options(2~3 個), answer, why }`;答錯不扣分;每個 id 只算第一次答案 |
| `hold` | 只用在最後一小段:變化結束後再停留幾秒 | 預設 2 秒 |

緩動 `ease`:`linear`、`inOut`(預設)、`in`、`out`、`back`(會稍微過頭再回來,像開關「啪」一聲到位;畫面必須自己限制範圍)。

## 章節要宣告的詞彙
```js
vocab: { params: ['a', 'upClosed', 'y'], flows: ['up', 'down'], pulses: ['ctl'], targets: ['input', 'swUp', 'bucket', 'output'] },
params: { a: 0, upClosed: 0, y: 0 },       // 各參數的起始值
```
畫面必須真的畫出每個 `targets`(端對端測試會檢查),`check-content` 會檢查時間表只用了宣告過的詞彙。

## 規則(`check-content` 會自動檢查)
- 每個步驟 3~8 個小段;字幕 ≤ 20 字;焦點、參數、流動、脈衝都必須是宣告過的。
- 一個步驟用 `timeline` **或**舊的 `run`,不能兩者並存(遷移期間兩種都支援;S4 完成後移除 `run`)。
- 動畫準則見提案 §7:每個動作要有理由、先預告再發生再留下痕跡、一次一個焦點、停留在變化完成之後、流動是暫態。

## 這份資料怎麼被使用
- `domain/timeline.js`:`compileTimeline` 編譯、`evaluate(tl, t)` 求值(同一個 t 永遠得到同樣結果)、`frameAtBeatEnd` 取小段結束時的靜止畫面(降低動態用)、`timelineProblems` 產生內容檢查訊息。
- `app/player.js`:時鐘與所有操作(播放、暫停、速度、拖曳、上/下一小段、重播這一小段、先猜、看/試、降低動態逐段模式)。
