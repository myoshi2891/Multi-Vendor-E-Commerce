# Storefront Static Pages — 進捗トラッカ

> このファイルは [tasks.md](./tasks.md) の **Phase 進捗の SSOT**（どこまで完了し、次にどこから着手するか）。
> 全体の履歴・テスト統計は [docs/PROGRESS.md](../../PROGRESS.md)、統計の SSOT は [docs/testing/QA_HANDOFF.md](../../testing/QA_HANDOFF.md)。
> 要件は [requirements.md](./requirements.md)、設計は [design.md](./design.md)。

---

## 🧭 現在地（2026-06-21）

- ✅ **設計完了** — README / requirements / design / tasks / PROGRESS を作成。
- ⬜ **実装未着手** — 着手時は [tasks.md](./tasks.md) §0 の `feature-plan` から開始（承認後 Phase 1）。
- 👉 **次の着手**: Phase 1-A（共有レイアウト `StaticPageLayout` の Red テスト）。

---

## Phase 1: 共有レイアウト + 各ページ + 導線配線 ⬜ 未着手

| Task | 内容                                        | 状態 | SKILL                | 備考                                              |
| ---- | ------------------------------------------- | ---- | -------------------- | ------------------------------------------------- |
| 1-A  | StaticPageLayout 共有部品                   | ⬜   | test-gen             | 描画テスト先行                                    |
| 1-B  | コンテンツ定数 + 5 ページ + /faq redirect   | ⬜   | test-gen             | about/legal/faqs/customer-service/product-support |
| 1-C  | user-menu 配線（Help Center / Legal）       | ⬜   | test-gen             | 回帰テスト先行（AC-SP4/5）                        |
| 1-D  | 品質チェック（lint/tsc/test + build）       | ⬜   | test-complete        | 全緑後コミット                                    |
| 1-E  | ドキュメント同期（統計 + dashboard 再生成） | ⬜   | spec-sync-after-test | QA_HANDOFF SSOT → 伝播                            |
| 1-F  | 最終ドリフト確認                            | ⬜   | spec-sync-check      | 任意                                              |

---

## SKILL 起動チェック（漏れ防止）

- [ ] feature-plan（着手前・必須）
- [ ] test-gen（1-A / 1-B / 1-C）
- [ ] test-complete（各コミット前）
- [ ] spec-sync-after-test（テスト数変動時・必須）
- [ ] spec-sync-check（最終・任意）
- [ ] server-action-scaffold は **不要**（新規 action 無し）
- [ ] safe-migration は **不要**（schema 変更無し）

---

## レビュー必須ポイント

- [ ] plain text 描画（XSS 回避）。
- [ ] user-menu の他の空文字リンクを触っていない。
- [ ] 文面がプレースホルダである旨を運営に共有。
