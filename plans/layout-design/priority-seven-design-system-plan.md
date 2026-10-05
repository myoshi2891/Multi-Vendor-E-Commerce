# 優先7画面のデザインシステム移行

- 日付: 2026-10-05
- 承認: ユーザーが対象構成・画面単位Green後コミットを選択し、実装を依頼済み。
- 正本: [採用計画](design-system-adoption-plan.md)／[進捗](../../docs/design/design-system/PROGRESS.md)

## 対象・順序

| ID | 対象 | 優先度 |
|---|---|---|
| DS-PAGE-032 | /profile/settings | P2 |
| DS-PAGE-004 | /seller/apply | P3 |
| DS-PAGE-058 | /dashboard/seller/stores/[storeUrl] | P3 |
| DS-PAGE-062 | 同 /products | P3 |
| DS-PAGE-055 | 同 /inventory | P3 |
| DS-PAGE-057 | 同 /orders | P3 |
| DS-PAGE-056 | 同 /messages | P3 |

## 実装・依存・境界

共通基盤を先行。深緑・アイボリー・ゴールドと意味を持つ状態色を分離し、見出しはセリフ、業務本文はサンセリフ。販売者のlight/darkを維持し、未対象の共通部品はopt-inで既存表示を維持。Portalへテーマを明示する。768px以上は300pxサイドバー、未満は開閉ナビと本文の固定左余白解除。表の横スクロールは局所化。

設定はClerk appearanceとhash routingを維持。申請は4ステップ・値保持・validation・画像・完了を維持し、固定400px列とスクロール禁止を解消、reduced-motion対応。概要はKPI・チャート・最近の注文・上位商品。商品一覧は検索・作成モーダル・確認操作、在庫は数量/しきい値・状態バッジ、注文は状態操作・取得失敗を空と区別。メッセージはPC2ペイン/mobile切替、未読・pending/error/retry・下書き保持。

変更するClientと操作依存部品はaction PropsでServerから注入し、必要な列はfactory化する。認可・DB/APIスキーマ・金額・在庫計算・注文状態遷移は変更しない。新機能、P4管理マスタ、他ページの全面移行、push/deployは対象外。

主な依存: DS-COMP-114〜122(申請)、124〜129/131〜145(業務枠/表/概要/在庫)、089/091/092(メッセージ)、商品フォーム/列/確認dialog。既存ID維持、新規IDは208以降。

## TDD・受け入れ条件

- 新表示/操作要件を先行RTLまたはブラウザでRed確認、最小実装でGreen、Refactor後再検証。CSS文字列をなぞるテストは追加しない。既存実装の回帰と環境失敗はRedに数えない。
- 設定のheading/Clerk hashとappearance、申請の進捗/4step/値保持、業務の検索/空/取得失敗、在庫のvalidation/pending/error/retry、メッセージの選択/送信/poll/stale/unmountを確認。
- 各実装コミット前: 関連Jest、bunx tsc --noEmit、bun run lint。最後にJest全体を実測。
- Playwrightで1440/768/390px、業務light/dark、hover/focus/Tab/Enter/Escape、dialog trap/復帰、長文/空/pending/error/success、横溢れ、axe WCAG AA(contrast除外なし)、画像目視。
- profileナビ/購入者メッセージ/管理者共有枠・表・チャート/他商品フォームを回帰。
- 認証後実ルートは専用test DB/Clerk lifecycleを使う。環境不足なら補助fixture検証を実ルート検証済みとせず、理由と解除条件付き保留。購入/実送信/削除/DB初期化は表示検証のために実行しない。

## 文書同期

profile-settingsとseller-dashboard要件/設計/tasks/進捗、販売者UI移行仕様、SDD要件/UI/workflow/testing、採用計画、デザイン進捗、TEST_IMPLEMENTATION_PLAN/QA_HANDOFFを更新。architecture/data-model変更不要の根拠を進捗へ記録。全体統計は実測後QA正本から同期、coverage dashboardは生成コマンドで更新。既存QA未コミット4行の変更は保持し、今回の差分のみコミット。

## コミット

1. docs(design): plan priority seven screen migration
2. feat(design): add scoped seller theme and responsive shell
3. feat(profile): apply design system to account settings
4. feat(seller): apply design system to application flow
5. feat(seller): apply design system to store overview
6. feat(seller): apply design system to product listing
7. feat(seller): apply design system to inventory
8. feat(seller): apply design system to order listing
9. feat(seller): apply design system to messages
10. test(design): verify seven screens and sync final evidence

各画面コミットにテスト/仕様/進捗を同梱。必須検証と文書同期が揃った対象のみ検証済みとする。
