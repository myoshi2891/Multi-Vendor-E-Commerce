# Compare — 実装タスク（tasks.md）

> [.claude/rules/02-tdd-step-commit.md](../../../.claude/rules/02-tdd-step-commit.md) 準拠。各タスクを **Red → Green → Refactor** とコミット粒度に分解する。
> 要件 ID は [requirements.md](./requirements.md)、設計詳細は [design.md](./design.md)。進捗は [PROGRESS.md](./PROGRESS.md)。

---

## 0. 実装前チェック（必須・SKILL 呼び出し漏れ防止）

- [ ] **[feature-plan](../../../.claude/skills/feature-plan/) を起動**し、本設計書を入力に最終計画化・**ユーザー承認**を取得（コード着手前・必須）。
- [ ] 新規コードに `any` 禁止・`console.log` 禁止（fetch 失敗時のみ `console.error`・[design §2.3](./design.md)）。
- [ ] ストアは `useCartStore` と同型（`create(persist<State & Actions>())`）。テストは同階層配置。
- [ ] `getProductsByIds` を **items 空のとき呼ばない**（空配列 throw 回避・[design §判断/事実0-4](./design.md)）。
- [ ] `useEffect` キャンセルフラグで古いレスポンス上書きを防ぐ（[tech.md パターン](../../../.claude/steering/tech.md)）。
- [ ] **safe-migration / server-action-scaffold は不要**（schema 変更なし・既存 `getProductsByIds` 再利用）。
- [ ] **完了の定義**: [test-complete](../../../.claude/skills/test-complete/)（lint/tsc/test）+ `bun run build`。
- [ ] テスト数変動 → [spec-sync-after-test](../../../.claude/skills/spec-sync-after-test/) + `bun run coverage:dashboard`（**同一コミット**）。

---

## SKILL シーケンス（本機能・俯瞰）

```
0. feature-plan         本設計書を入力に最終計画化・承認取得（必須）
1. test-gen             ストアのユニット + グリッドのコンポーネント（Red→Green）
2. test-complete        lint/tsc/test（各コミット前・必須）
3. spec-sync-after-test テスト数変動 → QA_HANDOFF(SSOT)→伝播 + dashboard 再生成（同一コミット）
4. spec-sync-check      最終ドリフト確認（任意）
```

---

## Phase 1: Zustand ストア（TDD）

### 1-A. `useCompareStore`　【SKILL: test-gen】

| Step        | 内容                                                                             | コミット例                                               |
| ----------- | -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1-A-1 Red   | `useCompareStore.test.ts` に T-CMP1〜T-CMP4（追加/冪等/上限/削除）を書き失敗確認 | `test(compare): add failing useCompareStore tests`       |
| 1-A-2 Green | [design §2.1](./design.md) で `useCompareStore.ts` を実装 → Green                | `feat(compare): add useCompareStore (zustand + persist)` |

## Phase 2: UI（TDD）

### 2-A. グリッド + ページ　【SKILL: test-gen】

| Step           | 内容                                                                                                                     | コミット例                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| 2-A-1 Red      | `compare-grid.test.tsx` に T-CMP5/T-CMP6（非空で取得描画・空状態で未呼び出し、`getProductsByIds` を mock）を書き失敗確認 | `test(compare): add failing CompareGrid tests`         |
| 2-A-2 Green    | [design §2.2-2.3](./design.md) で page + grid を実装 → Green                                                             | `feat(compare): add /compare page and comparison grid` |
| 2-A-3 Refactor | 既存商品カード部品の流用で各セルを整える（任意）                                                                         | `refactor(compare): reuse product card for grid cells` |

### 2-B.（任意）Add to compare ボタン

- [ ] 最小実装する場合: 既存商品カードに `addToCompare(variantId)` ボタンを追加（**別コミット**・follow-up 可）。

## Phase 3: 品質 + 同期

### 3-A. 品質チェック　【SKILL: test-complete】

- [ ] `bun run lint` / `bunx tsc --noEmit` / `bun run test` + `bun run build`。全緑後コミット。

### 3-B. ドキュメント同期　【SKILL: spec-sync-after-test】

- [ ] テスト数変動 → `QA_HANDOFF.md`（SSOT）→ `07-testing.md`/`COVERAGE_REPORT.md`/`docs/PROGRESS.md` 伝播。
- [ ] `04-interfaces.md`（`/compare`）/ `05-workflows.md`（比較フロー）を同期。
- [ ] `bun run coverage:dashboard` 再生成。**ドキュメント同期コミット**（実装と別）。
- コミット例: `docs: sync compare stats and regenerate dashboard`

### 3-C. 最終ドリフト確認　【SKILL: spec-sync-check・任意】

- [ ] [spec-sync-check](../../../.claude/skills/spec-sync-check/)（報告のみ）。

---

## レビュー必須ポイント（着手前に確認）

- [ ] `getProductsByIds` を items 空で呼んでいないか（throw 回避）。
- [ ] ストアが `useCartStore` と同型・テストが同階層か。
- [ ] グリッドが client 部品で、page 側で localStorage を読んでいない（hydration 安全）か。
- [ ] スペック比較は任意拡張として MVP から切り出しているか。

---

## コミット分割サマリー（rule 02 準拠）

| コミット | 種別     | 内容                                                   |
| -------- | -------- | ------------------------------------------------------ |
| 1        | test     | useCompareStore テスト（Red）                          |
| 2        | feat     | useCompareStore 実装（Green）                          |
| 3        | test     | CompareGrid テスト（Red）                              |
| 4        | feat     | page + grid（Green）                                   |
| 5        | refactor | 商品カード流用（任意）                                 |
| 6        | docs     | spec-sync + dashboard 再生成（統計同期は単独コミット） |

> 各コミットは単独で `bunx tsc --noEmit` 通過。複数フェーズ混在の巨大コミット禁止（rule 02 NEVER）。
