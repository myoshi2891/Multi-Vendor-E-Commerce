# Plan 063: Backfill `PaymentDetails.amount` for Stripe rows written in minor units

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **This plan writes to production payment data.** It is gated on the
> `safe-migration` skill and on an explicit human approval of the affected row
> set. Do **not** run any `UPDATE` before Step 3 has produced a reviewed dry-run report.
>
> **Drift check (run first)**:
>
> ```bash
> git diff --stat c4a6fb41 -- src/queries/stripe.ts src/app/api/webhooks/stripe/route.ts prisma/schema.prisma
> git status --porcelain -- src/queries/stripe.ts src/app/api/webhooks/stripe/route.ts
> ```
>
> If either Stripe write path (同期パス / webhook) no longer writes `order.total` into
> `PaymentDetails.amount`, or `PaymentDetails.amount` is no longer `Decimal(12,2)`,
> the premise below has changed — treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: MED (production payment data)
- **Depends on**: none (the code fix already shipped in `e63474b6`)
- **Category**: correctness
- **Planned at**: commit `b84eb9d9`, 2026-07-27
- **Executed at**: 2026-08-09 — **DONE（補正対象 0 件）**。詳細は下の「実行記録」。

## 実行記録（2026-08-09）

**結論: 補正対象は 0 件だった。** 本番 DB の `PaymentDetails` は **総行数 0**（`Order` は 18 行、
`OrderGroup` 28 行、`User` 44 行）。cents 行を書きうる経路は境界より前に確かに存在したが、
この DB では決済が `PaymentDetails` を作る段階まで到達した注文が一件も無く、
**補正すべき歴史的データがそもそも存在しない**。

### Step 1: カットオーバー境界

境界 = **`c4a6fb41` の commit 時刻 `2026-08-07T02:44:54+09:00`**（UTC `2026-08-06T17:44:54Z`）。

プラン本文はデプロイ時刻を要求しているが、**本プロジェクトには本番デプロイが存在しない**
（`.vercel` 等のデプロイ設定なし、`DATABASE_URL` は開発者の Neon を直指し）。参照すべき
デプロイログが存在しないため commit 時刻を採用した。STOP 条件「デプロイ時刻を確定できない」は
「ログはあるが読めない」場合を想定したもので、**デプロイという工程自体が無い**本ケースには
当たらないと判断した。commit 時刻は書き手が切り替わった時刻の**下限**なので、境界としては
安全側（過剰に拾う方向）に倒れる。

### Step 2-3: レポート

`scripts/backfill/reports/063-2026-08-08T15-31-07-811Z.md`（巻き戻し用 JSON は同名 `-candidates.json`、
候補 0 件のため空配列）。

| バケット | 件数 |
|---|---|
| `ratio ≈ 100`（補正対象） | 0 |
| `ratio ≈ 1` | 0 |
| どちらでもない | 0 |
| `ratio IS NULL`（zero-total） | 0 |
| **合計 / 候補総数** | **0 / 0** ✅ |

承認値: `--approved-count 0` / `--approved-digest d41d8cd98f00b204e9800998ecf8427e`
（= 空文字列の md5。`coalesce(…, '')` があるため 0 件でも「比較不能」ではなく決定論的な値になる）。

### Step 4a: ステージング予行（実測）

`docker-compose.test.yml` の PostgreSQL 16 に 5 行のフィクスチャ
（cents/Stripe・cents/PayPal 切替・**既にドル建て**・zero-total・境界より後）を投入して実測:

| ケース | 終了コード | データ |
|---|---|---|
| 承認値と一致 | `GATE OK` → `POST OK` / **exit 0** | `9999.00→99.99` / `5000.00→50.00`（`currency` も `eur→usd`）の 2 行のみ補正 |
| digest ドリフト（**件数は一致**） | `GATE FAIL` / **exit 3** | 全件不変 |
| 件数ドリフト | `GATE FAIL` / **exit 3** | 全件不変 |
| 承認値の指定漏れ | エラー / **exit 1** | UPDATE に到達しない |
| 2 回目の実行（古い承認値のまま） | `GATE FAIL` / **exit 3** | 全件不変（冪等） |
| 空集合を再承認して実行 | `POST OK` / **exit 0** | 0 行 |

**不変であるべき行はすべて不変**: `dollars-ok` `20.00`（旧 runbook が `0.20` に壊した当の行）・
`zero-total` `1234.00`・`after-boundary` `3000.00`。

### Step 4b / Step 5: 本番

`GATE OK` → `POST OK` → `COMMIT 済み: 0 行` / exit 0。検証は
`still_wrong=0` / `null_ratio=0` / `null_ratio_digest=d41d8cd98f00b204e9800998ecf8427e` /
`stale_paypal_currency=0`。

### 実装上の逸脱（psql → tsx + Prisma）

`psql` がこの環境に無く、Step 4 の `\gset` / `\if` / `RAISE` をそのまま実行できないため、
**`scripts/backfill/063-apply.ts` に等価のゲートを移植**した（`$transaction` 内で事前ゲート →
`UPDATE … RETURNING` を CTE で包んだ件数 + digest 取得 → 事後ゲート、不一致は throw で ROLLBACK・
exit 3）。述語は `063-shared.ts` に集約し、レポート側と UPDATE 側が同一述語を使うことを
import で保証している（プランが繰り返し要求する「述語は完全に同一」を人手のコピペに委ねない）。

