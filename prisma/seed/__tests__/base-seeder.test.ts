import { seedBase } from "../seeders/base-seeder";
import { SEED_COUNTRIES } from "../constants/countries";
import { SEED_USERS } from "../constants/users";
import { SEED_CATEGORIES } from "../constants/categories";
import { SEED_OFFER_TAGS } from "../constants/offer-tags";

// Prisma mock
const mockUpsert = jest.fn();
// childCount の再計算は upsert ではなく update で行うので別のスパイにする
const mockUpdate = jest.fn();

/** ルート（parentUrl 無し）と子（parentUrl 有り）の内訳 */
const ROOTS = SEED_CATEGORIES.filter((c) => !c.parentUrl);
const CHILDREN = SEED_CATEGORIES.filter((c) => c.parentUrl);

function createMockPrisma() {
    const upsertFn = () => mockUpsert;
    return {
        country: { upsert: upsertFn() },
        user: { upsert: upsertFn() },
        category: { upsert: upsertFn(), update: mockUpdate },
        subCategory: { upsert: upsertFn() },
        offerTag: { upsert: upsertFn() },
    } as unknown as import("@prisma/client").PrismaClient;
}

describe("seedBase", () => {
    let idCounter: number;

    beforeEach(() => {
        jest.clearAllMocks();
        idCounter = 0;
        // 実 Prisma の upsert は「書き込んだ行」を返す。legacy SubCategory ミラーは
        // create 側で id を明示しており、その id がそのまま返る —— seeder は
        // 返り値の id が Category ノードと一致することを検証するため、
        // モックも id を素通しにしないと実挙動から乖離する。
        mockUpsert.mockImplementation((args?: { create?: { id?: string } }) => ({
            id: args?.create?.id ?? `mock-id-${++idCounter}`,
        }));
        mockUpdate.mockImplementation(() => ({ id: "mock-id-update" }));
    });

    it("正常ケース: 全エンティティのupsertが呼ばれること", async () => {
        const prisma = createMockPrisma();
        await seedBase(prisma);

        const expectedCalls =
            SEED_COUNTRIES.length +
            SEED_USERS.length +
            SEED_CATEGORIES.length +
            // 子ノードは legacy SubCategory 行としても書くので 2 回 upsert される
            CHILDREN.length +
            SEED_OFFER_TAGS.length;

        expect(mockUpsert).toHaveBeenCalledTimes(expectedCalls);
    });

    it("正常ケース: childCountが全ノードぶん再計算されること", async () => {
        const prisma = createMockPrisma();
        await seedBase(prisma);

        // 非正規化列なので、宣言データから毎回引き直して合わせる
        expect(mockUpdate).toHaveBeenCalledTimes(SEED_CATEGORIES.length);
        const rootCall = mockUpdate.mock.calls.find(
            (c) => c[0].where.url === ROOTS[0].url
        );
        const expected = CHILDREN.filter(
            (c) => c.parentUrl === ROOTS[0].url
        ).length;
        expect(rootCall?.[0].data.childCount).toBe(expected);
    });

    it("正常ケース: 子ノードのlegacy SubCategory行がCategoryノードとidを共有すること", async () => {
        const prisma = createMockPrisma();
        await seedBase(prisma);

        // id を共有させることで、シード済み DB がマイグレーション A-3 の結果と一致する
        const firstChild = CHILDREN[0];
        const calls = mockUpsert.mock.calls.filter(
            (c) => c[0].where.url === firstChild.url
        );
        expect(calls).toHaveLength(2);
        const [categoryCall, subCategoryCall] = calls;
        // 期待値は mock の id 採番規則を再現するのではなく、Category upsert が
        // 実際に返した値から取る（採番実装を変えてもテストが嘘にならない）。
        const categoryIndex = mockUpsert.mock.calls.indexOf(categoryCall);
        const categoryResult: unknown =
            mockUpsert.mock.results[categoryIndex]?.value;
        if (
            typeof categoryResult !== "object" ||
            categoryResult === null ||
            !("id" in categoryResult)
        ) {
            throw new Error("Category upsert が id を返していません");
        }
        expect(subCategoryCall[0].create.id).toBe(categoryResult.id);
    });

    it("正常ケース: 戻り値のMapが正しいサイズであること", async () => {
        const prisma = createMockPrisma();
        const result = await seedBase(prisma);

        expect(result.countries.size).toBe(SEED_COUNTRIES.length);
        expect(result.users.size).toBe(SEED_USERS.length);
        expect(result.categories.size).toBe(SEED_CATEGORIES.length);
        expect(result.offerTags.size).toBe(SEED_OFFER_TAGS.length);
    });

    it("正常ケース: countriesマップがcodeをキーとしていること", async () => {
        const prisma = createMockPrisma();
        const result = await seedBase(prisma);

        for (const country of SEED_COUNTRIES) {
            expect(result.countries.has(country.code)).toBe(true);
        }
    });

    it("正常ケース: usersマップがemailをキーとしていること", async () => {
        const prisma = createMockPrisma();
        const result = await seedBase(prisma);

        for (const user of SEED_USERS) {
            expect(result.users.has(user.email)).toBe(true);
        }
    });

    it("正常ケース: categoriesマップがurlをキーとしていること", async () => {
        const prisma = createMockPrisma();
        const result = await seedBase(prisma);

        for (const cat of SEED_CATEGORIES) {
            expect(result.categories.has(cat.url)).toBe(true);
        }
    });

    it("正常ケース: Country upsertがwhere: { code }で呼ばれること", async () => {
        const prisma = createMockPrisma();
        await seedBase(prisma);

        // 最初の呼び出しはCountryのupsert
        const firstCall = mockUpsert.mock.calls[0][0];
        expect(firstCall.where).toHaveProperty("code", SEED_COUNTRIES[0].code);
    });

    it("正常ケース: User upsertがwhere: { email }で呼ばれること", async () => {
        const prisma = createMockPrisma();
        await seedBase(prisma);

        // CountryのあとにUserが呼ばれる
        const userCallIndex = SEED_COUNTRIES.length;
        const userCall = mockUpsert.mock.calls[userCallIndex][0];
        expect(userCall.where).toHaveProperty("email", SEED_USERS[0].email);
    });

    it("異常ケース: legacy SubCategory の id が Category ノードと食い違う場合は停止すること", async () => {
        // Arrange: 別 id の SubCategory 行が既にある状況（upsert が update 分岐に入り、
        // create.id は無視されて既存 id が返る）を模す。
        mockUpsert.mockImplementation(
            (args?: { create?: { id?: string; url?: string } }) => ({
                id:
                    args?.create?.id === undefined
                        ? `mock-id-${++idCounter}`
                        : "pre-existing-sub-category-id",
            })
        );
        const prisma = createMockPrisma();

        // Act & Assert
        await expect(seedBase(prisma)).rejects.toThrow(
            /legacy SubCategory ミラーの id が Category ノードと一致しません/
        );
    });

    it("異常ケース: DB接続失敗時にエラーがthrowされること", async () => {
        mockUpsert.mockRejectedValue(new Error("DB connection failed"));
        const prisma = createMockPrisma();

        await expect(seedBase(prisma)).rejects.toThrow("DB connection failed");
    });
});
