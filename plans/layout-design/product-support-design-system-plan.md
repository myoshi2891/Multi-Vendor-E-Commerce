# Product support デザイン移行（2026-10-01）

対象: DS-PAGE-018 `/product-support`。ユーザー依頼を承認としてdesign-system-workflowを継続。
変更: 既存3本文を再利用。深緑ヒーロー・クリーム・ゴールド・セリフ、Homeパンくず、3項目のアンカー目次、番号付き本文、customer-service/contact/returns-exchange/track-orderのサポート導線。
対象外: 本文・保証条件確定、CMS、フォーム・DB・認証、共通StaticPageLayoutや他画面の移行。
依存: PRODUCT_SUPPORT_SECTIONS、既存ブランド基準。静的Server Componentでplain text表示。
受け入れ条件: 3見出し・本文とプレースホルダ表記保持。アンカーは一意で空でない。h1/h2階層、キーボードfocus・Enterで本文へ移動、サポート4導線を維持。1440/390/768pxで折り返し・横溢れなし、axe AA。
先行テスト: RTLで本文保持と3目次の対応、4導線。Playwrightで背景・font・目次操作・幅・axe。Redの期待理由確認後実装。
検証: 関連Jest、Chromium、lint、tsc、PC/モバイル画像。共有レイアウトは変更せず既存テスト回帰。
文書: storefront-static-pages requirements/design/tasks、SDD requirements/interfaces/workflows/testing、移行計画・デザイン進捗・QA_HANDOFF・TEST_IMPLEMENTATION_PLAN・docs/PROGRESS。本計画結果。dashboard再生成・実測ファイル数のみ統計同期。

完了（2026-10-01、未コミット）: RTL1件は目次不在、Chromium3幅は背景色でRed確認。最終関連Jest11/11、Chromium3/3、lintエラー0（既存警告12）、tsc成功。本文・目次・4導線、3幅・axe AA・画像確認と文書同期済み。共有レイアウト変更なし、全体Jest・coverage率の再測定なし。
