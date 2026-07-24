# プラン 003: Stripe の決済状態をサーバー側で導出し、配送先住所の所有権を検証する

> 原本: [../003-server-side-payment-and-address-trust.md](../003-server-side-payment-and-address-trust.md)

> **Executor 向け指示**: このプランを順番どおりに実行すること。各検証コマンドを実行し、
> 次に進む前に期待結果を確認する。「STOP conditions」に該当する事象が起きたら、
> 停止して報告すること — 独自判断で進めない。完了したら `plans/README.md` の
> このプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**: `git diff --stat f9752c0..HEAD -- src/queries/stripe.ts src/queries/user.ts src/queries/stripe.test.ts src/queries/user.test.ts src/components/store/cards/payment/stripe/stripe-payment.tsx`
> 対象ファイルのいずれかがこのプラン作成後に変更されていれば、「Current state」の
> 抜粋を実コードと比較すること。不一致があれば STOP。

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `f9752c0`, 2026-07-03

## なぜ重要か

2つのサーバーアクションが、金銭と PII を左右するクライアント提供データを信頼している:

1. **Stripe capture** — `createStripePayment(orderId, paymentIntent)` は、サーバー側の `stripe.paymentIntents.retrieve()` を一切行わずに、クライアントから渡された `PaymentIntent` オブジェクトからそのまま `paymentStatus`、`amount`、`currency` を書き込む。自分の注文を所有するユーザーは、偽造した `{ status: "succeeded", amount: <任意> }` でこのアクションを呼び、実際の課金なし・署名済み webhook の発火なしに、自分の未払い注文を `Paid` に変え、攻撃者が選んだ金額を記録できる。
2. **Address ownership** — `placeOrder(shippingAddress, cartId)` は、そのアドレスが現在のユーザーに属するか確認せずに `shippingAddress.id` をそのまま作成した注文に使用する；`getOrder` は後にその住所を関連ユーザーの PII とともに返す。

いずれも「セキュリティ上重要な状態についてクライアントを信頼してはならない」バグである。本プランはサーバーを信頼の源泉にする: PaymentIntent を id で Stripe から再取得し、使用前に住所所有権を検証する。

## Current state

- `src/queries/stripe.ts` — `createStripePaymentIntent`（intent を作成、`orderId` metadata あり）と `createStripePayment`（脆弱な capture の書き手）。
- `src/queries/user.ts` — `placeOrder`（注文を作成；`shippingAddress.id` を信頼）。
- `src/components/store/cards/payment/stripe/stripe-payment.tsx` — クライアント呼び出し元；`paymentIntent` 全体を `createStripePayment` に渡す（~60行目）。

脆弱な capture、`src/queries/stripe.ts:71-138`（要点行に抜粋）:

```ts
export const createStripePayment = async (
    orderId: string,
    paymentIntent: PaymentIntent   // ← whole object from the client
) => {
    const user = await currentUser();
    if (!user) throw new Error("Unauthenticated.");

    const order = await db.order.findUnique({ where: { id: orderId, userId: user.id } });
    if (!order) throw new Error("Order not found.");

    const updatedPaymentDetails = await db.paymentDetails.upsert({
        where: { orderId },
        update: {
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount,          // ← client value
            currency: paymentIntent.currency,      // ← client value
            status: paymentIntent.status === "succeeded" ? "Completed" : paymentIntent.status,
            userId: user.id,
        },
        create: { /* same fields */ },
    });

    const updatedOrder = await db.order.update({
        where: { id: orderId },
        data: {
            paymentStatus: paymentIntent.status === "succeeded" ? "Paid" : "Failed",  // ← client-derived
            paymentMethod: "Stripe",
            paymentDetails: { connect: { id: updatedPaymentDetails.id } },
        },
        include: { paymentDetails: true },
    });
    return updatedOrder;
};
```

intent はサーバー側で認証済み Stripe クライアントを使って作成されている、`src/queries/stripe.ts:41-46`:

```ts
const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(order.total.toNumber() * 100), // cents
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    metadata: { orderId },
});
return { paymentIntentId: paymentIntent.id, clientSecret: paymentIntent.client_secret };
```

脆弱な order create、`src/queries/user.ts:609-616`:

