# Plan 040: Clerk webhook `user.deleted` の FK 連鎖（RESTRICT / CASCADE / SET NULL）を実 DB 統合テストで固定する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 9111f41..HEAD -- src/app/api/webhooks/route.ts prisma/schema.prisma prisma/migrations/ tests/integration/`
> If any in-scope/referenced file changed since this plan was written, compare
> the "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **前提チェック（Step 0）**: 本プランは Docker（testcontainers）必須。
> `docker info` が失敗する環境では **STOP**（`plans/README.md` の status 列に
> `BLOCKED (Docker unavailable)` と記録して終了）。

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW（テスト新設のみ。`src/` 本体は 1 行も変更しない）
- **Depends on**: none（他プランと完全独立・並行可。seed.ts / reset-db.ts を変更しないため
  027 / 031〜039 とファイル競合なし）
- **Category**: tests
- **Planned at**: commit `9111f41`, 2026-07-11
- **出典 finding**: TESTS-24（`plans/audit/findings-15-integration-coverage-r7.md`）

## Why this matters

Clerk の `user.deleted` イベントを受けた webhook は `db.user.deleteMany` の**ハード削除**を
実行するが、User への FK は **RESTRICT（Store / Review / ShippingAddress / Order）・
CASCADE（Cart / Wishlist / Conversation / Message / フォロー / クーポン割当）・
SET NULL（SupportTicket）の 3 種が混在**する。つまり**注文・レビュー・住所・店舗のいずれか
1 件でも持つユーザーが Clerk 上でアカウントを削除すると、DB 側の削除は P2003 で永続的に失敗し、
webhook は 500 を返し続ける。Svix のリトライは**有限回で打ち切られ、以後そのメッセージは
failed としてマークされる**（リトライ上限後の再送はダッシュボード等からの手動操作が必要）。
つまり**リトライを尽くしても削除は成功せず、誰も気付かないまま
ユーザーの PII（name/email/picture）が DB に残存し続ける**
（GDPR 等の削除要求と衝突するコンプライアンス隣接事案）。一方 Cart や
Wishlist は黙って連鎖消滅し、SupportTicket は匿名化される。この 3 値境界は
`db.user.deleteMany` をモックする unit テスト（`src/app/api/webhooks/route.test.ts`）では
原理的に検証できない。実 DB で characterization として固定すれば、将来の修正
（削除前の匿名化・ソフト削除化・onDelete 変更）や Prisma メジャーアップグレードの回帰網になる。

## Current state

- `src/app/api/webhooks/route.ts:114-127` — 検証対象。**変更しない。** 抜粋:

```typescript
    if (evt.type === "user.deleted") {
        const userId = (evt.data as { id: string }).id;
        try {
            await db.user.deleteMany({
                where: {
                    id: userId,
                },
            });
        } catch (error) {
            console.error("Webhook user deletion failed:", error);
            return new Response("Internal Server Error", { status: 500 });
        }
    }
    return new Response("", { status: 200 });
```

- **User への FK セマンティクス（migration SQL で確認済み）**:
  - `prisma/migrations/20260222101357_init_postgresql/migration.sql`:
    - **RESTRICT（削除を阻止）**: `Store.userId`（:640）/ `Review.userId`（:691）/
      `ShippingAddress.userId`（:712）/ `Order.userId`（:721）
    - **CASCADE（連鎖消滅）**: `Cart.userId`（:700）/ `Wishlist.userId`（:736）/
      `PaymentDetails.userId`（:754）/ `_UserFollowingStore.B`（:760）/ `_CouponToUser.B`（:766）
  - `prisma/migrations/20260619115547_add_conversation_message/migration.sql`:
    `Conversation.userId`（:45）と `Message.senderId`（:57）は **CASCADE**
  - `prisma/migrations/20260622061307_add_support_ticket/migration.sql`:
    `SupportTicket.userId`（:34）は **SET NULL**（匿名化）

