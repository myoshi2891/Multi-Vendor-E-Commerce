# FAQs デザインシステム適用計画

- 日付: 2026-09-30
- 承認範囲: ユーザー依頼の `/faqs` デザイン移行・TDD・仕様同期。
- 対象: DS-PAGE-014。DS-PAGE-013 `/faq` は転送の回帰確認のみ。
- 変更: FAQ専用CSS Module、深緑のヒーロー、アイボリー本文、ゴールド装飾、セリフ見出し、質問目次、サポートリンク。既存FAQ定数を再利用するServer Component。
- 対象外: FAQ回答の確定、CMS、検索、共通レイアウト・他ページの移行、DB・認証変更。
- 依存: store共通ヘッダー／フッター、既存4件のFAQ定数、Contactのブランド基準。

## 受け入れ条件

- h1はFAQs、質問はh2。既存4回答をplain textで常時表示し、プレースホルダ表記を保持する。
- 日本語質問ごとに一意で空でないアンカーを付け、目次から到達できる。
- Home、Contact、Track your order、Returns & Exchange、Customer serviceへ到達できる。
- PC1440px／モバイル390px／境界768pxで折り返し・横スクロールなし。focus可視、キーボードで目次操作可能、axe重大違反なし。
- `/faq`の308転送を保持。FAQは静的Server ComponentでDB非依存。

## TDD・検証

1. RTLで全回答の保持を回帰確認し、新目次・サポート導線の失敗をRedとして記録。
2. Playwrightで背景・文字組み・レスポンシブ・focus・アンカー・axeを検証。CSS文字列だけのテストは使用しない。
3. 最小実装後、関連RTL、Chromium、bun run lint、bunx tsc --noEmit、git diff --check。
4. 仕様・進捗・移行計画・QA_HANDOFF・テスト実装計画を同期。全体テスト統計は部分実行から推測しない。

## 更新文書

- storefront-static-pages requirements/design/tasks
- specs/multi-vendor-ecommerce 01-requirements / 07-testing
- design-system PROGRESS / adoption-plan
- docs/testing QA_HANDOFF / TEST_IMPLEMENTATION_PLAN
- 本計画に最終検証結果を追記。

## 検証依存の同期

別作業でmiddleware.tsがproxy.tsへ移行したため、必須型チェックで旧テストimportが解決できない。既存middleware.test.tsのimportのみproxy.tsへ同期し、認証・Cookie回帰テストを実行する。プロキシ本体は別作業の変更を保持する。

## 最終結果

2026-09-30、未コミット。受け入れ条件を確認。関連Jest24/24、Chromium4/4、lint 0 errors／既存12 warnings、tsc成功。仕様と進捗を同期。全体Jest／coverage・Firefox／WebKitは未実行。詳しいRed／Green／Refactor・環境制約は[移行記録](../docs/design/design-system/PROGRESS.md#faqs移行記録)。