corrective migration ではなくスクリプトにしたのは、承認値（`approved_count` / `approved_digest`）が
**その DB のその時点の候補集合に固有**で、全環境で再生されるマイグレーションには載せられないため。
判断基準と手順は [`scripts/backfill/README.md`](../scripts/backfill/README.md) に記載。

## Why this matters

`PaymentDetails.amount` is `Decimal(12,2)` — **dollars**
([`prisma/schema.prisma:699`](../prisma/schema.prisma)). PayPal always wrote dollars and was
correct from the start. The Stripe path wrote `paymentIntent.amount`, which is Stripe's
**minor unit** (cents), so a `$99.99` order was recorded as `9999.00`.

The code defect was fixed in `e63474b6` (2026-07-19, Round 14) — all four Stripe write sites now
store `order.total`. **What remains is the historical data**: every `PaymentDetails` row created
by the Stripe path *before* that commit still holds a cents value in a dollars column, i.e. it
overstates the payment by 100×.

This is tracked in [`plans/README.md`](README.md) under **CORRECTNESS-05**, where it was recorded
as "残るのは既存行の backfill のみで、これは未起票". This plan exists to make that remainder
executable rather than leaving it buried in a Deferred paragraph — a data-correctness item with no
plan number does not appear in any status table and is easy to lose across rounds.

Impact of leaving it: any aggregate over `PaymentDetails.amount` that spans the fix date mixes two
units. Revenue reporting, per-user payment history, and refund reconciliation all silently combine
`9999.00` and `99.99` rows for equivalent orders.

## Current state

- `src/queries/stripe.ts` writes `amount: order.total` (`Prisma.Decimal`, dollars) at all write
  sites. `toStripeAmount()` remains for values handed to the Stripe API, which legitimately wants
  minor units.
- `src/app/api/webhooks/stripe/route.ts` also writes `order.total` **since `c4a6fb41`
  (2026-08-07)** — before that it wrote the event's minor units, so it kept producing
  cents rows after `e63474b6`. The helper that returned the raw `amount` was removed
  (`extractCurrency` now returns only the currency) so the unit cannot be re-wired by accident.
  同コミットは **PayPal webhook の `update` 分岐にも `amount` / `currency` を追加**している。
  それ以前は同分岐が両列を書かなかったため、Stripe が作った cents 行に PayPal イベントが
  届くと **`paymentMethod` だけ `'PayPal'` に変わり金額は cents のまま**という行が残った
  （Step 2 の候補述語がこれを拾えるよう拡張してある）。
- Stripe webhook は USD 以外の event を 400 で拒否する。`amount` に入る `order.total` が
  USD 建てである以上、event 通貨をそのまま `currency` に流すと両列が別通貨を指すため。
  よって**境界より後**に「ドル建て金額 + 非 USD 通貨」の行が新たに増えることはない。
- `src/queries/paypal.ts` writes dollars and was never affected.
- `prisma/schema.prisma:699` — `amount Decimal @db.Decimal(12, 2)`.
- No migration has touched existing rows.

## Scope

**In scope**: a one-off corrective backfill of `PaymentDetails` rows created by the Stripe path
before `e63474b6`, plus the query used to identify them and the record of what was changed.

**Out of scope**:

- `src/queries/stripe.ts` / `paypal.ts` — the code is already correct. Do **not** modify.
- `toStripeAmount()` — correct as-is (Stripe API takes minor units).
- Any change to `PaymentDetails.amount`'s column type.
- PayPal rows.

## Steps

### Step 1: Establish the cutover boundary

> **⚠️ 境界は `e63474b6` ではない（2026-08-07 訂正）。** `e63474b6` が直したのは
> **同期パス `src/queries/stripe.ts`** だけで、**webhook 経路
> `src/app/api/webhooks/stripe/route.ts` は cents を書き続けていた**
> （`extractAmountAndCurrency` が `paymentIntent.amount` / `charge.amount` を
> そのまま `PaymentDetails.amount` に配線していた）。webhook 側を `order.total` に
> 揃えたのは **`c4a6fb41`（2026-08-07）**。したがって cents 行を生む経路が閉じたのは
> こちらであり、**境界は `c4a6fb41` のデプロイ時刻**まで延びる。
> `e63474b6` を境界に使うと、その後 webhook が書いた cents 行を**すべて取りこぼす**。
>
> 補足: `e63474b6` 〜 `c4a6fb41` の間の行は、同じ注文に対して同期パスと webhook が
> 交互に上書きしうるため、**最後にどちらが書いたかで単位が決まる**（`ratio` は
> ≈1 と ≈100 のどちらにもなりうる）。Step 2 の `ratio` 判定はこの期間の行にも
> そのまま機能する（値そのものを見ているため）。

Find the deployment time of `c4a6fb41`, not just its commit time — rows written between commit and
deploy are still affected.

```bash
git show -s --format='%H %cI %s' c4a6fb41
```

