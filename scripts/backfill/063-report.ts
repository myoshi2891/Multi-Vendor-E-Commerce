/**
 * plan 063 Step 2/3（レポート）および Step 5（検証）— **読み取り専用**。
 *
 * 使い方:
 *   bun run scripts/backfill/063-report.ts                       # 既定境界でレポート生成
 *   bun run scripts/backfill/063-report.ts --boundary <ISO8601>  # 境界を明示
 *   bun run scripts/backfill/063-report.ts --verify              # Step 5 の検証クエリ
 *
 * レポートは `scripts/backfill/reports/` に Markdown と候補行の JSON
 * （UPDATE 前の巻き戻し材料）として保存される。JSON は承認の対象物であり、
 * 想定外が起きたときに `amount` / `currency` を復元する唯一の材料になる。
 *
 * @see plans/063-backfill-stripe-payment-amount.md
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Prisma } from "@prisma/client";

import {
    candidateGateSql,
    candidateRowsSql,
    createBackfillClient,
    getStringArg,
    maskDatabaseUrl,
    parseArgs,
    PAYPAL_LABELS,
    RATIO_CENTS_MAX,
    RATIO_CENTS_MIN,
    RATIO_DOLLARS_MAX,
    RATIO_DOLLARS_MIN,
    resolveBoundary,
    type GateRow,
} from "./063-shared";

const REPORTS_DIR = join(import.meta.dirname, "reports");

type CandidateRow = {
    id: string;
    payment_intent_id: string;
    payment_method: string;
    currency: string;
    stored_amount: string;
    order_total: string | null;
    /** `amount / order.total`。zero-total 注文では NULL（計算不能）。 */
    ratio: string | null;
    created_at: Date;
};

/** ratio による 4 バケット。合計は必ず候補総数に一致する。 */
type Bucket = "cents" | "dollars" | "neither" | "nullRatio";

/**
 * ratio を 4 バケットへ分類する。
 *
 * NULL を最初に判定するのが要点。SQL の範囲述語では NULL は真とも偽とも
 * 判定されず、`ratio ≈ 100` にも `ratio NOT BETWEEN 0.99 AND 1.01` にも
 * 現れないため、範囲比較だけで数えると zero-total 行が**どのバケットにも
 * 属さないまま消える**。ここで明示的に第 4 のバケットへ落とす。
 */
function classify(ratio: string | null): Bucket {
    if (ratio === null) return "nullRatio";

    const value = Number(ratio);
    if (!Number.isFinite(value)) return "neither";
    if (value >= RATIO_CENTS_MIN && value <= RATIO_CENTS_MAX) return "cents";
    if (value >= RATIO_DOLLARS_MIN && value <= RATIO_DOLLARS_MAX)
        return "dollars";
    return "neither";
}

/** Markdown のテーブル行へ整形する。 */
function toTableRow(row: CandidateRow): string {
    return `| \`${row.id}\` | ${row.payment_method} | ${row.currency} | ${row.stored_amount} | ${row.order_total ?? "NULL"} | ${row.ratio ?? "NULL"} | ${row.created_at.toISOString()} |`;
}

/**
 * Step 2/3: 候補集合の列挙・4 バケット集計・承認用の件数と digest を出力する。
 */
