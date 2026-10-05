# 優先6画面のデザインシステム移行

- 日付: 2026-10-05
- 承認: ユーザーが販売者6画面・画面単位Green後コミットを選択し、実装を依頼済み。
- 正本: [採用計画](design-system-adoption-plan.md)／[進捗](../../docs/design/design-system/PROGRESS.md)

## 対象・順序

未適用P3から、既存販売者基盤と共通フォームを利用できる業務導線を選ぶ。

| 順序 | ID | 対象 |
|---|---|---|
| 1 | DS-PAGE-061 | 商品登録 `/dashboard/seller/stores/[storeUrl]/products/new` |
| 2 | DS-PAGE-060 | バリアント追加 `同 /products/[productId]/variants/new` |
| 3 | DS-PAGE-059 | バリアント編集 `同 /products/[productId]/variants/[variantId]` |
| 4 | DS-PAGE-064 | 配送設定 `同 /shipping` |
| 5 | DS-PAGE-063 | 店舗設定 `同 /settings` |
| 6 | DS-PAGE-065 | 店舗作成 `/dashboard/seller/stores/new` |

## 実装・依存・境界

SellerPageとseller.module.cssを再利用。深緑・アイボリー・ゴールド、セリフ見出し、サンセリフ業務本文、light/darkを維持。商品3画面はProductDetailsのseller opt-inを有効化し見出し階層を整理する。配送は既定フォーム・国別検索表・編集dialogを統一し、表の横スクロールを局所化、Portalにもテーマを付与。店舗はロゴ/カバーの固定配置をレスポンシブ化。店舗作成は店舗別Shell外のためテーマ付き専用枠を用意する。

店舗/配送のActionはServerから型付きPropsで注入。配送列はClient factoryで受け取り編集dialogに渡す。validation/pending/重複防止/error/値保持/retry/successを確認。商品カテゴリ/属性/画像/価格/在庫、料金のDecimal変換・Default/Free、店舗payload・保存後遷移を維持。認可、DB/APIスキーマ、計算、業務状態遷移、P4管理画面、既存11画面の保留解除、push/deployは対象外。

依存: DS-COMP-147（既存商品フォーム）、146（店舗）、148/149（配送）、180（配送列）、既存表/CustomModal/画像部品。既存IDは維持、新規部品は217以降。

## TDD・受け入れ条件

- 各画面で先行RTL/ブラウザRedを確認→最小Green→Refactor→関連再検証。既存実装の回帰と環境失敗をRedに数えない。
- 登録/追加/編集の初期値・action Props・payload・遷移、属性と画像操作、店舗validation、配送検索/編集、pending/error/retry/successを確認。
- 1440/768/390px・light/dark・長文/空・hover/focus/Tab/Enter/Escape・dialog trap/復帰・overflow・reduced-motion・axe WCAG AA（contrast除外なし）と画像目視。
- playwright.design.config.tsへsuite登録、tests/browser/へspec、既存startFixtureServer利用。config/独自サーバーを増やさない。
- 各画面コミット前に関連Jest・ブラウザ、bun run lint、bunx tsc --noEmit、bun run check:playwright。最後にJest全体を実測。
- 商品一覧作成dialog・商品編集/属性・sellerナビ・共有部品の既存利用先を回帰。
- 専用test DB/Clerk環境がなければ認証後実ルート/SDKは理由・解除条件付き保留。fixtureを実ルートの受け入れ完了と扱わない。外部送信/購入/DB初期化は行わない。

## 文書同期・コミット

計画を最初にコミット。各画面のGreen/Refactor/検証/仕様同期後に画面単位コミット。共有実装は最初の利用画面に含め後続の証跡は個別に記録する。最後に全体検証証跡をコミット。Redはログで残し失敗状態はコミットしない。既存.coderabbit.yaml差分は維持し除外。

seller-ui-migrationの要件/設計/tasks、SDDの要件/インターフェース/ワークフロー/品質/テスト、採用計画・画面/部品台帳・TEST_IMPLEMENTATION_PLAN・QA_HANDOFFを同期。変更不要の仕様には理由とリンクを記録。全体統計は実測後QA正本から転記、coverage更新時はdashboard再生成。リンク/Markdown/66画面件数/台帳と証跡の一致を検証。

## 実施チェック

- [x] DS-PAGE-061 商品登録: TDD・実装・関連検証・文書同期。
- [ ] DS-PAGE-060 バリアント追加: TDD・実装・関連検証・文書同期。
- [ ] DS-PAGE-059 バリアント編集: TDD・実装・関連検証・文書同期。
- [ ] DS-PAGE-064 配送設定: TDD・実装・関連検証・文書同期。
- [ ] DS-PAGE-063 店舗設定: TDD・実装・関連検証・文書同期。
- [ ] DS-PAGE-065 店舗作成: TDD・実装・関連検証・文書同期。
- [ ] 最終回帰・全体Jest・文書整合。
- [ ] 認証後6実ルート・必要なSDK実描画の受け入れ確認。
