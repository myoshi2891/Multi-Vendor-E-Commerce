import { currentUser } from "@clerk/nextjs/server";
import {
    upsertCategory,
    getAllCategories,
    getAllSubCategoriesFotCategory,
    getCategory,
    deleteCategory,
} from "./category";
import { TEST_CONFIG } from "../config/test-config";
import {
    createMockCategory,
    createMockSubCategory,
    createMockStore,
} from "../config/test-fixtures";

// ---- モック設定 ----
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
    db: {
        category: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            upsert: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
            delete: jest.fn(),
        },
        subCategory: {
            findMany: jest.fn(),
        },
        categorySlugAlias: {
            createMany: jest.fn(),
        },
        store: {
            findUnique: jest.fn(),
        },
        $transaction: jest.fn(),
        $queryRaw: jest.fn(),
    },
}));

const mockDb = require("@/lib/db").db;

/**
 * `upsertCategory` のツリー書き込み経路をモックする。
 *
 * 実装は 1 本の `$transaction` の中で「親行の `SELECT … FOR UPDATE` →
 * 対象ノードの現在値読み出し → upsert → 子孫の path 追随 → childCount 再計算」を行う。
 * コールバックには同じ `mockDb` を渡し、tx 内外で呼び出し記録を 1 箇所に集める。
 */
const mockCategoryTx = () => {
    mockDb.$transaction.mockImplementation(
        async (callback: (tx: typeof mockDb) => Promise<unknown>) =>
            callback(mockDb)
    );
    // 既定はルート作成（親なし・対象ノードは未作成・子孫なし）
    mockDb.$queryRaw.mockResolvedValue([]);
    mockDb.category.findUnique.mockResolvedValue(null);
    mockDb.category.findMany.mockResolvedValue([]);
    mockDb.category.count.mockResolvedValue(0);
    mockDb.categorySlugAlias.createMany.mockResolvedValue({ count: 0 });
};

/** `SELECT … FOR UPDATE` が返す親行を与える。 */
const mockLockedParent = (parent: {
    id: string;
    path: string;
    depth: number;
}) => mockDb.$queryRaw.mockResolvedValue([parent]);

beforeEach(() => {
    jest.clearAllMocks();
});

