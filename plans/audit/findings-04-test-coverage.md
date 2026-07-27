# Findings 04 — Test Coverage（raw・未 vet）

> Explore サブエージェント報告（2026-07-03 / HEAD `f9752c0`）。**Phase 3 の vet 前の生データ**。
> 総評: テスト資産は成熟（グルーピング・キャップ・店舗クーポン・IDOR・restock・webhook 署名は既カバー）。
> 危険な残余は**収益経路の挙動保証**（原子性・オーバーセルロールバック・実 Stripe/PayPal ペイロード形状・クライアント capture オーケストレーション）が passthrough モックのみ、または未検証である点に集中。

### [TESTS-01] Client-side payment/checkout orchestration layer has zero component tests

> **⚠️ 訂正（2026-07-17）**: 原文の Evidence は「`cards/place-order.tsx` を含めすべてテストなし」と
> していたが、これは**採取時点で既に誤り**だった。原因は探索方法で、**co-located テストのみを
> 探し、本リポジトリのコンポーネントテスト規約である `tests/component/` を見ていない**
> （`.claude/steering/tech.md`「テスト要件」表が定める配置）。`place-order.tsx` には監査 HEAD
> `f9752c0` 時点で `tests/component/store/place-order-card.test.tsx` が存在した
> （追加コミット `0e10650`。同テストは `@/components/store/cards/place-order` を直接 import）。
> 見出しの "zero component tests" も同様に過大。**残り 4 ファイルの所見は検証の結果正しい**。
> Round 4 の再検証・残余のプラン化は
> [`findings-12-test-coverage.md`](findings-12-test-coverage.md)（reconcile 表 TESTS-01 行 →
> 「部分解消」/ 残余は **plan 030**）を正とする。

- **Evidence（訂正後・監査時点）**: `src/components/store/cards/payment/stripe/stripe-payment.tsx`（`createStripePayment` 呼び出し）/ `payment/paypal/paypal-payment.tsx`（`capturePayPalPayment`）/ `checkout-page/container.tsx` / `order-page/*` — テストなし。**測定: 2026-07-03 / HEAD `f9752c0`**。再現コマンド:

  ```bash
  git ls-tree -r --name-only f9752c0 tests/component/   # tests/component/ 側に該当なし
  git ls-tree -r --name-only f9752c0 src/components/store/cards/payment/ | grep -i test
  ```

- **再測定（2026-07-18 / HEAD 未記録）**: 上記 4 ファイルは**依然として未カバー**。
  ⚠️ **この行は測定 HEAD を欠いている** —— 当時インラインで追記されたため記録が残っていない。
  同日の最終コミットは `c77cdd7d`（`git log --until='2026-07-18 23:59' -1` で得た上界）だが、
  測定時点の作業ツリーがこれと一致していた保証は無い。**次回の再測定時に上のコマンドを
  実行し、日付 + HEAD 付きの行で置き換えること**（この不備自体が下の規約の実例）。

  > **測定は「日付 + HEAD + 再現コマンド」の 3 点セットで、行を分けて追記すること**。
  > この finding は複数ラウンドにまたがって参照されるため、
  > (a) 日付の無い「現 HEAD」は読んだ時点によって指すコミットが変わり、いつの測定なのか
  > 復元できなくなる。(b) 日付だけあっても HEAD が無ければ、その日の作業ツリーが
  > どの状態だったか再現できない。(c) 監査時点の Evidence 行に後日の再測定を
  > **インラインで混ぜると**、「監査時に何が見えていたか」と「その後どうなったか」が
  > 分離できなくなる（この行自体が 2026-07-27 まで違反していた）。
  > 更新時は監査時点の値を上書きせず、**測定日付きの独立した行を足す**こと。
- **Evidence（誤りとして撤回）**: ~~`cards/place-order.tsx`（`placeOrder`）~~ — 監査時点で `tests/component/store/place-order-card.test.tsx` によりカバー済み。
- **Impact**: capture をいつ呼ぶか・失敗ハンドリング・二重送信ガードを担うクライアント層の回帰が無検出で通る。唯一の演習は間欠ハングが追跡中の E2E のみ（ただし place-order の再入ガードは component テストで演習済み）。
- **Effort**: L / **Risk**: LOW / **Confidence**: HIGH（訂正後の 4 ファイルについて）
- **Fix sketch**: server action をモックした RTL テストで happy path / 失敗 toast / submit ボタンの再入ガードを検証。優先: `stripe-payment.tsx`・`paypal-payment.tsx`（`place-order.tsx` はカバー済みのため対象外）。

### [TESTS-02] Synchronous capture paths (createStripePayment / capturePayPalPayment) lack integration coverage; two-write consistency untestable as written