```ts
const order = await db.$transaction(async (tx) => {
    const order = await tx.order.create({
        data: {
            userId,
            shippingAddressId: shippingAddress.id,   // ← ownership never checked
            orderStatus: 'Pending',
            paymentStatus: 'Pending',
            ...
```

`placeOrder` は `shippingAddress.countryId`（601行目）と `shippingAddress.id` のみを読み；そのアドレスが `shippingAddress.userId === user.id` であることを一切確認しない。

### リポジトリ規約

- **外部呼び出しは try/catch でラップ**し `instanceof Error` で narrowing、構造化ログ `console.error("[Module:Function] msg", { error, stack })`（`.claude/steering/tech.md` 参照）。`stripe.ts` は現在古い3引数形式の `console.error` を使用している — 新規 catch を追加する場合以外はこのファイル内の既存スタイルを維持し、新規 catch を追加する場合は構造化2引数形式を使うこと。
- `stripe` クライアントは既に `src/queries/stripe.ts` 内で import/初期化済み（`createStripePaymentIntent` が使用）。これを再利用する。
- `placeOrder` はインライン `currentUser()` を使用している（既存）— ここで auth-guards への移行はしない。
- 金額の精度: 金額は `Decimal(12,2)`；既存以上の float 演算を持ち込まないこと。

## 必要なコマンド

| 目的   | コマンド                                       | 期待結果          |
|-----------|-----------------------------------------------|-------------------|
| 型チェック | `bunx tsc --noEmit`                           | exit 0            |
| ユニットテスト | `bun run test -- src/queries/stripe.test.ts`  | 全件 pass          |
| ユニットテスト | `bun run test -- src/queries/user.test.ts`    | 全件 pass          |
| Lint      | `bun run lint`                                | exit 0（警告は許容） |

## Scope

**対象内**:
- `src/queries/stripe.ts` — `createStripePayment` のシグネチャ + サーバー側再取得
- `src/components/store/cards/payment/stripe/stripe-payment.tsx` — サーバーが必要とする値のみを渡すよう呼び出しを更新
- `src/queries/user.ts` — `placeOrder` の住所所有権チェック
- `src/queries/stripe.test.ts`、`src/queries/user.test.ts` — テスト
- `plans/README.md` — 完了時に plan 003 のステータスを更新（別の docs コミット）

**対象外**:
- 署名済み webhook ハンドラ（`src/app/api/webhooks/stripe/route.ts`）— 既に権威的経路；変更しない。
- PayPal capture（`src/queries/paypal.ts`）— 別サーフェス；記録はするが触らない。
- `PaymentDetails.amount` の単位不一致（Stripe cents vs PayPal dollars）— 別 finding（CORRECTNESS-05）；ここでは試みない。
- `placeOrder` / `createStripePayment` の認可を auth-guards へ移行すること。

## Git ワークフロー

- Branch: `advisor/003-server-side-payment-trust`
- コミットスタイル: `fix(payment): derive stripe state server-side; verify address ownership`
- 指示がない限り push や PR は作成しないこと。

## Steps

### Step 1: `createStripePayment` を id を受け取り Stripe から再取得するよう変更

シグネチャを `(orderId: string, paymentIntent: PaymentIntent)` から `(orderId: string, paymentIntentId: string)` に変更する。注文所有権チェック直後に、権威的な intent を取得する:

```ts
export const createStripePayment = async (
    orderId: string,
    paymentIntentId: string
) => {
    try {
        const user = await currentUser();
        if (!user) throw new Error("Unauthenticated.");

        const order = await db.order.findUnique({ where: { id: orderId, userId: user.id } });
        if (!order) throw new Error("Order not found.");

        // 権威的なソースは Stripe。クライアント値ではなく retrieve した intent から導出する。
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        // この intent が当該 order のものであることを検証（metadata.orderId は intent 作成時に付与）。
        if (paymentIntent.metadata?.orderId !== orderId) {
            throw new Error("Payment intent does not match order.");
        }
        // ... existing upsert/update, now reading from the retrieved paymentIntent ...
```

関数本体の残りは構造的には同じままだが — すべての `paymentIntent.*` が今や**取得済み**のオブジェクトを参照するため、`amount`、`currency`、`status` は Stripe 権威になる。それ以外の upsert/update の形は変更しないこと。