// ==================================================
// upsertCategory
// ==================================================
describe("upsertCategory", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                upsertCategory(createMockCategory() as never)
            ).rejects.toThrow("Unauthenticated.");
        });

        it("ADMINロール以外の場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });

            await expect(
                upsertCategory(createMockCategory() as never)
            ).rejects.toThrow("Only admins can perform this action.");
        });
    });

    describe("バリデーション", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
        });

        it("カテゴリデータがnullの場合エラーをスローする", async () => {
            await expect(upsertCategory(null as never)).rejects.toThrow(
                "Please provide category data."
            );
        });

        it("同名のカテゴリが存在する場合エラーをスローする", async () => {
            mockDb.category.findFirst.mockResolvedValue({
                id: "other-cat",
                name: "Electronics",
                url: "other-url",
            });

            await expect(
                upsertCategory(
                    createMockCategory({ name: "Electronics" }) as never
                )
            ).rejects.toThrow("A category with the same name already exists");
        });

        it("同URLのカテゴリが存在する場合エラーをスローする", async () => {
            mockDb.category.findFirst.mockResolvedValue({
                id: "other-cat",
                name: "Other Name",
                url: "electronics",
            });

            await expect(
                upsertCategory(
                    createMockCategory({ url: "electronics" }) as never
                )
            ).rejects.toThrow("A category with the same URL already exists");
        });

        it("重複チェックで自身のIDを除外する（更新時の自己参照防止）", async () => {
            mockDb.category.findFirst.mockResolvedValue(null);
            mockDb.category.upsert.mockResolvedValue(createMockCategory());

            const category = createMockCategory({ id: "cat-update" });
            await upsertCategory(category as never);

            expect(mockDb.category.findFirst).toHaveBeenCalledWith({
                where: {
                    AND: [
                        {
                            OR: [
                                { name: category.name },
                                { url: category.url },
                            ],
                        },
                        {
                            NOT: { id: "cat-update" },
                        },
                    ],
                },
            });
        });
    });

    describe("正常系", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            mockDb.category.findFirst.mockResolvedValue(null);
            mockCategoryTx();
        });

        it("新規ルートカテゴリを作成する（親なし ⇒ path = url / depth = 0）", async () => {
            const category = createMockCategory();
            mockDb.category.upsert.mockResolvedValue(category);

            const result = await upsertCategory(category as never);

            expect(result).toEqual(category);
            expect(mockDb.category.upsert).toHaveBeenCalledWith({
                where: { id: category.id },
                // 移行 SQL の A-1 と同じ規則（ルート ⇒ path = url / depth = 0）。
                // update 側にも書くのは、url の変更に path を追随させるため。
                update: { ...category, path: category.url, depth: 0 },
                create: { ...category, path: category.url, depth: 0 },
            });
        });

        it("path / depth / childCount は入力から受け取らずサーバー側で決める", async () => {
            // Arrange: 型上は存在しないが、実行時には渡り得る列を混ぜる
            //（DB から読み戻した Category をそのまま渡す経路など）。
            // parentId / sortOrder は **admin が編集できる**列なので落とさない。
            const category = {
                ...createMockCategory(),
                path: "attacker/path",
                depth: 4,
                childCount: 7,
            };
            mockDb.category.upsert.mockResolvedValue(createMockCategory());

            // Act
            await upsertCategory(category as never);

            // Assert
            const callArg = mockDb.category.upsert.mock.calls[0][0];
            expect(callArg.create).not.toHaveProperty("childCount");
            expect(callArg.update).not.toHaveProperty("childCount");
            // path / depth は入力値ではなくツリー規則の値で上書きされる
            expect(callArg.create.path).toBe(category.url);
            expect(callArg.create.depth).toBe(0);
            expect(callArg.update.path).toBe(category.url);
            expect(callArg.update.depth).toBe(0);
        });

        it("親を指定すると path を親から導出し depth を 1 段深くする", async () => {
            // Arrange
            mockLockedParent({
                id: "electronics",
                path: "electronics",
                depth: 0,
            });
            const category = createMockCategory({
                id: "camera",
                name: "Camera",
                url: "camera",
                parentId: "electronics",
            } as never);
            mockDb.category.upsert.mockResolvedValue(category);

            // Act
            await upsertCategory(category as never);

            // Assert
            const callArg = mockDb.category.upsert.mock.calls[0][0];
            expect(callArg.create.path).toBe("electronics/camera");
            expect(callArg.create.depth).toBe(1);
            expect(callArg.create.parentId).toBe("electronics");
        });

        it("親行は SELECT … FOR UPDATE でロックしてから読む", async () => {
            // Arrange —— リーフ強制（upsertProduct 側）と同じ行を掴むことが
            // 直列化の条件なので、ロック句の有無を機械的に検証する。
            mockLockedParent({
                id: "electronics",
                path: "electronics",
                depth: 0,
            });
            mockDb.category.upsert.mockResolvedValue(createMockCategory());

            // Act
            await upsertCategory(
                createMockCategory({
                    id: "camera",
                    url: "camera",
                    parentId: "electronics",
                } as never) as never
            );

            // Assert
            const sqlParts = mockDb.$queryRaw.mock.calls[0][0] as string[];
            expect(sqlParts.join("?")).toMatch(/FOR UPDATE/);
        });

        it("既存カテゴリを更新する", async () => {
            const category = createMockCategory({ name: "Updated Name" });
            mockDb.category.upsert.mockResolvedValue(category);

            const result = await upsertCategory(category as never);

            expect(result.name).toBe("Updated Name");
        });
    });

    // ==================================================
    // ツリー編集の不変条件（design.md V-7 系）
    // ==================================================
    describe("ツリー編集の不変条件", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            mockDb.category.findFirst.mockResolvedValue(null);
            mockCategoryTx();
            mockDb.category.upsert.mockResolvedValue(createMockCategory());
        });

        it("V-7: depth 上限（4）を超える作成を拒否する", async () => {
            // Arrange —— depth 4 の親の下は depth 5 になる
            mockLockedParent({ id: "deep", path: "a/b/c/d", depth: 4 });

            // Act / Assert
            await expect(
                upsertCategory(
                    createMockCategory({
                        id: "too-deep",
                        url: "too-deep",
                        parentId: "deep",
                    } as never) as never
                )
            ).rejects.toThrow(/depth/i);
            expect(mockDb.category.upsert).not.toHaveBeenCalled();
        });

        it("V-7: depth 上限ちょうど（4）は許可する", async () => {
            // Arrange —— 境界の内側。上限を off-by-one で閉めていないことの確認
            mockLockedParent({ id: "d3", path: "a/b/c", depth: 3 });

            // Act
            await upsertCategory(
                createMockCategory({
                    id: "leaf",
                    url: "leaf",
                    parentId: "d3",
                } as never) as never
            );

            // Assert
            const callArg = mockDb.category.upsert.mock.calls[0][0];
            expect(callArg.create.depth).toBe(4);
        });

        it("V-7b: 自分自身を親に指定した更新を拒否する（副作用なし）", async () => {
            // Act / Assert
            await expect(
                upsertCategory(
                    createMockCategory({
                        id: "self",
                        url: "self",
                        parentId: "self",
                    } as never) as never
                )
            ).rejects.toThrow(/own parent/i);
            expect(mockDb.category.upsert).not.toHaveBeenCalled();
            expect(mockDb.category.update).not.toHaveBeenCalled();
        });

        it("V-7c: 自分の子孫を親に指定した更新を拒否する（副作用なし）", async () => {
            // Arrange —— electronics を electronics/camera の下へ移そうとする
            mockDb.category.findUnique.mockResolvedValue({
                id: "electronics",
                parentId: null,
                path: "electronics",
                depth: 0,
            });
            mockLockedParent({
                id: "camera",
                path: "electronics/camera",
                depth: 1,
            });

            // Act / Assert
            await expect(
                upsertCategory(
                    createMockCategory({
                        id: "electronics",
                        url: "electronics",
                        parentId: "camera",
                    } as never) as never
                )
            ).rejects.toThrow(/descendant/i);
            expect(mockDb.category.upsert).not.toHaveBeenCalled();
            expect(mockDb.category.update).not.toHaveBeenCalled();
        });

        it("V-7c: 兄弟（path が前置一致するだけ）への付け替えは拒否しない", async () => {
            // Arrange —— `electronics/camera` に対する `electronics/camera-bags` は
            // 素の startsWith だと子孫に誤判定される兄弟である。
            mockDb.category.findUnique.mockResolvedValue({
                id: "camera",
                parentId: "electronics",
                path: "electronics/camera",
                depth: 1,
            });
            mockLockedParent({
                id: "camera-bags",
                path: "electronics/camera-bags",
                depth: 1,
            });

            // Act
            await upsertCategory(
                createMockCategory({
                    id: "camera",
                    url: "camera",
                    parentId: "camera-bags",
                } as never) as never
            );

            // Assert
            const callArg = mockDb.category.upsert.mock.calls[0][0];
            expect(callArg.update.path).toBe("electronics/camera-bags/camera");
            expect(callArg.update.depth).toBe(2);
        });

        it("V-7d: 再親子化で全子孫の path / depth を書き換える", async () => {
            // Arrange —— camera（子: lens / 孫: prime）を accessories の下へ移す
            mockDb.category.findUnique.mockResolvedValue({
                id: "camera",
                parentId: "electronics",
                path: "electronics/camera",
                depth: 1,
            });
            mockLockedParent({
                id: "accessories",
                path: "electronics/accessories",
                depth: 1,
            });
            mockDb.category.findMany.mockResolvedValue([
                { id: "lens", path: "electronics/camera/lens" },
                { id: "prime", path: "electronics/camera/lens/prime" },
            ]);

            // Act
            await upsertCategory(
                createMockCategory({
                    id: "camera",
                    url: "camera",
                    parentId: "accessories",
                } as never) as never
            );

            // Assert —— 子孫は新しい親を前置に持ち、depth も 1 段ずつ増える
            const updates = mockDb.category.update.mock.calls.map(
                (
                    call: [
                        {
                            where: { id: string };
                            data: Record<string, unknown>;
                        },
                    ]
                ) => call[0]
            );
            const lens = updates.find(
                (u: { where: { id: string } }) => u.where.id === "lens"
            );
            const prime = updates.find(
                (u: { where: { id: string } }) => u.where.id === "prime"
            );
            expect(lens?.data).toMatchObject({
                path: "electronics/accessories/camera/lens",
                depth: 3,
            });
            expect(prime?.data).toMatchObject({
                path: "electronics/accessories/camera/lens/prime",
                depth: 4,
            });
        });

        it("V-7d: 移動で子孫が depth 上限を超える場合は 1 行も書き換えない", async () => {
            // Arrange —— 孫（相対 depth 2）を depth 3 の親の下へ移すと 5 段になる
            mockDb.category.findUnique.mockResolvedValue({
                id: "camera",
                parentId: "electronics",
                path: "electronics/camera",
                depth: 1,
            });
            mockLockedParent({ id: "d3", path: "a/b/c", depth: 3 });
            mockDb.category.findMany.mockResolvedValue([
                { id: "lens", path: "electronics/camera/lens" },
                { id: "prime", path: "electronics/camera/lens/prime" },
            ]);

            // Act / Assert
            await expect(
                upsertCategory(
                    createMockCategory({
                        id: "camera",
                        url: "camera",
                        parentId: "d3",
                    } as never) as never
                )
            ).rejects.toThrow(/depth/i);
            expect(mockDb.category.update).not.toHaveBeenCalled();
        });

        it("url の変更時に旧 slug を CategorySlugAlias へ残す", async () => {
            // Arrange —— 移行で温存された旧 url（大文字・`_` 等）は正準形へ寄せて
            // 保存されるため、**通常の運用で rename が起きる**。外部被リンクの
            // 到達性は別名表だけが担保する。
            mockDb.category.findUnique.mockResolvedValue({
                id: "home",
                parentId: null,
                path: "Home_Garden",
                depth: 0,
                url: "Home_Garden",
            });

            // Act
            await upsertCategory(
                createMockCategory({
                    id: "home",
                    name: "Home Garden",
                    url: "home-garden",
                } as never) as never
            );

            // Assert
            expect(mockDb.categorySlugAlias.createMany).toHaveBeenCalledWith({
                data: [
                    {
                        entityType: "CATEGORY",
                        oldSlug: "Home_Garden",
                        categoryId: "home",
                    },
                ],
                // 旧 slug が既に**別ノードの**別名になっている場合は先着を残す。
                // 奪うと、生きている外部リンクの行き先が黙って変わる。
                skipDuplicates: true,
            });
        });

        it("url が変わらない更新では別名を作らない", async () => {
            // Arrange
            mockDb.category.findUnique.mockResolvedValue({
                id: "electronics",
                parentId: null,
                path: "electronics",
                depth: 0,
                url: "electronics",
            });

            // Act
            await upsertCategory(
                createMockCategory({
                    id: "electronics",
                    url: "electronics",
                } as never) as never
            );

            // Assert
            expect(mockDb.categorySlugAlias.createMany).not.toHaveBeenCalled();
        });

        it("新規作成では別名を作らない", async () => {
            // Arrange —— 旧 slug が存在しない
            mockDb.category.findUnique.mockResolvedValue(null);

            // Act
            await upsertCategory(createMockCategory() as never);

            // Assert
            expect(mockDb.categorySlugAlias.createMany).not.toHaveBeenCalled();
        });

        it("V-7d: 旧親と新親の childCount を両方再計算する", async () => {
            // Arrange
            mockDb.category.findUnique.mockResolvedValue({
                id: "camera",
                parentId: "electronics",
                path: "electronics/camera",
                depth: 1,
            });
            mockLockedParent({ id: "audio", path: "audio", depth: 0 });
            mockDb.category.count.mockResolvedValue(2);

            // Act
            await upsertCategory(
                createMockCategory({
                    id: "camera",
                    url: "camera",
                    parentId: "audio",
                } as never) as never
            );

            // Assert —— 片側だけ増減させると「子がいないのに childCount > 0」になり、
            // リーフ強制（V-5）が正当なリーフを拒否しはじめる。
            const counted = mockDb.category.update.mock.calls
                .map(
                    (
                        call: [
                            {
                                where: { id: string };
                                data: Record<string, unknown>;
                            },
                        ]
                    ) => call[0]
                )
                .filter(
                    (u: { data: Record<string, unknown> }) =>
                        "childCount" in u.data
                )
                .map((u: { where: { id: string } }) => u.where.id);
            expect(counted).toEqual(
                expect.arrayContaining(["electronics", "audio"])
            );
        });
    });
});

