# Plan 037: `upsertShippingAddress` の default フラグ不変条件を実 DB 統合テストで固定する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4ec6b5b..HEAD -- src/queries/user.ts tests/integration/`
> If any in-scope/referenced file changed since this plan was written, compare
> the "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **前提チェック（Step 0）**: 本プランは Docker（testcontainers）必須。
> `docker info` が失敗する環境では **STOP**（`plans/README.md` の status 列に
> `BLOCKED (Docker unavailable)` と記録して終了）。

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW（テスト新設のみ。`src/` 本体は 1 行も変更しない）
- **Depends on**: none（他プランと完全独立・並行可）
- **Category**: tests
- **Planned at**: commit `4ec6b5b`, 2026-07-11
- **出典 finding**: TESTS-21（`plans/audit/findings-14-integration-coverage-r6.md`）

## Why this matters

checkout の配送先自動選択は `addresses.find((address) => address.default)`
（`src/components/store/shared/shipping-addresses/address.list.tsx:21`）で**最初の default を
採用**する。したがって「1 ユーザーにつき default は最大 1 件」という不変条件が壊れると、
**配送先の自動選択が並び順依存の非決定になる**（意図しない住所への配送リスク）。
現実装は、①既存住所を default に更新する経路では他住所の default を解除するが、
②**新規住所を default 付きで作成する経路では解除がスキップされ default が併存しうる**。
この行状態の変化はモック unit（`src/queries/user.test.ts`）では観測できない。実 DB で
現挙動を characterization として固定し、将来の修正（新規経路への解除追加・`$transaction` 化）の
回帰網にする。

## Current state

- `src/queries/user.ts:345-411` — 検証対象 `upsertShippingAddress`。**変更しない。** 構造:

```typescript
export const upsertShippingAddress = async (address: ShippingAddress) => {
    try {
        const user = await currentUser()
        if (!user) throw new Error('Unauthenticated.')
        if (!address) throw new Error('Please provide shipping address data.')

        // Handle making the rest of address default false when we are adding a new default
        if (address.default) {
            const addressDB = await db.shippingAddress.findUnique({
                where: { id: address.id },
            })
            if (addressDB) {          // ← 既存行があるときだけ他住所の default を解除
                await db.shippingAddress.updateMany({
                    where: { userId: user.id, default: true },
                    data: { default: false },
                })
            }
        }

        // 所有権検証付きの upsert（他ユーザーのアドレス上書き防止）
        const existing = await db.shippingAddress.findFirst({
            where: { id: address.id, userId: user.id },
        })
        let upsertedAddresses
        if (existing) {
            upsertedAddresses = await db.shippingAddress.update({
                where: { id: address.id },
                data: { ...address, userId: user.id },
            })
        } else {
            upsertedAddresses = await db.shippingAddress.create({
                data: { ...address, userId: user.id },   // ← id を含む全フィールドを spread
            })
        }
        return upsertedAddresses
    } catch ...
}
```

- **重要な実挙動（実 DB でしか観測できない）**:
  1. **新規 id + `default: true`** → `findUnique` が null → 解除スキップ → 既存 default と併存
  2. **他ユーザーの住所 id を渡す** → 所有権 `findFirst` が null → **同一 id で create を試み
     PK 一意制約違反（P2002）で reject**（silent overwrite にはならない — これが IDOR 防御の実体）
- **引数型**: `ShippingAddress` は `@prisma/client` の**フルモデル型**（`user.ts:18` で import）。
  テストでは seed 済み住所オブジェクトを spread で改変するか、新規作成時は
  `{ ...seeded, id: randomUUID(), default: true }` の形で渡す（`createdAt`/`updatedAt` を含んでいて
  よい — create/update の data に受理される）。
- **認証**: `currentUser()` 直呼び（auth-guards 非経由・ロール不要）。mock は
  `{ id: userId }` で足りる。
- **テスト基盤**: `getTestDb` / `disconnectTestDb`（`tests/integration/setup/db.ts`）、
  `resetDb`（`setup/reset-db.ts` — ShippingAddress / User / Country は TRUNCATE 対象済み。
  Country はデフォルトでは消えない → `seedCountry` は describe 内で 1 回 seed して使い回す）、
  `seedUser` / `seedCountry` / `seedShippingAddress`（`setup/seed.ts:398-417` — `overrides` で
  `default: true` を指定可能）。