> **`PaymentDetails.userId` の CASCADE は、この webhook 経路では到達できない**（＝本プランの
> 検証対象に含めない）。`PaymentDetails.orderId` は `Order` への**必須** FK（`schema.prisma` —
> `orderId String @unique`）なので、PaymentDetails を 1 行でも持つユーザーは**必ず Order を持つ**。
> そして `Order.userId` は RESTRICT。したがって削除は常に **Order の RESTRICT で先に阻止**され、
> PaymentDetails の CASCADE が発火する状態は作れない（シナリオ 2 の 500 経路に吸収される）。
> Why this matters の CASCADE 列挙から PaymentDetails を外しているのはこのため。
>
> 一方 **`Conversation` は `orderId String?` が optional** なので Order 無しで成立し、
> `Conversation` / `Message` / `_CouponToUser` の CASCADE は**到達可能**。よってシナリオ 1 で
> 検証する（本プランのタイトルが「FK 連鎖（RESTRICT / CASCADE / SET NULL）を固定する」と
> 掲げる以上、到達可能な CASCADE を取りこぼさない）。
- **webhook の境界モック（unit テストのパターンをそのまま流用する）**:
  `src/app/api/webhooks/route.test.ts:4-68` に svix / next/headers / `@clerk/nextjs/server` /
  `WEBHOOK_SECRET` 環境変数 / `createWebhookRequest` / `setSvixHeaders` の完全な設定例がある。
  **統合テストでの違いは 1 点だけ**: `jest.mock("@/lib/db", ...)` を**しない**こと。
  globalSetup（`tests/integration/setup/container.ts`）が `DATABASE_URL` を testcontainers の
  接続文字列に書き換えた後で route が import する `@/lib/db` シングルトンが初期化されるため、
  route の DB 書き込みはそのまま実コンテナ DB に当たる（plan 032 と同じ方式）。
- **svix モックの要点**（route.test.ts:26-31）: `Webhook` クラスをモックし `verify` が
  イベントオブジェクトを返すようにする。テスト側で
  `mockVerify.mockReturnValue({ type: "user.deleted", data: { id: user.id } })` のように
  イベントを注入する。署名検証自体は本プランの検証対象外（DB セマンティクスのみが対象）。
- **テスト基盤**: `getTestDb` / `disconnectTestDb`（`tests/integration/setup/db.ts`）、
  `resetDb`（`setup/reset-db.ts`）、`seedUser` / `seedStore` / `seedCountry` /
  `seedShippingAddress` / `seedCart` / `seedCategoryWithSubcategory` /
  `seedProductWithVariantAndSize`（`setup/seed.ts`）。
- **`resetDb` の注意**: `APPLICATION_TABLES`（`reset-db.ts:24-51`）に SupportTicket /
  Conversation / Message は**未列挙**だが、`TRUNCATE ... CASCADE`（:77-79）が User / Order /
  Store を truncate する際に FK 参照経由で連鎖 truncate するため、テスト間の掃除は機能する。
  **reset-db.ts への追記はしない**（out of scope — 他プランとの競合回避）。
- **seed ヘルパーにないレコード**はテストファイル内で直接 create する（seed.ts への追加は不要）:
  - `db.order.create` の必須フィールド（`prisma/schema.prisma` の `model Order`）:
    `subTotal` / `total`（`new Prisma.Decimal(...)`）+ `shippingAddressId` + `userId`
  - `db.review.create` の必須フィールド: `variant` / `review` / `rating`（Float）/ `color` /
    `size` / `quantity`（文字列）+ `userId` / `productId`
  - `db.wishlist.create`: `userId` / `productId` / `variantId`（`sizeId` は任意）
  - `db.supportTicket.create`: `category`（enum `SupportTicketCategory` =
    `CONTACT | RETURN_REQUEST | DISPUTE`（schema.prisma:783-786）— `"CONTACT"` を使う）+
    `name` / `email` / `subject` / `message` + `userId`（`orderId` は null のままにする —
    Order を作ると RESTRICT で削除が阻止され SET NULL を観測できない）
- **構造の手本**: `tests/integration/order-placement.test.ts`（lifecycle: `beforeEach` で
  `resetDb` + mock reset、`afterAll` で `disconnectTestDb`）と
  `src/app/api/webhooks/route.test.ts`（webhook 境界モックの宣言位置と形）。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Docker 確認 | `docker info` | exit 0（失敗なら STOP） |
| 統合テスト全体 | `bun run test:integration` | 全 pass |
| 単一ファイル | `bun run test:integration -- tests/integration/user-deletion-webhook.test.ts` | all pass |
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| unit 回帰 | `bun run test` | 全 pass |

## Scope

**In scope**（変更してよいファイル）:
- `tests/integration/user-deletion-webhook.test.ts` — **新規作成**

**Out of scope**（触らない）:
- `src/app/api/webhooks/route.ts` — 検証対象本体。**「RESTRICT を回避して削除可能にする」
  修正（匿名化・ソフト削除・onDelete 変更・先行子テーブル削除）は行わない**（コード修正は
  将来の correctness プランの領分。本プランは現挙動の characterization）
