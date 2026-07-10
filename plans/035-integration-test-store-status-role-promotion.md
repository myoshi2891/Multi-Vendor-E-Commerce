# Plan 035: `updateStoreStatus` の PENDING→ACTIVE ロール昇格遷移を実 DB 統合テストで固定する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 1750ef2..HEAD -- src/queries/store.ts tests/integration/`
> If any in-scope/referenced file changed since this plan was written, compare
> the "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **前提チェック（Step 0）**: 本プランは Docker（testcontainers）必須。
> `docker info` が失敗する環境では **STOP**（`plans/README.md` の status 列に
> `BLOCKED (Docker unavailable)` と記録して終了）。

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW（テスト新設のみ。`src/` 本体は 1 行も変更しない）
- **Depends on**: none（他プランと完全独立・並行可）
- **Category**: tests
- **Planned at**: commit `1750ef2`, 2026-07-11
- **出典 finding**: TESTS-19（`plans/audit/findings-13-integration-coverage.md`）

## Why this matters

`updateStoreStatus` は店舗承認（PENDING → ACTIVE）と同時に**店舗オーナーのロールを
USER → SELLER に昇格**させる。ロール昇格は**権限境界の変更**であり、条件（PENDING 起点の
ACTIVE 遷移のみ）を外れて発火すると seller ダッシュボードへのアクセス権が不正に付与される
Trust & Safety 上の欠陥になる。unit テスト（`src/queries/store.test.ts:1464-`）は認可エラーが
中心で、「非 PENDING 起点では昇格しない」「$transaction で status 更新と昇格が原子的に行われる」
という遷移条件の実 DB セマンティクスは未検証。Round 2/3 の spike 016（出品審査）/
022（セラー自動措置）はこの関数の遷移を土台にするため、先に現仕様を固定しておく価値が高い。

## Current state

- `src/queries/store.ts` — 検証対象。**変更しない。** `updateStoreStatus`（`:531-601`）:
  - 認可（`:536-544`）: `currentUser()` + **インライン** role チェック
    （`user.privateMetadata.role !== "ADMIN"` → `"Only admins can perform this action."` throw。
    ※ auth-guards の `requireAdmin` ではなく歴史的なインライン実装 — 挙動は同一）
  - 店舗存在チェック（`:547-556`）: `db.store.findUnique` → 無ければ `"Store not found."` throw
  - **本体（`:558-582`）**:

```typescript
// ステータス更新とロール昇格をアトミックに実行
const updatedStore = await db.$transaction(async (tx) => {
    const updated = await tx.store.update({
        where: { id: storeId },
        data: { status },
    });

    // PENDING → ACTIVE 遷移時にユーザーロールを SELLER に昇格
    if (store.status === "PENDING" && updated.status === "ACTIVE") {
        await tx.user.update({
            where: { id: updated.userId },
            data: { role: "SELLER" },
        });
    }

    return updated;
});

// Clerk メタデータ同期（ACTIVE ステータスへの遷移時、冪等操作でリトライ可能）
if (updatedStore.status === "ACTIVE") {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(updatedStore.userId, {
        privateMetadata: { role: "SELLER" },
    });
}
```

  - 戻り値: `updatedStore.status`
- **enum**（`prisma/schema.prisma`）: `StoreStatus = PENDING | ACTIVE | BANNED | DISABLED`、
  `User.role: Role @default(USER)`（`USER | ADMIN | SELLER`）
- **Clerk モック**: `clerkClient` は **`await import("@clerk/nextjs/server")` の動的 import**
  で取得される（`:585`）が、jest のモジュールモックは動的 import にも適用される。
  ファイル冒頭で以下の形にする:

```typescript
const mockUpdateUserMetadata = jest.fn();
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
    clerkClient: jest.fn().mockResolvedValue({
        users: { updateUserMetadata: (...args: unknown[]) => mockUpdateUserMetadata(...args) },
    }),
}));
```

  ADMIN 認証は `currentUser` を
  `{ id: "admin-integration", privateMetadata: { role: "ADMIN" } }` に resolve させる
  （既存の `tests/integration/order-placement.test.ts:31-33,67-69` と同パターン）。
