# Track order デザインシステム移行（2026-10-01）

対象: `/track-order`、フォーム、結果（既存台帳IDを維持）。ユーザー依頼を承認として実施。
変更: FAQと同じクリーム・深緑・ゴールド、セリフ見出し、パンくず、レスポンシブな案内とフォーム、結果カード。Server Componentから照会actionをPropsで渡す。
対象外: DB・照合方式・認証・共有ステータスタグの変更。
依存: 既存TrackOrderSchema、trackOrder、共有UI。
受け入れ条件: ラベル付き入力、未入力、送信中（二重送信抑止）、成功、未検出、失敗と再照会が動作。長いID・商品名も折り返し、1440/390/768pxで横溢れなし。focus・WCAG AA確認。
先行テスト: RTLで送信中の文言/disabled/入力ロック、成功・エラー回帰。Playwrightでブランド配色・フォント・focus・幅・各状態・axe（照会をモックしDB操作なし）。期待した失敗を記録後に実装。
実装後: 関連Jest、Playwright、bun run lint、bunx tsc --noEmit。スクリーンショット確認。
文書: 本計画、移行計画、デザイン進捗、track-order requirements/design/tasks、SDD interfaces/workflows/testing、QA_HANDOFF。全体統計は部分結果で更新しない。

完了: 2026-10-01。関連Jest82/82、Chromium3/3、lintエラー0（既存警告12）、tsc成功。状態・レスポンシブ・axe AA確認、仕様と台帳同期済み。未コミット。実注文はモック、全体coverage再測定なし。
