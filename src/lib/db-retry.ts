import { randomInt } from "node:crypto";

import { Prisma } from "@prisma/client";

/**
 * Prisma がトランザクションの直列化異常（serialization failure）で返すエラーコード。
 * PostgreSQL の SQLSTATE 40001 に対応する。
 */
const SERIALIZATION_FAILURE_CODE = "P2034";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 25;

/**
 * 直列化異常（P2034）かどうかを判定する型ガード。
 *
 * `any` を使わず `unknown` から絞り込む（`.claude/steering/tech.md` の規約）。
 */
export const isSerializationFailure = (error: unknown): boolean =>
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === SERIALIZATION_FAILURE_CODE;

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

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
 * @param operation - 再実行可能な処理。**副作用が冪等であること**が前提。
 *                    トランザクション全体をこの中に入れること（部分適用されると
 *                    再試行で二重適用になる）。
 * @param options.maxAttempts - 初回を含む最大試行回数（既定 3）
 * @param options.baseDelayMs - 指数バックオフの基準待ち時間（既定 25ms）。
 *                    小数は切り捨て・負値は 0・非有限値は既定値へ正規化される
 *                    （`randomInt` が整数しか受理しないため）
 *
 * @example
 * const cart = await retryOnSerializationFailure(() =>
 *     db.$transaction(async (tx) => { ... }, { isolationLevel: Serializable })
 * );
 */
export const retryOnSerializationFailure = async <T>(
    operation: () => Promise<T>,
    options?: { maxAttempts?: number; baseDelayMs?: number }
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
    const requestedDelay = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    const baseDelayMs = Number.isFinite(requestedDelay)
        ? Math.max(0, Math.floor(requestedDelay))
        : DEFAULT_BASE_DELAY_MS;

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error: unknown) {
            // 直列化異常以外は再試行しても結果が変わらないため即座に投げ返す。
            if (!isSerializationFailure(error)) throw error;

            lastError = error;
            if (attempt === maxAttempts) break;

            // 指数バックオフ + ジッター。競合した2者が同じ間隔で再突入して
            // 再び衝突する（ロックステップ）のを避ける。
            // ジッターに `node:crypto` を使うのは静的解析（SonarCloud S2245）が
            // `Math.random()` を security 用途と誤検知するため。ここは暗号強度要件では
            // なく単なる衝突回避なので、範囲 [0, baseDelayMs) の乱数であれば等価。
            // `randomInt(0, 0)` は RangeError を投げるため baseDelayMs=0 はガードする。
            const backoff = baseDelayMs * 2 ** (attempt - 1);
            const jitter = baseDelayMs > 0 ? randomInt(0, baseDelayMs) : 0;
            await sleep(backoff + jitter);
        }
    }

    throw lastError;
};
