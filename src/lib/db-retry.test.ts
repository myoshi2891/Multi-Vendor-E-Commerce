import { Prisma } from "@prisma/client";
import {
    isDeadlockFailure,
    isSerializationFailure,
    retryOnDeadlock,
    retryOnSerializationFailure,
} from "./db-retry";

/**
 * P2034（直列化異常）を模した Prisma エラーを生成する。
 */
const makeSerializationFailure = () =>
    new Prisma.PrismaClientKnownRequestError("could not serialize access", {
        code: "P2034",
        clientVersion: "test",
    });

/**
 * デッドロック（SQLSTATE 40P01）を模した Prisma エラーを生成する。
 *
 * `$queryRaw` の失敗は `P2010` に畳まれ、生の SQLSTATE は `meta.code` に載る
 * （`lockCategoryNodesForUpdate` の `SELECT ... FOR UPDATE` がこの経路）。
 */
const makeDeadlockFailure = () =>
    new Prisma.PrismaClientKnownRequestError("Raw query failed", {
        code: "P2010",
        clientVersion: "test",
        meta: { code: "40P01", message: "deadlock detected" },
    });

const makeUniqueConstraintError = () =>
    new Prisma.PrismaClientKnownRequestError("unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
    });

describe("isSerializationFailure", () => {
    it("P2034 の Prisma エラーを true と判定する", () => {
        expect(isSerializationFailure(makeSerializationFailure())).toBe(true);
    });

    it("他の Prisma エラーコードは false と判定する", () => {
        expect(isSerializationFailure(makeUniqueConstraintError())).toBe(false);
    });

    it("Prisma 由来でない値は false と判定する", () => {
        expect(isSerializationFailure(new Error("boom"))).toBe(false);
        expect(isSerializationFailure("P2034")).toBe(false);
        expect(isSerializationFailure(null)).toBe(false);
    });
});

