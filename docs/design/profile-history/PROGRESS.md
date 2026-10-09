# View history — 進捗

2026-10-05。実装済み。`a52ef2f0`→`31492ef3`→`85022b3b`。新要件6/6、following/ProductCardを含む21/21。router mockは実際と同様にstableに修正（新ロジックの失敗と混同しない）。tsc0、lint0 errors/12既存warnings。未認証実ルート転送はChromium11/11の一部として確認。専用test DBがなく認証後実ルート検証は保留、実装あり。解除条件: 専用DBとアプリ接続先の一致を確認し、テストユーザーの作成/後処理と認証後画面/ページング/商品操作を実ルートで検証する。

[保存計画](../../../plans/layout-design/priority-five-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p2優先5画面移行記録)


### 最終判定（2026-10-05）

実装あり・補助ブラウザー検証済み・認証後実ルート検証保留。2画面の補助Chromium6/6、1440/768/390px・keyboard/focus・URL/back・axe AA contrast・長文・pending/error/retry/emptyを確認。PC/mobile画像目視。公開実ルートの未認証転送と、alias/範囲補正のRTL回帰も確認。専用test DB不在。解除条件: 専用DB/アプリ接続先一致の環境で認証後の実画面と操作を検証しtest-userを後処理。[QA](../../testing/QA_HANDOFF.md#ds-account-discovery-browser)。

## P2残存表示統一（2026-10-09）

- [x] 失敗パネルtoken継承のbrowser Red→Green、pending/retry/empty/URLと共通caller回帰・仕様同期。
- [ ] 認証後実ルート受け入れ（専用test DB不在の保留を継続）。

[証跡](../design-system/PROGRESS.md#p2残存6画面移行記録)。