- **テスト基盤**: `getTestDb` / `disconnectTestDb`（`tests/integration/setup/db.ts`）、
  `resetDb`（`setup/reset-db.ts` — Store / User は TRUNCATE 対象済み）、
  `seedUser` / `seedStore`（`setup/seed.ts`）。`seedStore` は
  `overrides?: Partial<Prisma.StoreUncheckedCreateInput>` を受けるため
  **`overrides: { status: StoreStatus.PENDING }` で PENDING 店舗を作れる**（デフォルトは ACTIVE —
  `seed.ts:113-133`）。seed ヘルパーの変更は不要。
- **構造の手本**: `tests/integration/order-placement.test.ts`（mock + lifecycle + 副作用検証）。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Docker 確認 | `docker info` | exit 0（失敗なら STOP） |
| 統合テスト全体 | `bun run test:integration` | 全 pass |
| 単一ファイル | `bun run test:integration -- tests/integration/store-status.test.ts` | all pass |
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| unit 回帰 | `bun run test` | 全 pass（集計不変のはず） |

## Scope

**In scope**（変更してよいファイル）:
- `tests/integration/store-status.test.ts` — **新規作成**

**Out of scope**（触らない）:
- `src/queries/store.ts` — 検証対象本体。**インライン認可を `requireAdmin` へ移行する
  リファクタも行わない**（tech.md の「新規追加禁止」規約は既存コードの即時移行を求めていない。
  バグ発見時は STOP して報告）
- `src/queries/store.test.ts`（unit テスト）
- `tests/integration/setup/`（seed ヘルパー変更不要）
- Clerk 実 API との疎通（`updateUserMetadata` はモックで呼び出し引数のみ検証）

## Git workflow

- 現行ブランチ `dev` 上で作業してよい。コミット規律は `.claude/rules/02-tdd-step-commit.md`:
  テストファイル新設で 1 コミット（例: `test(integration): add store status role promotion scenarios`）、
  docs 同期は別コミット。push / PR はオペレーターの指示があるまで行わない。

## Steps

### Step 1: drift check とベースライン確認

冒頭の Drift check 実行 → `bun run test:integration` 全 pass 確認。

**Verify**: `bun run test:integration` → 全 pass

### Step 2: `tests/integration/store-status.test.ts` を新設

ファイル冒頭 JSDoc に検証境界（遷移条件付きロール昇格・tx 原子性・Clerk 同期の発火条件）と
ADR-004 参照を記載。モックは Current state 記載の `@clerk/nextjs/server`（currentUser +
clerkClient）のみ。`beforeEach` で `resetDb` + `mockReset`。

共通 Arrange: `seedUser`（店舗オーナー — `role` は seed デフォルトの USER であること
を前提に assert で確認）→ `seedStore(db, { userId: owner.id, overrides: { status: StoreStatus.PENDING } })`。

シナリオ:

1. **PENDING → ACTIVE で SELLER 昇格 + Clerk 同期**:
   `updateStoreStatus(store.id, "ACTIVE")` → 戻り値 `"ACTIVE"`。DB assert:
   Store.status === "ACTIVE"、**User.role === "SELLER"**。
   Clerk assert: `mockUpdateUserMetadata` が `(owner.id, { privateMetadata: { role: "SELLER" } })`
   で 1 回呼ばれた
2. **PENDING → BANNED は昇格しない**:
   戻り値 `"BANNED"`、Store.status === "BANNED"、**User.role === "USER" のまま**、
   `mockUpdateUserMetadata` 未呼び出し
