import { Prisma } from "@prisma/client";
import {
    isSerializationFailure,
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

        await expect(retryOnSerializationFailure(operation)).resolves.toBe("ok");

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
