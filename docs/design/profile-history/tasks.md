# View history — タスク

- [x] 保存計画、新要件RTL Red6件
- [x] Green/Refactor・関連21/21
- [x] tsc0・lint errors0（12既存warnings）
- [x] 補助ブラウザー確認・最終文書同期
- [ ] 専用DB環境の認証後実ルート検証

[保存計画](../../../plans/layout-design/priority-five-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p2優先5画面移行記録)


### 最終判定（2026-10-05）

実装あり・補助ブラウザー検証済み・認証後実ルート検証保留。2画面の補助Chromium6/6、1440/768/390px・keyboard/focus・URL/back・axe AA contrast・長文・pending/error/retry/emptyを確認。PC/mobile画像目視。公開実ルートの未認証転送と、alias/範囲補正のRTL回帰も確認。専用test DB不在。解除条件: 専用DB/アプリ接続先一致の環境で認証後の実画面と操作を検証しtest-userを後処理。[QA](../../testing/QA_HANDOFF.md#ds-account-discovery-browser)。

## P2残存表示統一（2026-10-09）

- [x] 失敗パネルtoken継承のbrowser Red→Green、pending/retry/empty/URLと共通caller回帰・仕様同期。
- [ ] 認証後実ルート受け入れ（専用test DB不在の保留を継続）。

[証跡](../design-system/PROGRESS.md#p2残存6画面移行記録)。


## ストアフロント残存8画面 Step 2（2026-10-12）

履歴の再試行・空状態導線はhover時もブランド配色と可読性を保つ。loading/error/保存順/URLページング契約を維持。

[承認済み計画](../../../plans/layout-design/priority-eight-storefront-residual-design-system-plan.md)／[検証証跡](../design-system/PROGRESS.md#ストアフロント残存8画面移行記録2026-10-12)。補助検証と実認証/SDK受け入れを区別する。


### ストアフロント残存8画面・最終受け入れ（2026-10-12）

今回の表示変更は実装・関連仕様同期・3幅の補助/実route確認を完了。pending/error/retry/successはadapter/RTL、実routeは読取の表示確認として区別する。実followingは空、履歴は既存商品あり、申請はguest/認証後第1段階。実更新/送信/uploadの既存保留は維持。[最終証跡](../design-system/PROGRESS.md#ストアフロント残存8画面移行記録2026-10-12)／[QA正本](../../testing/QA_HANDOFF.md#ds-storefront-eight-acceptance)。


## 受け入れ未完了8 Step 2（2026-10-16）

DS-PAGE-024 閲覧履歴。既存実装の回帰確認（新規Redなし）。priority history13/13（3幅＋480px・axe AA・loading/error/retry/empty・比較操作・URL/back）、history/discovery RTL14/14。再試行後の保存ID不変とalert消去も回帰追加。認証後read-only1/1内3幅で既存12variantの保存IDから商品表示とページングを確認、390px画像目視。商品画像placeholderは既存テストデータ。型0・lint0 errors/既存8 warnings。取得・保存順・URL・API/DBの仕様変更は不要。 [証跡](../design-system/PROGRESS.md#受け入れ未完了8画面2026-10-16)。
