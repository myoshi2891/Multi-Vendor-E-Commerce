# Profile Messages — 実装タスク（tasks.md）

> [.claude/rules/02-tdd-step-commit.md](../../../.claude/rules/02-tdd-step-commit.md) 準拠。各タスクを **Red → Green → Refactor** とコミット粒度に分解する。
> [.claude/rules/03-data-model-diagram-sync.md](../../../.claude/rules/03-data-model-diagram-sync.md) 準拠（schema 変更 → ERD 再生成を同一コミット）。
> 要件 ID は [requirements.md](./requirements.md)、設計詳細は [design.md](./design.md)、進捗は [PROGRESS.md](./PROGRESS.md)。

---

## 0. 実装前チェック（全フェーズ共通・SKILL 呼び出し漏れ防止）

> **各フェーズで呼ぶ SKILL を Step に再掲する。チェックが埋まらないままコミットしないこと。**

- [ ] **[feature-plan](../../../.claude/skills/feature-plan/) を起動**し、本設計書を入力に最終計画化・**ユーザー承認**を取得（コード着手前・必須）。
- [ ] スキーマ変更は **[safe-migration](../../../.claude/skills/safe-migration/) 必須**（`db push` 禁止・[tech.md 禁止事項](../../../.claude/steering/tech.md)）。承認取得 → `migrate dev` → `bunx prisma generate`。
- [ ] schema 変更コミットに `bun run erd:generate` の `data-model.drawio` を**同梱**（rule 03）。
- [ ] 各 server action は冒頭で認可（`requireUser`/`requireStoreOwner`/`assertParticipant`）を **try の外**で実施（tech.md 認可ガード規約）。
- [ ] 各 server action は **[server-action-scaffold](../../../.claude/skills/server-action-scaffold/)** で雛形生成（実装 + Zod + テストを一括）。
- [ ] `src/queries/message.test.ts` に **AAA**で正常系/異常系。**IDOR は 3階層**（[SECURITY_GAP_REPORT.md §5.2](../../testing/SECURITY_GAP_REPORT.md)）: (a)スロー検証 / (b)`where`/引数構造検証 / (c)副作用なし検証。
- [ ] DB 依存 `page.tsx` は `export const dynamic='force-dynamic';` を import 直後に宣言（NFR-M4）。
- [ ] `any` 禁止（`unknown` + 型ガード）。`console.log` 禁止（`[Message:Fn]` 構造化 `console.error`）。複数テーブル更新は `db.$transaction`（NFR-M2）。
- [ ] **完了の定義**: [test-complete](../../../.claude/skills/test-complete/)（lint / tsc / test）通過 + `bun run build` 成功。
- [ ] テスト数 / スイート数が変動したら [spec-sync-after-test](../../../.claude/skills/spec-sync-after-test/) → `bun run coverage:dashboard`（**同一コミット**で同期）。

---

## SKILL シーケンス（本機能・俯瞰）

```
0. feature-plan            本設計書を入力に最終計画化・承認取得（必須）
1. safe-migration          Conversation/Message 追加（migrate dev・非破壊） + erd:generate（rule 03）
2. server-action-scaffold  message.ts の各 action（実装+Zod+テスト雛形を一括）
3. test-gen                ユニットテスト補完。IDOR 3階層（getConversationMessages/sendMessage/markConversationRead）必須
4. test-complete           lint/tsc/test（各コミット前・必須）
5. spec-sync-after-test    テスト数変動 → QA_HANDOFF(SSOT) 伝播 + dashboard 再生成（同一コミット）。新規 action/page → 04-interfaces/05-workflows 同期
6. spec-sync-check         最終ドリフト確認
```

---

## フェーズ順（破壊性で並べる・schema を最初に隔離）

```
Phase 1: schema + migration（safe-migration・erd:generate）   ← 直列・最初
Phase 2: server actions + ユニットテスト（IDOR 3階層）
Phase 3: 購入者 UI（/profile/messages・ポーリング）
Phase 4: 販売者 UI（seller dashboard messages・ループ閉鎖）
Phase 5: E2E（購入者↔販売者往復）+ spec-sync
```

> **直列が必須の箇所**: Phase 1（schema）→ Phase 2（action）。schema が無いと action が型エラーになるため並列不可。Phase 3/4 は Phase 2 完了後に型合意して並列着手可。

---

## Phase 1: スキーマ + マイグレーション　【SKILL: safe-migration + erd:generate】