3. **非 PENDING 起点（DISABLED → ACTIVE）は昇格しない・Clerk 同期は走る**:
   `overrides: { status: StoreStatus.DISABLED }` で seed →
   `updateStoreStatus(store.id, "ACTIVE")` → Store.status === "ACTIVE"、
   **User.role === "USER" のまま**（DB 昇格は PENDING 起点限定）、
   `mockUpdateUserMetadata` は **1 回呼ばれる**（`:584` の条件は `updatedStore.status === "ACTIVE"`
   のみ — DB 昇格条件と Clerk 同期条件が異なるという現仕様の固定。
   ※ この非対称が意図かどうかは本プランでは判定しない — Maintenance notes 参照）
4. **ACTIVE → ACTIVE 再実行の冪等性**: シナリオ 1 の後に再度 `"ACTIVE"` で呼ぶ →
   throw せず、User.role は SELLER のまま（再昇格なし = `store.status`（更新前読取）が
   ACTIVE なので昇格分岐に入らない）
5. **存在しない storeId**: `/Store not found/` で reject、User テーブル無変化
6. **認可**: `currentUser` を `{ id: "u", privateMetadata: { role: "USER" } }` にして
   `/Only admins can perform this action/` で reject + Store.status 不変。
   `currentUser` null で `/Unauthenticated/` も 1 テスト

**Verify**: `bun run test:integration -- tests/integration/store-status.test.ts` → all pass

### Step 3: 全体回帰

**Verify**:
1. `bun run test:integration` → 既存 + 新規（6〜8 テスト目安）全 pass
2. `bunx tsc --noEmit` → exit 0
3. `bun run lint` → exit 0
4. `bun run test` → unit 全 pass（集計不変）

## Test plan

Step 2 のシナリオ 1〜6 が本体。構造の手本は `tests/integration/order-placement.test.ts`。
完了後、テスト統計が変わるため **`spec-sync-after-test` skill を必ず起動**
（`.claude/rules/02-tdd-step-commit.md` の MUST）。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run test:integration` exits 0; `store-status.test.ts` の新規テストが全 pass
- [ ] シナリオ 2 / 3 に「User.role が USER のまま」の assert が存在する
- [ ] `bunx tsc --noEmit` exits 0 / `bun run lint` exits 0 / `bun run test` exits 0（集計不変）
- [ ] `git status` で in-scope 外のファイルに変更がない
- [ ] docs 同期（QA_HANDOFF 統計 + ダッシュボード再生成）が別コミットで完了
- [ ] `plans/README.md` の 035 行が DONE に更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- `docker info` が失敗する（→ `BLOCKED (Docker unavailable)`）
- Drift check で `store.ts:558-590` が本プランの抜粋と一致しない
- シナリオ 2 / 3 で User.role が SELLER に変わる（昇格条件のバグ = 権限境界の欠陥）—
  **セキュリティ関連の本体バグ**。即 STOP して報告（テストの合わせ込み禁止）
- `clerkClient` の動的 import がモックを迂回して実モジュールに到達する
  （テスト実行時に Clerk のネットワーク呼び出しやキー検証エラーが出る場合）
- 検証コマンドが 2 回の修正試行後も失敗する

## Maintenance notes

- シナリオ 3 で固定した**非対称**（DB のロール昇格は PENDING 起点限定・Clerk メタデータ同期は
  「結果が ACTIVE」なら毎回）は現実装の忠実な写しであり、意図的かは不明。spike 016
  （出品審査ワークフロー）の設計時にこの非対称を仕様として確定 or 解消すべき — 変更されたら
  本テストのシナリオ 3 期待値を追従させる。
- `updateStoreStatus` の認可はインライン実装（auth-guards 移行前の残存）。plan 002
  （Store フィールド allowlist）や将来の auth-guards 統一リファクタで `requireAdmin()` に
  置換された場合もエラーメッセージは同一のため本テストは緑のまま — 想定どおり。
- BANNED / DISABLED からの降格時に SELLER ロールを剥奪する処理は現状**存在しない**
  （spike 022 の自動措置設計と接続する将来課題。本プランではテストしない）。
