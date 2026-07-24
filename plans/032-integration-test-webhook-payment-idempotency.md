# Plan 032: Stripe / PayPal webhook の実 DB 冪等性（upsert + unique 制約 + 原子性）を統合テストで固定する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 1750ef2..HEAD -- src/app/api/webhooks/ tests/integration/ tests/fixtures/webhooks/`
> If any in-scope/referenced file changed since this plan was written, compare
> the "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **前提チェック（Step 0）**: 本プランは Docker（testcontainers）必須。
> `docker info` が失敗する環境では **STOP**（`plans/README.md` の status 列に
> `BLOCKED (Docker unavailable)` と記録して終了）。

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW（テスト新設のみ。`src/` 本体は 1 行も変更しない）
- **Depends on**: none（plan 031 と独立。ただし 031 が先に完了していれば
  `seedOrderWithGroupAndItem` を再利用できる — 本プランは **Order 単体 seed で足りる**ため
  必須依存ではない）
- **Category**: tests
- **Planned at**: commit `1750ef2`, 2026-07-11
- **出典 finding**: TESTS-16（`plans/audit/findings-13-integration-coverage.md`。
  Round 1 raw TESTS-04 の昇格）

## Why this matters

Stripe / PayPal の webhook は**プロバイダー側が再送を前提とする経路**であり、ハンドラーは
「同一イベントを何度受けても最終状態が同じ」（冪等）でなければならない。両ルートはこれを
`PaymentDetails.upsert`（`orderId` unique）+ `Order.update` の `$transaction` で実装しているが、
unit テスト（`route.test.ts` × 2）は `@/lib/db` を全モックしており、**冪等性の本体 —
unique 制約と upsert の実挙動、2 書き込みの原子性 — はどのテストでも実行されていない**。
冪等性が破れると PaymentDetails の重複 or upsert 失敗 500 → プロバイダーの再送ループで
決済状態が不定になる。money-critical。

## Current state

- `src/app/api/webhooks/stripe/route.ts` — 検証対象 1。**変更しない。**
  - 対象イベント（`:10-14`）: `payment_intent.succeeded` → `Paid` /
    `payment_intent.payment_failed` → `Failed` / `charge.refunded` →
    `amount_refunded >= amount` なら `Refunded`、未満なら `PartiallyRefunded`（`:23-38`）
  - 相関 ID 抽出（`:44-62`）: `metadata.orderId` + paymentIntentId
    （charge イベントは `object.payment_intent`）
  - DB 反映（`:141-180`）: `db.order.findUnique` で存在確認（無ければ **404**）→

```typescript
await db.$transaction(async (tx) => {
    await tx.paymentDetails.upsert({
        where: { orderId },
        update: { paymentIntentId, paymentMethod: "Stripe", status: paymentStatus, userId: order.userId },
        create: { paymentIntentId, paymentMethod: "Stripe", status: paymentStatus,
                  amount, currency, orderId, userId: order.userId },
    });
    await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus, paymentMethod: "Stripe" },
    });
});
```

  - レスポンス: 成功 200 / 署名不正 400 / metadata 欠落 400 / Order 不在 404 /
    未知イベント 200 "Ignored" / 内部エラー 500
- `src/app/api/webhooks/paypal/route.ts` — 検証対象 2。**変更しない。** 同型の
  upsert + tx（`:241-268`、capture id を `paymentIntentId` カラムに格納、
  `amount: order.total` / `currency: "usd"`）。対象イベント（`:8-12`）:
  `PAYMENT.CAPTURE.COMPLETED` → `Paid` / `DENIED` → `Failed` / `REFUNDED` → `Refunded`。
  相関 ID は `resource.custom_id`（orderId）と `resource.id`（captureId）。
  必須ヘッダー 5 種（`:14-20`）: `paypal-transmission-id` / `-time` / `-sig` /
  `paypal-cert-url` / `paypal-auth-algo`。
  署名検証は OAuth fetch → verify fetch の 2 段（`:180-213`。fetch throw は 500 =
  再送に乗せる / verify 結果 false のみ 400）。
- `prisma/schema.prisma` — `PaymentDetails`: `orderId String @unique`。必須フィールド:
  `paymentIntentId` / `paymentMethod` / `status`（String）、`amount`（Decimal(12,2)）、
  `currency`、`orderId`、`userId`（FK: User）。