- `prisma/schema.prisma` / `prisma/migrations/` — FK 定義の変更は絶対にしない
- `tests/integration/setup/seed.ts` / `setup/reset-db.ts` — ヘルパー追加・テーブル列挙の
  変更は不要（直接 create と TRUNCATE CASCADE で足りる）
- `src/app/api/webhooks/route.test.ts` — unit テストはそのまま
- `user.created` / `user.updated` の upsert 経路 — 分岐が単純（upsert 1 本）で unit 網羅済み。
  本プランは deleted 経路のみ

## Git workflow

- 現行ブランチ `dev` 上で作業してよい。コミット規律は `.claude/rules/02-tdd-step-commit.md`:
  テストファイル新設で 1 コミット（例:
  `test(integration): add clerk user.deleted webhook FK cascade scenarios`）、
  docs 同期は別コミット。push / PR はオペレーターの指示があるまで行わない。

## Steps

### Step 1: drift check とベースライン確認

冒頭の Drift check 実行 → `bun run test:integration` 全 pass 確認。

**Verify**: `bun run test:integration` → 全 pass（17 テスト以上。他プラン実行済みなら増えていてよい）

### Step 2: `tests/integration/user-deletion-webhook.test.ts` を新設

ファイル冒頭 JSDoc に検証境界（RESTRICT による削除阻止 + 500 / CASCADE 連鎖消滅 /
SET NULL 匿名化 / deleteMany の冪等性）と ADR-004 参照を記載。

境界モックは **import より前に** 宣言する（`route.test.ts:4-68` のパターンから
`jest.mock("@/lib/db", ...)` だけを除いたもの）:

```typescript
// Svix 署名検証をバイパスし、テストからイベントを注入する
const mockVerify = jest.fn();
jest.mock("svix", () => ({
    Webhook: jest.fn().mockImplementation(() => ({
        verify: (...args: unknown[]) => mockVerify(...args),
    })),
}));

// next/headers から svix ヘッダーを返す
const mockHeadersMap = new Map<string, string>();
jest.mock("next/headers", () => ({
    headers: () => ({
        get: (key: string) => mockHeadersMap.get(key) ?? null,
    }),
}));

// user.created 経路が clerkClient を呼ぶため形だけ用意（deleted 経路では未使用）
jest.mock("@clerk/nextjs/server", () => ({
    clerkClient: jest.fn().mockResolvedValue({
        users: { updateUserMetadata: jest.fn() },
    }),
}));
```

`WEBHOOK_SECRET` は `beforeAll` で `process.env` に設定し `afterAll` で復元
（`route.test.ts:42-48` と同形）。リクエスト生成・ヘッダー設定ヘルパーは
`route.test.ts:56-68` の `createWebhookRequest` / `setSvixHeaders` をコピーする。
イベント送信ヘルパー:

```typescript
async function postUserDeleted(userId: string): Promise<Response> {
    setSvixHeaders();
    mockVerify.mockReturnValue({ type: "user.deleted", data: { id: userId } });
    return POST(createWebhookRequest({}));
}
```

シナリオ（各テストの Arrange は `beforeEach` の `resetDb(db)` 後に組む）:

1. **CASCADE 群のみのユーザーは削除され、子行が連鎖消滅する（CASCADE）**:
   `seedUser` → `seedCart` + `seedCartItem`（商品は別セラーの store に `seedStore` +
   `seedCategoryWithSubcategory` + `seedProductWithVariantAndSize` で用意）+
   `db.wishlist.create` + `db.user.update` で `following: { connect: { id: store.id } }`
   （`User.following`（schema.prisma:26）が `_UserFollowingStore` の implicit M2M）
   さらに **`db.conversation.create`（`userId` / `storeId`。`orderId` は指定しない — optional なので
   Order 無しで成立し、RESTRICT に触れずに CASCADE を発火できる）** と **`db.message.create`
   （`conversationId` / `senderId: user.id`）**、
   および **`seedCoupon(db, { storeId: store.id, connectUserIds: [user.id] })`（`_CouponToUser` の
   M2M 割当。既存ヘルパーで足り、`seed.ts` の変更は不要）** を用意して →
   `postUserDeleted(user.id)` → **status 200**。
   assert: 対象 User 消滅（`db.user.findUnique` === null）、`db.cart.count` === 0、
   `db.cartItem.count` === 0、`db.wishlist.count` === 0、
   **`db.conversation.count` === 0、`db.message.count` === 0**。
   **フォロー中間テーブルの解消も assert する**（`_UserFollowingStore` の CASCADE は
   migration `:760` で定義されているのに、これを確認しないと「フォロー行だけ残る」
   回帰を取り逃す）。implicit M2M の中間テーブルは Prisma から直接クエリできないため、
   **Store 側から followers を引いて空であること**を確認する:

```typescript
const storeAfter = await db.store.findUniqueOrThrow({
    where: { id: store.id },
    select: { _count: { select: { followers: true } } },
});
expect(storeAfter._count.followers).toBe(0); // _UserFollowingStore の行が CASCADE で消えた
```

   **クーポン割当（`_CouponToUser`）も同じ理由で assert する**（migration `:766` の CASCADE）。
   これも implicit M2M で直接クエリできないため、**Coupon 側から users を引いて空であること**を
   確認する（Coupon 自体は残る — 消えるのは割当だけ）:

```typescript
const couponAfter = await db.coupon.findUniqueOrThrow({
    where: { id: coupon.id },
    select: { _count: { select: { users: true } } },
});
expect(couponAfter._count.users).toBe(0); // _CouponToUser の行が CASCADE で消えた
```

   **セラー側は無傷**: store / product / variant / size が残存（count 1 ずつ）。
   Coupon 本体も残存（`db.coupon.count` === 1）。
   > フォロー解消の assert は「Store は残るがフォロー関係だけが消える」という
   > 中間テーブル固有の挙動を固定する。Store 残存の assert だけでは、
   > 中間テーブル行が孤児として残っても green になってしまう。
2. **Order 持ちユーザーは削除できず 500 + 全行無傷（RESTRICT — 本丸）**:
   `seedUser` + `seedCountry` + `seedShippingAddress` + `db.order.create`
   （`subTotal: new Prisma.Decimal(100)` / `total: new Prisma.Decimal(110)` /
   `shippingAddressId` / `userId`）→ `postUserDeleted(user.id)` → **status 500**。
   assert: User・Order・ShippingAddress がすべて残存（S5「拒否 + 副作用なし」パターン）。
   これは**現挙動の characterization** — 将来「削除前に匿名化する」修正が入ったら
   期待値を反転させる
3. **Review のみ持つユーザーも 500 + 無傷（RESTRICT）**: レビュー対象の商品は別セラーの
   store に用意し、対象ユーザー自身は Review 1 行だけを持つ状態を作る →
   `postUserDeleted` → **status 500**、User と Review が残存
4. **ShippingAddress のみ持つユーザーも 500 + 無傷（RESTRICT）**: `seedUser` +
   `seedCountry` + `seedShippingAddress` のみ → **status 500**、User と住所が残存
5. **Store 保有ユーザーは削除できず 500 + User/Store 無傷（RESTRICT）**:
   `Store.userId` は migration `:640` で **RESTRICT** であり、Why this matters で
   RESTRICT 群の筆頭に挙げているにもかかわらずシナリオが無かった（セラーが Clerk 上で
   アカウントを削除しても DB 側が追従できない、という**販売者側の PII 残存経路**）。
   `seedUser` → `seedStore({ userId: user.id })` のみ（Order / Review / 住所は作らない —
   **Store 単独で削除が阻止されること**を分離して示すため）→ `postUserDeleted(user.id)`
   → **status 500**。
   assert: User 残存（`db.user.findUnique` !== null）、Store 残存（`db.store.count` === 1）。
   シナリオ 2〜4 と同じく**現挙動の characterization** — 将来の匿名化・ソフト削除で反転する。
   > 他の RESTRICT シナリオと分離する理由: Store は「顧客の削除」ではなく「販売者の削除」の
   > 経路であり、修正時の設計（店舗の所有権移譲 / 店舗の閉鎖）が顧客側とは別物になるため。
6. **SupportTicket（orderId なし）持ちユーザーは削除され、ticket が匿名化される（SET NULL）**:
   `seedUser` + `db.supportTicket.create`（`userId: user.id`, `orderId` は指定しない）→
   `postUserDeleted(user.id)` → **status 200**。
   assert: User 消滅、`db.supportTicket.findUnique` の行は**残存**し `userId` === null
7. **存在しない userId は 200（deleteMany の冪等性）**: seed なしで
   `postUserDeleted("user_does_not_exist")` → **status 200**（deleteMany は count:0 で正常終了）

**Verify**: `bun run test:integration -- tests/integration/user-deletion-webhook.test.ts` → all pass（7 テスト以上）

### Step 3: 全体回帰

**Verify**:
1. `bun run test:integration` → 既存 + 新規 全 pass
2. `bunx tsc --noEmit` → exit 0
3. `bun run lint` → exit 0
4. `bun run test` → unit 全 pass（本プランは unit に触れないため不変のはず）

