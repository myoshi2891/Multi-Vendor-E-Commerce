/**
 * `@/lib/db` の遅延初期化 Proxy に対する単体テスト。
 *
 * 実 DB へは一切接続しない。`@prisma/client` / `@prisma/extension-accelerate` を
 * モックし、以下の契約を検証する:
 *   1. import しただけでは PrismaClient を生成しない（= 接続を張らない）
 *   2. 初回プロパティアクセスで 1 度だけ生成し、以降は同一インスタンスを使い回す
 *   3. 非 production では globalThis.prisma にキャッシュし、production ではしない
 *   4. 既存の globalThis.prisma があればそれを再利用する
 *   5. メソッドは実体に bind して返す（Proxy を this にしない）
 */

const mockConstructPrismaClient = jest.fn();
const mockExtends = jest.fn();
const mockWithAccelerate = jest.fn(() => ({ name: "accelerate" }));

jest.mock("@prisma/client", () => ({
    PrismaClient: jest.fn().mockImplementation(() => {
        mockConstructPrismaClient();
        return { $extends: mockExtends };
    }),
}));

jest.mock("@prisma/extension-accelerate", () => ({
    withAccelerate: () => mockWithAccelerate(),
}));

/** テスト用の擬似 Prisma クライアント。`$connect` は `this` 依存で bind を検証する。 */
type FakeClient = {
    id: string;
    clientVersion: string;
    $connect(): string;
};

const makeFakeClient = (id: string): FakeClient => ({
    id,
    clientVersion: "test",
    $connect(this: FakeClient): string {
        return this.id;
    },
});

/**
 * Proxy 越しにプロパティを読む。`db` の公開型（Accelerate 拡張済み）には
 * テスト用の擬似プロパティが存在しないため、`unknown` 経由で取り出す。
 */
const readProp = (target: unknown, key: string): unknown =>
    (target as Record<string, unknown>)[key];

/** グローバル宣言（`var prisma: ExtendedPrismaClient | undefined`）へ安全に書き込むヘルパ。 */
const setGlobalPrisma = (value: unknown): void => {
    (globalThis as unknown as { prisma: unknown }).prisma = value;
};

const getGlobalPrisma = (): unknown =>
    (globalThis as unknown as { prisma: unknown }).prisma;

/** NODE_ENV は readonly 型なので defineProperty で差し替える。 */
const setNodeEnv = (value: string): void => {
    Object.defineProperty(process.env, "NODE_ENV", {
        value,
        configurable: true,
        writable: true,
        enumerable: true,
    });
};

/** モジュールレベルの `client` をリセットして `db` を読み直す。 */
const loadDb = async (): Promise<typeof import("./db")> => {
    jest.resetModules();
    return import("./db");
};

const originalNodeEnv = process.env.NODE_ENV;

beforeEach(() => {
    jest.clearAllMocks();
    setGlobalPrisma(undefined);
    mockExtends.mockImplementation(() => makeFakeClient("extended"));
});

afterEach(() => {
    setGlobalPrisma(undefined);
    setNodeEnv(originalNodeEnv ?? "test");
});