- **unit テストのモックパターン（そのまま流用する）**:
  - Stripe: `src/app/api/webhooks/stripe/route.test.ts:26-42` —
    `jest.mock("stripe", ...)` で `webhooks.constructEvent` を `mockConstructEvent` に委譲、
    `jest.mock("next/headers")` で `stripe-signature` ヘッダーを Map から返す、
    `beforeAll` で `process.env.STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` にダミーを設定。
  - PayPal: `src/app/api/webhooks/paypal/route.test.ts:10-52` — `global.fetch` を
    `mockFetch` に差し替え（1 回目 = OAuth token、2 回目 = verify-webhook-signature で
    `{ verification_status: "SUCCESS" }` を返す）、`next/headers` モック、env ダミー
    （`NEXT_PUBLIC_PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` / `PAYPAL_WEBHOOK_ID`）。
  - **統合テストでの違いは 1 点だけ**: `jest.mock("@/lib/db", ...)` を**しない**こと。
    `tests/integration/setup/container.ts`（globalSetup）が `DATABASE_URL` を
    testcontainers に書き換えるため、route が import する `@/lib/db` シングルトンは
    自動的に実コンテナ DB へ接続する（`placeOrder` を実 DB で呼ぶ
    `tests/integration/order-placement.test.ts` と同じ機構）。
- **イベント fixture（既存・流用する）**: `tests/fixtures/webhooks/stripe/`
  （payment-intent-succeeded / payment-intent-failed / charge-refunded-full /
  charge-refunded-partial）、`tests/fixtures/webhooks/paypal/`
  （payment-capture-completed / denied / refunded）。fixture 内の orderId は固定値のため、
  テストでは **deep clone して seed 済み Order の id に差し替える**
  （Stripe: `event.data.object.metadata.orderId`、PayPal: `event.resource.custom_id`）。
- **テスト基盤**: `getTestDb` / `disconnectTestDb`（`tests/integration/setup/db.ts`）、
  `resetDb`（`setup/reset-db.ts` — PaymentDetails / Order は TRUNCATE 対象済み）、
  `seedUser` / `seedCountry` / `seedShippingAddress` / `seedStore`（`setup/seed.ts`）。
  Order の直接 seed は `db.order.create` で行う（必須: `subTotal` / `total`（Decimal）、
  `shippingAddressId`、`userId`。plan 031 完了済みなら `seedOrderWithGroupAndItem` を使ってよいが、
  本プランは OrderGroup / OrderItem 不要のため `db.order.create` 直書きで十分）。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Docker 確認 | `docker info` | exit 0（失敗なら STOP） |
| 統合テスト全体 | `bun run test:integration` | 全 pass |
| 単一ファイル | `bun run test:integration -- tests/integration/webhook-payment.test.ts` | all pass |
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| unit 回帰 | `bun run test` | 全 pass（集計不変のはず） |

## Scope

**In scope**（変更してよいファイル）:
- `tests/integration/webhook-payment.test.ts` — **新規作成**

**Out of scope**（触らない）:
- `src/app/api/webhooks/**`（route 本体・unit テスト）— バグ発見時は STOP して報告
- `tests/fixtures/webhooks/**` — 既存 fixture は変更せず、テスト内で clone + 差し替え
- `src/queries/stripe.ts` / `src/queries/paypal.ts` — 同期 capture 経路は TESTS-02
  （plan 003 先行依存のため deferred — `plans/audit/findings-13-integration-coverage.md` 参照）
- `jest.integration.config.js` / `tests/integration/setup/`

## Git workflow

- 現行ブランチ `dev` 上で作業してよい。コミット規律は `.claude/rules/02-tdd-step-commit.md`:
  テストファイル新設で 1 コミット（例: `test(integration): add webhook payment idempotency scenarios`）、
  docs 同期は別コミット。push / PR はオペレーターの指示があるまで行わない。

## Steps

### Step 1: drift check とベースライン確認

冒頭の Drift check を実行し、`bun run test:integration` で既存テストが全 pass することを確認。
両 route.test.ts のモック設定（Current state 記載の行）を読み、コピー元を確定する。

**Verify**: `bun run test:integration` → 全 pass

### Step 2: `tests/integration/webhook-payment.test.ts` を新設（Stripe 側）

ファイル冒頭 JSDoc に検証境界（upsert 冪等性 / unique 制約 / tx 原子性 / 404 副作用なし）と
ADR-004 参照を記載。モックは unit テストから流用（stripe SDK・next/headers・env）。
**`@/lib/db` はモックしない。**

共通 Arrange ヘルパー:

```typescript
async function seedOrderForWebhook(): Promise<{ orderId: string; userId: string }> {
    const user = await seedUser(db);
    const country = await seedCountry(db);
    const address = await seedShippingAddress(db, { userId: user.id, countryId: country.id });
    const order = await db.order.create({
        data: {
            subTotal: new Prisma.Decimal(100),
            total: new Prisma.Decimal(110),
            shippingAddressId: address.id,
            userId: user.id,
        },
    });
    return { orderId: order.id, userId: user.id };
}
```

fixture 差し替えヘルパー（deep clone; `structuredClone` 可）で
`event.data.object.metadata.orderId` を seed 済み orderId に設定し、
`mockConstructEvent.mockReturnValue(event)` → `POST(new Request("http://localhost/api/webhooks/stripe", { method: "POST", body: "{}" }))` を呼ぶ
（body は署名検証がモックされるため任意の文字列でよい。unit テストと同じ流儀）。

**Scenario S1: 初回イベントで行が作られる**
`payment_intent.succeeded` を 1 回配送 → 200。DB assert:
- `db.paymentDetails.findUnique({ where: { orderId } })` が 1 行存在し
  `status === "Paid"` / `paymentMethod === "Stripe"` / `paymentIntentId` = fixture の intent id /
  `amount` = fixture の amount（cents）
- `db.order` の `paymentStatus === "Paid"` / `paymentMethod === "Stripe"`

**Scenario S2: 同一イベント再送で 1 行のまま（冪等性の本体）**
S1 と同じイベントを**2 回**配送 → 両方 200。DB assert:
- `db.paymentDetails.count({ where: { orderId } })` === **1**
- 内容が S1 と同一（upsert update 経路が同値で上書き）

> **逐次再送だけでは「冪等性」の主張を満たさない。** Stripe は再試行を**並行**配送しうるため、
> 逐次 2 回のみを検証して「冪等」と名乗るのは過大主張。次のどちらかにすること:
> - **並行ケースを追加**（推奨）: 同一イベントを `Promise.all` で 2 回配送し、`paymentDetails.count`
>   が **1** のままであることを assert（upsert の一意制約が並行 upsert を直列化することの回帰網）。
> - もしくは S2 の主張を「**逐次**再送に対する冪等性」に**明示的に狭める**（並行は別途 TODO と記す）。

**Scenario S3: 状態遷移イベントは upsert 更新される**
`payment_intent.succeeded` → `charge.refunded`（同一 orderId）の順で配送。DB assert:
- PaymentDetails は 1 行のまま `status === "Refunded"`
- Order.paymentStatus === "Refunded"
- 部分返金の別ケースで `PartiallyRefunded` も 1 テスト固定

> **fixture は実在の Stripe イベント形状に忠実にすること**（でっち上げの `charge-refunded-full` /
> `charge-refunded-partial` のような**存在しないイベントタイプ名やペイロード**を使わない）。
> Stripe の実際のイベントは `type: "charge.refunded"`、`event.data.object` は **Charge オブジェクト**で
> `amount` / `amount_refunded` / `refunded`(boolean) / `payment_intent` / `metadata` 等を持つ。
> 全額返金は `amount_refunded === amount`（`refunded: true`）、部分返金は
> `0 < amount_refunded < amount` で表現する。fixture は Stripe CLI の
> `stripe trigger charge.refunded` で記録した実イベント、または公式型
> （`Stripe.Charge` / `Stripe.Event`）に一致する形から作る。route が実際に読むフィールド
> （`route.ts` で参照している `object` のプロパティ）を Current state から確認し、それに整合させる。

**Scenario S4: Order 不在は 404 + 副作用なし**
存在しない orderId のイベントを配送 → 404。
`db.paymentDetails.count()` === 0（何も書かれない）。

**Scenario S5: `$transaction` の原子性（失敗時ロールバック）— JSDoc の「tx 原子性」を実証**
JSDoc に「tx 原子性」を検証境界として掲げる以上、**成功パスだけでなく失敗時に部分書き込みが
残らないこと**を 1 ケースで実証する（無ければ JSDoc から「tx 原子性」を削り scope を狭める）。
実装は `$transaction` で括られていることを確認済み（`src/app/api/webhooks/stripe/route.ts:153-179`
— `tx.paymentDetails.upsert` → `tx.order.update` の順。Drift check で形状が変わっていたら STOP）。

