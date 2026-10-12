# Followed stores — タスク

- [x] 保存計画・新要件RTL Red 4件
- [x] Green・共通表示Refactor・関連18/18
- [x] 型0・lint0 errors（12既存warnings）
- [ ] 認証後実ルートのブラウザー受け入れ検証
- [x] 補助ブラウザー確認と最終文書同期

[保存計画](../../../plans/layout-design/priority-five-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p2優先5画面移行記録)


### 最終判定（2026-10-05）

実装あり・補助ブラウザー検証済み・認証後実ルート検証保留。2画面の補助Chromium6/6、1440/768/390px・keyboard/focus・URL/back・axe AA contrast・長文・pending/error/retry/emptyを確認。PC/mobile画像目視。公開実ルートの未認証転送と、alias/範囲補正のRTL回帰も確認。専用test DB不在。解除条件: 専用DB/アプリ接続先一致の環境で認証後の実画面と操作を検証しtest-userを後処理。[QA](../../testing/QA_HANDOFF.md#ds-account-discovery-browser)。

## P2残存表示統一（2026-10-09）

- [x] browser Red→Green（番号リンク36→44px）、tokens・操作状態・共通caller回帰・仕様同期。
- [ ] 認証後実ルート受け入れ（専用test DB不在の保留を継続）。

[証跡](../design-system/PROGRESS.md#p2残存6画面移行記録)。


## ストアフロント残存8画面 Step 1（2026-10-12）

店舗名リンクは短い名称でも44px領域を確保。店舗リンク・フォロー操作にhover表示を追加。既存の更新/失敗保持/成功通知は維持。

[承認済み計画](../../../plans/layout-design/priority-eight-storefront-residual-design-system-plan.md)／[検証証跡](../design-system/PROGRESS.md#ストアフロント残存8画面移行記録2026-10-12)。補助検証と実認証/SDK受け入れを区別する。


### ストアフロント残存8画面・最終受け入れ（2026-10-12）

今回の表示変更は実装・関連仕様同期・3幅の補助/実route確認を完了。pending/error/retry/successはadapter/RTL、実routeは読取の表示確認として区別する。実followingは空、履歴は既存商品あり、申請はguest/認証後第1段階。実更新/送信/uploadの既存保留は維持。[最終証跡](../design-system/PROGRESS.md#ストアフロント残存8画面移行記録2026-10-12)／[QA正本](../../testing/QA_HANDOFF.md#ds-storefront-eight-acceptance)。
