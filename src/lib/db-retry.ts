import { randomInt } from "node:crypto";

import { Prisma } from "@prisma/client";

/**
 * Prisma がトランザクションの直列化異常（serialization failure）で返すエラーコード。
 * PostgreSQL の SQLSTATE 40001 に対応する。
 */
const SERIALIZATION_FAILURE_CODE = "P2034";

/**
 * PostgreSQL がデッドロックを検出したときの SQLSTATE。直列化異常（`40001` /
 * Prisma の `P2034`）とは**別の条件**であり、混同してはならない。
 *
 * `40P01` は Prisma のモデル API 経由では独自コードに畳まれず、`$queryRaw` の失敗
 * （`P2010`）の `meta.code` に生の SQLSTATE として現れる。カテゴリツリーのロックは
 * `SELECT ... FOR UPDATE` を `$queryRaw` で発行するため（`lockCategoryNodesForUpdate`）、
 * デッドロックはこの経路で観測される。
 */
const DEADLOCK_SQLSTATE = "40P01";
const RAW_QUERY_FAILED_CODE = "P2010";

/** 再試行の共通オプション（上限回数とバックオフ基準時間）。 */
type RetryOptions = { maxAttempts?: number; baseDelayMs?: number };

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 25;

/**
 * バックオフ待ち時間の上限（ms）。`baseDelayMs` と、指数バックオフ後の実待ち時間の
 * **両方**に掛ける。
 *
 * 有限でも巨大な値は下の正規化（小数切り捨て・下限 0・非有限→既定値）を素通りするため、
 * 上限が無いと 2 通りの形で壊れる:
 * - `randomInt(0, max)` は `max - min <= 2**48 - 1` が Node の要件。超えると
 *   **catch の内側から `ERR_OUT_OF_RANGE` が投げられ**、投げ返すはずの P2034 が化ける。
 * - `setTimeout` は `2**31 - 1` を超える遅延を黙って ~1ms へ丸める。つまり巨大値を
 *   渡すとかえってバックオフが消える。
 *
 * 60 秒は上記 2 つの機械的限界より十分小さく、かつ直列化異常の再試行（既定 3 回）で
 * 実用上到達しない水準。ここは方針ではなく**安全網**であり、通常経路の値には影響しない。
 */
const MAX_DELAY_MS = 60_000;

/**
 * 直列化異常（P2034）かどうかを判定する型ガード。
 *
 * `any` を使わず `unknown` から絞り込む（`.claude/steering/tech.md` の規約）。
 */
export const isSerializationFailure = (error: unknown): boolean =>
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === SERIALIZATION_FAILURE_CODE;

/**
 * Prisma の既知エラーから、`$queryRaw` 失敗（`P2010`）に添えられた生の SQLSTATE を取り出す。
 *
 * `meta` は `unknown` 相当なので、`as any` で覗かずに `in` 演算子で絞り込む
 * （`.claude/steering/tech.md` の `any` 禁止規約）。
 */
const sqlStateOf = (
    error: Prisma.PrismaClientKnownRequestError
): string | null => {
    const meta: unknown = error.meta;
    if (typeof meta !== "object" || meta === null || !("code" in meta)) {
        return null;
    }
    const code: unknown = meta.code;
    return typeof code === "string" ? code : null;
};

/**
 * PostgreSQL のデッドロック（SQLSTATE `40P01`）かどうかを判定する型ガード。
 *
 * **直列化異常（`P2034`）は含めない。** 両者は原因も対処も異なり、`isSerializationFailure`
 * と役割を分けておかないと「Serializable の再試行」と「ロック順の交差による再試行」が
 * 同じ計測・同じ上限に混ざって、どちらが起きているのか判別できなくなる。
 */
export const isDeadlockFailure = (error: unknown): boolean =>
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === RAW_QUERY_FAILED_CODE &&
    sqlStateOf(error) === DEADLOCK_SQLSTATE;

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 再試行ループの本体。**どのエラーを再試行するかだけ**を `isRetryable` で差し替える。
 *
 * 上限・バックオフ・値の正規化はどの再試行でも同じなので 1 箇所に持ち、
 * 「直列化異常（`P2034`）」と「デッドロック（`40P01`）」は述語で分ける。混ぜて
 * 1 つの述語にしないのは、原因も対処も異なる 2 条件を同じ上限・同じログに
 * 畳んでしまうと、どちらが起きたのか運用側から判別できなくなるため。
 *
 * @param isRetryable - 再試行対象と見なすエラーの述語
 * @param operation - 再実行可能な処理。**副作用が冪等であること**が前提。
 *                    トランザクション全体をこの中に入れること（部分適用されると
 *                    再試行で二重適用になる）。
 * @param options.maxAttempts - 初回を含む最大試行回数（既定 3）
 * @param options.baseDelayMs - 指数バックオフの基準待ち時間（既定 25ms）。
 *                    小数は切り捨て・負値は 0・非有限値は既定値・上限 `MAX_DELAY_MS`
 *                    へ正規化される（`randomInt` が整数かつ `2**48` 未満の範囲しか
 *                    受理せず、`setTimeout` は `2**31-1` 超を黙って丸めるため）
 */