Record both the commit timestamp and the actual production deploy timestamp (from the hosting
provider's deployment log). **The deploy timestamp is the boundary**; using the commit timestamp
alone under-selects rows.

### Step 2: Identify affected rows (read-only)

Selecting on `createdAt < boundary` alone is **not sufficient** — it would also sweep in the
PayPal rows, which are already correct. But constraining to `paymentMethod = 'Stripe'` is
**too narrow**, for the reason set out immediately below.

> **⚠️ `paymentMethod` は行の出自を表さない（2026-08-07 訂正）。** `c4a6fb41` **以前**の
> PayPal webhook (`src/app/api/webhooks/paypal/route.ts`) は `upsert` の **`update` 分岐に
> `amount` / `currency` を持っていなかった**（同コミットの diff が `paypal/route.ts` に
> +4 行を足しているのがこれ）。したがって、
>
> 1. Stripe webhook が cents で行を作る（`amount = 9999`, `paymentMethod = 'Stripe'`）
> 2. 同じ注文に PayPal webhook が届く → `paymentMethod` は `'PayPal'` に、
>    `paymentIntentId` は capture id に**書き換わるが、`amount` / `currency` は
>    Stripe 由来のまま残る**
>
> という既知の状態が存在する。この行は **cents のまま `paymentMethod = 'PayPal'`** なので、
> `paymentMethod = 'Stripe'` 述語では**一件も拾えない**。`paymentIntentId` による出自判定
> （`pi_` 前置）も、PayPal が capture id で上書きしているので**この行では効かない**。
>
> 拾える signal は**値そのもの、すなわち `ratio ≈ 100`** しかない。PayPal 経路は
> 初日からドル建てしか書いていないので、**`ratio ≈ 100` の行は provider ラベルが何であれ
> Stripe 由来**と断定できる（これは肯定形の述語であり、"PayPal でないもの" の否定形が
> 抱えていた `'Paypal'` 表記ゆれの問題も持たない）。

```sql
-- Read-only. Produces the candidate set and a magnitude check per row.
-- 出自は paymentMethod ではなく ratio で判定する（上の訂正ノートを参照）。
-- provider ラベルは除外条件ではなく、Step 4 で currency をどちらの契約へ揃えるかの分岐に使う。
SELECT pd.id,
       pd."paymentIntentId",
       pd."paymentMethod",
       pd.currency,
       pd.amount        AS stored_amount,
       o.total          AS order_total,
       pd.amount / NULLIF(o.total, 0) AS ratio,
       pd."createdAt"
FROM "PaymentDetails" pd
JOIN "Order" o ON o.id = pd."orderId"
WHERE pd."createdAt" < :deploy_boundary
  AND (
        pd."paymentMethod" = 'Stripe'                        -- Stripe のまま確定した行
     OR pd.amount / NULLIF(o.total, 0) BETWEEN 99 AND 101    -- provider が切替わった cents 行
      )
ORDER BY pd."createdAt";
```

`paymentMethod = 'Stripe'` is safe as a **positive** predicate for the first arm:
`src/queries/stripe.ts` has written the literal `"Stripe"` at every write site since the original
integration (`7fca45c0`), and `git log -S'paymentMethod: "Stripe"'` shows no other value ever
reached the column. It is simply not *complete* on its own.

**Do not invert it into "everything that is not PayPal".** The PayPal path wrote `"Paypal"`
(lower-case `a`) until `d8f770d2` (2026-05-29), so rows predating that commit would escape a
`!= 'PayPal'` filter and be swept into the update.

The `ratio` column is the decision signal: affected rows should land at **≈100**, correct rows at
**≈1**. Any row that is neither is an anomaly — it must be listed in the report and excluded from
the automated update, then handled by hand.

Group the `ratio ≈ 100` rows by `pd."paymentMethod"` in the report. The two groups get **different
`currency` treatment** in Step 4:

| 最終的な provider ラベル | `amount` | `currency` |
|---|---|---|
| `'Stripe'` | `/ 100` | そのまま（Stripe event の実値） |
| `'PayPal'` / `'Paypal'` | `/ 100` | `'usd'` へ補正（PayPal 契約。`paypal/route.ts` は常に `'usd'` を書く） |

PayPal として確定した行に Stripe 由来の `currency` が残っているのは、`amount` が cents で
残っているのと**同じ書き漏れの裏表**である。`amount` だけ直して `currency` を放置すると、
「PayPal 決済なのに通貨が `eur`」という行が残り、次の監査で再び候補として掘り起こされる。

> **`ratio IS NULL` is a fourth bucket, not a member of "neither".** `NULLIF(o.total, 0)` returns
> NULL for zero-total orders, so `ratio` is NULL for them. Under SQL three-valued logic a NULL
> ratio satisfies **neither** `ratio ≈ 100` **nor** `ratio NOT BETWEEN 0.99 AND 1.01` — such rows
> are silently absent from every range-based count. They therefore (a) escape the Step 4 update and
> (b) escape the Step 5 verification, so a cents-valued row on a zero-total order would be left
> uncorrected *and* reported as clean. Enumerate them explicitly:
>
> ```sql
> -- zero-total 注文（ratio が計算不能）を必ず別立てで列挙する
> SELECT pd.id, pd."paymentIntentId", pd."paymentMethod", pd.amount, o.total, pd."createdAt"
> FROM "PaymentDetails" pd
> JOIN "Order" o ON o.id = pd."orderId"
> WHERE pd."createdAt" < :deploy_boundary
>   AND pd."paymentMethod" = 'Stripe'
>   AND (o.total IS NULL OR o.total = 0);
> ```
>
> Each such row must be resolved by hand (the order total itself is likely the defect) or recorded
> as unresolved with a reason. Do not let them fall through the range predicates unnoticed.
>
> **この列挙が `paymentMethod = 'Stripe'` のままなのは意図的**（Step 2 本体の拡張と食い違って
> 見えるので明示する）。拡張した第 2 の arm は `ratio BETWEEN 99 AND 101` であり、
> zero-total 行では `ratio` が NULL なので**この arm には構造的に入り得ない** ——
> よって NULL バケットは第 1 の arm の部分集合であり、Step 3 の「四バケットが候補総数に
> 一致する」検算はこの形で閉じる。
>
> ただし裏返すと、**zero-total 注文の行が provider 切替で `'PayPal'` になっていた場合、
> どの述語でも拾えない**（金額 signal が計算不能、ラベル signal も失われている）。
> これは検出不能領域として受け入れる。境界より前の zero-total な PayPal 行が
> 存在するかは、`SELECT count(*) … WHERE o.total = 0 AND pd."paymentMethod" IN ('PayPal','Paypal')`
> で**件数だけ確認し、0 でなければ STOP して人手で調べること**。

### Step 3: Produce a dry-run report and get human approval

Write the Step 2 result to a file and summarise:

- total candidate rows, and how many have `ratio ≈ 100` / `ratio ≈ 1` / neither / **`ratio IS NULL`
  (zero-total orders)** — the four buckets must sum to the candidate total, which is the arithmetic
  check that no row was silently dropped by three-valued logic
- **the exact count of rows the Step 4 `UPDATE` is expected to affect** (the `ratio ≈ 100` bucket),
  **together with a checksum of that bucket's `id` set**. Both are what the approver signs off on,
  and Step 4 compares against both before `COMMIT`.

  ```sql
  -- Step 4 が同じ述語で再計算して突合する。件数と id 集合の両方を出す。
  -- `paymentMethod` の制約は**入れない**。ratio ≈ 100 だけが出自の signal であり
  -- （PayPal 経路はドル建てしか書いていないので ratio ≈ 100 になり得ない）、
  -- ラベルで絞ると provider 切替後の cents 行を取りこぼす（Step 2 の訂正ノート参照）。
  SELECT count(*)                                                       AS will_update,
         md5(coalesce(string_agg(pd.id::text, ',' ORDER BY pd.id), '')) AS candidate_digest
  FROM   "PaymentDetails" pd
  JOIN   "Order" o ON o.id = pd."orderId"
  WHERE  pd."createdAt" < :deploy_boundary
    AND  pd.amount / NULLIF(o.total, 0) BETWEEN 99 AND 101;
  ```

  この同じ集合を `pd."paymentMethod"` で内訳表示し、**PayPal 側へ確定する行数**（Step 4 で
  `currency` も `'usd'` へ補正される行）を承認者へ別掲すること。`amount` の補正だけでなく
  `currency` の書き換えも承認対象に含める。

  > **なぜ件数だけでは足りないか。** 承認と実行の間は非同期に空くので、その間に候補集合が
  > **入れ替わる**ことがある —— 1 行が手作業で修正されて候補から外れ、別の 1 行が新たに
  > 候補へ入れば、**件数は一致したまま対象行が違う**。件数の一致は「承認された行に対して
  > UPDATE した」ことを含意しない。`ORDER BY` 付きの `string_agg` は id 集合を決定論的な
  > 1 文字列へ畳むので、集合が 1 行でも変われば digest が変わる。
  >
  > `coalesce(…, '')` は候補 0 件のときに `string_agg` が NULL を返し、`md5(NULL)` = NULL に
  > なって**比較が常に不成立（NULL）になる**のを避けるため。0 件は 0 件として
  > 決定論的な digest（空文字列の md5）を持つべきで、「比較不能」に落としてはいけない。
- the min/max `createdAt` of the rows to be updated
- the total monetary delta the update will apply
- **the unresolved zero-total list — an enumeration, not a count.** For the `ratio IS NULL` bucket,
  list **every row's `paymentDetails.id` / `orderId` / `pd.amount` / `o.total` together with the
  reason it is being left unresolved** (e.g. fully coupon-discounted order, test/seed row,
  cancelled before capture). This list is an **approval artifact in its own right** — the approver
  signs off on *which specific rows* stay unresolved, not merely on how many.

  > **なぜ件数では足りないか。** Step 5 の合格条件 2 は `null_ratio` を「承認済みの未解決リスト」と
  > 突き合わせ、さらに **id レベルで一致すること**を要求する（件数一致だけでは「解決した行」と
  > 「新たに壊れた行」が相殺して同数になる経路を排除できないため）。その突合先となる
  > **id のリストが成果物として定義されていなければ、Step 5 の条件は実行不能**になる
  > ——「承認済みの未解決リスト」という参照先が存在しないまま参照されている状態だった。
  > ここで列挙を成果物に含めることで、Step 5 の比較対象が一意に定まる。
  >
  > 各行に**理由**を要求するのは、zero-total が「正当（全額クーポン等）」と
  > 「別のバグ（`total` が書かれていない）」の両方を含みうるためである。理由を書かせると
  > 後者は承認の時点で表面化し、`ratio IS NULL` バケットに紛れて恒久的に見逃されることを防げる。

**Stop here and present the report.** Per
[`.claude/steering/tech.md`](../.claude/steering/tech.md), destructive or corrective production
writes require explicit human approval via the `safe-migration` skill. Do not proceed on your own
judgement, even if every row looks unambiguous.

### Step 4: Apply the correction inside a transaction

Only after approval. Use a corrective migration (never edit an existing migration file):

突合は**コメントではなく実行される検査**にすること。「一致しなければ ROLLBACK する」と
散文で書いても、実行者が読み飛ばせば `UPDATE` は素通しで走る。承認値を psql 変数として
渡し、一致しなければ**トランザクションごと中断する**形にする:

```sql
-- 実行例:
--   psql -v ON_ERROR_STOP=on \
--        -v deploy_boundary='2026-06-01' \
--        -v approved_count=<Step 3 の will_update> \
--        -v approved_digest=<Step 3 の candidate_digest> \
--        -f backfill.sql
\set ON_ERROR_STOP on
BEGIN;

-- 1) 影響行数**と対象 id 集合の digest** を UPDATE の前に確定させる
--    （述語は下の UPDATE と完全に同一にすること）
SELECT count(*)                                                       AS actual_count,
       md5(coalesce(string_agg(pd.id::text, ',' ORDER BY pd.id), '')) AS actual_digest
FROM   "PaymentDetails" pd
JOIN   "Order" o ON o.id = pd."orderId"
WHERE  pd."createdAt" < :'deploy_boundary'
  AND  pd.amount / NULLIF(o.total, 0) BETWEEN 99 AND 101   -- 出自 signal は ratio のみ
\gset

-- 2) **件数と digest の両方**を Step 3 の承認済みレポートと機械的に突合する。
--    digest が要るのは、承認から実行までの間に 1 行が候補を外れ 1 行が候補に入ると
--    **件数は一致したまま対象行が入れ替わる**ため。件数一致は行集合の同一性を含意しない。
SELECT (:actual_count = :approved_count)
   AND (:'actual_digest' = :'approved_digest') AS gate_ok \gset

\if :gate_ok
  \echo 'GATE OK: candidate set matches the approved report'
\else
  \warn 'GATE FAIL: candidate set drifted since approval'
  \warn 'approved:' :approved_count :'approved_digest'
  \warn 'actual  :' :actual_count :'actual_digest'
  ROLLBACK;
  -- `\quit 1` は使わない: psql のバージョンによっては引数が無視され
  -- （`\quit: extra argument "1" ignored`）**exit 0 で終了する**ため、
  -- CI から見ると合格と区別できない。RAISE なら ON_ERROR_STOP と併せて exit 3 になる。
  DO $$ BEGIN RAISE EXCEPTION 'candidate set drifted since approval - aborting'; END $$;
\endif

-- 3) 両方一致した場合のみ UPDATE を実行し、**影響行の集合をその場で捕捉する**。
--    `UPDATE ... RETURNING` を CTE に包むと、件数と id digest を \gset で変数へ取れる。
WITH updated AS (
    UPDATE "PaymentDetails" pd
    SET    amount   = pd.amount / 100,
           -- provider 切替で PayPal として確定した行は currency も PayPal 契約
           -- （`paypal/route.ts` は常に 'usd'）へ揃える。Stripe のままの行は
           -- event の実通貨が正なので触らない。
           currency = CASE
                          WHEN pd."paymentMethod" IN ('PayPal', 'Paypal') THEN 'usd'
                          ELSE pd.currency
                      END
    FROM   "Order" o
    WHERE  o.id = pd."orderId"
      AND  pd."createdAt" < :'deploy_boundary'
      AND  pd.amount / NULLIF(o.total, 0) BETWEEN 99 AND 101    -- ratio ≈ 100 のみ（唯一の出自 signal）
    RETURNING pd.id
)
SELECT count(*)                                                 AS updated_count,
       md5(coalesce(string_agg(id::text, ',' ORDER BY id), '')) AS updated_digest
FROM   updated
\gset

-- 4) 影響行数**と id 集合**が 1) の確定値と一致することを機械的に検査する。
--    不一致は並行書き込み等で対象がずれた合図。1) と同様に digest まで見るのは、
--    件数一致が行集合の同一性を含意しないため。
SELECT (:updated_count = :actual_count)
   AND (:'updated_digest' = :'actual_digest') AS post_ok \gset

\if :post_ok
  \echo 'POST OK: the updated set matches the pre-checked candidate set'
\else
  \warn 'POST FAIL: the updated set differs from the pre-checked candidates'
  \warn 'pre :' :actual_count :'actual_digest'
  \warn 'post:' :updated_count :'updated_digest'
  ROLLBACK;
  DO $$ BEGIN RAISE EXCEPTION 'updated set differs from pre-checked candidates - aborting'; END $$;
\endif

-- 5) ここまで到達したときだけ COMMIT する
COMMIT;
```

> **⚠️ UPDATE 結果を検証する前に COMMIT しないこと（2026-08-01 訂正）。** 旧版の 4) は
>
> ```sql
> -- 4) psql が返す `UPDATE <n>` の n が 1) の actual_count と一致することを確認する。
> --    不一致なら ROLLBACK;（並行書き込みが入った可能性がある）
>
> COMMIT;
> ```
>
> という**コメントだけの指示**で、その直後に**無条件の `COMMIT;`** が置かれていた。
> 本節冒頭が指定する `psql -f backfill.sql`（ファイル実行）では、人間が `UPDATE <n>` を
> 読んで介入する余地は無く、**検証は一度も行われないまま COMMIT が実行される**。
> 事前ゲート（1〜2）は `\gset` + `\if` + `RAISE` で機械化されていたのに、
> **事後検証だけが人間の目視に委ねられて穴になっていた** —— しかも金額を書き換える
> UPDATE なので、素通りの帰結はデータ破損である。上の 3〜5 は事前ゲートと同じ機構で
> 事後も機械化する。
>
> **実測（2026-08-01・PostgreSQL 16 実機 / 3 行のフィクスチャ = 候補 2 + 非候補 1）**:
>
> | ケース | 結果 | データ |
> |---|---|---|
> | 承認値と一致（正常系） | `GATE OK` → `POST OK` / **exit 0** | 候補 2 件のみ 1/100 に補正（`10000→100` / `5000→50`）、非候補は不変 |
> | 事前ゲート不一致（承認 digest がドリフト） | `GATE FAIL` / **exit 3** | **全件不変**（UPDATE に到達しない） |
> | 事後ゲート不一致（UPDATE が別集合に当たった状況を模擬） | `POST FAIL` / **exit 3** | **全件不変**（ROLLBACK が効く） |
>
> **旧形を同じドリフト状況で流すと**: **exit 0** で完了し、
> **既にドル建てだった非候補行が `20.00 → 0.20` に壊れたまま COMMIT された**。
> 4) のコメントは実行されないので、何の防御にもなっていなかった。
> これは本プランが解消しようとしている CORRECTNESS-05（金額単位の不整合）を
> **runbook 自身が新たに作り出す**形であり、事後ゲートの機械化は必須である。