> ⚠️ **`db.order.delete` で Order を消す方法は使わないこと（ロールバックを実証できない）**。
> `PaymentDetails.orderId` は `Order` への**必須 FK**（`prisma/schema.prisma` — `onDelete: Cascade`）。
> したがって:
> - Order を消すと **`onDelete: Cascade` で既存 PaymentDetails も道連れ**になる。
> - Order が無い状態では `paymentDetails.upsert` は **FK 制約違反で落ちる** ——
>   「upsert は成立するが order.update だけ失敗する」という前提の状態は**そもそも存在し得ない**。
> - つまり失敗するのは **2 番目ではなく 1 番目**の書き込み。`count === 0` は
>   **route が `$transaction` を使っていなくても成立**するため、この assert は原子性を
>   一切証明しない（「ロールバックされた」と「そもそも書かれなかった」を区別できない）。
>
> **ロールバックの実証には「1 番目が成功し、2 番目が失敗する」状態が必須**。

`@/lib/db` はモックしない方針なので、実 PostgreSQL（testcontainers）側で**2 番目の書き込みだけ**を
決定論的に失敗させる。`order.update` は `paymentMethod: "Stripe"` を書くので、それを拒む
CHECK 制約を一時的に張る:

```typescript
// Arrange: Order（paymentMethod は未設定）と User を seed した後
await db.$executeRawUnsafe(
    `ALTER TABLE "Order" ADD CONSTRAINT tmp_block_stripe CHECK ("paymentMethod" IS DISTINCT FROM 'Stripe'::"PaymentMethod")`
);
try {
    // Act: webhook イベントを配送
    //   tx 内: paymentDetails.upsert は成功（Order は実在するので FK OK）
    //          → order.update が CHECK 違反で throw → tx ロールバック
    // Assert: 具体的な応答ステータスを固定すること — 曖昧な「5xx またはハンドリング済み応答」
    //   ではなく、ハンドラが実際に返す値を assert する。Stripe webhook は内部エラー時に
    //   `new Response("Internal Server Error", { status: 500 })`（route.ts:193）を返すので
    //   `res.status === 500` を assert し、かつ
    //   await db.paymentDetails.count({ where: { orderId } }) === 0（tx ロールバックで副作用なし）
} finally {
    await db.$executeRawUnsafe(`ALTER TABLE "Order" DROP CONSTRAINT tmp_block_stripe`);
}
```

- `IS DISTINCT FROM` を使うのは、既存行の `paymentMethod` が `NULL` でも制約追加が通るようにするため
  （`NULL IS DISTINCT FROM 'Stripe'` は true）。`<>` だと NULL 比較が `NULL` になり挙動が変わる。
- 制約の削除は **`finally` で必ず行う**（残すと後続テストの `order.update` を巻き込んで壊す）。
- **対照（control）assert を必ず添えること**: 同じイベントを**制約なし**で配送すると
  `paymentDetails.count({ where: { orderId } })` === **1** になることを確認する。
  これが無いと「制約のせいで 1 番目すら書かれなかった」場合と区別できず、
  上で退けた `order.delete` 方式と同じ穴に戻る。**対照が 1・本番が 0** で初めてロールバックの証明になる。

- **もし** Drift check で route が upsert と update を `$transaction` で括っていない（2 つの独立書き込み）
  ことが判明したら、それは**原子性の欠陥**。テストを削って隠さず、失敗テストとして顕在化させ finding に
  登録し、JSDoc の「tx 原子性」記述を「（未担保・要修正）」に改める（scope を正直に狭める）。

> 根拠: 「境界に掲げた性質は成功例だけで満たしたことにしない」。原子性は*失敗時*にしか観測できず、
> かつ**失敗のさせ方を誤ると何も証明しないテストが緑で残る**。

**Verify**: `bun run test:integration -- tests/integration/webhook-payment.test.ts` → Stripe 分 all pass

### Step 3: PayPal 側シナリオを同ファイルに追加

`global.fetch` モック（OAuth → verify SUCCESS の 2 段）と 5 必須ヘッダーを
`src/app/api/webhooks/paypal/route.test.ts:10-52,64` のパターンで設定。
fixture の `resource.custom_id` を seed 済み orderId に差し替えて配送する。

**Scenario P1: COMPLETED 初回 → 行作成**（`status === "Paid"` / `paymentMethod === "PayPal"` /
`paymentIntentId` = fixture の `resource.id` / `amount` = **Order.total と同値**
（paypal route は event 額ではなく `order.total` を格納する — `route.ts:254`））

**Scenario P2: COMPLETED 再送 → 1 行のまま**（count === 1）