> **「Stripe 権威」と「この注文と一致する」は別物である。** retrieve が証明するのは intent 自身の
> 値であって、それが注文の請求額と合致することではない。upsert の前に明示的に突き合わせること —
> さもないと `order.total` と異なる `amount`（あるいは `usd` 以外の通貨）の intent が
> この注文の決済として記録される:
>
> ```ts
> // metadata が正しくても amount/currency が食い違う intent を弾く
> const expectedAmount = toStripeAmount(order.total);
> if (paymentIntent.amount !== expectedAmount || paymentIntent.currency !== "usd") {
>     throw new Error("Payment intent amount/currency mismatch.");
> }
> ```
>
> `toStripeAmount` は intent 作成時と**同一**の Decimal ベースのヘルパー
> （`order.total.mul(100).toDecimalPlaces(0).toNumber()`）でなければならない。さもないと
> 作成時と照合時がズレる。
>
> **実装済みのため再導出しないこと**: `src/queries/stripe.ts` は現在さらに
> (a) 作成時に有効な intent id を記録し capture 時に一致を要求する、
> (b) 確定済み `paymentStatus` からの遷移を拒否する — を行っており、metadata+amount+currency
> だけでは残る「古い Pending/canceled intent が Paid を退行させる」穴を塞いでいる。
> 詳細は [`audit/VETTED_FINDINGS.md`](../audit/VETTED_FINDINGS.md) の Round 10 / CR-03 を参照。

**検証**: `bunx tsc --noEmit` → exit 0。

### Step 2: クライアント呼び出し元を id のみ渡すよう更新

`src/components/store/cards/payment/stripe/stripe-payment.tsx`（呼び出し箇所 ~60行目）で、`createStripePayment(orderId, paymentIntent)` を `createStripePayment(orderId, paymentIntent.id)` に変更する。それ以外の Stripe.js 確認フローは変更しない。

コンポーネントが他所で `paymentIntent` オブジェクト全体をまだ参照する場合、ローカル変数はそのまま残す — Stripe.js は `confirmPayment` から引き続きそれを返す。サーバーアクションの引数だけが変わる。

**検証**: `bunx tsc --noEmit` → exit 0。

### Step 3: `placeOrder` で配送先住所の所有権を検証

`src/queries/user.ts` の `placeOrder` 内で、カートがロードされた後（~442行目以降）かつ注文を作成する `$transaction` の**前**に、所有権チェックを追加する:

```ts
// shippingAddress の所有権検証（IDOR 防止: 他ユーザーの住所 id を注文に付けさせない）
const ownedAddress = await db.shippingAddress.findFirst({
    where: { id: shippingAddress.id, userId },
});
if (!ownedAddress) throw new Error("Shipping address not found.");
```

そのうえで、**残りのフローで使う住所の値はすべてクライアント供給の `shippingAddress` ではなく `ownedAddress` から導出する** — 配送料の引き当てには `ownedAddress.countryId`、注文の `shippingAddressId` には `ownedAddress.id` を使う。

> **`shippingAddress.countryId` を読み続けてはならない。** 上の所有権チェックが証明するのは
> `shippingAddress.id` が呼び出し元のものであることだけで、クライアント供給オブジェクトの
> **他のフィールドについては何も保証しない**。呼び出し元は**自分の**住所 `id` と**偽装した**
> `countryId` を組み合わせれば、このチェックをそのまま通過できる。`countryId` は
> `getDeliveryDetailsForStoreByCountry` を駆動するため、偽装値は別の国の配送料率を選択させる:
> IDOR は塞がるが**配送料の改ざんは開いたまま**になる。id の所有権は行の完全性ではない —
> 行を読み直してサーバー側の値を使うこと。

**検証**: `bunx tsc --noEmit` → exit 0。

### Step 4: テスト — Stripe のサーバー側導出

