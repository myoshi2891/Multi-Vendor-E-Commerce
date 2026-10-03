# Profile reviews デザインシステム移行

- 日付: 2026-10-03。ユーザーの同様対応指示を承認範囲とする。
- 対象: DS-PAGE-031 `/profile/reviews`、DS-COMP-087/088 ReviewsContainer/Header。profile専用カード/heading/module CSS/loadingと表示query facade。
- 保持: 自分のレビュー、評価1〜5/全件、4期間、本文のcase-insensitive検索、10件ページ/updatedAt降順、マスクした投稿者名/画像/色/variant/size/数量/本文/添付画像。商品ページの共有ReviewCardは変更しない。
- UI: account共通の深緑/クリーム/ゴールド/Georgia、My reviews h1、日本語リード、サポート、label付きnative controls、Search/Enterで明示検索（空検索で解除）、全解除は期間も戻す、条件変更でpage=1。
- 状態: 空/条件付き空、初期/再取得失敗と条件保持Try again、取得中status/静的skeleton/操作ロックと旧結果非表示、成功、ページ境界。mount重複取得と二重要求を防ぐ。
- 境界: getUserReviewsForDisplayは既存所有者queryへ委譲、表示項目/user name+picture/image id+url+altのみ投影、updatedAt ISO。Server Componentからaction Propsを渡しClient直接importを除去。既存query認可/DB/schemaは変更しない。
- 対象外: レビュー投稿/編集/削除、新しいproduct/store/order検索・商品リンク、商品ページレビュー部品/集計/認可変更。

## 受け入れ条件とTDD

1. 先行RTLでh1/native評価/期間/本文検索/ページング/全解除、内容と画像保持、空/条件付き空、初期失敗/取得中二重要求なし/再試行をRed実測。表示facadeの最小投影とISO日付を先行テスト。Chromium390px h1 Red。
2. PC1440/mobile390/boundary768pxで空/通常/長い本文とvariant/画像/操作、focus/Tab/Enter、横溢れなし、axe AA違反0（contrast除外なし）。モバイル取得中/失敗/再試行/条件/ページングと未認証転送。
3. 実Clerk test session/後処理、初期空は実query。通常/遅延/失敗はaction応答mock、レビューDBへ書き込まず購入/seed/外部送信しない。
4. Refactor後関連Jest、lint/tsc、画像目視。既存profile query/sidebar/先行account画面は適切な回帰を実施。server/loadingは実装後回帰として記録。

## 文書同期

- docs/design/profile-reviews/{requirements,design,tasks,PROGRESS}.md、SDD01/02/04/05/07。
- SDD00/03/06確認と変更不要理由、移行台帳/計画チェック、QA_HANDOFF/テスト計画/全体進捗、dashboard再生成。
- 検証と文書整合完了時のみ検証済み。全体Jest/coverageは再測定時のみ統計更新。コミット依頼なし。
