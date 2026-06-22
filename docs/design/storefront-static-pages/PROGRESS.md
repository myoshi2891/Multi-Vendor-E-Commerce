# Storefront Static Pages — 進捗トラッカ

> このファイルは [tasks.md](./tasks.md) の **Phase 進捗の SSOT**（どこまで完了し、次にどこから着手するか）。
> 全体の履歴・テスト統計は [docs/PROGRESS.md](../../PROGRESS.md)、統計の SSOT は [docs/testing/QA_HANDOFF.md](../../testing/QA_HANDOFF.md)。
> 要件は [requirements.md](./requirements.md)、設計は [design.md](./design.md)。

---

## 🧭 現在地（2026-06-22）

- ✅ **設計完了** — README / requirements / design / tasks / PROGRESS を作成。
- ✅ **Phase 1 完了** — 共有レイアウト + 5 ページ + /faq 308 redirect + user-menu 配線。build で 6 ルート全て `○ Static`、テスト 1620→1629 passed / 165→168 スイート。
- 👉 **次の着手**: なし（本設計書は完了）。残る user-menu 空文字リンク（Return & Refund / Order Dispute / Report a Problem）は別設計書（support-forms 等）が担当。文面はプレースホルダのため運営へ正式文面差替を依頼（フォローアップ）。

---

## Phase 1: 共有レイアウト + 各ページ + 導線配線 ✅ 完了

| Task | 内容                                        | 状態 | SKILL                | 備考                                              |
| ---- | ------------------------------------------- | ---- | -------------------- | ------------------------------------------------- |
| 1-A  | StaticPageLayout 共有部品                   | ✅ `fa1f56a`–`de2c3a2` | test-gen             | 描画テスト先行（+5）                              |
| 1-B  | コンテンツ定数 + 5 ページ + /faq redirect   | ✅   | test-gen             | about/legal/faqs/customer-service/product-support |
| 1-C  | user-menu 配線（Help Center / Legal）       | ✅ `227ca0e` | test-gen             | 回帰テスト先行（AC-SP4/5・+2）                    |
| 1-D  | 品質チェック（lint/tsc/test + build）       | ✅   | test-complete        | 全緑（lint 0 err / tsc 0 / 1629 passed / build OK）|
| 1-E  | ドキュメント同期（統計 + dashboard 再生成） | ✅   | spec-sync-after-test | QA_HANDOFF SSOT → 伝播                            |
| 1-F  | 最終ドリフト確認                            | ⬜   | spec-sync-check      | 任意（未実施）                                    |

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