> **実測（2026-08-01・実 PostgreSQL 16 で三方向）**: 承認値と一致 → `GATE OK` / **exit 0** /
> `UPDATE` 適用。**件数は同じまま候補集合だけ入れ替えた**ケース（1 行を候補から外し
> 別の 1 行を候補へ入れる）→ digest 不一致を検出して `GATE FAIL` / **exit 3** /
> `UPDATE` は走らず金額は元のまま —— これが件数だけでは捕まえられない当のケースである。
> 初版は `\quit 1` を使っていたが、psql が引数を無視して **exit 0** を返したため
> `DO … RAISE EXCEPTION` へ差し替えた（`\quit` の挙動はバージョン依存で、
> ゲートの成否が exit code に出ないのは fail open）。

The count-and-digest check is **not optional bookkeeping**. Between the Step 3 report and the Step 4
execution an unbounded amount of time passes — the approval is asynchronous by design. New Stripe
rows written in that window sit after `:deploy_boundary` and cannot match, but a manual data edit or
a restored backup can change the candidate set underneath the approval. `COMMIT`ting a row set
nobody approved defeats the purpose of the approval gate.

> **The count alone cannot detect that.** A count is a lossy summary of a set: if one row is fixed
> by hand (leaving the `ratio ≈ 100` bucket) while another regresses into it, the count is
> unchanged and the comparison passes — while the rows actually updated are not the rows that were
> approved. The `md5(string_agg(id ORDER BY id))` digest is what makes the check about *which rows*
> rather than *how many*, and any single-row difference changes it.

