# Compare — 進捗トラッカ

> このファイルは [tasks.md](./tasks.md) の **Phase 進捗の SSOT**（どこまで完了し、次にどこから着手するか）。
> 全体の履歴・テスト統計は [docs/PROGRESS.md](../../PROGRESS.md)、統計の SSOT は [docs/testing/QA_HANDOFF.md](../../testing/QA_HANDOFF.md)。
> 要件は [requirements.md](./requirements.md)、設計は [design.md](./design.md)。

---

## 🧭 現在地（2026-06-21）

- ✅ **設計完了** — README / requirements / design / tasks / PROGRESS を作成。
- ⬜ **実装未着手** — 着手時は [tasks.md](./tasks.md) §0 の `feature-plan` から開始（承認後 Phase 1）。
- 👉 **次の着手**: Phase 1-A（`useCompareStore` のユニット先行 → 実装）。

---

## Phase 進捗 ⬜ 未着手

| Phase | 内容                                                   | 状態 | SKILL                                |
| ----- | ------------------------------------------------------ | ---- | ------------------------------------ |
| 1     | Zustand ストア（useCompareStore・TDD）                 | ⬜   | test-gen                             |
| 2     | UI（page + CompareGrid・任意で Add to compare ボタン） | ⬜   | test-gen                             |
| 3     | 品質チェック + ドキュメント同期                        | ⬜   | test-complete / spec-sync-after-test |

---

## SKILL 起動チェック（漏れ防止）

- [ ] feature-plan（着手前・必須）
- [ ] test-gen（Phase 1 / 2）
- [ ] test-complete（各コミット前）
- [ ] spec-sync-after-test（テスト数変動時・必須）
- [ ] spec-sync-check（最終・任意）
- [ ] safe-migration は **不要**（schema 変更無し）
- [ ] server-action-scaffold は **不要**（既存 `getProductsByIds` 再利用）

---

## レビュー必須ポイント

- [ ] `getProductsByIds` を items 空で呼んでいない（throw 回避）。
- [ ] ストアが `useCartStore` と同型・テストが同階層。
- [ ] グリッドが client 部品で hydration 安全。
- [ ] スペック比較は任意拡張として切り出し済み。
