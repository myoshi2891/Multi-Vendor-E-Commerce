# Compare — 進捗トラッカ

> このファイルは [tasks.md](./tasks.md) の **Phase 進捗の SSOT**（どこまで完了し、次にどこから着手するか）。
> 全体の履歴・テスト統計は [docs/PROGRESS.md](../../PROGRESS.md)、統計の SSOT は [docs/testing/QA_HANDOFF.md](../../testing/QA_HANDOFF.md)。
> 要件は [requirements.md](./requirements.md)、設計は [design.md](./design.md)。

---

## 🧭 現在地（2026-06-21）

- ✅ **設計完了** — README / requirements / design / tasks / PROGRESS を作成。
- ✅ **実装完了** — Phase 1〜3 すべて完了（`23f7332`〜`bdf3356`）。2-B「Add to compare」ボタンも対応済み。
- ✅ **品質ゲート** — lint 0 error / tsc 0 / test 1601 passed（+10）/ build 成功（`/compare` static）。
- 👉 **次の着手**: なし（任意拡張のスペック行比較は design §判断4 の follow-up として未着手のまま据え置き）。

---

## Phase 進捗 ✅ 完了

| Phase | 内容                                                   | 状態 | SKILL                                |
| ----- | ------------------------------------------------------ | ---- | ------------------------------------ |
| 1     | Zustand ストア（useCompareStore・TDD）                 | ✅ `5a1c669` | test-gen                       |
| 2     | UI（page + CompareGrid + Add to compare ボタン 2-B）   | ✅ `bdf3356` | test-gen                       |
| 3     | 品質チェック + ドキュメント同期                        | ✅          | test-complete / spec-sync-after-test |

---

## SKILL 起動チェック（漏れ防止）

- [x] feature-plan（着手前・必須）
- [x] test-gen（Phase 1 / 2）
- [x] test-complete（各コミット前）
- [x] spec-sync-after-test（テスト数変動時・必須）
- [ ] spec-sync-check（最終・任意）
- [x] safe-migration は **不要**（schema 変更無し）
- [x] server-action-scaffold は **不要**（既存 `getProductsByIds` 再利用）

---

## レビュー必須ポイント

- [ ] `getProductsByIds` を items 空で呼んでいない（throw 回避）。
- [ ] ストアが `useCartStore` と同型・テストが同階層。
- [ ] グリッドが client 部品で hydration 安全。
- [ ] スペック比較は任意拡張として切り出し済み。