- **構造の手本**: `tests/integration/order-placement.test.ts`（Clerk mock 宣言位置・
  `beforeEach` の resetDb + mockReset・S5「拒否 + 副作用なし」パターン）。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Docker 確認 | `docker info` | exit 0（失敗なら STOP） |
| 統合テスト全体 | `bun run test:integration` | 全 pass |
| 単一ファイル | `bun run test:integration -- tests/integration/shipping-address-default.test.ts` | all pass |
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| unit 回帰 | `bun run test` | 全 pass |

## Scope

**In scope**（変更してよいファイル）:
- `tests/integration/shipping-address-default.test.ts` — **新規作成**

**Out of scope**（触らない）:
- `src/queries/user.ts` — 検証対象本体。**「新規 default 作成時にも他住所を解除する」修正や
  `$transaction` 化は行わない**（correctness 修正は別プランの領分。本プランは現挙動の
  characterization）
- `src/components/store/shared/shipping-addresses/` — UI 側の default 選択ロジック
- `tests/integration/setup/seed.ts`（`seedShippingAddress` は既存のまま使える）

## Git workflow

- 現行ブランチ `dev` 上で作業してよい。コミット規律は `.claude/rules/02-tdd-step-commit.md`:
  テストファイル新設で 1 コミット（例: `test(integration): add shipping address default-flag scenarios`）、
  docs 同期は別コミット。push / PR はオペレーターの指示があるまで行わない。

## Steps

### Step 1: drift check とベースライン確認

冒頭の Drift check 実行 → `bun run test:integration` 全 pass 確認。

**Verify**: `bun run test:integration` → 全 pass

### Step 2: `tests/integration/shipping-address-default.test.ts` を新設

ファイル冒頭 JSDoc に検証境界（default 不変条件の更新経路/新規経路の非対称・PK 衝突による
IDOR 防御）と ADR-004 参照、および「シナリオ 2 は既知の correctness ギャップ
（findings-14 TESTS-21）の characterization」であることを明記。

Clerk mock（import より前）:

```typescript
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));
```

```typescript
function mockAuthAs(userId: string): void {
    (currentUser as unknown as jest.Mock).mockResolvedValue({ id: userId });
}
```

共通 Arrange: `seedUser` → `seedCountry` → `seedShippingAddress`（`overrides: { default: true }`
で default 住所 A、もう 1 件 default なしの住所 B）。

シナリオ:

1. **既存住所を default に更新すると他住所の default が実 DB で解除される**:
   `upsertShippingAddress({ ...addressB, default: true })` →
   `db.shippingAddress.findUnique(A)` の `default === false`、B の `default === true`、
   `db.shippingAddress.count({ where: { userId, default: true } })` === **1**
2. **新規住所を default 付きで作成すると既存 default が残存する（既知バグの characterization）**:
   `upsertShippingAddress({ ...addressA, id: randomUUID(), default: true })` →
   新行が作成され、`count({ where: { userId, default: true } })` === **2**。

   > **これは「正しい期待値」ではない。** 本来の不変条件は
   > **「1 ユーザーにつき `default: true` は最大 1 件」**（`address.list.tsx:21` の
   > `addresses.find((a) => a.default)` が最初の 1 件を採るため、2 件併存すると
   > どちらが選ばれるかが行順に依存し非決定になる）。`=== 2` は**現在のバグ挙動**を
   > 記録しているだけであり、バグ修正と同時に**必ず `=== 1` へ反転させる**。
   >
   > テストコードには以下を**必須**で書く（レビュー・将来の grep で拾えるようにするため）:
   > - `TODO(characterization): 既知バグ TESTS-21。修正時にこの期待値を 1 に反転する`
   >   という**機械検索可能なタグ付きコメント**
   > - 出典 `plans/audit/findings-14-integration-coverage-r6.md` の **TESTS-21** への参照
   > - 正しい不変条件（1 ユーザー = default 最大 1 件）の明記
   >
   > このタグが無いと、後任は `=== 2` を**満たすべき契約**と誤読し、バグ修正時に
   > 「テストが壊れた」として修正側を差し戻してしまう（characterization test の典型的な事故）。