describe("db (遅延初期化 Proxy)", () => {
    it("import しただけでは PrismaClient を生成しない", async () => {
        await loadDb();

        expect(mockConstructPrismaClient).not.toHaveBeenCalled();
        expect(mockWithAccelerate).not.toHaveBeenCalled();
    });

    it("初回プロパティアクセスで PrismaClient を 1 度だけ生成する", async () => {
        const { db } = await loadDb();

        expect(readProp(db, "clientVersion")).toBe("test");

        expect(mockConstructPrismaClient).toHaveBeenCalledTimes(1);
        expect(mockWithAccelerate).toHaveBeenCalledTimes(1);
        expect(mockExtends).toHaveBeenCalledTimes(1);
    });

    it("2 回目以降のアクセスではキャッシュ済みインスタンスを再利用する", async () => {
        const { db } = await loadDb();

        expect(readProp(db, "clientVersion")).toBe("test");
        expect(readProp(db, "clientVersion")).toBe("test");
        expect(readProp(db, "clientVersion")).toBe("test");

        expect(mockConstructPrismaClient).toHaveBeenCalledTimes(1);
    });

    it("非 production では globalThis.prisma にキャッシュする", async () => {
        setNodeEnv("development");
        const { db } = await loadDb();

        expect(readProp(db, "clientVersion")).toBe("test");

        expect(getGlobalPrisma()).toEqual(
            expect.objectContaining({ id: "extended" })
        );
    });

    it("production では globalThis.prisma にキャッシュしない", async () => {
        setNodeEnv("production");
        const { db } = await loadDb();

        expect(readProp(db, "clientVersion")).toBe("test");

        expect(getGlobalPrisma()).toBeUndefined();
        expect(mockConstructPrismaClient).toHaveBeenCalledTimes(1);
    });

    it("既存の globalThis.prisma があれば再生成せず再利用する", async () => {
        setNodeEnv("development");
        setGlobalPrisma(makeFakeClient("from-global"));
        const { db } = await loadDb();

        expect(db.$connect()).toBe("from-global");

        expect(mockConstructPrismaClient).not.toHaveBeenCalled();
    });

    it("メソッドは実体に bind されて返る（this が Proxy にならない）", async () => {
        const { db } = await loadDb();

        // 分割代入でレシーバを失っても `this` が解決できることを確認する
        const { $connect } = db;

        expect($connect()).toBe("extended");
    });

    it("メソッド以外のプロパティはそのまま返す", async () => {
        mockExtends.mockImplementation(() => ({
            ...makeFakeClient("extended"),
            clientVersion: "6.0.0",
        }));
        const { db } = await loadDb();

        expect(readProp(db, "clientVersion")).toBe("6.0.0");
    });

    it("未定義のプロパティは undefined を返す", async () => {
        const { db } = await loadDb();

        expect(readProp(db, "unknownProperty")).toBeUndefined();
    });

    describe("初期化失敗時", () => {
        let errorSpy: jest.SpyInstance;

        beforeEach(() => {
            errorSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
        });

        afterEach(() => {
            errorSpy.mockRestore();
        });

        it("new PrismaClient() の失敗は文脈をログしたうえで元の error を再 throw する", async () => {
            const boom = new Error("PrismaClient init failed");
            // `clearAllMocks` は実装をリセットしないため、後続テストへ
            // 漏れないよう Once で登録する
            mockConstructPrismaClient.mockImplementationOnce(() => {
                throw boom;
            });
            const { db } = await loadDb();

            expect(() => readProp(db, "clientVersion")).toThrow(boom);
            expect(errorSpy).toHaveBeenCalledWith(
                "[Db:getClient] Prisma クライアントの初期化に失敗しました",
                expect.objectContaining({
                    error: "PrismaClient init failed",
                    nodeEnv: process.env.NODE_ENV,
                    reusedGlobal: false,
                })
            );
        });

        it("$extends() の失敗は文脈をログしたうえで元の error を再 throw する", async () => {
            const boom = new Error("accelerate extension failed");
            mockExtends.mockImplementation(() => {
                throw boom;
            });
            const { db } = await loadDb();

            expect(() => readProp(db, "clientVersion")).toThrow(boom);
            expect(mockConstructPrismaClient).toHaveBeenCalledTimes(1);
            expect(errorSpy).toHaveBeenCalledWith(
                "[Db:getClient] Prisma クライアントの初期化に失敗しました",
                expect.objectContaining({
                    error: "accelerate extension failed",
                })
            );
        });

        it("Error 以外が throw された場合も文脈をログして再 throw する", async () => {
            mockExtends.mockImplementation(() => {
                throw "string failure";
            });
            const { db } = await loadDb();

            expect(() => readProp(db, "clientVersion")).toThrow(
                "string failure"
            );
            expect(errorSpy).toHaveBeenCalledWith(
                "[Db:getClient] Prisma クライアントの初期化に失敗しました (Unknown error)",
                expect.objectContaining({ error: "string failure" })
            );
        });

        it("失敗後は client をキャッシュせず、次回アクセスで再試行する", async () => {
            mockExtends.mockImplementationOnce(() => {
                throw new Error("transient failure");
            });
            const { db } = await loadDb();

            expect(() => readProp(db, "clientVersion")).toThrow(
                "transient failure"
            );
            // 2 回目は正常系の mockExtends 実装に戻るため成功する
            expect(readProp(db, "clientVersion")).toBe("test");
            expect(mockConstructPrismaClient).toHaveBeenCalledTimes(2);
        });
    });
});