| Step | 内容 | コミット例 |
|------|------|-----------|
| 1-1 | [safe-migration](../../../.claude/skills/safe-migration/) を起動し承認取得 → `prisma/schema.prisma` に `Conversation`/`Message` + User/Store/Order 逆リレーション追加（[design §2](./design.md#2-データモデルschema-変更safe-migration)） | — |
| 1-2 | `bunx prisma migrate dev --name add_conversation_message` → `bunx prisma generate` | — |
| 1-3 | `bun run erd:generate` で `data-model.drawio` 再生成 + `generate-erd.ts` の `PAGES` に新モデル分類（orphan WARNING ゼロ確認・rule 03） | `feat(db): add Conversation/Message models and regenerate ERD` |

> **コミット同梱**: schema + migration + `data-model.drawio`（+ `generate-erd.ts` 分類）を**同一コミット**（rule 03）。この時点で `bunx tsc --noEmit` 通過を確認。

---

## Phase 2: Server Actions + ユニットテスト　【SKILL: server-action-scaffold → test-gen】

> 対応要件: M-1〜M-6 / AC-M1〜M7。`server-action-scaffold` で各 action の実装+Zod+テスト雛形を生成し、`test-gen` でギャップ（特に IDOR）を埋める。

### 2-A. Zod スキーマ + 型

| Step | 内容 | コミット例 |
|------|------|-----------|
| 2-A-1 | `src/lib/schemas.ts` に `SendMessageSchema` / `StartConversationSchema` 追加（[design §3.3](./design.md#33-zod-スキーマsrclibschemasts-追加)） | `feat(schemas): add SendMessage and StartConversation schemas` |

### 2-B. 参加者ヘルパー + 取得系

| Step | 内容 | コミット例 |
|------|------|-----------|
| 2-B-1 Red | `getUserConversations` の非認証拒否テスト（`"Unauthenticated."`）→ 失敗確認（AC-M1） | `test(message): add failing auth test for getUserConversations` |
| 2-B-2 Green | `message.ts` に private `assertParticipant` + `getUserConversations`（`requireUser` + where userId）実装 → Green | `feat(message): add getUserConversations and participant guard` |
| 2-B-3 Green | `getStoreConversations`（`requireStoreOwner` + 非所有拒否テスト・AC-M2）実装 | `feat(message): add getStoreConversations with store-owner guard` |
| 2-B-4 Red→Green | `getConversationMessages`（`assertParticipant`）+ **IDOR 3階層テスト**（非参加者: (a)`"Forbidden: not a participant..."` スロー / (b)`findMany` が呼ばれない・引数構造 / (c)副作用なし）（AC-M3） | `feat(message): add getConversationMessages with IDOR guard` |

### 2-C. 送信・既読系

| Step | 内容 | コミット例 |
|------|------|-----------|
| 2-C-1 Red | `sendMessage` の Zod 異常（空/2001文字）+ 非参加者スローのテスト → 失敗確認（AC-M3/M4） | `test(message): add failing validation/IDOR tests for sendMessage` |
| 2-C-2 Green | `sendMessage`（`assertParticipant` + `$transaction`[create + update updatedAt]）実装（[design §3.2](./design.md#32-実装テンプレートsendmessage-例--他関数も同型)・AC-M6） | `feat(message): add sendMessage with atomic transaction` |
| 2-C-3 Green | `getOrCreateConversation`（`upsert` 複合キー・冪等テスト: 2回で1件・AC-M5） | `feat(message): add idempotent getOrCreateConversation` |
| 2-C-4 Red→Green | `markConversationRead`（`updateMany` 相手発のみ `senderId: { not }`・冪等・AC-M7） | `feat(message): add markConversationRead (peer-only, idempotent)` |
| 2-C-5 Refactor | 構造化監査ログ統一・重複モック整理 | `refactor(message): unify structured logs across message actions` |

### 2-D. 型 + 品質チェック

| Step | 内容 | コミット例 |
|------|------|-----------|
| 2-D-1 | `src/lib/types.ts` に `ConversationWithLatest` / `MessageType`（[design §3.4](./design.md#34-型srclibtypests-追加)） | `feat(types): add Conversation and Message types` |
| 2-D-2 | [test-complete](../../../.claude/skills/test-complete/)（lint/tsc/test + build）で全緑確認 | — |

- **テスト必須観点**: AC-M1/M2（認可）、AC-M3（IDOR 3階層・getConversationMessages/sendMessage/markConversationRead 各々）、AC-M4（Zod 境界）、AC-M5（冪等 upsert）、AC-M6（`$transaction` モック検証）、AC-M7（相手発のみ既読・再実行不変）。

---

## Phase 3: 購入者 UI（`/profile/messages`・ポーリング）　【SKILL: test-gen（コンポーネント）】

| Step | 内容 | コミット例 |
|------|------|-----------|
| 3-1 | `src/app/(store)/profile/messages/page.tsx`（`force-dynamic` + `getUserConversations` → container・[design §4.1](./design.md#41-顧客ページ-srcappstoreprofilemessagespagetsx)） | `feat(messages): add /profile/messages page` |
| 3-2 | `messages-container.tsx`（2ペイン + **ポーリング** cancelled パターン・`document.hidden` 停止・[design §4.2](./design.md#42-messages-containertsxuse-client2ペインポーリング)） | `feat(messages): add messages container with 5s polling` |
| 3-3 | `conversation-thread.tsx`（バブル左右振り分け + RHF composer + useRef リエントランシーガード・[design §4.3](./design.md#43-conversation-threadtsxバブル--composer)） | `feat(messages): add conversation thread and composer` |
| 3-4 | `sidebar.tsx` に Messages エントリ追加（[design §4.5](./design.md#45-導線)） | `feat(sidebar): add messages menu entry` |
| 3-5 | コンポーネントテスト（[test-gen](../../../.claude/skills/test-gen/)）: 一覧描画・送信で `sendMessage` 呼び出し・ポーリング interval | `test(messages): add container and thread component tests` |

> **コミット粒度**（rule 02）: page / container / thread / sidebar / test を**論理単位ごとに分割**。container と thread は相互依存が強い（同一 SUT）が、合計200行/3ファイルを超える場合は分割（PR で理由明記）。

---

## Phase 4: 販売者 UI（ループ閉鎖）　【SKILL: test-gen】

| Step | 内容 | コミット例 |
|------|------|-----------|
| 4-1 | `dashboard/seller/stores/[storeUrl]/messages/page.tsx`（`force-dynamic` + `getStoreConversations` ・[design §4.4](./design.md#44-販売者側-dashboardsellerstoresstoreurlmessagespagetsx)） | `feat(seller-messages): add seller dashboard messages page` |
| 4-2 | `seller-messages-container.tsx`（`conversation-thread.tsx` 流用・返信は共有 `sendMessage`） | `feat(seller-messages): add seller messages container` |
| 4-3 | コンポーネントテスト（一覧・返信） | `test(seller-messages): add seller messages tests` |

---

## Phase 5: E2E + ドキュメント同期　【SKILL: test-complete → spec-sync-after-test → spec-sync-check】

| Step | 内容 | 状態 | コミット |
|------|------|------|---------|
| 5-1 | [test-complete](../../../.claude/skills/test-complete/)（lint/tsc/test）全緑確認（1560 passed / 161 スイート・型エラー0） | ✅ | — |
| 5-2 | E2E（`tests/e2e/messages.spec.ts`）: 購入者送信 → 販売者返信 → 購入者ポーリング受信の往復（AC-M8）。2 browser context・Chromium 往復通過確認・3 ブラウザ対象 | ✅ | `ea89706` |
| 5-3 | [spec-sync-after-test](../../../.claude/skills/spec-sync-after-test/): `QA_HANDOFF.md`（SSOT）→ `07-testing.md`/`PROGRESS.md` 伝播（E2E スペック数 7→8・Jest 不変）。`04-interfaces.md`/`05-workflows.md` は Phase 2〜4 で同期済み。`bun run coverage:dashboard` 再生成。**統計同期は単独コミット** | ✅ | （本コミット） |
| 5-4 | [spec-sync-check](../../../.claude/skills/spec-sync-check/) で仕様↔実装・規約↔skill ドリフト確認（報告のみ） | ✅ | — |

---

## レビュー必須ポイント（着手前に確認）

- [ ] 会話一意キー `(userId, storeId)` で MVP 要件を満たすか（注文ごと分離が必要なら `orderId` 含む・[design §判断3](./design.md#判断3-会話の一意キーを-userid-storeid-とする理由)）。
- [ ] ポーリング 5s 間隔が運用上妥当か（負荷・即時性のトレードオフ）。
- [ ] 販売者返信を seller dashboard に置く構成で E2E が成立するか。
- [ ] `assertParticipant` が取得/送信/既読の**全関数**で漏れなく呼ばれているか（IDOR）。

---

## コミット分割サマリー（rule 02 準拠・抜粋）

| フェーズ | 主要コミット | 種別 |
|---------|-------------|------|
| 1 | schema + migration + ERD 再生成（同一コミット・rule 03） | feat(db) |
| 2 | schemas → 各 action（Red/Green 分離）→ types → refactor | feat/test/refactor |
| 3 | page / container / thread / sidebar / test（論理単位分割） | feat/test |
| 4 | seller page / container / test | feat/test |
| 5 | E2E（独立）/ docs 同期（独立・dashboard 再生成同梱） | test/docs |

> 各コミットは単独で `bunx tsc --noEmit` 通過。複数フェーズ混在の巨大コミット禁止（rule 02 NEVER）。テストが Red のまま実装へ進まない。