// ==================================================
// getAllCategories
// ==================================================
describe("getAllCategories", () => {
    /** ツリー組み立ての入力（Prisma が返すフラット行の最小形） */
    const flatNode = (
        id: string,
        parentId: string | null,
        path: string,
        url = id
    ) => ({ ...createMockCategory(), id, parentId, path, url });

    it("フラットな結果を children 付きの木へ組み立てて返す", async () => {
        // Arrange —— depth 昇順のフラット行
        mockDb.category.findMany.mockResolvedValue([
            flatNode("electronics", null, "electronics"),
            flatNode("camera", "electronics", "electronics/camera"),
            flatNode("lens", "camera", "electronics/camera/lens"),
        ]);

        // Act
        const result = await getAllCategories();

        // Assert —— 3 階層目まで木として届く（2 段固定だと lens が落ちる）
        expect(result).toHaveLength(1);
        expect(result[0].children[0].id).toBe("camera");
        expect(result[0].children[0].children[0].id).toBe("lens");
    });

    it("depth → sortOrder → name の決定論的な順序で引く", async () => {
        // Arrange —— updatedAt desc は編集のたびに並びが変わるため置き換えた
        mockDb.category.findMany.mockResolvedValue([]);

        // Act
        await getAllCategories();

        // Assert
        expect(mockDb.category.findMany).toHaveBeenCalledWith({
            orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        });
    });

    it("storeUrl 指定時はリーフの祖先まで含めて引く（枝を欠けさせない）", async () => {
        // Arrange —— 商品はリーフにのみ紐づくので、直接のリレーション条件では
        // リーフしか返らない。祖先が欠けると木が繋がらず店舗メニューが壊れる。
        mockDb.store.findUnique.mockResolvedValue(createMockStore());
        mockDb.category.findMany
            .mockResolvedValueOnce([{ path: "electronics/camera/lens" }])
            .mockResolvedValueOnce([]);

        // Act
        await getAllCategories(TEST_CONFIG.TEST_STORE_URL);

        // Assert —— 1 回目はリーフの path 取得（新 FK 経由）
        expect(mockDb.category.findMany).toHaveBeenNthCalledWith(1, {
            where: {
                nodeProducts: {
                    some: { storeId: TEST_CONFIG.DEFAULT_STORE_ID },
                },
            },
            select: { path: true },
        });

        // Assert —— 2 回目は祖先を prefix 展開した集合
        expect(mockDb.category.findMany).toHaveBeenNthCalledWith(2, {
            where: {
                path: {
                    in: [
                        "electronics",
                        "electronics/camera",
                        "electronics/camera/lens",
                    ],
                },
            },
            orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        });
    });

    it("storeUrl 指定でリーフが 0 件なら 2 回目のクエリを撃たない", async () => {
        // Arrange
        mockDb.store.findUnique.mockResolvedValue(createMockStore());
        mockDb.category.findMany.mockResolvedValueOnce([]);

        // Act
        const result = await getAllCategories(TEST_CONFIG.TEST_STORE_URL);

        // Assert
        expect(result).toEqual([]);
        expect(mockDb.category.findMany).toHaveBeenCalledTimes(1);
    });

    it("存在しないストアURLの場合、空配列を返す", async () => {
        mockDb.store.findUnique.mockResolvedValue(null);

        const result = await getAllCategories("nonexistent-store");

        expect(result).toEqual([]);
        expect(mockDb.category.findMany).not.toHaveBeenCalled();
    });

    it("storeUrlなしの場合はストア検索を行わない", async () => {
        mockDb.category.findMany.mockResolvedValue([]);

        await getAllCategories();

        expect(mockDb.store.findUnique).not.toHaveBeenCalled();
    });
});