describe("retryOnSerializationFailure", () => {
    it("成功した場合は再試行せず結果を返す", async () => {
        const operation = jest.fn().mockResolvedValue("ok");

        await expect(retryOnSerializationFailure(operation)).resolves.toBe(
            "ok"
        );

        expect(operation).toHaveBeenCalledTimes(1);
    });

    it("P2034 で失敗しても再試行して成功すれば結果を返す", async () => {
        const operation = jest
            .fn()
            .mockRejectedValueOnce(makeSerializationFailure())
            .mockResolvedValue("ok");

        await expect(
            retryOnSerializationFailure(operation, { baseDelayMs: 0 })
        ).resolves.toBe("ok");

        expect(operation).toHaveBeenCalledTimes(2);
    });

    it("maxAttempts まで再試行し、超えたら最後の P2034 を投げる", async () => {
        const operation = jest
            .fn()
            .mockRejectedValue(makeSerializationFailure());

        await expect(
            retryOnSerializationFailure(operation, {
                maxAttempts: 3,
                baseDelayMs: 0,
            })
        ).rejects.toMatchObject({ code: "P2034" });

        expect(operation).toHaveBeenCalledTimes(3);
    });

    // 再試行してよいのは「やり直せば結果が変わりうる」直列化異常だけ。
    // 一意制約違反などを再試行しても同じ失敗を繰り返し、遅延を増やすだけになる。
    it("P2034 以外のエラーは再試行せず即座に投げ返す", async () => {
        const operation = jest
            .fn()
            .mockRejectedValue(makeUniqueConstraintError());

        await expect(
            retryOnSerializationFailure(operation, { baseDelayMs: 0 })
        ).rejects.toMatchObject({ code: "P2002" });

        expect(operation).toHaveBeenCalledTimes(1);
    });

    it("Prisma 由来でないエラーも再試行せず投げ返す", async () => {
        const operation = jest.fn().mockRejectedValue(new Error("boom"));

        await expect(
            retryOnSerializationFailure(operation, { baseDelayMs: 0 })
        ).rejects.toThrow("boom");

        expect(operation).toHaveBeenCalledTimes(1);
    });

    // `?? DEFAULT_MAX_ATTEMPTS` は nullish 合体なので 0 / NaN を弾けない。
    // クランプが無いと for が 1 周も回らず lastError 未代入のまま `throw undefined`
    // になり、呼び出し側の `instanceof Error` 型ガードが全て崩れる。
    // 「最低 1 回は試す」が正直な契約なので、下限 1 でクランプする。
    it.each([
        ["0", 0],
        ["負値", -5],
        ["NaN", Number.NaN],
        ["小数", 1.9],
    ])(
        "maxAttempts が %s でも operation を 1 回は実行し、結果を返す",
        async (_label, maxAttempts) => {
            const operation = jest.fn().mockResolvedValue("ok");

            await expect(
                retryOnSerializationFailure(operation, {
                    maxAttempts,
                    baseDelayMs: 0,
                })
            ).resolves.toBe("ok");

            expect(operation).toHaveBeenCalledTimes(1);
        }
    );

    // `baseDelayMs` は `randomInt(0, baseDelayMs)` に素通しされる。`randomInt` は
    // **整数引数しか受理しない**ため、小数を渡すと catch の中から ERR_INVALID_ARG_TYPE が
    // 投げられ、本来投げ返すはずの P2034 が TypeError に化ける（＝呼び出し側の
    // `isSerializationFailure` / `code === "P2034"` 判定が全て空振りする）。
    // NaN / 負値は throw しないが `setTimeout` が即発火するのでバックオフが黙って
    // 消える。いずれも「リトライ経路を一周させて初めて」露出するため、
    // operation が maxAttempts 回呼ばれたこと（＝ジッター経路を通ったこと）も固定する。
    it.each([
        ["小数", 25.5],
        ["NaN", Number.NaN],
        ["負値", -1],
    ])(
        "baseDelayMs が %s でも P2034 をそのまま投げ返す（別のエラーに化けない）",
        async (_label, baseDelayMs) => {
            const operation = jest
                .fn()
                .mockRejectedValue(makeSerializationFailure());

            await expect(
                retryOnSerializationFailure(operation, {
                    maxAttempts: 2,
                    baseDelayMs,
                })
            ).rejects.toMatchObject({ code: "P2034" });

            expect(operation).toHaveBeenCalledTimes(2);
        }
    );

    // 有限でも巨大な `baseDelayMs` は上の正規化（小数切り捨て・下限 0・非有限→既定値）を
    // すべて通り抜ける（`Math.floor` は値を縮めない）。しかし
    // 1. `randomInt(0, max)` は Node の要件として `max - min < 2**48` を満たす必要があり、
    //    `2**48` 以上では **catch の内側から `ERR_OUT_OF_RANGE`（RangeError）が投げられ**、
    //    投げ返すはずの P2034 が化けて下流の `isSerializationFailure` 判定が空振りする。
    //    小数 → `ERR_INVALID_ARG_TYPE` と**同一の欠陥クラス**（上の it.each）の残存。
    // 2. `backoff` が `2**31 - 1` を超えると `setTimeout` が黙って ~1ms へ丸めるため、
    //    「巨大値を渡すとかえってバックオフが消える」という逆転が起きる。
    // どちらも上限クランプで閉じる。fake timer はクランプ後の待ち時間を実時間で
    // 待たないために使う（復元は afterEach — 失敗したテストの後でも必ず走る）。
    describe("baseDelayMs の上限クランプ", () => {
        // クランプ上限（60s）+ ジッター上限（< 60s）を必ず消化できる進め幅。
        const BEYOND_MAX_DELAY_MS = 120_000;

        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it.each([
            ["2**48（randomInt の範囲上限）", 2 ** 48],
            ["MAX_SAFE_INTEGER", Number.MAX_SAFE_INTEGER],
        ])(
            "baseDelayMs が %s でも P2034 をそのまま投げ返す（RangeError に化けない）",
            async (_label, baseDelayMs) => {
                const operation = jest
                    .fn()
                    .mockRejectedValue(makeSerializationFailure());

                // reject を先に捕まえてから時計を進める（unhandled rejection を作らない）
                const settled = retryOnSerializationFailure(operation, {
                    maxAttempts: 2,
                    baseDelayMs,
                }).catch((error: unknown) => error);

                await jest.advanceTimersByTimeAsync(BEYOND_MAX_DELAY_MS);

                expect(await settled).toMatchObject({ code: "P2034" });
                // ジッター経路で throw していたら 1 回で止まる。再試行到達も固定する。
                expect(operation).toHaveBeenCalledTimes(2);
            }
        );

        it("巨大な baseDelayMs でもバックオフが上限内で消化される", async () => {
            const operation = jest
                .fn()
                .mockRejectedValueOnce(makeSerializationFailure())
                .mockResolvedValue("ok");

            const settled = retryOnSerializationFailure(operation, {
                maxAttempts: 2,
                baseDelayMs: 2 ** 48,
            });

            await jest.advanceTimersByTimeAsync(BEYOND_MAX_DELAY_MS);

            await expect(settled).resolves.toBe("ok");
            expect(operation).toHaveBeenCalledTimes(2);
        });
    });

    it("maxAttempts が 0 でも P2034 は undefined ではなく Error として投げ返す", async () => {
        const operation = jest
            .fn()
            .mockRejectedValue(makeSerializationFailure());

        // `throw undefined` だと rejects.toMatchObject が使えず、下流の
        // `error instanceof Error` も false になる。Error であることを固定する。
        await expect(
            retryOnSerializationFailure(operation, {
                maxAttempts: 0,
                baseDelayMs: 0,
            })
        ).rejects.toMatchObject({ code: "P2034" });

        expect(operation).toHaveBeenCalledTimes(1);
    });
});

