# Offers — 実装タスク（tasks.md）

> [.claude/rules/02-tdd-step-commit.md](../../../.claude/rules/02-tdd-step-commit.md) 準拠。各タスクを **Red → Green → Refactor** とコミット粒度に分解する。
> 要件 ID は [requirements.md](./requirements.md)、設計詳細は [design.md](./design.md)。進捗は [PROGRESS.md](./PROGRESS.md)。

---

## 0. 実装前チェック（必須・SKILL 呼び出し漏れ防止）

- [ ] **[feature-plan](../../../.claude/skills/feature-plan/) を起動**し、本設計書を入力に最終計画化・**ユーザー承認**を取得（コード着手前・必須）。
- [ ] 新規コードに `any` 禁止・`console.log` 禁止。ページは async server component。
- [ ] **`export const dynamic = 'force-dynamic'` を import 直後に宣言**（Prisma 依存ページ規約・[design §2.1](./design.md)）。
- [ ] 商品一覧は `/browse?offer=<url>` に委譲（再実装しない・[design §判断2](./design.md)）。
- [ ] **safe-migration / server-action-scaffold は不要**（schema 変更なし・既存 `getAllOfferTags` 再利用）。
- [ ] **完了の定義**: [test-complete](../../../.claude/skills/test-complete/)（lint/tsc/test）+ `bun run build`。
- [ ] テスト数変動 → [spec-sync-after-test](../../../.claude/skills/spec-sync-after-test/) + `bun run coverage:dashboard`（**同一コミット**）。

---

## SKILL シーケンス（本機能・俯瞰）

```
0. feature-plan         本設計書を入力に最終計画化・承認取得（必須）
1. test-gen             ページ描画 + user-menu リンク回帰の RTL（Red→Green）
2. test-complete        lint/tsc/test（各コミット前・必須）
3. spec-sync-after-test テスト数変動 → QA_HANDOFF(SSOT)→伝播 + dashboard 再生成（同一コミット）
4. spec-sync-check      最終ドリフト確認（任意）
```

> 本機能は **単一フェーズ**（破壊的変更なし）。

---

## Phase 1: オファー landing + 導線

### 1-A. ページ（TDD）　【SKILL: test-gen】

| Step        | 内容                                                                                               | コミット例                                    |
| ----------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1-A-1 Red   | `offers/page.test.tsx` に T-OF1/T-OF2（一覧描画・空状態、`getAllOfferTags` を mock）を書き失敗確認 | `test(offers): add failing offers page tests` |
| 1-A-2 Green | [design §2.1](./design.md) で `offers/page.tsx`（`force-dynamic` 付き）を実装 → Green              | `feat(offers): add /offers landing page`      |

### 1-B. 導線配線（user-menu・回帰）　【SKILL: test-gen】

| Step        | 内容                                                                                            | コミット例                                            |
| ----------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1-B-1 Red   | user-menu の「Discounts & Offers」→`/offers` 期待値テストを書き、現状 `""` で失敗確認（AC-OF3） | `test(user-menu): add failing offers link regression` |
| 1-B-2 Green | [design §2.2](./design.md) の diff で 1 行修正（他行は触らない） → Green                        | `fix(user-menu): wire discounts-and-offers link`      |

### 1-C. 品質チェック　【SKILL: test-complete】

- [ ] `bun run lint` / `bunx tsc --noEmit` / `bun run test` + `bun run build`（`force-dynamic` で安定）。全緑後コミット。

### 1-D. ドキュメント同期　【SKILL: spec-sync-after-test】

- [ ] テスト数変動 → `QA_HANDOFF.md`（SSOT）→ `07-testing.md`/`COVERAGE_REPORT.md`/`docs/PROGRESS.md` 伝播。
- [ ] `04-interfaces.md`（`/offers`）/ `05-workflows.md`（オファー導線）を同期。
- [ ] `bun run coverage:dashboard` 再生成。**ドキュメント同期コミット**（実装と別）。
- コミット例: `docs: sync offers stats and regenerate dashboard`

### 1-E. 最終ドリフト確認　【SKILL: spec-sync-check・任意】

- [ ] [spec-sync-check](../../../.claude/skills/spec-sync-check/)（報告のみ）。

---

## レビュー必須ポイント（着手前に確認）

- [ ] `force-dynamic` を宣言したか（Prisma 依存ページ）。
- [ ] 商品一覧を再実装せず `/browse?offer=<url>` に委譲しているか。
- [ ] user-menu の **Discounts & Offers の 1 行のみ**変更したか（他の空文字リンクは別設計書）。
- [ ] プラットフォームクーポン掲示を MVP に含めていないか（任意・運営判断）。

---

## コミット分割サマリー（rule 02 準拠）

| コミット | 種別 | 内容                                                   |
| -------- | ---- | ------------------------------------------------------ |
| 1        | test | offers page テスト（Red）                              |
| 2        | feat | offers page 実装（Green）                              |
| 3        | test | user-menu リンク回帰（Red）                            |
| 4        | fix  | user-menu 配線（Green）                                |
| 5        | docs | spec-sync + dashboard 再生成（統計同期は単独コミット） |

> 各コミットは単独で `bunx tsc --noEmit` 通過。複数フェーズ混在の巨大コミット禁止（rule 02 NEVER）。
