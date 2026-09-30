# Profile デザインシステム移行計画

- 日付: 2026-09-30。ユーザー指示: `/profile` に新デザインを適用しTDDで進める。
- 対象: DS-PAGE-029、DS-COMP-077（共通sidebar）、078（会員情報）、079（注文概要）、profile layout。
- 依存: Clerk認証、store header/footer、既存profileルートと注文フィルター。
- 表現: 深緑のアカウントヘッダー、アイボリーの本文、ゴールドの装飾、セリフ見出し、細い罫線。データ数値や注文履歴を創作しない。
- 既存の氏名・画像、Wishlist／Following／Viewed、注文全件・4ステータス、sidebarの10リンクを保持。未実装Coupons／Shopping creditは準備中としリンクにしない。操作のないMy appeal／In dispute行は既存Contact／Disputeへのサポートリンクにする。
- 共有layout/sidebarはprofile子ページにも影響するため、注文・住所・設定への導線と選択状態を回帰確認。子ページ本文・Clerk設定UIそのものの全面移行は対象外。
- DB・API・認可・注文数の取得追加は対象外。検証に既存Clerk E2Eテストユーザーのライフサイクルを利用し、seed／DB初期化／購入は行わない。

## 受け入れ条件・先行テスト

- h1はMy account、会員名は大文字小文字を保持、未設定名のfallback。会員画像には適切なalt。無認証の会員情報は表示しない。Clerk取得失敗は読みやすい案内と再読込導線。
- ラベル付きAccount navigation、aria-currentは該当リンクだけ。ordersフィルター・wishlistページングなど子ルートでも親を選択する。パンくず・h2で構造化。
- 既存3クイックリンク、4注文フィルター、全件表示とサポートのhrefをRTLで検証。未実装機能はリンクでないことを確認。
- Chromium1440／390／768px: 新配色・セリフ見出し、横スクロールなし、focusとTab／Enter、axe（color-contrastを除外しない）。認証後の通常・設定／注文の共有枠と未認証転送を確認。
- Redを新要件の失敗で実測、Green後に共通化・整理し関連RTL再実行。最終lint、tsc、diffチェック。

## 同期文書

本計画、design-system adoption-plan／PROGRESS、profile-overview requirements/design/tasks/PROGRESS（新設）、profile-settingsの共通枠に関する仕様、SDD 01-requirements／07-testing、QA_HANDOFF／TEST_IMPLEMENTATION_PLAN、docs/PROGRESSとcoverage dashboard（全体統計は再測定時のみ）。

## 最終結果

- Red: RTL新要件11件失敗／既存回帰2件成功。Chromium新要件4件失敗／未認証転送1件成功。
- Green／Refactor後: 関連Jest5 suites／28件成功、Chromium5件成功。1440／390／768px、focus・Tab／Enter、共有枠のaxe（contrast除外なし）、注文・住所・設定遷移、未認証転送を確認。会員名なしはブラウザ、氏名保持・Clerk失敗・user=nullはRTLで確認。
- lint 0 errors／既存12 warnings、変更対象ESLint無警告、tsc成功、diffチェック成功。
- 仕様・移行台帳・QA・進捗同期済み。dashboard294ファイル／既存lcov328を反映。全体Jest／coverage、Firefox／WebKitは今回未実行。
- 未コミット。詳細は[profile移行記録](../docs/design/design-system/PROGRESS.md#profile移行記録)。