describe("isDeadlockFailure", () => {
    it("meta.code が 40P01 の P2010 を true と判定する", () => {
        expect(isDeadlockFailure(makeDeadlockFailure())).toBe(true);
    });

    // 直列化異常とデッドロックを 1 つの述語に畳むと、原因も対処も違う 2 条件が
    // 同じ上限・同じ再試行に混ざって運用側から判別できなくなる。分離を固定する。
    it("直列化異常(P2034)は deadlock と判定しない", () => {
        expect(isDeadlockFailure(makeSerializationFailure())).toBe(false);
        expect(isSerializationFailure(makeDeadlockFailure())).toBe(false);
    });

    it("P2010 でも meta.code が別の SQLSTATE なら false", () => {
        const other = new Prisma.PrismaClientKnownRequestError(
            "Raw query failed",
            {
                code: "P2010",
                clientVersion: "test",
                meta: { code: "42601", message: "syntax error" },
            }
        );
        expect(isDeadlockFailure(other)).toBe(false);
    });

    // meta は Prisma 側の任意フィールドで、欠落・非オブジェクトもあり得る。
    // ここで throw すると catch の内側から別のエラーが出て元の失敗が化ける。
    it.each([
        ["meta 無し", undefined],
        ["meta.code が非文字列", { code: 40101 }],
        ["meta.code 自体が無い", { message: "deadlock detected" }],
    ])("%s の P2010 は false（throw しない）", (_label, meta) => {
        const error = new Prisma.PrismaClientKnownRequestError(
            "Raw query failed",
            { code: "P2010", clientVersion: "test", meta }
        );
        expect(isDeadlockFailure(error)).toBe(false);
    });

    it("Prisma エラー以外は false", () => {
        expect(isDeadlockFailure(new Error("deadlock detected"))).toBe(false);
        expect(isDeadlockFailure(null)).toBe(false);
    });
});

describe("retryOnDeadlock", () => {
    it("40P01 で失敗しても再試行して成功すれば結果を返す", async () => {
        const operation = jest
            .fn()
            .mockRejectedValueOnce(makeDeadlockFailure())
            .mockResolvedValueOnce("ok");

        await expect(
            retryOnDeadlock(operation, { baseDelayMs: 0 })
        ).resolves.toBe("ok");
        expect(operation).toHaveBeenCalledTimes(2);
    });

    it("maxAttempts まで再試行し、超えたら最後の 40P01 を投げ返す", async () => {
        const operation = jest.fn().mockRejectedValue(makeDeadlockFailure());

        await expect(
            retryOnDeadlock(operation, { maxAttempts: 2, baseDelayMs: 0 })
        ).rejects.toMatchObject({ code: "P2010" });
        expect(operation).toHaveBeenCalledTimes(2);
    });

    // 再試行対象を取り違えると、Serializable 用の再試行が deadlock を握って
    // 二重適用したり、その逆で正当な失敗を延々やり直したりする。
    it("直列化異常(P2034)は再試行せず即座に投げ返す", async () => {
        const operation = jest
            .fn()
            .mockRejectedValue(makeSerializationFailure());

        await expect(
            retryOnDeadlock(operation, { baseDelayMs: 0 })
        ).rejects.toMatchObject({ code: "P2034" });
        expect(operation).toHaveBeenCalledTimes(1);
    });

    it("40P01 以外のエラーは再試行せず即座に投げ返す", async () => {
        const operation = jest
            .fn()
            .mockRejectedValue(makeUniqueConstraintError());

        await expect(
            retryOnDeadlock(operation, { baseDelayMs: 0 })
        ).rejects.toMatchObject({ code: "P2002" });
        expect(operation).toHaveBeenCalledTimes(1);
    });
});
