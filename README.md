# 西瓜遊戲

單機靜態網頁版西瓜遊戲專案。

目前狀態：已有單機靜態可玩版本，並加入 PWA 安裝、首次載入後離線快取與可關閉音效。

## 文件

- `SPEC.md`：完整產品與遊戲規格。
- `AGENTS.md`：給後續 agent 的工作指引。
- `docs/ASSET_GENERATION.md`：AI 水果素材生成與驗收規則。
- `progress.md`：進度、決策與交接紀錄。
- `manifest.webmanifest`、`sw.js`：PWA 安裝與離線快取設定。

## 目前決策

- 水果共有 11 種：櫻桃、草莓、葡萄、橘子、蘋果、梨子、桃子、鳳梨、哈密瓜、椰子、西瓜。
- 素材必須直接使用 AI 生成，且整體風格一致。
- 第一版是完整可玩的單機靜態網頁，不做後端、排行榜或帳號。
- 桌機與手機都要支援。
- 要支援 PWA：可安裝、使用本機 manifest/icon/service worker、核心素材離線快取。
- 音效使用瀏覽器 Web Audio API 即時合成，不依賴外部音訊檔。

## 建議工作順序

1. 確認 `SPEC.md` 與 `AGENTS.md`。
2. 依 `docs/ASSET_GENERATION.md` 生成並整理 11 種水果透明 PNG。
3. 下載或放入本機 `vendor/matter.min.js`。
4. 實作靜態網頁與遊戲邏輯。
5. 加入並驗證 PWA manifest、service worker 與安裝圖示。
6. 用瀏覽器測試桌機、手機與離線載入。

## 本機預覽

直接開啟 `index.html` 可以玩核心遊戲；PWA 安裝與 service worker 需要透過 localhost 或 HTTPS 靜態伺服器測試。