async function runReport(boundary: Date): Promise<void> {
    const db = createBackfillClient();

    try {
        const [{ count: totalRows }] = await db.$queryRaw<{ count: number }[]>(
            Prisma.sql`SELECT count(*)::int AS count FROM "PaymentDetails"`
        );
        console.log(`PaymentDetails 総行数: ${totalRows}`);

        const candidates = await db.$queryRaw<CandidateRow[]>(
            candidateRowsSql(boundary)
        );

        const buckets: Record<Bucket, CandidateRow[]> = {
            cents: [],
            dollars: [],
            neither: [],
            nullRatio: [],
        };
        for (const row of candidates) {
            buckets[classify(row.ratio)].push(row);
        }

        // 承認対象の件数と digest。UPDATE と同一述語で SQL 側から取り直す。
        const [gate] = await db.$queryRaw<GateRow[]>(
            candidateGateSql(boundary)
        );

        // JS 分類（enumerate ベース）と SQL ゲート（述語ベース）が一致するかの交差検証。
        // 片方だけで数えると、三値論理の取りこぼしも JS 側の分類バグも検出できない。
        const centsMatches = buckets.cents.length === gate.count;

        const [stats] = await db.$queryRaw<
            {
                min_created: Date | null;
                max_created: Date | null;
                delta: string | null;
            }[]
        >(Prisma.sql`
            SELECT min(pd."createdAt")                      AS min_created,
                   max(pd."createdAt")                      AS max_created,
                   sum(pd.amount - pd.amount / 100)::text   AS delta
            FROM   "PaymentDetails" pd
            JOIN   "Order" o ON o.id = pd."orderId"
            WHERE  pd."createdAt" < ${boundary}
              AND  pd.amount / NULLIF(o.total, 0) BETWEEN ${RATIO_CENTS_MIN} AND ${RATIO_CENTS_MAX}
        `);

        // zero-total な PayPal 行は検出不能領域（金額 signal が計算不能で
        // ラベル signal も失われている）。0 でなければ STOP 条件。
        const [{ count: zeroTotalPaypal }] = await db.$queryRaw<
            { count: number }[]
        >(
            Prisma.sql`
                SELECT count(*)::int AS count
                FROM   "PaymentDetails" pd
                JOIN   "Order" o ON o.id = pd."orderId"
                WHERE  pd."createdAt" < ${boundary}
                  AND  (o.total IS NULL OR o.total = 0)
                  AND  pd."paymentMethod" IN (${Prisma.join(PAYPAL_LABELS)})
            `
        );

        const byMethod = new Map<string, number>();
        for (const row of buckets.cents) {
            byMethod.set(
                row.payment_method,
                (byMethod.get(row.payment_method) ?? 0) + 1
            );
        }
        const paypalBound = PAYPAL_LABELS.reduce(
            (sum, label) => sum + (byMethod.get(label) ?? 0),
            0
        );

        const bucketSum =
            buckets.cents.length +
            buckets.dollars.length +
            buckets.neither.length +
            buckets.nullRatio.length;

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        mkdirSync(REPORTS_DIR, { recursive: true });

        const lines = [
            `# plan 063 dry-run report`,
            ``,
            `- 生成時刻: ${new Date().toISOString()}`,
            `- 接続先: \`${maskDatabaseUrl(process.env.DATABASE_URL)}\``,
            `- カットオーバー境界: \`${boundary.toISOString()}\``,
            `- PaymentDetails 総行数: ${totalRows}`,
            ``,
            `## 4 バケット（合計は候補総数に一致すること）`,
            ``,
            `| バケット | 件数 |`,
            `|---|---|`,
            `| \`ratio ≈ 100\`（補正対象） | ${buckets.cents.length} |`,
            `| \`ratio ≈ 1\`（既に正しい） | ${buckets.dollars.length} |`,
            `| どちらでもない（要人手） | ${buckets.neither.length} |`,
            `| \`ratio IS NULL\`（zero-total） | ${buckets.nullRatio.length} |`,
            `| **合計 / 候補総数** | **${bucketSum} / ${candidates.length}** ${bucketSum === candidates.length ? "✅" : "❌"} |`,
            ``,
            `## 承認対象（Step 4 のゲートに渡す値）`,
            ``,
            `- \`--approved-count\`: **${gate.count}**`,
            `- \`--approved-digest\`: **${gate.digest}**`,
            `- SQL ゲートと列挙分類の一致: ${centsMatches ? "✅" : `❌ (gate=${gate.count} / enumerated=${buckets.cents.length})`}`,
            `- うち PayPal ラベルへ確定済み（\`currency\` も \`'usd'\` へ補正される行）: **${paypalBound}**`,
            `- provider 内訳: ${[...byMethod.entries()].map(([m, c]) => `${m}=${c}`).join(", ") || "(none)"}`,
            `- 対象の createdAt: ${stats.min_created?.toISOString() ?? "-"} 〜 ${stats.max_created?.toISOString() ?? "-"}`,
            `- 金額デルタ合計（減少額）: ${stats.delta ?? "0"}`,
            ``,
            `## 補正対象行（\`ratio ≈ 100\`）`,
            ``,
            `| id | paymentMethod | currency | stored_amount | order_total | ratio | createdAt |`,
            `|---|---|---|---|---|---|---|`,
            ...(buckets.cents.length > 0
                ? buckets.cents.map(toTableRow)
                : ["| (none) | | | | | | |"]),
            ``,
            `## どちらでもない行（自動更新から除外・人手で解決すること）`,
            ``,
            `| id | paymentMethod | currency | stored_amount | order_total | ratio | createdAt |`,
            `|---|---|---|---|---|---|---|`,
            ...(buckets.neither.length > 0
                ? buckets.neither.map(toTableRow)
                : ["| (none) | | | | | | |"]),
            ``,
            `## unresolved zero-total list（\`ratio IS NULL\`）`,
            ``,
            `Step 5 の \`null_ratio\` / \`null_ratio_digest\` はこのリストと突き合わせる。`,
            `各行に未解決の理由を記入して承認を得ること。`,
            ``,
            `| id | paymentMethod | stored_amount | order_total | createdAt | 理由 |`,
            `|---|---|---|---|---|---|`,
            ...(buckets.nullRatio.length > 0
                ? buckets.nullRatio.map(
                      (row) =>
                          `| \`${row.id}\` | ${row.payment_method} | ${row.stored_amount} | ${row.order_total ?? "NULL"} | ${row.created_at.toISOString()} | (要記入) |`
                  )
                : ["| (none) | | | | | |"]),
            ``,
            `## STOP 条件チェック`,
            ``,
            `- zero-total かつ PayPal ラベルの行: **${zeroTotalPaypal}** ${zeroTotalPaypal === 0 ? "✅" : "❌ STOP"}`,
            `- どちらでもない行: **${buckets.neither.length}** ${buckets.neither.length === 0 ? "✅" : "⚠️ 人手で解決すること"}`,
            ``,
        ];

        const reportPath = join(REPORTS_DIR, `063-${timestamp}.md`);
        writeFileSync(reportPath, lines.join("\n"), "utf8");

        // UPDATE 前の巻き戻し材料。ゲートを抜けた後の想定外に対する唯一の復旧手段。
        const backupPath = join(
            REPORTS_DIR,
            `063-${timestamp}-candidates.json`
        );
        writeFileSync(
            backupPath,
            JSON.stringify(
                buckets.cents.map((row) => ({
                    id: row.id,
                    paymentMethod: row.payment_method,
                    currency: row.currency,
                    amount: row.stored_amount,
                    orderTotal: row.order_total,
                    createdAt: row.created_at.toISOString(),
                })),
                null,
                2
            ),
            "utf8"
        );

        console.log(lines.join("\n"));
        console.log(`\nレポート: ${reportPath}`);
        console.log(`巻き戻し材料: ${backupPath}`);

        if (!centsMatches) {
            throw new Error(
                `SQL ゲートと列挙分類が不一致: gate=${gate.count} enumerated=${buckets.cents.length}`
            );
        }
        if (bucketSum !== candidates.length) {
            throw new Error(
                `バケット合計が候補総数と不一致: ${bucketSum} !== ${candidates.length}`
            );
        }
        if (zeroTotalPaypal > 0) {
            throw new Error(
                `STOP: zero-total かつ PayPal ラベルの行が ${zeroTotalPaypal} 件ある（検出不能領域）`
            );
        }
    } finally {
        await db.$disconnect();
    }
}

