# 返品 RMA の UI（plan 088 Step 5・2026-10-15）

対象: DS-PAGE-003 `/order/[orderId]`（返品パネルの追加）、DS-PAGE-036 `/returns-exchange`（文面の差し替え）、DS-PAGE-068 `/dashboard/seller/stores/[storeUrl]/returns`（新規）、DS-COMP-247 顧客の返品パネル、DS-COMP-248 seller 返品キュー。
承認: ユーザーの今回依頼（plan 088 Step 5）。design-system-workflow を適用。設計の正本は [returns-rma/design.md](../../docs/design/returns-rma/design.md) §3 / §4.1 / §6、親プランは [088](../088-implement-returns-rma.md)。
変更:
- 注文詳細: 店舗グループごとに、既存の RMA（状態・明細・却下理由・返金額の目安）と、適格な item があるときの申請フォーム（明細ごとの数量・理由・メモ）。取り下げ（REQUESTED / APPROVED）と追跡番号（APPROVED）。冪等キーはフォームを開いた時点で作り、失敗後の再送でも同じ値を使う。`useRef` で二重送信を防ぐ。
- seller 返品キュー: 状態での絞り込みと件数、RMA のカード、承認・却下（理由必須）・受け取り（全明細の状態必須）・解決（目安額と手動返金の注記）。サイドバーに Returns。
- `/returns-exchange`: 期限は `resolveReturnWindowDays` から描く。注文詳細からの申請への案内と `/profile/orders` へのリンク。フォームは「返品・交換のご相談」として残す（category は RETURN_REQUEST のまま）。
基本ルール対応: Client は `src/queries` を import せず、Server Component から actions を props で渡す。表示用のシリアライズと適格性は `src/lib/returns-view.ts`（`returns-policy.ts` を再利用）。
対象外: E2E（plan 088 Step 6）、admin の返品画面、返金 API、交換。
依存: `src/queries/returns.ts`（実装済み）、`getOrder`、`SellerPage` / `seller.module.css`、`commerce.module.css`、`SupportForm`。
受け入れ条件: 適格な item のある group だけに申請導線。残り数量を超える選択はできない。数量 0 だけでは送れない。送信中は入力とボタンをロック、失敗は alert で同じキーのまま再送できる、成功は status と refresh。seller は状態ごとに正しい操作だけを出し、却下の理由・受け取りの状態が欠けると送れない。1440 / 768 / 390px で横溢れなし、focus とキーボード操作、axe AA 違反 0、seller はライト・ダーク。
先行テスト: RTL（返品パネル・seller キュー・注文詳細ページ・returns-exchange 文面）、`returns-view` のユニット。Red を確認してから実装する。
検証: 関連 Jest、`DESIGN_SUITE=returns`（新設 suite・fixture）、`DESIGN_SUITE=priority`（support-returns の回帰）、chromium の `tests/e2e/returns-exchange-design.spec.ts`、`check:playwright`、lint、tsc、全体 Jest。
保留（予定）: 認証後の実ルート（実 DB の Delivered 注文と Clerk の顧客・seller が要る）。解除条件は plan 088 Step 6。
文書: 台帳と実施記録、05-workflows / 04-interfaces、design §9（差分があれば）、plan 088・plans/README、spec-sync-after-test（QA_HANDOFF ほか）。

完了（2026-10-15、未コミット）: RTL 新要件 28 件の Red を実測。最終: 関連 Jest 107 スイート・600 件、全体 Jest 3254/3257、`DESIGN_SUITE=returns` 10/10、priority 83/83、E2E chromium 4/4、check:playwright・lint・tsc 成功。3 幅・各状態の axe AA 違反 0、seller は light/dark、PC/モバイル画像を目視。認証後の実ルートは保留（解除: plan 088 Step 6）。台帳・仕様（04/05）・design §9.1・support-forms 文書を同期。