- **Evidence**: `src/queries/stripe.ts:91-138` — `paymentDetails.upsert` → `order.update` が **`db.$transaction` なし**の 2 書き込み（webhook 側 `webhooks/stripe/route.ts:153-180` は原子的で対照的）。`src/queries/paypal.ts:222-281` — 同じ非原子 upsert→update + `Number(captureData.purchase_units[0].payments.captures[0].amount.value)` の深い non-null チェーン & 金額の float パース。
- **Evidence**: `stripe.test.ts` / `paypal.test.ts` は Prisma 全体モック。`tests/integration/` に決済 capture のエントリなし。
- **Evidence**: status 規約の分岐 — sync 経路は `PaymentDetails.status = "Completed"`（`stripe.ts:102`, `paypal.ts:230`）、webhook は `"Paid"`/`"Refunded"`（enum）。契約を固定するテストなし。
- **Impact**: 2 書き込み目が失敗すると**課金成功なのに Order は Pending のまま**。モックテストでは原理的に検出不能。
- **Effort**: M / **Risk**: MED（$transaction 化は書き込みセマンティクス変更） / **Confidence**: HIGH（ギャップと非原子性）/ MED（status 分岐）
- **Fix sketch**: testcontainers 統合テスト（ゲートウェイ応答スタブ + 2 書き込み目の強制失敗）+ 両経路の `$transaction` 化 + status 値の正規化。

### [TESTS-03] Stripe `charge.refunded` test asserts against a fixture carrying `charge.metadata.orderId` that real charges do not inherit

- **Evidence**: `webhooks/stripe/route.ts:47-55`（相関元）/ `src/queries/stripe.ts:41-46`（metadata は PaymentIntent のみ）/ `tests/fixtures/webhooks/stripe/charge-refunded-full.json`（手書き fixture が metadata.orderId を持つ）/ `stripe/route.test.ts:245-259`。
- **Impact**: 「fixture をテストして現実をテストしない」教科書例。本番の refund は 400 分岐へ（CORRECTNESS-01 と同根）。
- **Effort**: S〜M / **Risk**: LOW / **Confidence**: MED
- **Fix sketch**: `charge.payment_intent` 経由の相関に変更し、Stripe CLI で捕獲した実ペイロードに fixture を差し替え。

### [TESTS-04] Webhook route handlers have no integration coverage; `$transaction` atomicity and unique-constraint idempotency asserted only via passthrough mocks

- **Evidence**: `stripe/route.test.ts:63-66` / `paypal/route.test.ts` — `$transaction` を `callback(mockDb)` にモック。冪等性テスト（`stripe/route.test.ts:305-325`）は upsert が同じ where で 2 回呼ばれたことのみ検証。`tests/integration/` に webhook なし。Svix 経路（`webhooks/route.ts`）も `wh.verify` モックのみ。
- **Impact**: 原子的更新と orderId-unique による再配送冪等性という中核保証が挙動レベルで未検証。
- **Effort**: M / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: testcontainers で検証済みイベントを 2 回 POST し、PaymentDetails 1 行 + Order 整合を実 DB で検証。

### [TESTS-05] `placeOrder` atomic stock decrement & oversell-rollback branch never exercised by integration test

- **Evidence**: `src/queries/user.ts:716-728` — 条件付き `size.updateMany({ where: { quantity: { gte } }, decrement })` + `count === 0` throw（TOCTOU ガード）。`tests/integration/order-placement.test.ts` の 6 シナリオは Scenario 3 が在庫にキャップするため decrement は常に成功し、rollback 経路と減算後の `Size.quantity` 検証がない。
- **Impact**: 在庫整合性の最重要保証（オーバーセルなし・マルチストア注文の全ロールバック）に実 DB テストなし。
- **Effort**: M / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**:
  - **(a) 正常系の減算**: 注文後に `Size.quantity` が注文数分減ることを assert。
  - **(b) `count === 0` ロールバック分岐の再現** — **単純な「在庫不足 seed」では到達しない**:
    > `placeOrder` は `validQuantity = Math.min(quantity, size.quantity)`（`user.ts:494`）で
    > **注文数を在庫上限にクランプ**してから減算する。したがって「在庫 1 に対して 5 個注文」の
    > ように**単に在庫を不足させても、注文数が 1 にクランプされて
    > `where: { quantity: { gte: item.quantity } }` を満たしてしまい、`count === 0` 分岐には
    > 到達しない**（既存の `order-placement.test.ts` Scenario 3 がまさにこの状態で、
    > だから rollback 経路が未検証のまま残っている）。**この区別が本 finding の肝**。
    >
    > 正しい再現方法は、**クランプ時点では十分な在庫があり、減算が実行される
    > 時点で条件を満たさなくなっている**状況を作ること:
    > 1. **十分な在庫**（例: 5）で seed する → `validQuantity` はクランプされず 5 のまま確定。
    > 2. `placeOrder` の `$transaction` が該当 `size.updateMany` に到達する**前**に、
    >    在庫を減らして条件（`quantity >= 5`）を破る。実現手段は
    >    (i) 同一 tx 内でその Size を先に消費させる **マルチアイテム/マルチストア注文**を
    >    組み、後続アイテムの減算時に在庫が尽きるようにする（tx 内で完結し、
    >    外部からの介入が不要なので決定的）か、
    >    (ii) 一時的な CHECK 制約等で当該 UPDATE を失敗させる（plan 035 / 038 と同型）。
    > 3. assert: throw + **Order / OrderGroup / OrderItem が 0 行**（tx 全体のロールバック）
    >    + **先に減算されたはずの Size.quantity も元値のまま**（部分減算が残らないこと）。
    >
    > 「在庫不足 seed で throw する」とだけ書くと、実装者はクランプに阻まれて分岐に
    > 到達できず、**到達しないまま green のテストを書いてしまう**（= 本 finding が
    > 指摘したギャップがそのまま残る）。

