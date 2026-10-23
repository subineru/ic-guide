# IC 解構室 · 顯示驅動 IC:一個像素如何亮起

給零基礎自學者的互動教材。規格見 `docs/ic-spec.md`。**目前是 M0(MVP):首頁主線動畫、學習地圖、`basics` 三步、`gates` 反相器與 NAND、試讀模式。內容尚未經專業審閱。**

## 指令
| 指令 | 作用 |
|---|---|
| `npm install` | 安裝(`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` 可略過下載瀏覽器) |
| `npm run dev` | 在 http://localhost:8080 直接伺服原始碼(不需建置;ES modules 需經 http) |
| `npm run check` | 層級檢查(`check-deps`)與內容檢查(`check-content`) |
| `npm test` | 單元測試(Node,不需瀏覽器) |
| `npm run build` | 產生 `dist/`(GitHub Pages 用)與 `dist-single/ic-guide.html`(單檔離線版,可雙擊) |
| `npm run budget` | 傳輸量預算檢查(首頁 ≤ 150 KB、每章 ≤ 60 KB,gzip) |
| `npm run e2e` | 真實瀏覽器版面與行為檢查(6 種尺寸),截圖輸出到 `shots/` |
| `npm run review` | 產生給審閱者的畫格、影片(`review/`)與審閱包(`docs/review/review-pack.md`) |
| `npm run ci` | 檢查、測試、建置、預算、端對端 |

## 試讀
網址加 `?trial=1`(例如 `.../index.html?trial=1`,單檔版同樣可用)會開啟試讀模式:每個步驟多一個「這裡看不懂」,可寫一句話;試讀結束到「設定」按「匯出試讀回饋」,把下載的文字檔寄回。一般網址完全不會出現這些功能。

## 結構(相依只能向內)
`core` ← `domain` ← `content`;`app`、`render`、`ui`、`audio` 依賴 `app/domain/core`;`src/main.js` 是組合根。規則由 `tools/check-deps.mjs` 強制。

## 發佈到 GitHub Pages
1. 建立公開倉庫並推送。
2. Settings → Pages → Source 選 **GitHub Actions**。
3. 推送到 `main` 後,`deploy.yml` 會檢查、建置並部署。網址為 `https://<帳號>.github.io/<倉庫名>/`。
所有資源路徑都是相對路徑、路由用 `#/`,所以放在子路徑下可正常運作(`npm run e2e` 會在子路徑下驗證)。

## 授權
- 程式碼:[MIT](LICENSE)
- 教材內容(`src/content/`、`docs/` 與呈現給學習者的圖):[CC BY 4.0](LICENSE-CONTENT)

**內容尚未經專業審閱**,頁面皆標示「待審」。審閱包:[`docs/review/review-pack.md`](docs/review/review-pack.md)。
