/**
 * plan 063 backfill 共通モジュール
 *
 * `PaymentDetails.amount` は `Decimal(12,2)` = ドル建てだが、Stripe 経路は
 * minor unit（セント）を書いていた時期がある。その既存行を 1/100 に補正する
 * 一回限りのスクリプト群で共有する「述語」「digest 式」「引数処理」を集約する。
 *
 * ここに述語を集約するのは規約上の要請である:
 * plans/063-backfill-stripe-payment-amount.md は Step 3 / Step 4 で
 * 「述語は完全に同一にすること」を繰り返し要求しているが、レポート側と
 * UPDATE 側に同じ SQL を書き写す形にすると、片方だけ編集された瞬間に
 * 「承認された集合と違う集合を UPDATE する」事故が起きる。import で
 * 共有することで、その一致をレビューではなくモジュール境界で保証する。
 *
 * @see plans/063-backfill-stripe-payment-amount.md
 */

import { Prisma, PrismaClient } from "@prisma/client";

/**
 * カットオーバー境界の既定値。
 *
 * `c4a6fb41`（webhook 経路を `order.total` 保存へ統一したコミット）の commit 時刻。
 * 本プロジェクトには本番デプロイが存在せず（`.vercel` 等の設定なし）デプロイログを
 * 参照できないため、plan 063 Step 1 が要求する「デプロイ時刻」の代わりに
 * commit 時刻を採用する。
 */
export const DEFAULT_BOUNDARY_ISO = "2026-08-07T02:44:54+09:00";

/** cents 行と判定する ratio の下限（`amount / order.total`）。 */
export const RATIO_CENTS_MIN = 99;
/** cents 行と判定する ratio の上限。 */
export const RATIO_CENTS_MAX = 101;
/** 補正済み（ドル建て）と判定する ratio の下限。 */
export const RATIO_DOLLARS_MIN = 0.99;
/** 補正済み（ドル建て）と判定する ratio の上限。 */
export const RATIO_DOLLARS_MAX = 1.01;

/**
 * PayPal 経路が書きうる `paymentMethod` の表記ゆれ。
 *
 * `20260529073346_backfill_paypal_payment_method_casing` が `'Paypal'` を
 * `'PayPal'` へ正規化済みなので現行 DB では前者はヒットしないが、
 * 未適用の DB / 復元されたバックアップに対しても同じ意味で動くよう残す。
 */
export const PAYPAL_LABELS = ["PayPal", "Paypal"] as const;

/** ゲート照合に使う「件数 + id 集合 digest」。 */
export type GateRow = {
    count: number;
    digest: string;
};

/**
 * 候補行の出自判定に使う唯一の signal。
 *
 * `paymentMethod` は出自を表さない: 境界以前の PayPal webhook は upsert の
 * update 分岐に `amount` / `currency` を持たなかったため、Stripe が cents で
 * 作った行に PayPal イベントが届くと **ラベルだけ 'PayPal' に変わり金額は
 * cents のまま**という行が残る。PayPal 経路は初日からドル建てしか書いて
 * いないので、`ratio ≈ 100` はラベルに関わらず Stripe 由来を意味する。
 */
const ratioCentsPredicate = Prisma.sql`
    pd.amount / NULLIF(o.total, 0) BETWEEN ${RATIO_CENTS_MIN} AND ${RATIO_CENTS_MAX}
`;

/**
 * `md5(coalesce(string_agg(id ORDER BY id), ''))` — id 集合を決定論的な 1 文字列へ畳む。
 *
 * 件数だけでは不足である: 承認と実行の間に 1 行が候補を外れ別の 1 行が候補へ
 * 入ると、**件数は一致したまま対象行が入れ替わる**。`coalesce(…, '')` は候補 0 件で
 * `string_agg` が NULL を返し `md5(NULL)` = NULL となって比較が常に不成立
 * （NULL）になるのを防ぐ。0 件は空文字列の md5 という決定論的な値を持つべきで、
 * 「比較不能」に落としてはいけない。
 */
const digestExpr = Prisma.sql`md5(coalesce(string_agg(pd.id::text, ',' ORDER BY pd.id), ''))`;

/**
 * UPDATE 対象（`ratio ≈ 100`）の件数と id digest を返す SQL。
 *
 * この述語は {@link updateCandidatesSql} の WHERE と**完全に同一**でなければ
 * ならない。両者が同じ `ratioCentsPredicate` を参照しているのはそのため。
 *
 * @param boundary この時刻より前に作成された行のみを対象にする
 */
export function candidateGateSql(boundary: Date): Prisma.Sql {
    return Prisma.sql`
        SELECT count(*)::int AS count,
               ${digestExpr}  AS digest
        FROM   "PaymentDetails" pd
        JOIN   "Order" o ON o.id = pd."orderId"
        WHERE  pd."createdAt" < ${boundary}
          AND  ${ratioCentsPredicate}
    `;
}

