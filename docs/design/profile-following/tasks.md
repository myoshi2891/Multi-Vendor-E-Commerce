# Followed stores — タスク

- [x] 保存計画・新要件RTL Red 4件
- [x] Green・共通表示Refactor・関連18/18
- [x] 型0・lint0 errors（12既存warnings）
- [ ] 認証後実ルートのブラウザー受け入れ検証
- [x] 補助ブラウザー確認と最終文書同期

[保存計画](../../../plans/layout-design/priority-five-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p2優先5画面移行記録)


### 最終判定（2026-10-05）

実装あり・補助ブラウザー検証済み・認証後実ルート検証保留。2画面の補助Chromium6/6、1440/768/390px・keyboard/focus・URL/back・axe AA contrast・長文・pending/error/retry/emptyを確認。PC/mobile画像目視。公開実ルートの未認証転送と、alias/範囲補正のRTL回帰も確認。専用test DB不在。解除条件: 専用DB/アプリ接続先一致の環境で認証後の実画面と操作を検証しtest-userを後処理。[QA](../../testing/QA_HANDOFF.md#ds-account-discovery-browser)。