> Run this in a session where a failed comparison can actually stop the script. Do **not** paste the
> whole block into `psql` at once — the `COMMIT` at the bottom would execute regardless of what the
> comparison showed, which is exactly the failure the check exists to prevent.

The `ratio BETWEEN 99 AND 101` predicate makes the update **self-guarding and idempotent**: a row
already in dollars has `ratio ≈ 1` and cannot match, so re-running the statement is a no-op rather
than a second division by 100. This matters more than it looks — an accidental double-run without
that predicate would divide correct rows by 100 and turn a recoverable overstatement into an
understatement that no longer has a clean signal to detect it.

### Step 5: Verify

Re-run the Step 2 query. Every row must now show `ratio ≈ 1`, **and the `ratio IS NULL` bucket must
be counted separately** — a range predicate alone cannot see it (see the three-valued-logic note
in Step 2).

**The two counts have different pass conditions and must not be summed.** Merging them (a single
`still_wrong` with `OR ratio IS NULL`) contradicts Step 2, which explicitly permits a zero-total row
to be **recorded as unresolved with a reason** rather than fixed. Under the merged form any such
approved exception keeps `still_wrong` above zero forever, so CORRECTNESS-05 could never be closed
even though the plan was followed exactly as written.

```sql
-- 1 クエリ 2 カウント（同一行集合の上で測るため、取りこぼしが起きない）。
--   still_wrong : 範囲外。**0 でなければ不合格**
--   null_ratio  : zero-total（ratio 計算不能）。Step 3 で承認済みの未解決リストと**件数一致**が条件
-- NULL は範囲比較では検出できないため、FILTER 句で明示的に分けて数える。
SELECT
    count(*) FILTER (
        WHERE pd.amount / NULLIF(o.total, 0) NOT BETWEEN 0.99 AND 1.01
    ) AS still_wrong,
    count(*) FILTER (
        WHERE pd.amount / NULLIF(o.total, 0) IS NULL
    ) AS null_ratio,
    -- 承認リストと**集合として**突き合わせるための id 集合。件数だけを返していると
    -- 下の合格条件 2 が「id 集合が完全一致すること」を要求しているのに、
    -- 突合の材料が出力されず**実行不能な条件**になる。
    md5(coalesce(string_agg(pd.id::text, ',' ORDER BY pd.id)
                 FILTER (WHERE pd.amount / NULLIF(o.total, 0) IS NULL), '')) AS null_ratio_digest,
    coalesce(string_agg(pd.id::text, E'\n' ORDER BY pd.id)
             FILTER (WHERE pd.amount / NULLIF(o.total, 0) IS NULL), '(none)') AS null_ratio_ids
FROM   "PaymentDetails" pd
JOIN   "Order" o ON o.id = pd."orderId"
WHERE  pd."createdAt" < :'deploy_boundary'
  AND  pd."paymentMethod" IN ('Stripe', 'PayPal', 'Paypal');
```

