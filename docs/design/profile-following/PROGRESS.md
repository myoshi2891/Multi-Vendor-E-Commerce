# Followed stores — 進捗

2026-10-05。実装済み。`1ed94eaf`→`e5c54728`→`982f13b5`。RTL4/4、旧StoreCard/Wishlistを含む18/18。tsc0、lint0 errors/12 warnings。未認証実ルート転送は公開Chromium11/11の一部として確認。認証後ブラウザー検証は環境確認中。

[保存計画](../../../plans/layout-design/priority-five-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p2優先5画面移行記録)


### 最終判定（2026-10-05）

実装あり・補助ブラウザー検証済み・認証後実ルート検証保留。2画面の補助Chromium6/6、1440/768/390px・keyboard/focus・URL/back・axe AA contrast・長文・pending/error/retry/emptyを確認。PC/mobile画像目視。公開実ルートの未認証転送と、alias/範囲補正のRTL回帰も確認。専用test DB不在。解除条件: 専用DB/アプリ接続先一致の環境で認証後の実画面と操作を検証しtest-userを後処理。[QA](../../testing/QA_HANDOFF.md#ds-account-discovery-browser)。

## P2残存表示統一（2026-10-09）

- [x] browser Red→Green（番号リンク36→44px）、tokens・操作状態・共通caller回帰・仕様同期。
- [ ] 認証後実ルート受け入れ（専用test DB不在の保留を継続）。

[証跡](../design-system/PROGRESS.md#p2残存6画面移行記録)。
