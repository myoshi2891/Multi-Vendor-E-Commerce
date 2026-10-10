# 販売者の優先8画面・残存デザイン移行

- 日付: 2026-10-10
- 承認: 販売者業務8画面をユーザーが選択し、計画の実装と段階的コミットを依頼済み。
- 正本: [採用計画](design-system-adoption-plan.md)／[証跡](../../docs/design/design-system/PROGRESS.md#販売者優先8画面残存移行記録)

## 対象・順序

全画面の本体適用と今回の残存対応を区別する。P1/P2直近対応に続くP3の日常業務を優先。
起点は `/dashboard/seller/stores/[storeUrl]`。

| Step | ID | 画面 | 残存対応 |
|---|---|---|---|
| 1 | DS-PAGE-058 | 店舗概要 `/` | KPI、チャート、注文、商品、長文・大きな金額 |
| 2 | DS-PAGE-062 | 商品一覧 `/products` | 検索、作成、編集、削除、フォーム／Dialog、局所スクロール |
| 3 | DS-PAGE-055 | 在庫 `/inventory` | 数量・しきい値、44px操作、意味色、再試行／成功 |
| 4 | DS-PAGE-057 | 注文 `/orders` | 状態選択・保存、支払状態、詳細Dialog |
| 5 | DS-PAGE-056 | メッセージ `/messages` | sellerトークン、選択・未読・戻る・送信・失敗 |
| 6 | DS-PAGE-061 | 商品登録 `/products/new` | 固定色の警告、動的項目、画像、選択Portal |
| 7 | DS-PAGE-064 | 配送 `/shipping` | 既定フォーム、国別表、編集Dialog、保存／再試行 |
| 8 | DS-PAGE-063 | 店舗設定 `/settings` | 画像、連絡先、featured、保存状態 |

## 実装・境界・依存

SellerShell/SellerPage/seller.module.cssを再利用。ライト／ダークの深緑・アイボリー・ゴールド、セリフ見出し、サンセリフ業務本文を維持。面、罫線、focus、操作寸法、成功／警告／危険色をスコープ付きトークンに集約し、Portalにも明示する。主要操作は高さ44px以上、アイコン操作は幅44px以上、checkboxはlabelを含む操作領域を確保する。

型付きAction Propsとdesign="seller"を継続。ClientへのServer Actionsの直接importを追加しない。API/DB/認可/金額/在庫計算/状態遷移/payload/URLは変更しない。商品バリアント追加／編集、管理者、購入者メッセージなど共有callerを回帰確認する。機能追加、仮店舗一覧、push/PR/deployは対象外。

依存は既存業務theme、DataTable、CustomModal、商品／店舗／配送フォーム、在庫editor、message CSSと関連部品。既存IDを維持し、共有部品全体を一括完了にしない。

## TDD・受け入れ・検証

各StepはRed→Green→Refactor→関連検証→文書同期→コミット。新要件は表示寸法・computed style・focus・overflowまたは操作／状態遷移で先行Redを実測。既存回帰と環境失敗をRedに数えず、CSS文字列のみのテストは追加しない。

- 1440/768/390px × light/dark、共有ナビ767px、message1000px境界。
- 通常/空/取得失敗/pending/save error/retry/success、長文/欠画像、二重送信防止、値保持、keyboard/Escape/focus復帰、reduced-motion、表の局所スクロール。
- axe WCAG A/AA（contrast含む）違反0、スクリーンショット目視。
- 既存seven/six suiteと共通fixture serverを拡張。config/server新設なし、specはtests/browser/。
- 各実装commit前に関連Jest/browser、bun run lint、bunx tsc --noEmit、git diff --check。最終に関連suite全体、全体Jest/coverage、bun run check:playwright。
- 認証後実ルートは利用可能な検証用ログイン状態とtest DBで確認。不足なら理由・解除条件付き保留とし、fixtureと区別。表示検証だけの実保存/外部送信/upload/DB初期化はしない。

## 文書とコミット

11commit: 計画→共通基盤→上表8画面→最終検証。失敗中のテストのみのcommitは行わない。
各画面にテスト/実装/仕様/進捗を同梱。seller-ui-migration要件/設計/tasks、seller-dashboard要件/設計/tasks/進捗、採用計画、design-system進捗、関連SDDを同期。仕様変更不要ならリンクと理由を記録。
TEST_IMPLEMENTATION_PLAN/QA_HANDOFFを更新、coverage変化はCOVERAGE_REPORTへ。全体統計は実測後QA正本からdocs/PROGRESSへ同期、coverage dashboardを再生成。過去の検証履歴と今回の補助検証/認証後実受け入れを区別し、必須未実施は検証済みにしない。

## 実施チェック

- [x] 計画保存。
- [x] 共通基盤。
- [x] Step 1 店舗概要。
- [x] Step 2 商品一覧。
- [x] Step 3 在庫。
- [x] Step 4 注文。
- [x] Step 5 メッセージ。
- [x] Step 6 商品登録。
- [x] Step 7 配送。
- [x] Step 8 店舗設定。
- [x] 最終回帰・仕様/QA/統計同期。
- [x] 認証後8実ルート/実SDK受け入れ（2026-10-10、Cloudinary はウィジェット表示まで）。配送の Dialog フォーカス復帰の間欠失敗は、列定義の固定で修正（×5 再実行 5/5）。

最終実測: Jest3095/3098（3 skipped）、ブラウザー256/256＋最終Refactor10/10。認証後保留の解除条件は[QA](../../docs/testing/QA_HANDOFF.md#ds-seller-eight-browser)。

## 認証後8実ルート受け入れ（2026-10-10 追記）

- 承認: ユーザーが「専用テスト販売者を作成」「Cloudinary はSDK表示までに留める」を選択（2026-10-10）。
- 環境: ローカルDockerの専用DB `multivendor_e2e`（`multivendor_dev` とは別）。`DATABASE_URL`/`DIRECT_URL`/`E2E_DATABASE_URL` を同値にし、`migrate deploy` + `seed:e2e` 済み。
- 準備: `scripts/design/prepare-seller-route.ts` が (1) 3変数の一致とローカル・専用DB名を検査、(2) Clerk dev に `+clerk_test` 販売者を作成または再利用し `privateMetadata.role=SELLER`、(3) Clerk ID の User へ seed 店舗を付け替え、注文・会話・国別配送料率を冪等に投入。
- 検証: `DESIGN_SUITES` に route suite `seller-eight-route` を1行追加し、spec は `tests/browser/`。`@clerk/testing` の `clerk.signIn({ emailAddress })` でログインする（storageStateは保存しない）。
- 受け入れ条件: 8実ルート × 1440/768/390 × light/dark で 200・横はみ出しなし・axe AA違反0・スクリーンショット。実保存→再読込（在庫しきい値・注文状態・店舗設定・配送）で値保持。非SELLERは `/` へリダイレクト、他店舗URLは表示されない。Dialog の Escape でフォーカス復帰。画像SDKはウィジェット起動・表示まで（ファイル送信なし）。
- 対象外: Cloudinary への実アップロード、Neon/`multivendor_dev` への書き込み、本体E2E設定の変更。
- 実施結果（2026-10-10）: 表示48ケース全件200・はみ出し0、操作27/27。axe違反34/48（サイドバー、Jodit）と不具合2件（Cloudinary open の読込前クリック、Store の Decimal 受け渡し）により受け入れは保留。[QA](../../docs/testing/QA_HANDOFF.md#ds-seller-eight-browser)。
- 修正と再検証（2026-10-10）: ユーザー承認のもと、サイドバーを素の nav（検索欄なし）へ、Jodit の ARIA 補正・テーマ判定・コントラスト、Cloudinary の読込中無効化、Store の Decimal を Client へ渡さない射影（`upsertStore`→`{ id, url }`、`updateStoreDefaultShippingDetails`→`{ url }`）を TDD で実施。seller-eight-route 57/57、Jest 3111/3114、321 suites。
- 今後の課題（列定義の固定が未対応の表 8 か所、在庫のしきい値依存、管理者ナビの既定分岐、保存失敗理由の表示、Cloudinary 実アップロード、本番ビルドでの再検証、既存の Prettier 未整形）は [QA](../../docs/testing/QA_HANDOFF.md#ds-seller-eight-browser) に記録。
