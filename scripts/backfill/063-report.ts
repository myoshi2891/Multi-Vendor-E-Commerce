/**
 * plan 063 Step 2/3（レポート）および Step 5（検証）— **読み取り専用**。
 *
 * 使い方:
 *   bun run scripts/backfill/063-report.ts                       # 既定境界でレポート生成
 *   bun run scripts/backfill/063-report.ts --boundary <ISO8601>  # 境界を明示
 *   bun run scripts/backfill/063-report.ts --verify \
 *       --approved-null-count <n> --approved-null-digest <md5>   # Step 5 の検証クエリ
 *
 * レポートは `scripts/backfill/reports/` に Markdown と候補行の JSON
 * （UPDATE 前の巻き戻し材料）として保存される。JSON は承認の対象物であり、
 * 想定外が起きたときに `amount` / `currency` を復元する唯一の材料になる。
 *
 * @see plans/063-backfill-stripe-payment-amount.md
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Prisma, type PrismaClient } from "@prisma/client";

import {
    ALLOWED_PAYMENT_METHODS,
    candidateGateSql,
    candidateRowsSql,
    createBackfillClient,
    getStringArg,
    maskDatabaseUrl,
    nullRatioGateSql,
    parseArgs,
    paymentMethodCensusSql,
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

/**
 * 境界前の `paymentMethod` を全列挙し、許可ラベル以外があれば停止する。
 *
 * プラン本文の STOP 条件「`'Stripe'` / `'PayPal'` / `'Paypal'` 以外の
 * `paymentMethod` が存在する」を実行時に保証する。**候補集合を絞り込む前**に
 * 問い合わせるのが要点で、絞り込み後の集合を見ても「絞り込みから漏れたラベル」は
 * そこに現れない。未知ラベル × zero-total の行は、レポートの候補述語
 * （`paymentMethod = 'Stripe'` OR `ratio ≈ 100`）にも Step 5 の検証母集合にも
 * 現れないため、この関門が無いと**どのレポートにも載らないまま**素通りする。
 *
 * @returns ラベルごとの件数（レポートへ載せる）
 * @throws 許可ラベル以外が 1 件でも存在する場合
 */
