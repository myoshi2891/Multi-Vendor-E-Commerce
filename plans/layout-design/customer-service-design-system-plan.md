# Customer service デザイン移行（2026-10-01）

対象: DS-PAGE-011 `/customer-service`。既存ユーザー指示を承認として実施。design-system-workflowを適用。
変更: FAQ・注文追跡と同じ深緑ヒーロー、クリーム背景、ゴールド、セリフ見出し。パンくず、サポート案内と番号付き導線カード。
対象外: 各遷移先・フォーム・DB・認証・既存SUPPORT_LINKSの内容変更。
依存: SUPPORT_LINKS、Next Link、既存デザイン。
受け入れ条件: 既存5導線のタイトル・説明・URLを維持。1440/390/768pxで可読・横溢れなし。見出し階層・キーボード操作・focus・hover・WCAG AA。
先行テスト: Playwrightで配色・セリフ・5導線・focus・Enter・幅・axe。旧画面で期待した見た目の失敗を確認してから実装。
実装後: 同テスト、注文追跡回帰、bun run lint、bunx tsc --noEmit、PC/モバイルスクリーンショット目視。
同期: storefront-static-pages requirements/design/tasks、SDD requirements/interfaces/workflows/testing、移行計画と進捗、QA_HANDOFF、全体進捗。テスト変更後dashboard再生成、実測ファイル数のみ同期。

完了（2026-10-01、未コミット）: 先行Chromium3件の背景色失敗を確認後に実装。最終3/3、注文追跡回帰3/3、既存RTL1/1、lintエラー0（既存警告12）、tsc成功。PC/モバイル画像・axe AA・仕様と進捗同期済み。
