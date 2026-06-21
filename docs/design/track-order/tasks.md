# Track Order — 実装タスク（tasks.md）

> [.claude/rules/02-tdd-step-commit.md](../../../.claude/rules/02-tdd-step-commit.md) 準拠。各タスクを **Red → Green → Refactor** とコミット粒度に分解する。
> 要件 ID は [requirements.md](./requirements.md)、設計詳細は [design.md](./design.md)。進捗は [PROGRESS.md](./PROGRESS.md)。

---

## 0. 実装前チェック（必須・SKILL 呼び出し漏れ防止）

- [ ] **[feature-plan](../../../.claude/skills/feature-plan/) を起動**し、本設計書を入力に最終計画化・**ユーザー承認**を取得（コード着手前・必須）。
- [ ] 新規コードに `any` 禁止（戻り値型は `Awaited<ReturnType<typeof trackOrder>>` で推論）。`console.log` 禁止。email/orderId をログしない。
- [ ] `trackOrder` に認可ガードを**付けない**（公開・[design §判断3](./design.md)）。
- [ ] 不一致と不存在を**同一応答**にする（IDOR/列挙防止・[design §判断2](./design.md)）。
- [ ] `force-dynamic` は付与しない（page は client フォーム・DB 読取は action 内）。
- [ ] **safe-migration は不要**（schema 変更なし）。**server-action-scaffold** は既存ファイルへの追加のため任意（雛形が欲しければ起動）。
- [ ] **完了の定義**: [test-complete](../../../.claude/skills/test-complete/)（lint/tsc/test）+ `bun run build`。
- [ ] テスト数変動 → [spec-sync-after-test](../../../.claude/skills/spec-sync-after-test/) + `bun run coverage:dashboard`（**同一コミット**）。

---

## SKILL シーケンス（本機能・俯瞰）

```
0. feature-plan         本設計書を入力に最終計画化・承認取得（必須）
1. test-gen             ユニット（IDOR 3 階層含む）+ コンポーネント（Red→Green）
2. test-complete        lint/tsc/test（各コミット前・必須）
3. spec-sync-after-test テスト数変動 → QA_HANDOFF(SSOT)→伝播 + dashboard 再生成（同一コミット）
4. spec-sync-check      最終ドリフト確認（任意）
```

---

## Phase 1: server action + Zod

### 1-A. Zod スキーマ

| Step  | 内容                                                             | コミット例                           |
| ----- | ---------------------------------------------------------------- | ------------------------------------ |
| 1-A-1 | `schemas.ts` に `TrackOrderSchema`（[design §2.1](./design.md)） | `feat(schema): add TrackOrderSchema` |

### 1-B. `trackOrder`（TDD・IDOR 3 階層）　【SKILL: test-gen】

| Step        | 内容                                                                                                                  | コミット例                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1-B-1 Red   | `order.test.ts` に T-TO1〜T-TO6（一致返却 / 不一致 null / where 構造 / 副作用なし / 不存在 / 不正入力）を書き失敗確認 | `test(order): add failing trackOrder IDOR tests` |
| 1-B-2 Green | [design §2.2](./design.md) で `order.ts` に `trackOrder` を追加 → Green                                               | `feat(order): add public trackOrder lookup`      |

> IDOR テストは 3 階層（(a) スロー / (b) where 構造 / (c) 副作用なし）を必ず満たす（[SECURITY_GAP_REPORT.md §5.2](../../testing/SECURITY_GAP_REPORT.md)）。

## Phase 2: UI

### 2-A. 結果表示部品の既存流用調査

- [ ] `src/app/(store)/order/[orderId]/` のステータス表示部品が流用可能か調査し、design §1.2 に追記。

### 2-B. フォーム + 結果表示（TDD）　【SKILL: test-gen】

| Step           | 内容                                                                                                       | コミット例                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 2-B-1 Red      | `track-order-form.test.tsx` に T-TO7/T-TO8（未入力エラー・一致時描画、`trackOrder` を mock）を書き失敗確認 | `test(track-order): add failing form tests`                |
| 2-B-2 Green    | [design §2.3-2.5](./design.md) で page + form + result を実装 → Green                                      | `feat(track-order): add /track-order page and result view` |
| 2-B-3 Refactor | 既存注文表示部品の流用で重複を削減（任意）                                                                 | `refactor(track-order): reuse order status components`     |

## Phase 3: 品質 + 同期

### 3-A. 品質チェック　【SKILL: test-complete】

- [ ] `bun run lint` / `bunx tsc --noEmit` / `bun run test` + `bun run build`。全緑後コミット。

### 3-B. ドキュメント同期　【SKILL: spec-sync-after-test】

- [ ] テスト数変動 → `QA_HANDOFF.md`（SSOT）→ `07-testing.md`/`COVERAGE_REPORT.md`/`docs/PROGRESS.md` 伝播。
- [ ] `04-interfaces.md`（`/track-order` + `trackOrder`）/ `05-workflows.md`（追跡フロー）/ `06-quality.md`（IDOR）を同期。
- [ ] `bun run coverage:dashboard` 再生成。**ドキュメント同期コミット**（実装と別）。
- コミット例: `docs: sync track-order stats and regenerate dashboard`

### 3-C. 最終ドリフト確認　【SKILL: spec-sync-check・任意】

- [ ] [spec-sync-check](../../../.claude/skills/spec-sync-check/)（報告のみ）。

---

## レビュー必須ポイント（着手前に確認）

- [ ] 不一致と不存在が**同一応答**か（列挙防止）。
- [ ] `where` が `{ id: orderId }`、email 照合は取得後アプリ層か。
- [ ] 戻り値から `user`（email）を除去しているか。ログに PII を含めないか。
- [ ] 公開アクション（認可ガード無し）か。既存 `getOrder` を壊していないか。

---

## コミット分割サマリー（rule 02 準拠）

| コミット | 種別         | 内容                                                   |
| -------- | ------------ | ------------------------------------------------------ |
| 1        | feat(schema) | TrackOrderSchema                                       |
| 2        | test         | trackOrder IDOR テスト（Red）                          |
| 3        | feat         | trackOrder 実装（Green）                               |
| 4        | test         | track-order-form テスト（Red）                         |
| 5        | feat         | page + form + result（Green）                          |
| 6        | refactor     | 既存表示部品の流用（任意）                             |
| 7        | docs         | spec-sync + dashboard 再生成（統計同期は単独コミット） |

> 各コミットは単独で `bunx tsc --noEmit` 通過。複数フェーズ混在の巨大コミット禁止（rule 02 NEVER）。