async function assertKnownPaymentMethods(
    db: PrismaClient,
    boundary: Date
): Promise<{ payment_method: string; count: number }[]> {
    const census = await db.$queryRaw<
        { payment_method: string; count: number }[]
    >(paymentMethodCensusSql(boundary));

    const allowed = new Set<string>(ALLOWED_PAYMENT_METHODS);
    const unknown = census.filter((row) => !allowed.has(row.payment_method));

    if (unknown.length > 0) {
        const detail = unknown
            .map((row) => `${row.payment_method}=${row.count}`)
            .join(", ");
        throw new Error(
            `STOP: 未知の paymentMethod が境界前に存在する（候補集合を安全に絞り込めない）: ${detail}`
        );
    }

    return census;
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

        // 候補を絞り込む前に、境界前の paymentMethod を全列挙して STOP 条件を判定する。
        const census = await assertKnownPaymentMethods(db, boundary);

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

        // 未解決 zero-total 集合の承認値。Step 5 の `--approved-null-*` に渡す。
        // 検証側と同一の SQL（`nullRatioGateSql`）から取ることで、承認時に見た
        // 集合と補正後に残った集合を id レベルで照合できる。
        const [nullGate] = await db.$queryRaw<GateRow[]>(
            nullRatioGateSql(boundary)
        );

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

        // STOP 条件はレポート/巻き戻し JSON を書く**前**に判定する。
        // 失格した実行がレポートを残すと、`scripts/backfill/reports/` に
        // 「承認値（`--approved-count` / `--approved-digest`）を載せた、見た目は
        // 正常なレポート」が並ぶことになり、後から承認の材料として拾われうる。
        // 失格時は成果物を一切作らないのが唯一の安全側で、診断に必要な数値は
        // 例外メッセージへ載せる。
        if (!centsMatches) {
            throw new Error(
                `SQL ゲートと列挙分類が不一致: gate=${gate.count} enumerated=${buckets.cents.length}（レポートは書き出していない）`
            );
        }
        if (bucketSum !== candidates.length) {
            throw new Error(
                `バケット合計が候補総数と不一致: ${bucketSum} !== ${candidates.length}（レポートは書き出していない）`
            );
        }
        if (zeroTotalPaypal > 0) {
            throw new Error(
                `STOP: zero-total かつ PayPal ラベルの行が ${zeroTotalPaypal} 件ある（検出不能領域・レポートは書き出していない）`
            );
        }
        // 上の 3 条件を通れば、検証側の母集合（許可ラベル全体）で数えた zero-total と
        // レポートの `nullRatio` バケットは一致するはずである（ラベルが 'Stripe' 以外の
        // zero-total 行は zeroTotalPaypal で既に止まっている）。ずれるなら承認値と
        // 承認リストが別物を指しているので、レポートを出さずに止める。
        if (nullGate.count !== buckets.nullRatio.length) {
            throw new Error(
                `zero-total の承認値と未解決リストが不一致: gate=${nullGate.count} listed=${buckets.nullRatio.length}（レポートは書き出していない）`
            );
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        mkdirSync(REPORTS_DIR, { recursive: true });

        const lines = [
            `# plan 063 dry-run report`,
            ``,
            `- 生成時刻: ${new Date().toISOString()}`,
            `- 接続先: \`${maskDatabaseUrl(process.env.DATABASE_URL)}\``,
            `- カットオーバー境界: \`${boundary.toISOString()}\``,
            `- PaymentDetails 総行数: ${totalRows}`,
            `- 境界前の paymentMethod 分布: ${census.map((row) => `${row.payment_method}=${row.count}`).join(", ") || "(none)"}（許可ラベル以外は 0 件 ✅）`,
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
            `各行に未解決の理由を記入して承認を得たうえで、下の承認値を Step 5 へ渡すこと。`,
            ``,
            `- \`--approved-null-count\`: **${nullGate.count}**`,
            `- \`--approved-null-digest\`: **${nullGate.digest}**`,
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
async function runVerify(
    boundary: Date,
    approvedNullRatio: GateRow | undefined
): Promise<void> {
    const db = createBackfillClient();

    try {
        // 検証母集合は許可ラベルで絞る。未知ラベルの行があると**検証から丸ごと
        // 外れる**ため、絞り込む前に全ラベルを列挙して停止条件を判定する。
        await assertKnownPaymentMethods(db, boundary);

        const [result] = await db.$queryRaw<
            {
                still_wrong: number;
                null_ratio_ids: string;
            }[]
        >(Prisma.sql`
            SELECT
                count(*) FILTER (
                    WHERE pd.amount / NULLIF(o.total, 0)
                          NOT BETWEEN ${RATIO_DOLLARS_MIN} AND ${RATIO_DOLLARS_MAX}
                )::int AS still_wrong,
                coalesce(string_agg(pd.id::text, E'\n' ORDER BY pd.id)
                         FILTER (WHERE pd.amount / NULLIF(o.total, 0) IS NULL), '(none)') AS null_ratio_ids
            FROM   "PaymentDetails" pd
            JOIN   "Order" o ON o.id = pd."orderId"
            WHERE  pd."createdAt" < ${boundary}
              AND  pd."paymentMethod" IN (${Prisma.join(ALLOWED_PAYMENT_METHODS)})
        `);

        // 件数と digest はレポートと同一の SQL から取る（書き写しを避ける）。
        const [nullGate] = await db.$queryRaw<GateRow[]>(
            nullRatioGateSql(boundary)
        );

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
            `null_ratio            : ${nullGate.count}  (合格値: ${approvedNullRatio?.count ?? "承認済み unresolved リストの件数"})`
        );
        console.log(`null_ratio_digest     : ${nullGate.digest}`);
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

        // zero-total の照合は「承認された集合と同じか」であって「0 件か」ではない。
        // 件数だけを見ると、承認済みの 1 行が解決し別の 1 行が新たに zero-total に
        // なった場合に**件数据え置きで中身が入れ替わる**ため、digest も比較する。
        if (approvedNullRatio === undefined) {
            if (nullGate.count !== 0) {
                throw new Error(
                    `検証不合格: null_ratio = ${nullGate.count} だが承認値が渡されていない（--approved-null-count / --approved-null-digest をレポートの値で渡すこと）`
                );
            }
        } else if (
            approvedNullRatio.count !== nullGate.count ||
            approvedNullRatio.digest !== nullGate.digest
        ) {
            throw new Error(
                `検証不合格: zero-total 集合が承認と不一致 — approved=(count=${approvedNullRatio.count}, digest=${approvedNullRatio.digest}) actual=(count=${nullGate.count}, digest=${nullGate.digest})`
            );
        }

        console.log(
            "\n✅ still_wrong = 0 / stale_paypal_currency = 0 / null_ratio は承認済み集合と一致。"
        );
    } finally {
        await db.$disconnect();
    }
}

/**
 * `--approved-null-count` / `--approved-null-digest` を読む。
 *
 * 両方欠落なら undefined（`null_ratio = 0` を期待する実行）。片方だけの指定は、
 * 「digest を渡したつもりで件数だけ照合されていた」という取り違えを生むので拒否する。
 */
function parseApprovedNullRatio(
    args: Map<string, string | true>
): GateRow | undefined {
    const rawCount = getStringArg(args, "approved-null-count");
    const digest = getStringArg(args, "approved-null-digest");

    if (rawCount === undefined && digest === undefined) return undefined;
    if (rawCount === undefined || digest === undefined) {
        throw new Error(
            "--approved-null-count と --approved-null-digest は両方まとめて渡してください"
        );
    }

    const count = Number(rawCount);
    if (!Number.isInteger(count) || count < 0) {
        throw new Error(`--approved-null-count が不正です: ${rawCount}`);
    }
    if (!/^[0-9a-f]{32}$/.test(digest)) {
        throw new Error(
            `--approved-null-digest が md5 の形式ではありません: ${digest}`
        );
    }

    return { count, digest };
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2), ["verify"]);
    const boundary = resolveBoundary(getStringArg(args, "boundary"));

    console.log(`接続先: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);
    console.log(`境界: ${boundary.toISOString()}\n`);

    if (args.has("verify")) {
        await runVerify(boundary, parseApprovedNullRatio(args));
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
