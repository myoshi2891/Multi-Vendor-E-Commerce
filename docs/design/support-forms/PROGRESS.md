# Support Forms — 進捗トラッカ

> このファイルは [tasks.md](./tasks.md) の **Phase 進捗の SSOT**（どこまで完了し、次にどこから着手するか）。
> 全体の履歴・テスト統計は [docs/PROGRESS.md](../../PROGRESS.md)、統計の SSOT は [docs/testing/QA_HANDOFF.md](../../testing/QA_HANDOFF.md)。
> 要件は [requirements.md](./requirements.md)、設計は [design.md](./design.md)。

---

## 🧭 現在地（2026-06-21）

- ✅ **設計完了** — README / requirements / design / tasks / PROGRESS を作成。
- ⬜ **実装未着手** — 着手時は [tasks.md](./tasks.md) §0 の `feature-plan` から開始（承認後 Phase 1: safe-migration）。
- 👉 **次の着手**: Phase 1-A（`SupportTicket` モデル追加 → `safe-migration` → ERD 再生成）。

---

## Phase 進捗 ⬜ 未着手

| Phase | 内容                                                                   | 状態 | SKILL                                |
| ----- | ---------------------------------------------------------------------- | ---- | ------------------------------------ |
| 1     | schema（SupportTicket + enum + 逆リレーション + migration + ERD）      | ⬜   | safe-migration                       |
| 2     | Zod（SupportTicketSchema） + server action（createSupportTicket・TDD） | ⬜   | server-action-scaffold / test-gen    |
| 3     | UI（SupportForm + 4 ページ + user-menu 配線）                          | ⬜   | test-gen                             |
| 4     | 品質チェック + ドキュメント同期                                        | ⬜   | test-complete / spec-sync-after-test |

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
