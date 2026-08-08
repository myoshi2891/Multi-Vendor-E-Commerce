# backfill スクリプト（一回限りのデータ補正）

`plans/` の補正プランを実行するための一回限りスクリプト置き場。
スキーマ変更は伴わないため Prisma マイグレーションではなくスクリプトとして持つ。

## なぜマイグレーションではないのか

承認ゲートに渡す値（`approved_count` / `approved_digest`）は**その DB の、その時点の
候補集合**に固有であり、全環境で再生されるマイグレーションには載せられない。
ゲートを落とせば「承認された行集合と違う行集合を UPDATE する」経路が開き、
それは補正プランが解消しようとしている不整合を runbook 自身が作り出すことになる。

なお **`prisma/migrations/20260529073346_backfill_paypal_payment_method_casing`** のように、
述語が環境非依存で冪等な補正はマイグレーションとして持つのが正しい。判断基準は
「承認という人間の判断を挟む必要があるか」である。

---

## 063: `PaymentDetails.amount` のセント→ドル補正

対象プラン: [`plans/063-backfill-stripe-payment-amount.md`](../../plans/063-backfill-stripe-payment-amount.md)

`PaymentDetails.amount` は `Decimal(12,2)` = ドル建てだが、Stripe 経路は minor unit
（セント）を書いていた時期がある。その既存行を 1/100 に補正する。

### ファイル

| ファイル | 役割 |
|---|---|
| `063-shared.ts` | 境界・述語・digest 式・引数処理。**report と apply が同一述語を使うことを import で保証する** |
| `063-report.ts` | Step 2/3（レポート）と Step 5（検証）。読み取り専用 |
| `063-apply.ts` | Step 4。事前ゲート → UPDATE → 事後ゲート を 1 トランザクションで実行 |
| `063-seed-fixture.ts` | Step 4a のステージング予行用フィクスチャ（localhost の test DB 以外へは投入を拒否） |
| `reports/` | 生成されたレポートと巻き戻し用 JSON（承認の対象物） |

### カットオーバー境界

既定値 `2026-08-07T02:44:54+09:00` = `c4a6fb41`（webhook 経路を `order.total` 保存へ
統一したコミット）の **commit 時刻**。本プロジェクトには本番デプロイが存在せず
（`.vercel` 等の設定なし）デプロイログを参照できないため、プラン Step 1 が要求する
デプロイ時刻の代わりに commit 時刻を採用している。

### 実行手順

```bash
# 1. レポート生成（読み取り専用）。承認用の count と digest、
#    および巻き戻し用 JSON を scripts/backfill/reports/ に出力する
bun run scripts/backfill/063-report.ts

# 2. レポートを人間が承認する（承認者・日時・レポートファイル名を記録）

# 3. 承認値を渡して適用。ゲート不一致は ROLLBACK して exit 3
bun run scripts/backfill/063-apply.ts \
    --approved-count <will_update> \
    --approved-digest <candidate_digest>

# 4. 検証
bun run scripts/backfill/063-report.ts --verify
```

### ステージング予行

```bash
docker compose -f docker-compose.test.yml up -d
export DATABASE_URL=postgresql://test:test@localhost:55432/integration_test
export DIRECT_URL=$DATABASE_URL
bunx prisma migrate deploy
bun run scripts/backfill/063-seed-fixture.ts
bun run scripts/backfill/063-report.ts
bun run scripts/backfill/063-apply.ts --approved-count 2 --approved-digest <digest>
```

期待される挙動:

| ケース | 結果 |
|---|---|
| 承認値が一致 | `GATE OK` → `POST OK` → exit 0。cents 行のみ補正 |
| 2 回目の実行（同じ承認値） | 候補が 0 件になるため **`GATE FAIL` / exit 3**（冪等性は「no-op で成功」ではなく「ゲートで止まる」形で現れる） |
| 承認値をずらす | `GATE FAIL` / exit 3 / **全件不変** |

> 2 回目が `GATE FAIL` になるのは正しい挙動である。`ratio ≈ 100` 述語のおかげで
> 仮に UPDATE まで到達しても 0 行に当たるだけだが、その手前で「承認された集合
> （2 件）と現在の集合（0 件）が違う」ことをゲートが検出して止める。
> 承認は特定の行集合に対して与えられるものなので、集合が変われば再承認が要る。