// ==================================================
// getAllSubCategoriesFotCategory
// ==================================================
describe("getAllSubCategoriesFotCategory", () => {
    it("カテゴリIDで絞り込みupdatedAt降順で取得する", async () => {
        const subCategories = [
            createMockSubCategory(),
            createMockSubCategory({ id: "sub-2", name: "Tablets" }),
        ];
        mockDb.subCategory.findMany.mockResolvedValue(subCategories);

        const result = await getAllSubCategoriesFotCategory("category-001");

        expect(result).toHaveLength(2);
        expect(mockDb.subCategory.findMany).toHaveBeenCalledWith({
            where: { categoryId: "category-001" },
            orderBy: { updatedAt: "desc" },
        });
    });

    it("サブカテゴリがない場合、空配列を返す", async () => {
        mockDb.subCategory.findMany.mockResolvedValue([]);

        const result = await getAllSubCategoriesFotCategory("empty-cat");

        expect(result).toEqual([]);
    });
});

// ==================================================
// getCategory
// ==================================================
describe("getCategory", () => {
    it("空のcategoryIdの場合エラーをスローする", async () => {
        await expect(getCategory("")).rejects.toThrow(
            "Please provide a category ID."
        );
    });

    it("存在するカテゴリを正常に取得する", async () => {
        const category = createMockCategory();
        mockDb.category.findUnique.mockResolvedValue(category);

        const result = await getCategory("category-001");

        expect(result).toEqual(category);
        expect(mockDb.category.findUnique).toHaveBeenCalledWith({
            where: { id: "category-001" },
        });
    });

    it("存在しないカテゴリの場合nullを返す", async () => {
        mockDb.category.findUnique.mockResolvedValue(null);

        const result = await getCategory("nonexistent");

        expect(result).toBeNull();
    });
});

