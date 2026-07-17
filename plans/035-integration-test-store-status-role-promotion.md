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

   > **TODO(needs-detail)**: 「DB 昇格なし + Clerk 同期あり」の非対称が**仕様かバグか**は
   > 未確定であり、本シナリオの期待値はそれ次第で反転する。
   > - **仕様の場合**: 現行の期待値（role は USER のまま / Clerk は 1 回呼ばれる）を維持し、
   >   characterization ではなく契約として扱う。
   > - **バグの場合**: 本シナリオは**既知バグの characterization** であり、修正時
   >   （Clerk 同期も PENDING 起点限定にする等）に期待値を
   >   `mockUpdateUserMetadata` 未呼び出しへ**反転**させる。
   >
   > オペレーターはテストを書く前にこの判定をユーザーへ確認すること。判定が得られない場合は
   > シナリオ 3 に「非対称は未判定。修正時に期待値反転の可能性あり」のコメントを
   > テストファイル内へ明記した上で進める（合わせ込みの既成事実化を防ぐため）。
   > 判定先の候補: spike 016（出品審査ワークフロー）の設計 — Maintenance notes 参照。
4. **ACTIVE → ACTIVE 再実行の冪等性**: シナリオ 1 の後に再度 `"ACTIVE"` で呼ぶ →
   throw せず、User.role は SELLER のまま（再昇格なし = `store.status`（更新前読取）が
   ACTIVE なので昇格分岐に入らない）。
   **Clerk 同期の回数も assert する**: `:584` の条件は `updatedStore.status === "ACTIVE"` のみで
   起点ステータスを見ないため、再実行でも Clerk 同期は**もう一度発火する**。
   シナリオ 1 の呼び出しと合わせ `mockUpdateUserMetadata` は **累計 2 回**呼ばれ、
   2 回目も引数は `(owner.id, { privateMetadata: { role: "SELLER" } })`
   （`beforeEach` の `mockReset` 後に 2 回呼ぶ構成なら `toHaveBeenCalledTimes(2)`）。
   > 回数 assert を置かないと「冪等 = 何も起きない」と誤読され、Clerk への重複呼び出しが
   > 無検証で残る。ここで固定するのは「DB 状態は冪等だが Clerk 呼び出しは冪等ではない
   > （同一値の再送なので結果は同じ）」という現仕様。
5. **存在しない storeId**: `/Store not found/` で reject、User テーブル無変化
6. **認可**: `currentUser` を `{ id: "u", privateMetadata: { role: "USER" } }` にして
   `/Only admins can perform this action/` で reject + Store.status 不変。
   `currentUser` null で `/Unauthenticated/` も 1 テスト
7. **`$transaction` の原子性（後段失敗で前段もロールバック）**:
   シナリオ 1〜4 は「両方成功した」ことしか示さない。`store.update` と `user.update` が
   **本当に同一 tx か**は、後段（`user.update`）だけを失敗させて
   前段（`store.update`）が巻き戻ることを示さない限り実証できない。

   **失敗注入の手段**（実スキーマに基づく）: `prisma/schema.prisma:110` の
   `user User @relation("UserStores", fields: [userId], references: [id])` は
   **`onDelete` を指定しておらず、必須リレーションの既定は `Restrict`**。
   したがって「オーナー User を事前に削除して `user.update` を P2025 にする」ことは
   **できない**（Store が存在する限り User の削除自体が FK 制約で拒否される）。
   また統合テストは `src/lib/db.ts` のシングルトンをモックせず実 DB を共有するため
   （`tests/integration/setup/db.ts` は別インスタンスを生成するだけ）、
   `tx.user.update` を jest の spy で差し替えることもできない。

   代わりに **テスト内 DDL で一時的な CHECK 制約**を張り、tx 内の `user.update` のみを
   決定論的に失敗させる:

