# Support Forms — 進捗トラッカ

> このファイルは [tasks.md](./tasks.md) の **Phase 進捗の SSOT**（どこまで完了し、次にどこから着手するか）。
> 全体の履歴・テスト統計は [docs/PROGRESS.md](../../PROGRESS.md)、統計の SSOT は [docs/testing/QA_HANDOFF.md](../../testing/QA_HANDOFF.md)。
> 要件は [requirements.md](./requirements.md)、設計は [design.md](./design.md)。

---

## 🧭 現在地（2026-06-21）

- ✅ **設計完了** — README / requirements / design / tasks / PROGRESS を作成。
- ✅ **実装完了** — Phase 1〜4 全完了（commits `e3c58aa`〜`3608a3b` + 本ドキュメント同期）。テスト +9（1629→1638 passed / 168→170 スイート）。
- 👉 **次の着手**: なし（本機能クローズ）。follow-up は管理者向けチケット閲覧/ステータス更新 UI・外部メール通知・reCAPTCHA/レート制限（いずれもスコープ外・別設計書）。

---

## Phase 進捗 ✅ 完了

| Phase | 内容                                                                   | 状態 | SKILL                                |
| ----- | ---------------------------------------------------------------------- | ---- | ------------------------------------ |
| 1     | schema（SupportTicket + enum + 逆リレーション + migration + ERD）      | ✅ `e3c58aa` | safe-migration                |
| 2     | Zod（SupportTicketSchema） + server action（createSupportTicket・TDD） | ✅ `595012e`〜`86404dd` | server-action-scaffold / test-gen |
| 3     | UI（SupportForm + 4 ページ + user-menu 配線）                          | ✅ `b227765`〜`3608a3b` | test-gen             |
| 4     | 品質チェック + ドキュメント同期                                        | ✅ 本コミット | test-complete / spec-sync-after-test |

---

## SKILL 起動チェック（漏れ防止）

- [ ] feature-plan（着手前・必須）
- [ ] safe-migration（Phase 1・必須 — `db push` 禁止）
- [ ] server-action-scaffold（Phase 2）
- [ ] test-gen（Phase 2 / 3）
- [ ] test-complete（各コミット前）
- [ ] spec-sync-after-test（テスト数変動時・必須）
- [ ] spec-sync-check（最終・任意）

---

## レビュー必須ポイント

- [ ] migration が additive・非破壊か。
- [ ] 送信が公開（認可ガード無し）、ログイン時のみ userId か。
- [ ] PII（本文）をログしていないか。
- [ ] user-menu の Discounts & Offers 行を触っていないか（offers 設計書が担当）。
- [ ] `orderId` 条件必須が Zod superRefine、DB は nullable か。

## 2026-10-01 返品・交換デザイン移行

DS-PAGE-036と共通フォームDS-COMP-093のブランド表示を検証済み。既存ポリシー・validation・送信仕様維持。TDD、関連Jest16件・Chromium4件、lint/tsc、3幅・各状態・axe・画像確認と文書同期完了。未コミット。[証跡](../design-system/PROGRESS.md#returns-exchange移行記録)。他画面はaction Propsを同期し既定表示を保持。


## 紛争画面デザイン移行（2026-10-05）

DS-PAGE-012。公開DesignPageとSupportForm appearance=brandを使用。DISPUTE、必須UUID注文番号、申立ラベルと既存submitActionを維持。パンくずとCustomer service導線。Red 1件、Green/Refactor共通フォーム込み9/9、tsc 0、lint 0 errors/12既存warnings。`0ab9d890` / `89f5f198` / `a2c7ddb2`。ブラウザー確認待ちのため実装済み。[計画](../../../plans/layout-design/priority-five-design-system-plan.md)。


## 問題報告デザイン移行（2026-10-05）

DS-PAGE-035。PROBLEM_REPORT、報告ラベル、既存フィールド（注文番号入力なし）とsubmitActionを保持してbrand表示を適用。Red 1件→関連10/10、tsc 0、lint 0 errors/12既存warnings。共有DesignPage再利用後に追加のRefactor差分なし。`4bda3231` / `3f35e4f1`。実ブラウザー最終検証待ち。


### 最終受け入れ確認（2026-10-05）

今回のdispute/report-problem本体は検証済み（contact/他サポート画面の移行状態は拡張しない）。公開3画面と2つの未認証転送を実ルートChromium11/11で確認。1440/768/390px、focus/keyboard・横溢れ・axe AA contrast・画像目視。送信はmock応答、実ticket作成なし。Offers空/失敗はRTL、フォームカテゴリーpayload回帰2/2。全体Jest2766/2769（3 skipped）、tsc0、lint0 errors/12既存warnings。[最終証跡](../design-system/PROGRESS.md#p2優先5画面移行記録)。