**Scenario P3: COMPLETED → REFUNDED 遷移 → upsert 更新**（1 行のまま `Refunded`）

**Scenario P4: プロバイダー切替の上書き**（同一 Order に Stripe イベント → PayPal イベントの順で
配送。PaymentDetails が 1 行のまま、以下が**すべて**新プロバイダー値に更新されることを assert する
—`paymentMethod` だけでなく**金額・通貨も**切替後に一貫すること）:
- `paymentMethod` が `"PayPal"` に更新される
- `amount` が **PayPal 経路の権威値（`order.total`、`route.ts:254`）**に更新される
  （Stripe 側の cents 値が残らないこと。単位・値ともに PayPal 経路の格納規則に一致）
- `paymentIntentId` が PayPal の `resource.id` に更新される（Stripe intent id が残らない）
- 通貨を格納するカラムがある場合はそれも新プロバイダー値に一致すること
  （スキーマに currency 列が無ければ「格納なし」を Current state で確認し本 assert は省略と明記）
- orderId unique 制約がプロバイダー跨ぎでも 1 行を保証する設計の固定（count === 1）

> 主眼: 「行が 1 本」だけでなく「切替で古いプロバイダーの金額・intent が残らない」ことまで固定する。
> 金額の残留は二重計上・返金額誤りに直結するため、`paymentMethod` の更新だけでは不十分。

**Verify**: `bun run test:integration -- tests/integration/webhook-payment.test.ts` → all pass

### Step 4: 全体回帰

**Verify**:
1. `bun run test:integration` → 既存 + 新規（8〜10 テスト目安）全 pass
2. `bunx tsc --noEmit` → exit 0
3. `bun run lint` → exit 0
4. `bun run test` → unit 全 pass（集計不変。特に webhook unit テスト 2 ファイルが
   モック衝突なく pass し続けること）

## Test plan

Step 2〜3 のシナリオ S1〜S4 / P1〜P4 が本体。構造の手本は
`tests/integration/order-placement.test.ts`（lifecycle 管理）+
`src/app/api/webhooks/stripe/route.test.ts`（モック設定・fixture 利用）。
完了後、テスト統計が変わるため **`spec-sync-after-test` skill を必ず起動**
（`.claude/rules/02-tdd-step-commit.md` の MUST）。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run test:integration` exits 0; `webhook-payment.test.ts` の新規テストが全 pass
- [ ] Scenario S2 / P2 で `paymentDetails.count === 1` の assert が存在する（grep で確認可:
      `grep -n "count" tests/integration/webhook-payment.test.ts` に該当行がある）
- [ ] `bunx tsc --noEmit` exits 0 / `bun run lint` exits 0 / `bun run test` exits 0（集計不変）
- [ ] **コードコミットの直前**で、`git status` に in-scope 外の変更がない（プラン index の更新と `spec-sync-after-test` の docs 同期は、後続の別コミット）
- [ ] docs 同期（QA_HANDOFF 統計 + ダッシュボード再生成）が別コミットで完了
- [ ] `plans/README.md` の 032 行が DONE に更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- `docker info` が失敗する（→ `BLOCKED (Docker unavailable)`）
- Drift check で webhook route の該当行が本プランの抜粋と一致しない
- S2 / P2 で PaymentDetails が 2 行になる、または S3 / P3 で更新されない —
  **本体バグの発見**。テストを skip して合わせ込まず、失敗内容と実測値を添えて報告
- `@/lib/db` のモックなしで route の import がテスト環境で失敗する
  （transitive import の問題 — `jest.integration.config.js` の変更が必要になる場合は STOP。
  config は out of scope）
- 検証コマンドが 2 回の修正試行後も失敗する

## Maintenance notes

- CORRECTNESS-01（`charge.refunded` の paymentIntentId 相関 — `plans/README.md` Deferred 参照）が
  実装されると Stripe 側の相関ロジックが変わる。S3 の fixture 差し替え箇所が影響を受けるため、
  その実装 PR では本テストの期待値見直しをレビュー観点に含めること。
- TESTS-02（`src/queries/stripe.ts` / `paypal.ts` の同期 capture 経路）は plan 003 の
  `$transaction` 化後に本ファイルへ同型シナリオを追加するのが低コスト（同じ seed / モック基盤）。
- PayPal REFUNDED は部分/全額を即時判定できない設計（`route.ts:33-35` コメント）。
  将来 partial 判定が入ったら P3 の期待値を分岐させる。