// ==================================================
// deleteCategory
// ==================================================
describe("deleteCategory", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(deleteCategory("category-001")).rejects.toThrow(
                "Unauthenticated."
            );
        });

        it("ADMINロール以外の場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });

            await expect(deleteCategory("category-001")).rejects.toThrow(
                "Only admins can perform this action."
            );
        });
    });

    describe("バリデーション", () => {
        it("空のcategoryIdの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });

            await expect(deleteCategory("")).rejects.toThrow(
                "Please provide a category ID."
            );
        });
    });

    describe("正常系", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            mockCategoryTx();
        });

        it("カテゴリを正常に削除する", async () => {
            const category = createMockCategory();
            mockDb.category.delete.mockResolvedValue(category);

            const result = await deleteCategory("category-001");

            expect(result).toEqual(category);
            expect(mockDb.category.delete).toHaveBeenCalledWith({
                where: { id: "category-001" },
            });
        });

        it("削除した子の分だけ親の childCount を再計算する", async () => {
            // Arrange —— 親が childCount を持ったままだと、その親はリーフ強制
            // （V-5）に永久に引っかかり、**二度と商品を紐づけられなくなる**。
            // admin の UI からは直せない（childCount は導出列でフォームに無い）。
            mockDb.category.delete.mockResolvedValue(
                createMockCategory({ parentId: "electronics" } as never)
            );
            mockDb.category.count.mockResolvedValue(0);

            // Act
            await deleteCategory("camera");

            // Assert
            expect(mockDb.category.update).toHaveBeenCalledWith({
                where: { id: "electronics" },
                data: { childCount: 0 },
            });
        });

        it("ルートの削除では childCount を触らない", async () => {
            // Arrange
            mockDb.category.delete.mockResolvedValue(
                createMockCategory({ parentId: null } as never)
            );

            // Act
            await deleteCategory("electronics");

            // Assert
            expect(mockDb.category.update).not.toHaveBeenCalled();
        });
    });
});