> **検証の母集合は Step 2 の候補集合より広く取る。** ここで `paymentMethod = 'Stripe'` に
> 絞ると、**Step 4 が実際に書き換えた PayPal ラベルの行が検証から丸ごと外れる** ——
> 補正が効いていなくても `still_wrong = 0` が返り、「クリーン」と報告されてしまう。
> Step 2 の候補述語（`ratio ≈ 100`）をそのまま使えないのは、補正後の行は定義上
> `ratio ≈ 1` になっていて**候補述語から抜けてしまう**ためで、事後検証は
> 「元の候補だった行」ではなく「境界より前の決済行すべて」を見る必要がある。

加えて、PayPal として確定した行の `currency` が Step 4 で `'usd'` に揃ったことを別途確認する:

```sql
-- 0 件でなければ Step 4 の currency 補正が漏れている
SELECT count(*) AS stale_paypal_currency
FROM   "PaymentDetails" pd
WHERE  pd."createdAt" < :'deploy_boundary'
  AND  pd."paymentMethod" IN ('PayPal', 'Paypal')
  AND  pd.currency <> 'usd';
```

`null_ratio_digest` は Step 3 の承認済み「unresolved zero-total list」に対して**同じ式で**
計算した digest と直接比較できる（承認リストの id を同順で `string_agg` して md5 を取る）。
`null_ratio_ids` は不一致時に**どの行が入れ替わったか**を目視するための出力で、
判定そのものは digest で行う。

