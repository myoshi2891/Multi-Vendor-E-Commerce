# 監査指摘・優先6画面のデザインシステム適用

2026-10-09。会話で対象選択と計画を承認済み。実装・段階コミットの依頼あり。
正本: [移行計画](design-system-adoption-plan.md) / [証跡](../../docs/design/design-system/PROGRESS.md)。

## 対象と順序

| Step | ID | 対象 | 実装・関連検証・仕様同期 |
|---|---|---|---|
| 1 | DS-PAGE-006 | /browse ページング | [x] |
| 2 | DS-PAGE-017 | / motion切替 | [x] |
| 3 | DS-PAGE-019 | 商品詳細の周辺操作 | [x] |
| 4 | DS-PAGE-041 | 属性一覧・編集・共通フォーム | [x] |
| 5 | DS-PAGE-040 | 属性新規 | [x] |
| 6 | DS-PAGE-039 | ENUM属性選択肢 | [ ] |

## 実装・境界

既存store/sellerテーマ、SellerPage、DataTable design=seller、テーマ対応Modalを再利用。
BrowsePaginationはeditorial分岐を使い、共有Paginationへ任意の読み上げ名propを追加。既定のReview pagesを保持。
公開3画面の指摘操作は44×44px以上、checkboxはlabel込みで判定。URL条件・motion設定・既存商品操作を保持。
属性フォーム/列のClientからServer Actionを直接importせず、Server Componentから型付きAction Propsを注入。列はClientで構築。
key/value不変、カテゴリ階層、型/scope/多値制約、ENUM限定ルート、archive/restore/TEXT→NUMBER契約を保持。
同期pending guard、送信中input/close lock、失敗時値保持/retry、成功statusを追加。
DB・認可・購入計算・業務ルール・URL変更、seller/stores仮実装、global tokens全面移行は対象外。

## TDD・受け入れ

各Step: RTL/ブラウザー先行テスト→意図したRed→最小実装→Refactor→関連検証→仕様同期→コミット。
RTLはURL条件保持、motion、商品操作、属性create/edit/archive/restore/convert、validation/pending/error/retry/success。
ブラウザーは1440/768/390px、管理者light/dark、通常/空/長文/送信状態、44px、hover/focus、Tab/Enter/Escape、focus復帰、overflow、axe AA（contrast含む）、画像目視。
purchase/purchase-public/p4の既存suiteとfixtureを拡張し、config/serverは新設しない。
最終: 全体Jest、bun run lint、bunx tsc --noEmit、bun run check:playwright、bun run build、共有部品の関連回帰。
公開実ルートも確認。管理者認証環境不足は実装/補助検証と別に実受け入れ保留を記録し、解除条件を残す。fixtureを実ルート合格と扱わない。

## 文書・コミット

計画1、画面別6、最終検証/引き継ぎ1の8コミット。画面別commitにテストと関連文書を含める。
移行計画/デザインPROGRESS、関連画面仕様、admin-dashboard要件/設計/tasks/進捗、category-attributes設計、SDDを同期。変更不要の仕様は理由を証跡へ記録。
QA_HANDOFF、TEST_IMPLEMENTATION_PLAN、docs/PROGRESSを同期。全体統計/coverageは実測時のみ更新。
必須チェック未完了は検証済みにしない。Red/Green/Refactorの実測・制約は証跡の正本へ記録。
