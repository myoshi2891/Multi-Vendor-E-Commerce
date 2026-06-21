# Support Forms — 実装タスク（tasks.md）

> [.claude/rules/02-tdd-step-commit.md](../../../.claude/rules/02-tdd-step-commit.md) 準拠。各タスクを **Red → Green → Refactor** とコミット粒度に分解する。
> 要件 ID は [requirements.md](./requirements.md)、設計詳細は [design.md](./design.md)。進捗は [PROGRESS.md](./PROGRESS.md)。

---

## 0. 実装前チェック（必須・SKILL 呼び出し漏れ防止）

- [ ] **[feature-plan](../../../.claude/skills/feature-plan/) を起動**し、本設計書を入力に最終計画化・**ユーザー承認**を取得（コード着手前・必須）。
- [ ] **[safe-migration](../../../.claude/skills/safe-migration/) を起動**して schema 変更（`db push` 禁止・`migrate dev`）。additive・非破壊であることを確認。
- [ ] schema 変更後 `bunx prisma generate` + `bun run erd:generate`（[rule 03](../../../.claude/rules/03-data-model-diagram-sync.md)）を**同一コミット**に。
- [ ] **[server-action-scaffold](../../../.claude/skills/server-action-scaffold/) を起動**して `createSupportTicket` 雛形を生成（try/catch + 構造化ログ）。
- [ ] 新規コードに `any` 禁止・`console.log` 禁止。PII（本文）をログしない。
- [ ] 送信に認可ガードを**付けない**（公開・[design §判断3](./design.md)）。ログイン時のみ `userId`。
- [ ] **完了の定義**: [test-complete](../../../.claude/skills/test-complete/)（lint/tsc/test）+ `bun run build`。
- [ ] テスト数変動 → [spec-sync-after-test](../../../.claude/skills/spec-sync-after-test/) + `bun run coverage:dashboard`（**同一コミット**）。

---

## SKILL シーケンス（本機能・俯瞰）

```
0. feature-plan            本設計書を入力に最終計画化・承認取得（必須）
1. safe-migration          SupportTicket モデル + enum（migrate dev）→ generate → erd:generate
2. server-action-scaffold  createSupportTicket 雛形（src/queries/support.ts）
3. test-gen                ユニット（作成/却下/userId）+ コンポーネント（描画/二重送信）+ user-menu 回帰
4. test-complete           lint/tsc/test（各コミット前・必須）
5. spec-sync-after-test    テスト数変動 → QA_HANDOFF(SSOT)→伝播 + dashboard 再生成（同一コミット）
6. spec-sync-check         最終ドリフト確認（任意）
```

---

## Phase 1: schema（SupportTicket）

### 1-A. モデル + enum + migration　【SKILL: safe-migration】

| Step  | 内容                                                                                                                             | コミット例                                             |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1-A-1 | [design §2.1](./design.md) の `SupportTicket` + `SupportTicketCategory` + `User`/`Order` 逆リレーションを `schema.prisma` に追加 | —                                                      |
| 1-A-2 | `safe-migration` で `migrate dev --name add_support_ticket` → `prisma generate`                                                  | —                                                      |
| 1-A-3 | `bun run erd:generate` で `data-model.drawio` 再生成（rule 03）                                                                  | `feat(db): add SupportTicket model and regenerate ERD` |

> schema + migration + ERD を**同一コミット**（rule 03 MUST）。

## Phase 2: Zod + server action

### 2-A. Zod スキーマ　【SKILL: test-gen】

| Step  | 内容                                                                                                   | コミット例                                                       |
| ----- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 2-A-1 | `schemas.ts` に `SupportTicketSchema`（[design §2.2](./design.md)・`superRefine` で orderId 条件必須） | `feat(schema): add SupportTicketSchema with conditional orderId` |

### 2-B. server action（TDD）　【SKILL: server-action-scaffold → test-gen】

| Step        | 内容                                                                                        | コミット例                                             |
| ----------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 2-B-1 Red   | `support.test.ts` に T-SF1〜T-SF4（作成/却下/userId 有無）を書き失敗確認                    | `test(support): add failing createSupportTicket tests` |
| 2-B-2 Green | `server-action-scaffold` で `support.ts` を生成し [design §2.3](./design.md) を実装 → Green | `feat(support): add createSupportTicket server action` |