```typescript
// Arrange: PENDING 店舗 + role=USER のオーナー（共通 Arrange のまま）
// role を SELLER に更新しようとすると必ず失敗する制約を張る
await db.$executeRawUnsafe(
    `ALTER TABLE "User" ADD CONSTRAINT "tmp_block_seller" CHECK ("role" <> 'SELLER')`
);
try {
    // Act + Assert: PENDING -> ACTIVE は後段 user.update で弾かれ tx 全体が失敗する
    await expect(updateStoreStatus(store.id, "ACTIVE")).rejects.toThrow();

    // Assert: 前段の store.update がロールバックされている（原子性の本体）
    const after = await db.store.findUniqueOrThrow({ where: { id: store.id } });
    expect(after.status).toBe("PENDING");           // ACTIVE になっていない
    const ownerAfter = await db.user.findUniqueOrThrow({ where: { id: owner.id } });
    expect(ownerAfter.role).toBe("USER");           // 昇格もされていない
    // tx が throw するため Clerk 同期（tx 外・:584）には到達しない
    expect(mockUpdateUserMetadata).not.toHaveBeenCalled();
} finally {
    // 制約は必ず落とす（後続テストへ漏らさない）
    await db.$executeRawUnsafe(`ALTER TABLE "User" DROP CONSTRAINT "tmp_block_seller"`);
}
```

   > 注意: 制約の DROP は `finally` で必ず実行する（assert 失敗時に残すと後続テストが
   > 巻き添えで落ちる）。`resetDb` は TRUNCATE でありテーブル制約は落とさない。
   > このシナリオは `prisma/schema.prisma` を変更しない（DDL はテスト内で張って落とすだけ）。
   > このケースが green になることで初めて、シナリオ 1 の「status 更新 + 昇格」が
   > **たまたま両方成功した**のではなく**原子的**であることが実証される。

**Verify**: `bun run test:integration -- tests/integration/store-status.test.ts` → all pass

### Step 3: 全体回帰

**Verify**:
1. `bun run test:integration` → 既存 + 新規（7〜9 テスト目安）全 pass
2. `bunx tsc --noEmit` → exit 0
3. `bun run lint` → exit 0
4. `bun run test` → unit 全 pass（集計不変）
5. 原子性シナリオ（7）の実行後に `tmp_block_seller` 制約が残っていないこと:
   `bun run test:integration -- tests/integration/store-status.test.ts` を**2 回連続**で
   実行して 2 回とも全 pass（制約の後始末漏れは 2 回目で顕在化する）

## Test plan

Step 2 のシナリオ 1〜7 が本体。構造の手本は `tests/integration/order-placement.test.ts`。
完了後、テスト統計が変わるため **`spec-sync-after-test` skill を必ず起動**
（`.claude/rules/02-tdd-step-commit.md` の MUST）。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run test:integration` exits 0; `store-status.test.ts` の新規テストが全 pass
- [ ] シナリオ 2 / 3 に「User.role が USER のまま」の assert が存在する
- [ ] シナリオ 4 に `mockUpdateUserMetadata` の**呼び出し回数** assert が存在する
- [ ] シナリオ 7（tx 原子性）に「Store.status が PENDING のままロールバック」の assert が存在し、
      一時 CHECK 制約が `finally` で DROP されている
- [ ] 同一ファイルを 2 回連続実行して 2 回とも pass（DDL の後始末漏れが無い）
- [ ] `bunx tsc --noEmit` exits 0 / `bun run lint` exits 0 / `bun run test` exits 0（集計不変）
- [ ] **コードコミットの直前**で、`git status` に in-scope 外の変更がない（プラン index の更新と `spec-sync-after-test` の docs 同期は、後続の別コミット）
- [ ] docs 同期（QA_HANDOFF 統計 + ダッシュボード再生成）が別コミットで完了
- [ ] `plans/README.md` の 035 行が DONE に更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- `docker info` が失敗する（→ `BLOCKED (Docker unavailable)`）
- Drift check で `store.ts:558-590` が本プランの抜粋と一致しない
- シナリオ 2 / 3 で User.role が SELLER に変わる（昇格条件のバグ = 権限境界の欠陥）—
  **セキュリティ関連の本体バグ**。即 STOP して報告（テストの合わせ込み禁止）
- シナリオ 7 で `user.update` が失敗したのに Store.status が ACTIVE のまま残る
  （＝ status 更新とロール昇格が原子的でない）— **本体バグ**。期待値を実測値に
  合わせ込まず、そのまま報告する
- シナリオ 7 の一時 CHECK 制約が付与できない、または DROP に失敗して後続テストが汚染される
  （テスト用 DB ロールの DDL 権限を確認し、それでも不可なら STOP して報告）
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
