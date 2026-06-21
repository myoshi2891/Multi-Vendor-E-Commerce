# Offers — 進捗トラッカ

> このファイルは [tasks.md](./tasks.md) の **Phase 進捗の SSOT**（どこまで完了し、次にどこから着手するか）。
> 全体の履歴・テスト統計は [docs/PROGRESS.md](../../PROGRESS.md)、統計の SSOT は [docs/testing/QA_HANDOFF.md](../../testing/QA_HANDOFF.md)。
> 要件は [requirements.md](./requirements.md)、設計は [design.md](./design.md)。

---

## 🧭 現在地（2026-06-21）

- ✅ **設計完了** — README / requirements / design / tasks / PROGRESS を作成。
- ⬜ **実装未着手** — 着手時は [tasks.md](./tasks.md) §0 の `feature-plan` から開始（承認後 Phase 1）。
- 👉 **次の着手**: Phase 1-A（`/offers` ページの描画テスト先行 → 実装）。

---

## Phase 1: オファー landing + 導線 ⬜ 未着手

| Task | 内容                                                           | 状態 | SKILL                   |
| ---- | -------------------------------------------------------------- | ---- | ----------------------- |
| 1-A  | `/offers` ページ（getAllOfferTags 再利用・force-dynamic・TDD） | ⬜   | test-gen                |
| 1-B  | user-menu 配線（Discounts & Offers・回帰）                     | ⬜   | test-gen                |
| 1-C  | 品質チェック（lint/tsc/test + build）                          | ⬜   | test-complete           |
| 1-D  | ドキュメント同期（統計 + dashboard 再生成）                    | ⬜   | spec-sync-after-test    |
| 1-E  | 最終ドリフト確認                                               | ⬜   | spec-sync-check（任意） |

---

## SKILL 起動チェック（漏れ防止）

- [ ] feature-plan（着手前・必須）
- [ ] test-gen（1-A / 1-B）
- [ ] test-complete（各コミット前）
- [ ] spec-sync-after-test（テスト数変動時・必須）
- [ ] spec-sync-check（最終・任意）
- [ ] safe-migration は **不要**（schema 変更無し）
- [ ] server-action-scaffold は **不要**（既存 `getAllOfferTags` 再利用）

---

## レビュー必須ポイント

- [ ] `force-dynamic` を宣言したか。
- [ ] 商品一覧を `/browse?offer=<url>` に委譲しているか。
- [ ] user-menu の Discounts & Offers の 1 行のみ変更したか。
- [ ] プラットフォームクーポン掲示を MVP に含めていないか。