## Phase 3: UI（フォーム 4 ページ + 導線）

### 3-A. 共有フォーム部品（TDD）　【SKILL: test-gen】

| Step        | 内容                                                                                                          | コミット例                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 3-A-1 Red   | `support-form.test.tsx` に T-SF5/T-SF6（必須検証・二重送信防止、`createSupportTicket` を mock）を書き失敗確認 | `test(support): add failing SupportForm tests`    |
| 3-A-2 Green | [design §2.4](./design.md) で `support-form.tsx` を実装 → Green                                               | `feat(support): add shared SupportForm component` |

### 3-B. 各ページ　【SKILL: test-gen】

| Step  | 内容                                                                                                         | コミット例                                                |
| ----- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| 3-B-1 | `contact` / `returns-exchange` / `dispute` / `report-problem` の page.tsx 追加（[design §2.5](./design.md)） | `feat(support): add contact/returns/dispute/report pages` |

> ページは「同一カテゴリ・3ファイル以下・200行未満」を満たす範囲で束ねる（rule 02）。超える場合は分割。

### 3-C. 導線配線（user-menu・回帰）　【SKILL: test-gen】

| Step        | 内容                                                                                                                              | コミット例                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 3-C-1 Red   | user-menu の Return&Refund→`/returns-exchange`・Dispute→`/dispute`・Report→`/report-problem` 期待値テスト（現状 `""`/`/` で失敗） | `test(user-menu): add failing support link regression` |
| 3-C-2 Green | [design §2.6](./design.md) の diff で 3 行修正（Discounts 行は触らない） → Green                                                  | `fix(user-menu): wire returns/dispute/report links`    |

## Phase 4: 品質 + 同期

### 4-A. 品質チェック　【SKILL: test-complete】

- [ ] `bun run lint` / `bunx tsc --noEmit` / `bun run test` + `bun run build`。全緑後コミット。

### 4-B. ドキュメント同期　【SKILL: spec-sync-after-test】

- [ ] テスト数変動 → `QA_HANDOFF.md`（SSOT）→ `07-testing.md`/`COVERAGE_REPORT.md`/`docs/PROGRESS.md` 伝播。
- [ ] `04-interfaces.md`（新ルート + server action `createSupportTicket`）/ `05-workflows.md`（送信フロー）/ `03-data-model.md`（SupportTicket）を同期。
- [ ] `bun run coverage:dashboard` 再生成。**ドキュメント同期コミット**（実装と別）。
- コミット例: `docs: sync support-forms stats, schema and regenerate dashboard`

### 4-C. 最終ドリフト確認　【SKILL: spec-sync-check・任意】

- [ ] [spec-sync-check](../../../.claude/skills/spec-sync-check/)（報告のみ）。

---

## レビュー必須ポイント（着手前に確認）

- [ ] migration が **additive・非破壊**（既存列の変更/削除が無い）か。
- [ ] 送信に認可ガードを付けていない（公開）か。ログイン時のみ `userId` か。
- [ ] PII（本文）をログに含めていないか。
- [ ] user-menu の **Discounts & Offers 行を触っていない**か（offers 設計書が担当）。
- [ ] `orderId` 条件必須が Zod `superRefine` で表現され、DB は nullable か。

---

## コミット分割サマリー（rule 02 / rule 03 準拠）

| コミット | 種別         | 内容                                                          |
| -------- | ------------ | ------------------------------------------------------------- |
| 1        | feat(db)     | SupportTicket モデル + migration + ERD 再生成（同一コミット） |
| 2        | feat(schema) | SupportTicketSchema（Zod）                                    |
| 3        | test         | createSupportTicket テスト（Red）                             |
| 4        | feat         | createSupportTicket 実装（Green）                             |
| 5        | test         | SupportForm テスト（Red）                                     |
| 6        | feat         | SupportForm 実装（Green）                                     |
| 7        | feat         | 4 フォームページ                                              |
| 8        | test         | user-menu リンク回帰（Red）                                   |
| 9        | fix          | user-menu 配線（Green）                                       |
| 10       | docs         | spec-sync + dashboard 再生成（統計同期は単独コミット）        |

> 各コミットは単独で `bunx tsc --noEmit` 通過。複数フェーズ混在の巨大コミット禁止（rule 02 NEVER）。