/**
 * Step 5: 補正後の検証。
 *
 * 母集合は Step 2 の候補述語より**広い**。補正後の行は定義上 `ratio ≈ 1` に
 * なって候補述語から抜けるため、候補述語で検証すると全件素通りしてしまう。
 * また `paymentMethod = 'Stripe'` に絞ると、Step 4 が実際に書き換えた
 * PayPal ラベルの行が検証から丸ごと外れる。
 */
async function runVerify(boundary: Date): Promise<void> {
    const db = createBackfillClient();

    try {
        const [result] = await db.$queryRaw<
            {
                still_wrong: number;
                null_ratio: number;
                null_ratio_digest: string;
                null_ratio_ids: string;
            }[]
        >(Prisma.sql`
            SELECT
                count(*) FILTER (
                    WHERE pd.amount / NULLIF(o.total, 0)
                          NOT BETWEEN ${RATIO_DOLLARS_MIN} AND ${RATIO_DOLLARS_MAX}
                )::int AS still_wrong,
                count(*) FILTER (
                    WHERE pd.amount / NULLIF(o.total, 0) IS NULL
                )::int AS null_ratio,
                md5(coalesce(string_agg(pd.id::text, ',' ORDER BY pd.id)
                             FILTER (WHERE pd.amount / NULLIF(o.total, 0) IS NULL), '')) AS null_ratio_digest,
                coalesce(string_agg(pd.id::text, E'\n' ORDER BY pd.id)
                         FILTER (WHERE pd.amount / NULLIF(o.total, 0) IS NULL), '(none)') AS null_ratio_ids
            FROM   "PaymentDetails" pd
            JOIN   "Order" o ON o.id = pd."orderId"
            WHERE  pd."createdAt" < ${boundary}
              AND  pd."paymentMethod" IN ('Stripe', ${Prisma.join(PAYPAL_LABELS)})
        `);

        const [{ count: stalePaypalCurrency }] = await db.$queryRaw<
            { count: number }[]
        >(Prisma.sql`
            SELECT count(*)::int AS count
            FROM   "PaymentDetails" pd
            WHERE  pd."createdAt" < ${boundary}
              AND  pd."paymentMethod" IN (${Prisma.join(PAYPAL_LABELS)})
              AND  pd.currency <> 'usd'
        `);

        console.log(
            `still_wrong           : ${result.still_wrong}  (合格値: 0)`
        );
        console.log(
            `null_ratio            : ${result.null_ratio}  (合格値: 承認済み unresolved リストの件数)`
        );
        console.log(`null_ratio_digest     : ${result.null_ratio_digest}`);
        console.log(`null_ratio_ids        :\n${result.null_ratio_ids}`);
        console.log(
            `stale_paypal_currency : ${stalePaypalCurrency}  (合格値: 0)`
        );

        // still_wrong と null_ratio は合格条件が異なるので**合算しない**。
        // 合算すると、承認済みの zero-total 例外が永久に不合格を作り、
        // プラン通りに実行しても CORRECTNESS-05 を閉じられなくなる。
        if (result.still_wrong !== 0) {
            throw new Error(`検証不合格: still_wrong = ${result.still_wrong}`);
        }
        if (stalePaypalCurrency !== 0) {
            throw new Error(
                `検証不合格: stale_paypal_currency = ${stalePaypalCurrency}`
            );
        }
        console.log(
            "\n✅ still_wrong = 0 / stale_paypal_currency = 0。null_ratio は承認リストと突合すること。"
        );
    } finally {
        await db.$disconnect();
    }
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    const boundary = resolveBoundary(getStringArg(args, "boundary"));

    console.log(`接続先: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);
    console.log(`境界: ${boundary.toISOString()}\n`);

    if (args.has("verify")) {
        await runVerify(boundary);
        return;
    }

    await runReport(boundary);
}

main().catch((error: unknown) => {
    if (error instanceof Error) {
        console.error("[Backfill063:report] Failed", {
            error: error.message,
            stack: error.stack,
        });
    } else {
        console.error("[Backfill063:report] Unknown error", { error });
    }
    process.exit(1);
});