const retryOn = async <T>(
    isRetryable: (error: unknown) => boolean,
    operation: () => Promise<T>,
    options?: RetryOptions
): Promise<T> => {
    // `??` は nullish 合体なので 0 / NaN / 負値を既定値へ倒せない。クランプが無いと
    // ループが 1 周も回らず lastError 未代入のまま `throw undefined` になり、
    // 呼び出し側の `instanceof Error` 型ガードが全て崩れる（catch で握れない）。
    // 「最低 1 回は試す」が本関数の正直な契約なので、既定値へ戻さず下限 1 で
    // クランプする（呼び出し側の明示値を黙って 3 に膨らませない）。
    const requestedAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const maxAttempts = Number.isFinite(requestedAttempts)
        ? Math.max(1, Math.floor(requestedAttempts))
        : 1;
    // `baseDelayMs` は `randomInt(0, baseDelayMs)` へ渡るが、`randomInt` は整数しか
    // 受理しない（小数は ERR_INVALID_ARG_TYPE）。正規化が無いと catch の内側から
    // 別のエラーが投げられ、本来投げ返すはずの P2034 が化けて呼び出し側の
    // `isSerializationFailure` 判定が空振りする。
    // `maxAttempts` と違い**非有限なら既定値へ戻す**: 待ち時間は呼び出し側の契約では
    // なく実装詳細であり、NaN を 0 に倒すとジッターが消えてロックステップ回避という
    // 本来の目的が黙って失われるため。負値は 0 へ（バックオフ無し = 即再試行）。
    // `Math.floor` は値を縮めないため、**有限の巨大値には下限クランプが効かない**。
    // 上限（`MAX_DELAY_MS`）も掛けて `randomInt` / `setTimeout` の機械的限界の内側に収める。
    const requestedDelay = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    const baseDelayMs = Number.isFinite(requestedDelay)
        ? Math.min(MAX_DELAY_MS, Math.max(0, Math.floor(requestedDelay)))
        : DEFAULT_BASE_DELAY_MS;

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error: unknown) {
            // 対象外のエラーは再試行しても結果が変わらないため即座に投げ返す。
            if (!isRetryable(error)) throw error;

            lastError = error;
            if (attempt === maxAttempts) break;

            // 指数バックオフ + ジッター。競合した2者が同じ間隔で再突入して
            // 再び衝突する（ロックステップ）のを避ける。
            // ジッターに `node:crypto` を使うのは静的解析（SonarCloud S2245）が
            // `Math.random()` を security 用途と誤検知するため。ここは暗号強度要件では
            // なく単なる衝突回避なので、範囲 [0, baseDelayMs) の乱数であれば等価。
            // `randomInt(0, 0)` は RangeError を投げるため baseDelayMs=0 はガードする。
            // `baseDelayMs` を上限内に収めても `2 ** (attempt - 1)` 倍で再び越えるため、
            // 実待ち時間にも同じ上限を掛ける（`setTimeout` の暗黙クランプに落とさない）。
            const backoff = baseDelayMs * 2 ** (attempt - 1);
            const jitter = baseDelayMs > 0 ? randomInt(0, baseDelayMs) : 0;
            await sleep(Math.min(MAX_DELAY_MS, backoff + jitter));
        }
    }

    throw lastError;
};

/**
 * `isolationLevel: Serializable` のトランザクションを、直列化異常時のみ再試行する。
 *
 * Serializable は競合を「壊れたデータ」ではなく「やり直せるエラー（P2034）」へ
 * 変換する仕組みであり、**再試行とセットで初めて機能する**。再試行がないと、
 * 直列化前に起きていた P2002 / P2025 を P2034 に置き換えただけになり、
 * 正当なリクエストが落ちる問題は解決しない。
 *
 * P2034 以外のエラーは即座に再 throw する（握りつぶさない）。
 *
 * @example
 * const cart = await retryOnSerializationFailure(() =>
 *     db.$transaction(async (tx) => { ... }, { isolationLevel: Serializable })
 * );
 */
export const retryOnSerializationFailure = <T>(
    operation: () => Promise<T>,
    options?: RetryOptions
): Promise<T> => retryOn(isSerializationFailure, operation, options);

/**
 * PostgreSQL のデッドロック（SQLSTATE `40P01`）で落ちたトランザクションを再試行する。
 *
 * デッドロックは**ロック取得順が交差したときだけ**起きる。取得順を揃えられる範囲は
 * 実装側で揃えるのが第一（`acquireCategoryTreeLocks` は候補集合を 1 つの id 昇順で
 * 掴み切る）で、この再試行はそこで閉じ切れない残りの窓のための安全網である ——
 * 候補集合の 1 周目の算出は非ロック読みなので、掴み直しの周回だけは自ノードより
 * 後に低い id を取り得る（`docs/design/category-tree/design.md` の「残る窓（既知）」）。
 *
 * PostgreSQL はデッドロックを検出した時点で片方の**トランザクション全体**を abort
 * するため、部分適用は残らない。したがって再実行の単位は `db.$transaction` 全体で
 * なければならない（トランザクションの内側を再試行しても掴み直せない）。
 *
 * 上限に達したら最後の `40P01` をそのまま投げ返す（握りつぶさない）。
 *
 * @example
 * return await retryOnDeadlock(() =>
 *     db.$transaction((tx) => applyCategoryTreeUpsert(tx, ...))
 * );
 */
export const retryOnDeadlock = <T>(
    operation: () => Promise<T>,
    options?: RetryOptions
): Promise<T> => retryOn(isDeadlockFailure, operation, options);