## Test plan

Step 2 のシナリオ 1〜7 が本体。構造の手本は `tests/integration/order-placement.test.ts`
（lifecycle）と `src/app/api/webhooks/route.test.ts`（境界モック）。
完了後、テスト統計が変わるため **`spec-sync-after-test` skill を必ず起動**
（`.claude/rules/02-tdd-step-commit.md` の MUST。Integration 統計の SSOT は
`docs/testing/QA_HANDOFF.md`）。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run test:integration` exits 0; `user-deletion-webhook.test.ts` の新規テストが全 pass
- [ ] シナリオ 1 に**フォロー中間テーブル解消**（`_count.followers === 0`）の assert が存在する
- [ ] シナリオ 1 が**到達可能な CASCADE をすべて**カバーしている: Cart / CartItem / Wishlist /
      Conversation / Message / `_UserFollowingStore` / `_CouponToUser`
      （`PaymentDetails` は Order の RESTRICT に阻まれ到達不能なため対象外 — Current state の
      blockquote 参照。タイトルが掲げる「FK 連鎖（RESTRICT / CASCADE / SET NULL）」と
      検証範囲を一致させるための項目）
- [ ] シナリオ 2 に「500 + User/Order/住所 残存」の両方の assert が存在する
- [ ] シナリオ 5（**Store 保有ユーザー**）に「500 + User/Store 残存」の assert が存在する
      — Why this matters が RESTRICT 群の筆頭に挙げる経路であり、欠かすと販売者側の
      PII 残存が未検証のまま残る
- [ ] シナリオ 6 に「200 + ticket 残存 + userId NULL 化」の assert が存在する
- [ ] `bunx tsc --noEmit` exits 0 / `bun run lint` exits 0 / `bun run test` exits 0
- [ ] **コードコミットの直前**で、`git status` に in-scope 外の変更がない（プラン index の更新と `spec-sync-after-test` の docs 同期は、後続の別コミット）
- [ ] docs 同期（QA_HANDOFF 統計 + ダッシュボード再生成）が別コミットで完了
- [ ] `plans/README.md` の 040 行が DONE に更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- `docker info` が失敗する（→ `BLOCKED (Docker unavailable)`）
- Drift check で `route.ts:114-127` が本プランの抜粋と一致しない（特に匿名化・ソフト削除・
  子テーブル先行削除が既に入っている場合 — 本プランの前提が消えている）
- **シナリオ 2〜5 のいずれかで削除が成功（200）してしまう** — FK が RESTRICT でなくなっている
  （schema/migration が変わった）。characterization の前提が崩れているので、実際の FK 定義を
  添えて報告
- シナリオ 1 でいずれかの子テーブル行が残存する（フォロー中間テーブルを含む）、または
  セラー側リソースまで消える — CASCADE 定義のドリフト。実測の残存/消滅テーブル名を添えて報告
- route の import がテスト環境で失敗する（transitive import の jsdom 非互換等）。
  `jest.integration.config.js` の moduleNameMapper で吸収できない場合は STOP して報告
- 検証コマンドが 2 回の修正試行後も失敗する

## Maintenance notes

- 本テストは「注文・レビュー・住所・店舗持ちユーザーは Clerk 削除に DB が追従できない」
  という**現挙動を固定**するもの。プロダクト判断として削除要求へ対応する場合
  （PII 匿名化 + 行温存 / ソフト削除 / onDelete 変更のいずれか）、シナリオ 2〜5 の期待値を
  意図的に反転させること — onDelete 変更なら migration が必要
  （`.claude/rules/03-data-model-diagram-sync.md` の ERD 再生成義務にも注意）。
- `resetDb` の `APPLICATION_TABLES` に SupportTicket / Conversation / Message が未列挙である
  点は TRUNCATE CASCADE で実害がないが、これらのテーブルを**単独で**（User/Order/Store と
  無関係に）使うテストを将来追加する場合は列挙の追加を検討すること。
- シナリオ 5（Store 保有）の修正方向は顧客側（シナリオ 2〜4）と別設計になりうる
  （店舗の所有権移譲・閉鎖フロー）。spike 016（出品審査）/ 022（セラー指標）と接続して
  検討すること。
- 将来 `user.deleted` 経路に匿名化が入ると、シナリオ 6（SupportTicket SET NULL）は
  「webhook 到達前から匿名」に意味が変わる — 修正プラン側でテスト意図のコメントを更新すること。
