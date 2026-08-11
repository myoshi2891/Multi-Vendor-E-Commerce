/**
 * plan 063 Step 4 — 承認ゲート付きの補正 UPDATE。
 *
 * 使い方:
 *   bun run scripts/backfill/063-apply.ts \
 *       --boundary <ISO8601> \
 *       --approved-count <Step 3 の will_update> \
 *       --approved-digest <Step 3 の candidate_digest>
 *
 * 事前ゲート → UPDATE → 事後ゲート を 1 トランザクションに閉じる。いずれかの
 * 照合が外れれば throw し、Prisma がトランザクションを ROLLBACK してプロセスは
 * 非 0 で終了する。**部分適用は構造上起こらない。**
 *
 * なぜゲートが「あれば良い記録」ではないか:
 * 承認と実行の間は非同期に空く。その間に手作業の修正やバックアップ復元が入ると
 * 候補集合が入れ替わりうる。さらに**件数の一致は行集合の同一性を含意しない** ——
 * 1 行が候補を外れ別の 1 行が候補へ入れば件数は同じままである。だから件数と
 * id digest の両方を見る。
 *
 * plan 063 が記録している実測（2026-08-01 / PostgreSQL 16）では、事後検証を
 * 人間の目視に委ねた旧版はドリフト時に **既にドル建てだった行を 20.00 → 0.20 に
 * 壊したまま exit 0** で完了した。本スクリプトが解消しようとしている単位不整合を
 * runbook 自身が作り出す形であり、機械化は必須である。
 *
 * @see plans/063-backfill-stripe-payment-amount.md
 */

import {
    candidateGateSql,
    createBackfillClient,
    getStringArg,
    maskDatabaseUrl,
    parseArgs,
    resolveBoundary,
    updateCandidatesSql,
    type GateRow,
} from "./063-shared";

/** ゲート不一致を表す。通常のエラーと区別してメッセージを整形するために使う。 */
class BackfillGateError extends Error {
    constructor(
        message: string,
        readonly expected: GateRow,
        readonly actual: GateRow
    ) {
        super(message);
        this.name = "BackfillGateError";
    }
}

/** 承認値（件数と digest）を引数から取り出す。欠落は即エラー。 */
function requireApproval(args: Map<string, string | true>): GateRow {
    const rawCount = getStringArg(args, "approved-count");
    const digest = getStringArg(args, "approved-digest");

    if (rawCount === undefined || digest === undefined) {
        throw new Error(
            "--approved-count と --approved-digest は必須です（Step 3 のレポートの値を渡してください）"
        );
    }

    const count = Number(rawCount);
    if (!Number.isInteger(count) || count < 0) {
        throw new Error(`--approved-count が不正です: ${rawCount}`);
    }
    if (!/^[0-9a-f]{32}$/.test(digest)) {
        throw new Error(
            `--approved-digest が md5 の形式ではありません: ${digest}`
        );
    }

    return { count, digest };
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    const boundary = resolveBoundary(getStringArg(args, "boundary"));
    const approved = requireApproval(args);

    console.log(`接続先: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);
    console.log(`境界  : ${boundary.toISOString()}`);
    console.log(`承認値: count=${approved.count} digest=${approved.digest}\n`);

    const db = createBackfillClient();

    try {
        const result = await db.$transaction(
            async (tx) => {
                // 1) UPDATE の前に候補集合を確定させる（述語は UPDATE と共有モジュール上で同一）。
                const [pre] = await tx.$queryRaw<GateRow[]>(
                    candidateGateSql(boundary)
                );

                // 2) 事前ゲート: 承認された集合と同一か。件数と digest の両方を見る。
                if (
                    pre.count !== approved.count ||
                    pre.digest !== approved.digest
                ) {
                    throw new BackfillGateError(
                        "GATE FAIL: candidate set drifted since approval",
                        approved,
                        pre
                    );
                }
                console.log(
                    `GATE OK: candidate set matches the approved report (count=${pre.count})`
                );

                // 3) 両方一致したときだけ UPDATE し、影響行の集合をその場で捕捉する。
                const [post] = await tx.$queryRaw<GateRow[]>(
                    updateCandidatesSql(boundary)
                );

                // 4) 事後ゲート: 実際に更新した集合が事前の候補集合と同一か。
                if (post.count !== pre.count || post.digest !== pre.digest) {
                    throw new BackfillGateError(
                        "POST FAIL: the updated set differs from the pre-checked candidates",
                        pre,
                        post
                    );
                }
                console.log(
                    `POST OK: the updated set matches the pre-checked candidate set (count=${post.count})`
                );

                // 5) ここまで到達したときだけコールバックが正常終了し COMMIT される。
                return post;
            },
            { timeout: 30_000 }
        );

        console.log(`\n✅ COMMIT 済み: ${result.count} 行を補正しました`);
        console.log(`   updated_digest = ${result.digest}`);
    } finally {
        await db.$disconnect();
    }
}

main().catch((error: unknown) => {
    if (error instanceof BackfillGateError) {
        console.error(`[Backfill063:apply] ${error.message}`, {
            expected: error.expected,
            actual: error.actual,
        });
        console.error("ROLLBACK されました。データは一切変更されていません。");
        process.exit(3);
    }
    if (error instanceof Error) {
        console.error("[Backfill063:apply] Failed", {
            error: error.message,
            stack: error.stack,
        });
    } else {
        console.error("[Backfill063:apply] Unknown error", { error });
    }
    process.exit(1);
});