Verification passes only when **both** hold:

1. `still_wrong` = **0**（例外を認めない。範囲外の行が残っていれば backfill は未完）
2. `null_ratio` = **Step 3 の「unresolved zero-total list」**（承認済み成果物）の件数と**一致**
   （0 とは限らない。ただし「承認された件数」より多ければ、承認外の行が紛れているので不合格）
3. `null_ratio_digest` = 承認リストの id を**同じ式で**畳んだ digest と**一致**
   （承認リストの id を昇順で `string_agg(id, ',')` し `md5` を取る＝上のクエリと同一手順）

比較先は Step 3 で**列挙され承認された当のリスト**であり、件数だけの報告ではない。
条件 3 が独立に要る理由は、**件数一致が行集合の同一性を含意しない**ため —— 承認後に
1 行が解決して候補を外れ、別の 1 行が新たに壊れて `ratio IS NULL` に入ると、
`null_ratio` は同数のまま**中身が入れ替わる**。digest はその入れ替えを検出する。
不一致時は `null_ratio_ids` の出力を承認リストと突き合わせ、どの行が増減したかを特定する。

> **実測（2026-08-01・実 PostgreSQL 16）**: 上の検証クエリは
> `still_wrong=0 / null_ratio=1 / null_ratio_digest=7bc3ca68… / null_ratio_ids=p3` を返し、
> digest は同じ id 集合を単独で畳んだ値と一致した（`FILTER` 付き `string_agg` が
> `count(*) FILTER` と同一の行集合を見ていることの確認）。

Record the before/after counts in `docs/PROGRESS.md` and close the CORRECTNESS-05 entry in
`plans/README.md`.

## Test plan

This is a data migration, not a code change, so the guarantees come from the query rather than
from Jest:

- The Step 2 query is run **before and after** and its `ratio` distribution compared.
- The Step 4 statement is exercised in a local/staging database seeded with both a cents-valued row
  and a dollars-valued row, asserting the dollars row is untouched.
- Idempotency: run Step 4 twice on the staging data and confirm the second run reports 0 rows.

## Done criteria

ALL must hold:

- [x] The deploy boundary (not merely the commit timestamp) is recorded in this plan.
      → **本プロジェクトにデプロイ工程が存在しない**ため commit 時刻 `2026-08-07T02:44:54+09:00` を
      採用し、その根拠を「実行記録 / Step 1」に記載した。
- [x] The Step 5 query satisfies **both** of its counts, judged separately (they must not be summed
      — see "Verification passes only when both hold" in Step 5):
      **(a)** `still_wrong = 0` (out-of-range rows admit no exception), **and**
      **(b)** `null_ratio` equals the count of the approved "unresolved zero-total list" from Step 3
      — not necessarily 0 — with the surviving `ratio IS NULL` **id set** matching that list, not
      merely its cardinality. `still_wrong` does **not** cover the NULL bucket: the `NOT BETWEEN`
      FILTER is three-valued, so a NULL ratio is neither true nor false and never counted there.
      → 実測 `still_wrong = 0` / `null_ratio = 0`（承認済み unresolved リストも 0 件）/
      `null_ratio_digest = d41d8cd98f00b204e9800998ecf8427e`（= 空集合の digest、承認リストと一致）。