`src/queries/stripe.test.ts` にて:
- `stripe` クライアントの `paymentIntents.retrieve` をモックし、制御された intent を返すようにする。
- **Happy path**: retrieve が `{ id, status: "succeeded", amount, currency, metadata: { orderId } }` を返す；注文が `paymentStatus: "Paid"` に更新され、`PaymentDetails.amount`/`currency` が取得済みオブジェクトから来ることを assert する。
- **偽造/回帰**: クライアントが渡した id の取得結果の `metadata.orderId` が `orderId` と**一致しない**；`"Payment intent does not match order."` を throw し `db.order.update` が呼ばれ**ない**ことを assert する。
- **未成功**: 取得結果 `status: "requires_payment_method"` → 注文 `paymentStatus: "Failed"`。

`stripe` モジュールのモックに `paymentIntents.retrieve: jest.fn()` が含まれることを確認する。

**検証**: `bun run test -- src/queries/stripe.test.ts` → 全件 pass。

### Step 5: テスト — `placeOrder` の住所所有権

`src/queries/user.test.ts` の `placeOrder` describe にて:
- **回帰**: `mockDb.shippingAddress.findFirst.mockResolvedValue(null)` → `placeOrder` が `"Shipping address not found."` で reject し、`$transaction` / `order.create` が一切走らない。
- **Happy path**: `findFirst` が所有アドレスを返す → 注文が進む（既存の happy-path の期待値が動き続けるよう維持；セットアップに `findFirst` モックを追加）。

`mockDb.shippingAddress` に `findFirst` が無ければ、そのモックに `findFirst: jest.fn()` を追加する。

**検証**: `bun run test -- src/queries/user.test.ts` → 全件 pass。

### Step 6: 完全な型チェック + lint

**検証**: `bunx tsc --noEmit` → exit 0；`bun run lint` → exit 0。

## Test plan

- `stripe.test.ts`: happy path（取得済み intent から Paid）、偽造拒否（metadata 不一致 → throw、注文更新なし）、失敗ステータス。
- `user.test.ts`: 住所所有権拒否（findFirst null → throw、トランザクションなし）と happy path。
- 構造パターン: 各テストファイル内の既存 describe ブロック；`docs/testing/SECURITY_GAP_REPORT.md` §5.2 の IDOR-拒否スタイル（throw + 副作用なし）。
- 検証: 両テストコマンドが新規テストとともに pass する。

## Done criteria

以下すべてを満たすこと:

- [ ] `bunx tsc --noEmit` が exit 0
- [ ] `bun run test -- src/queries/stripe.test.ts` が exit 0；偽造拒否テストが存在し pass
- [ ] `bun run test -- src/queries/user.test.ts` が exit 0；住所所有権テストが存在し pass
- [ ] `grep -n "paymentIntents.retrieve" src/queries/stripe.ts` がサーバー側再取得を示す
- [ ] `grep -n "shippingAddress.findFirst" src/queries/user.ts` が所有権チェックを示す
- [ ] `createStripePayment` のシグネチャが `paymentIntentId: string` を取る（`PaymentIntent` ではない）
- [ ] **コードコミットの時点で**、対象外リストのファイルが一切変更されていない（`git status`）— `plans/README.md` のステータス行更新は別の docs コミットで行う
- [ ] `plans/README.md` の 003 のステータス行が更新されている

## STOP conditions

以下に該当する場合は停止して報告すること:

- 「Current state」の抜粋のいずれかが実コードと一致しない（ドリフト）。
- `src/queries/stripe.ts` の `stripe` クライアントの export が `createStripePayment` から再利用できない（例: `createStripePaymentIntent` 内だけで作成されている）— 報告して初期化を先に引き上げられるようにする。
- `PaymentIntent` 型の引数を削除すると見えない別の呼び出し元が壊れる — その呼び出し元を報告する。
- 妥当な修正を試みてもテストが2回失敗する。
- 取得済み intent の `metadata.orderId` が正規フローのテスト fixture に実は無い（intent 作成時に抜粋の主張どおり metadata が付与されていないことを意味する）— マッチチェックを弱める前に報告する。

## Maintenance notes

- これにより署名済み webhook とこのアクションが `amount`/`currency` のソース（どちらも Stripe 権威）で一致し、ドリフトリスクが減る — ただしプロバイダ間の `PaymentDetails.amount` 単位不一致（CORRECTNESS-05）は未解決であり別途プラン化すべき。
- レビュアーは変更後、引数からは `paymentIntent.status`/`.amount` が一切読まれず、取得済みオブジェクトからのみ読まれることを確認すること。
- PayPal capture（`paypal.ts`）が後に同様に堅牢化される場合、このパターン（サーバー側再取得 + order マッチ）を踏襲すること。
- 先送り事項: 通貨単位の正規化と `stripe.ts` の古い3引数ログ（tech-debt パスで構造化ログへ変換）。

