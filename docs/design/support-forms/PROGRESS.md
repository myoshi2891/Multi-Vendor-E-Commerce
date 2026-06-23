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