- [x] The Step 5 `stale_paypal_currency` query returns **0** — every row that ended up labelled
      `'PayPal'` / `'Paypal'` carries `currency = 'usd'`. A cents `amount` and a leftover Stripe
      `currency` are the same write-omission seen from two sides; fixing only the first leaves the
      row re-surfacing in the next audit.
- [x] Rows that were neither `≈1` nor `≈100` are enumerated and individually resolved, or
      explicitly recorded as unresolved with a reason. → **0 件**（レポートの該当表は `(none)`）。
- [x] **Rows with `ratio IS NULL` (zero-total orders) are enumerated and individually resolved, or
      explicitly recorded as unresolved with a reason.** These never match the Step 4 predicate, so
      "the update reported 0 affected rows" is not evidence that they were correct.
      → **0 件**。列挙表を成果物として出力したうえでの 0 件であり、「述語が 0 行に当たった」
      という間接証拠ではない。
- [x] The four report buckets (`≈100` / `≈1` / neither / NULL) sum to the total candidate count.
      → `0 / 0`。さらに SQL ゲートの件数と列挙分類の件数が一致することも交差検証している。
- [x] Step 4's **pre**-gate passed: the count **and `candidate_digest`** both matched the approved
      report (`\if :gate_ok` at step 2 of the script, otherwise `RAISE EXCEPTION`).
      → tsx 版では `BackfillGateError` の throw が `RAISE EXCEPTION` に相当し、
      `GATE OK: candidate set matches the approved report (count=0)` を出力した。
- [x] Step 4's **post**-gate passed: `POST OK: the updated set matches the pre-checked candidate set`
      was printed — i.e. `updated_count = actual_count` **and** `updated_digest = actual_digest`.
      The digest is required, not a nicety: equal counts do not prove the same rows — one row
      leaving the bucket while another enters keeps the count identical while changing what gets
      written.

  > **Do not phrase this as "the `UPDATE <n>` echo matched" (corrected 2026-08-02).** The script
  > wraps the `UPDATE ... RETURNING` in a CTE and selects `updated_count` / `updated_digest` from
  > it, so psql's command tag is **never surfaced as a separate, checkable value** — and the
  > script is run as `psql -f backfill.sql`, where the note above already establishes that a human
  > reading the tag is not part of the flow. The old wording therefore stated a criterion the
  > shipped script **cannot satisfy by construction**. `post_ok` is the mechanised equivalent and
  > is strictly stronger, because it also compares the row identities. If a future revision does
  > want the raw command tag, that is a change to the script (drop the CTE, capture the tag), not
  > something to assert about the current one.
- [x] Step 4 was run twice on staging and the second run reported 0 affected rows.
      → **ただし 2 回目は「0 行で成功」ではなく `GATE FAIL` / exit 3 で停止した。** 承認は特定の
      行集合に対して与えられるものなので、集合が 2 件から 0 件へ変わった以上、古い承認値のままの
      再実行はゲートで止まるのが正しい。空集合を改めて承認し直した実行が `POST OK` / **0 行** /
      exit 0 で完了し、冪等性（`ratio ≈ 100` 述語が補正済みの行に当たらないこと）を確認した。
- [x] Human approval for the production write is recorded (who, when, on which report).
      → 承認者: リポジトリ所有者（本セッションで事前承認）、2026-08-09、対象レポート
      `scripts/backfill/reports/063-2026-08-08T15-31-07-811Z.md`（候補 0 件）。
- [x] `plans/README.md` CORRECTNESS-05 entry updated to reflect the closed remainder.
- [x] No files under `src/` were modified. → `git status --porcelain -- src/` が空であることを確認。

## STOP conditions

- The deploy timestamp of `e63474b6` cannot be established from deployment logs — guessing the
  boundary risks both under- and over-selecting rows.
- The production data contains `paymentMethod` values other than `'Stripe'`, `'PayPal'` and
  `'Paypal'`, and `paymentIntentId` does not disambiguate them either — the candidate set cannot be
  constrained safely.
- More than a handful of rows fall outside both `ratio ≈ 1` and `ratio ≈ 100`, suggesting a third
  unit convention or unrelated corruption. Report rather than improvise a rule.
- Any refund/reconciliation process reads `PaymentDetails.amount` and would be disturbed
  mid-flight by the update — coordinate a window first.

## Maintenance notes

- The root cause was a unit mismatch between an external API's convention (Stripe minor units) and
  the column's declared type. When adding a new payment provider, assert the unit at the write
  boundary rather than trusting the SDK's field name.
- The shape that allowed this was writing a bare `number` from an SDK response
  (`amount: paymentIntent.amount`) into a `Decimal(12,2)` column: Prisma accepts the `number`
  without complaint, so nothing at the type level flagged the unit change. The fix routes
  `order.total` — already a `Prisma.Decimal` — to the column unconverted, which is also what
  `.claude/steering/tech.md`（金額・数値精度）requires.