### 本プラン完了後の乖離（2026-07-18 追記）

本プランは **DONE**（PR #158 としてマージ済み）だが、**対象は当初スコープ
（サーバー側 Stripe 再取得と住所所有権の `findFirst`）に限る**。上記ステップは commit
`f9752c0` 時点の計画の記録であり、意図的に改変していない。以下 **5 点**のうち、
**1–2** はその後コード側で*移動*したため **ステップ本文を現行仕様として読まないこと**。
**3–5 の 3 点は本プランの DONE では閉じない未解決の follow-up** であり、特に住所所有権の
TOCTOU（**5**）は未修正。3–5 は完了済みではなく追跡中のギャップとして扱うこと:

1. **`requires_payment_method` は無条件 `Failed` ではない。**
   Step 4 は当該ステータスを `paymentStatus: "Failed"` へ写像する前提だが、
   現行の `src/queries/stripe.ts` は `last_payment_error` の有無で分岐する。
   このステータスは「拒否されて再入力が必要」と「まだ決済手段が付いていない
   初期状態」の双方で返るため、status だけでは失敗と判別できない。初期状態を
   `Failed` で確定させると再試行を塞ぐ。現行の写像は
   `last_payment_error ? "Failed" : "Pending"`。
2. **セント換算は共通化され、float ベースではなくなった。**
   79-84 行の抜粋は作成時の `Math.round(order.total.toNumber() * 100)` を
   示すが、現在は作成時・照合時とも単一のヘルパー `toStripeAmount()`
   (`stripe.ts:52`) を呼ぶ。実装は `.claude/steering/tech.md` の
   `Prisma.Decimal` 規約に従い `total.mul(100).toDecimalPlaces(0).toNumber()`。
   作成時と照合時で導出方法が異なると、正当な決済が
   `paymentIntent.amount !== expectedAmount` ガードで弾かれる。
3. **住所所有権のテストは「クライアント由来フィールドを使わないこと」を
   assert すべき。** Step 5 のテスト（239-247 行付近）は拒否経路
   （`findFirst` → null）と正常系を固定するが、引数の
   `shippingAddress.<field>` を密かに読み続ける回帰はこれを通過してしまう。
   恒久的な assertion は「永続化された注文が **DB から取得した**住所を
   持つこと」— 例えば `findFirst` にクライアント供給オブジェクトとは異なる
   値の住所を返させ、保存値が引数ではなく DB 行と一致することを検証する。
4. **amount/currency の突合には独立した回帰テストが要る。** Step 4 のリスト
   （230 行付近）は metadata 不一致と status 写像を固定するが、
   `paymentIntent.amount !== expectedAmount || currency !== "usd"` ガード
   （174-178 行）を固定していない。ケースを追加する: `metadata.orderId` は一致するが
   amount が食い違う（または非 `usd`）retrieve 済み intent が
   `"Payment intent amount/currency mismatch."` を throw し、`order.update` が走らないこと。
5. **住所所有権の読み取りは注文トランザクション内に置くべき。
   Status: OPEN — 本プランでは未修正。** Step 3（202-209 行）は
   `findFirst` を `$transaction` の**外**で行うため、チェックと `order.create` の間で
   住所が削除・再割当てされる TOCTOU 窓が残る。恒久的な形は、`shippingAddressId` を書く
   同一 `tx` の中で所有権を読む（または再検証する）ことで、チェックと使用が乖離しない。
   これが入るまで、住所所有権 TOCTOU を解決済みとして（plan index / セキュリティ報告に）
   記録しないこと。

本プランを土台にした後続の決済作業: `plans/059`（PayPal capture 検証。共有ヘルパー
`isSettledPaymentStatus` を `src/lib/payment-status.ts` から再利用する —
**本モジュールから再 export はしない**）および 2026-07-18 の CodeRabbit Phase 1
（冪等キー付与 + ステータス書き込みの CAS 化）— 詳細は `docs/testing/COVERAGE_REPORT.md §7`。