/**
 * 補正 UPDATE を実行し、**影響した行の集合をその場で捕捉して**返す SQL。
 *
 * `UPDATE ... RETURNING` を CTE に包むことで、件数と id digest を同一文の中で
 * 取得できる。事後ゲートがこれを事前ゲートの値と突き合わせる。
 *
 * `currency` の扱いが分岐するのは、provider 切替で PayPal として確定した行に
 * Stripe 由来の通貨が残っているためで、これは `amount` が cents で残っているのと
 * 同じ書き漏れの裏表である。`amount` だけ直すと「PayPal 決済なのに通貨が eur」の
 * 行が残り、次の監査で再び候補として掘り起こされる。
 *
 * `ratio BETWEEN 99 AND 101` は自己防衛でもある: 既にドル建ての行は
 * `ratio ≈ 1` なので二度目の実行では一致せず、再実行は no-op になる。
 *
 * @param boundary この時刻より前に作成された行のみを対象にする
 */
export function updateCandidatesSql(boundary: Date): Prisma.Sql {
    return Prisma.sql`
        WITH updated AS (
            UPDATE "PaymentDetails" pd
            SET    amount   = pd.amount / 100,
                   currency = CASE
                                  WHEN pd."paymentMethod" IN (${Prisma.join(PAYPAL_LABELS)}) THEN 'usd'
                                  ELSE pd.currency
                              END
            FROM   "Order" o
            WHERE  o.id = pd."orderId"
              AND  pd."createdAt" < ${boundary}
              AND  ${ratioCentsPredicate}
            RETURNING pd.id
        )
        SELECT count(*)::int                                            AS count,
               md5(coalesce(string_agg(id::text, ',' ORDER BY id), '')) AS digest
        FROM   updated
    `;
}

/**
 * Step 2 の候補集合（レポート用・読み取り専用）。
 *
 * ゲート述語より**広い**: `paymentMethod = 'Stripe'` の arm を足すことで、
 * ratio が計算不能な zero-total 行（`ratio IS NULL`）も候補総数に含め、
 * 4 バケットの合計が候補総数に一致するという検算を成立させる。
 */
export function candidateRowsSql(boundary: Date): Prisma.Sql {
    return Prisma.sql`
        SELECT pd.id,
               pd."paymentIntentId"            AS payment_intent_id,
               pd."paymentMethod"              AS payment_method,
               pd.currency,
               pd.amount::text                 AS stored_amount,
               o.total::text                   AS order_total,
               (pd.amount / NULLIF(o.total, 0))::text AS ratio,
               pd."createdAt"                  AS created_at
        FROM   "PaymentDetails" pd
        JOIN   "Order" o ON o.id = pd."orderId"
        WHERE  pd."createdAt" < ${boundary}
          AND  (
                 pd."paymentMethod" = 'Stripe'
              OR ${ratioCentsPredicate}
               )
        ORDER BY pd."createdAt"
    `;
}

/**
 * 引数を `--key value` 形式で読む最小のパーサ。
 *
 * 値が欠けた指定（`--boundary` の直後が別のフラグ、または末尾）は黙って
 * undefined にせず throw する。金額を書き換えるスクリプトで「引数が渡って
 * いなかったので既定値で走った」という経路を作らないため。
 */
export function parseArgs(argv: readonly string[]): Map<string, string | true> {
    const args = new Map<string, string | true>();

    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (!token.startsWith("--")) continue;

        const key = token.slice(2);
        const next = argv[i + 1];

        if (next === undefined || next.startsWith("--")) {
            args.set(key, true);
            continue;
        }

        args.set(key, next);
        i++;
    }

    return args;
}

/** `--key value` を文字列として取り出す。フラグ指定（値なし）は undefined 扱い。 */
export function getStringArg(
    args: Map<string, string | true>,
    key: string
): string | undefined {
    const value = args.get(key);
    return typeof value === "string" ? value : undefined;
}

/**
 * 境界引数を Date へ解決する。未指定なら {@link DEFAULT_BOUNDARY_ISO}。
 *
 * @throws 解析できない日時文字列が渡された場合
 */
export function resolveBoundary(raw: string | undefined): Date {
    const iso = raw ?? DEFAULT_BOUNDARY_ISO;
    const boundary = new Date(iso);

    if (Number.isNaN(boundary.getTime())) {
        throw new Error(`Invalid --boundary: ${iso}`);
    }

    return boundary;
}

/**
 * 接続先 URL から資格情報を落とし、`user@host/db` だけを返す。
 *
 * 「意図した DB に繋いでいるか」をログで確認できるようにしつつ、
 * パスワードや api_key を出力に混ぜないため（構造化ログ規約: 秘密情報を
 * ログへ出さない）。
 */
export function maskDatabaseUrl(raw: string | undefined): string {
    if (!raw) return "(unset)";

    try {
        const url = new URL(raw);
        const user = url.username ? `${url.username}@` : "";
        return `${url.protocol}//${user}${url.host}${url.pathname}`;
    } catch {
        return "(unparseable)";
    }
}

/**
 * 本 backfill 専用の Prisma クライアントを作る。
 *
 * `src/lib/db.ts` のシングルトンを使わないのは、あちらが `withAccelerate()` を
 * 被せているため。ゲートは「UPDATE 直前に確定した候補集合」と「実際に更新した
 * 集合」の同一性に依存しており、間にキャッシュ層を挟みたくない。
 * `prisma/seed/` が同じ理由で `new PrismaClient()` の例外に含まれている。
 */
export function createBackfillClient(): PrismaClient {
    return new PrismaClient();
}