### [TESTS-06] Inventory restore + cancel/refund cascade: atomic double-restock guard has no real-DB test (and no admin E2E)

- **Evidence**: `src/queries/order.ts:562-651`（`updateOrderPaymentStatus` の `notIn:[Cancelled,Refunded]` 条件付き updateMany + restock カスケード）/ `order.ts:459-510`（`updateOrderGroupStatusAsAdmin`）。`order.test.ts:1140-1256` は `$transaction` passthrough + `{ count: 1 }` 手動設定。`tests/integration/` に restock/increment/decrement なし。admin フローの E2E なし。
- **Impact**: 二重 cancel/refund による在庫インフレ防止ガードはモックでは検証不能な並行セマンティクス。
- **Effort**: M / **Risk**: LOW / **Confidence**: MED-HIGH
- **Fix sketch**: 実 DB で cancel/refund 遷移を実行し restock がちょうど 1 回であることを検証。任意で admin 注文ステータス変更の E2E 1 本。

### [TESTS-07] `computeShippingTotal`（配送料計算の SSOT）has no direct unit test

- **Evidence**: `src/lib/shipping-utils.ts`（42 行・規約 #9 の一元化関数）に `shipping-utils.test.ts` なし。統合テスト内で**オラクル**としてのみ参照（自分自身と比較するため自己整合バグは検出不能）。
- **Impact**: WEIGHT/FIXED・追加アイテム・0/負数量・丸め境界が直接検証されていない。
- **Effort**: S / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: ITEM/WEIGHT/FIXED × 単数/複数 × 丸め境界を明示期待値で co-located テスト化。

### [TESTS-08] PLATFORM-coupon rounding-remainder absorption in `placeOrder` has no cent-exact assertion

- **Evidence**: `src/queries/user.ts:627-674` — 最終店舗グループが `platformTotalDiscount.sub(cumulative)` の残差を吸収（決定論的 `localeCompare` ソートの存在理由）。統合 Scenario 4 は STORE クーポンのみ。E2E `platform-coupon.spec.ts:106-165` はセント単位の pin なし。
- **Effort**: S / **Risk**: LOW / **Confidence**: MED
- **Fix sketch**: 割り切れない割引額での 2〜3 店舗統合シナリオを追加し、各グループ total をセント単位で assert。

### [TESTS-09] `jest.config.js` blanket-excludes every `page.tsx` from the coverage denominator, hiding logic-bearing server code

- **Evidence**: `jest.config.js:30` — `"!src/app/**/{layout,loading,error,not-found,template,page}.tsx"`。しかし `(store)/checkout/page.tsx` は db フェッチ + `parseUserCountryCookie`、`product/[productSlug]/[variantSlug]/page.tsx`（152 行）等はロジック保有。
- **Impact**: ロジックを持つ page.tsx の未テスト分岐がカバレッジ指標から不可視。「純 RSC ラッパー」というコメントの前提が一様に成立していない。
- **Effort**: S / **Risk**: LOW（報告 % は低下する） / **Confidence**: MED
- **Fix sketch**: 除外を真に自明なラッパーに絞るか、重いロジックを container/query モジュールへ移す（既存 `checkout-page/container.tsx` パターン）。

### [TESTS-10] (investigate) Oversized UI snapshots are effectively unreviewable

- **Evidence**: `tests/component/ui/__snapshots__/calendar.test.tsx.snap`（656 行）/ command（260）/ select（217）/ breadcrumb（216）/ pagination（202）。
- **Effort**: S / **Risk**: LOW / **Confidence**: LOW（`docs/testing/B1_SNAPSHOT_EXPANSION_PLAN.md` の意図と要照合）
- **Fix sketch**: 最大級のスナップショットを挙動 assert か小さいサブツリーへ置換。B1 計画と照合してから。

---

**Areas checked and found clean**: cart merge/sync + クーポン適用系 4 統合シナリオ / `useCartStore` の stock-clamp / `middleware.test.ts` / Svix 署名・user CRUD 分岐 / Stripe・PayPal webhook の署名欠落・未知イベント・not-found・DB エラー分岐 / IDOR 3 階層の一貫適用 / stray `.only` なし・skip はすべて追跡済みリストと一致 / `updateSizeStock` の原子的 updateMany 直接テスト。
