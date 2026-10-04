# Checkout・注文詳細 デザインシステム移行

- 日付: 2026-10-04。ユーザー承認済み計画を実施。
- 順序: DS-PAGE-008 `/checkout` → DS-PAGE-003 `/order/[orderId]`。
- 対象: DS-COMP-031〜049（利用する部品のみ）、020（checkout住所選択）。旧住所form/list/card・共有モーダルの全利用先移行、PDF装飾変更は対象外。新設部品には台帳の最終IDに続くIDを割り当てる。
- 変更: 深緑・アイボリー・ゴールド、serif見出し、PC2カラム／mobile1カラム、住所・クーポン・注文・決済の状態表示。注文詳細の固定幅／固定高さを撤去し集計を一度表示。戻るは注文一覧、未実装キャンセルはdisabled。
- 依存: 既存queries・カート送料更新の直列化・Clerk・Stripe／PayPal。ClientにはServerページから型付きaction Propsを渡す。住所フォームは検証済みprofileフォームを再利用する。
- 維持: DB／API／認可／金額計算／在庫／注文状態遷移／支払い表示条件／PDF内容、注文成功後の二重送信防止とカート後処理。
- 受け入れ条件: 1440／768／390pxでページ横あふれなし、長文の折返し、keyboard住所選択・ラベル・modal Escape/focus trap/復帰、処理中ロック・失敗通知と再試行、集計1つ、状態の意味、reduced motion、WCAG2.1AA相当。
- Red: RTLで住所keyboard／modal／入力エラー、Checkout更新中・失敗／クーポン送信中、決済の状態通知。ブラウザーで新しい配色・focus・responsive要件が失敗することを確認。過去の既存実装は回帰として記録。
- Green/Refactor: 関連Jest、ChromiumのPC/mobile/middleと通常／空／複数店舗／長文／pending／failure／retry／paid、axe（contrastを含む）、screenshots目視、既存cart/product/profile住所の回帰。
- 実ルート検証: 専用テストDBと確認できた場合のみテスト顧客の住所・cart・order fixtureを作成し終了時削除。注文確定・決済・外部送信はmock、購入・seed・DB初期化なし。未確認の接続先へ書かない。
- 最終チェック: bun run lint、bunx tsc --noEmit、git diff --check、対象文書のlocalリンク・台帳件数確認。
- 文書: docs/design/checkout・order-detailのrequirements/design/tasks、SDD01/02/05/07、移行計画、デザイン進捗、QA_HANDOFF、必要なテスト計画。統計は部分実行から推定しない。未検証は理由・解除条件付き保留。コミットなし。
- [x] Red / [x] Green・Refactor / [ ] 必須検証（実ルートは保留） / [x] 文書同期

## 実施結果

- 関連Jest420/420（18 suites）、supplemental Chromium11/11、lint0 errors／既存12 warnings、tsc成功。先行RTL Red4件。
- 専用DBがないため実ルート認証後／SDK実描画は保留。DB・Clerk・providerなしの独立fixtureブラウザーを補助検証として追加した。
- [証跡と解除条件](../../docs/design/design-system/PROGRESS.md#checkout-order移行記録)。未コミット。