3. **他ユーザーの住所 id の上書きは PK 衝突で reject + 被害者の行は無傷**:
   user2 で mock し `upsertShippingAddress({ ...addressA, firstName: "Attacker" })` →
   reject（P2002。`rejects.toMatchObject({ code: "P2002" })` が合わなければ捕捉して
   `code` を個別 assert）。addressA の `userId` / `firstName` が実 DB で不変であること
4. **未認証は reject + 行数不変**: `currentUser` を null に →
   `rejects.toThrow("Unauthenticated.")`、`db.shippingAddress.count()` 不変

**Verify**: `bun run test:integration -- tests/integration/shipping-address-default.test.ts` → all pass（4 テスト以上）

### Step 3: 全体回帰

**Verify**:
1. `bun run test:integration` → 既存 + 新規 全 pass
2. `bunx tsc --noEmit` → exit 0
3. `bun run lint` → exit 0
4. `bun run test` → unit 全 pass

## Test plan

Step 2 のシナリオ 1〜4 が本体。構造の手本は `tests/integration/order-placement.test.ts`。
完了後、テスト統計が変わるため **`spec-sync-after-test` skill を必ず起動**
（`.claude/rules/02-tdd-step-commit.md` の MUST。Integration 統計の SSOT は
`docs/testing/QA_HANDOFF.md`）。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run test:integration` exits 0; `shipping-address-default.test.ts` の新規テストが全 pass
- [ ] シナリオ 2 に `default: true` 件数 === 2 の assert が存在し、かつ同じテスト内に
      (a) `TODO(characterization)` タグ / (b) TESTS-21 への参照 /
      (c) 正しい不変条件（1 ユーザー = default 最大 1 件）/ (d)「修正時に 1 へ反転」
      の 4 点がコメントとして揃っている
      （`grep -n "TODO(characterization)" tests/integration/shipping-address-default.test.ts`
      が 1 件以上ヒットすること）
- [ ] シナリオ 3 に「reject + 被害者行の不変」の両方の assert が存在する
- [ ] `bunx tsc --noEmit` exits 0 / `bun run lint` exits 0 / `bun run test` exits 0
- [ ] **コードコミットの直前**で、`git status` に in-scope 外の変更がない（プラン index の更新と `spec-sync-after-test` の docs 同期は、後続の別コミット）
- [ ] docs 同期（QA_HANDOFF 統計 + ダッシュボード再生成）が別コミットで完了
- [ ] `plans/README.md` の 037 行が DONE に更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- `docker info` が失敗する（→ `BLOCKED (Docker unavailable)`）
- Drift check で `upsertShippingAddress` が本プランの抜粋と一致しない（特に新規経路の
  解除スキップが既に修正されている場合 — シナリオ 2 の期待値を反転させる前に、修正
  コミットを特定して報告）
- **シナリオ 2 で default 件数が 1 になる** — ギャップが修正済み。期待値を合わせ込まず
  修正コミットを添えて報告（本プランのシナリオ 2 は期待値反転で有効化できる）
- シナリオ 3 が P2002 以外の理由で失敗する（例: create が成功して行が乗っ取られる —
  **セキュリティ所見**として即報告）
- 検証コマンドが 2 回の修正試行後も失敗する

## Maintenance notes

- シナリオ 2 は**バグの characterization**。修正プラン（新規経路への解除追加 +
  updateMany/upsert の `$transaction` 化が最小修正）を実行する際は、期待値を
  `count === 1` に反転して回帰ガードに転用すること。
- plan 003（server-side payment/address trust）は checkout の住所所有権検証を扱う隣接
  プラン。003 実行後も本テストの経路（プロフィール/チェックアウトの住所管理）は独立に有効。
- `ShippingAddress` に「1 ユーザー 1 default」の**部分 unique index**
  （`CREATE UNIQUE INDEX ... WHERE "default" = true`）を張る恒久解決もありうる —
  その場合シナリオ 2 は DB エラー期待に書き換わる（migration プラン側で本テストを更新）。
