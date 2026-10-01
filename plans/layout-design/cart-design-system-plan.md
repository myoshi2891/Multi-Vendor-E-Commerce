# Cart デザインシステム適用

- 日付: 2026-10-01 / ユーザー依頼を承認として実施。既存カート同期修正を保持。
- 対象: DS-PAGE-007、DS-COMP-026〜030、035〜037（カート内表示）、ストアの react-hot-toast（新規 DS-COMP-201）。
- 変更: アイボリーの背景、深緑の導入・集計、ゴールドの操作、セリフ見出し、レスポンシブ商品行、空・読み込み・同期失敗・保存中・通知の表示、実リンクの保証案内。
- 対象外: 決済/DB/税計算の仕様変更、他画面の移行、Radix/Sonner 通知の全体移行。
- 依存: Zustand の既存カート・サーバー同期と保存・wishlist。Server Component から action props を渡す。
- 受け入れ条件: 1440/390/768px で横あふれなし。商品情報・送料・合計を保持。選択・削除・数量・wishlist をキーボード操作できる。保存中の再送信を防ぎ通知は読めて閉じられる。空状態から /browse に移動できる。
- 商品削除時にその商品の送料を集計から除外し、選択状態を現カートと一致させる。
- 先行テスト: RTL で選択/削除のアクセシブル名、保存中 disabled/状態通知。Playwright で背景色・focus・PC/モバイル・axe・通知・各状態。新要件による失敗を Red と記録。
- 実装後チェック: 関連 Jest、対象 Chromium、bun run lint、bunx tsc --noEmit、git diff --check。実購入・外部送信は行わず action 応答を mock。
- 文書同期: docs/design/cart/{requirements,design}.md、仕様 01/02/07、デザイン進捗、移行計画、QA_HANDOFF。全体統計は部分実行から更新しない。
- [x] Red / [x] Green・Refactor / [x] 検証 / [x] 文書同期

検証環境の補足: Docker(3000)とホスト(3001)が同じ.nextに書き込みTurbopackキャッシュ競合を起こした。ユーザー指示により両キャッシュを削除。開発時だけNEXT_DEV_DIST_DIRで出力先を分離するopt-inを追加し、既定と本番は.nextを維持する。

最終実績: 関連Jest27/27、Chromium画面10/10、画像基準更新後の回帰2/2、lint0 errors／既存12 warnings、型チェック・差分・新規文書リンク検証成功。未コミット。
