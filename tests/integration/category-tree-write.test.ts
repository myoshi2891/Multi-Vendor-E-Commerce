/**
 * Category Tree Write Integration Tests (upsertCategory / upsertProduct)
 *
 * plan 068 Step 1–4 で入れたツリー書き込みの不変条件を、実 DB
 * (testcontainers PostgreSQL) で検証する。unit テスト
 * (`src/queries/category.test.ts` / `src/queries/product.test.ts`) は Prisma を
 * モックしているため、**行ロックによる直列化と、materialized path の
 * 書き換えが検索結果に及ぼす影響**は原理的に検証できない。ここで実測する:
 *
 *   - V-7d 再親子化で全子孫の `path` / `depth` が追随する
 *   - V-7d 移動で子孫が深さ上限を超える場合、`path` が 1 行も書き換わらない
 *   - V-7d `path` の追随が**検索結果**に現れる（新しい祖先でヒットし、旧祖先で消える）
 *   - V-5d 「商品をリーフ L に紐づける」と「L の子を作る」の並行実行で、
 *          非リーフ紐づけが成立しない（両者が同じ行を `FOR UPDATE` で掴む）
 *
 * `path` の取り残しは **DB の値を見るだけでは軽微な不整合に見える**が、
 * `subtreeOf`（前置一致）で回る検索・ファセット・admin ツリーはすべて `path` を
 * 正とするため、実際には「商品が消えた」という形で表面化する。だから DB の値と
 * 検索の両方で検算する。
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - ADR-006: docs/architecture/decisions/006-category-tree-representation.md
 * - docs/design/category-tree/design.md §2-Q1（path 規則）/ §2-Q5（リーフ強制）
 * - plans/068-implement-category-tree-admin-cutover.md
 */

// ----------------------------------------------------------------------------
// Mocks (must be declared before importing the modules they affect)
// ----------------------------------------------------------------------------

// 本ファイルは **ADMIN と SELLER の両方**を同一テスト内で並行に走らせる
// （V-5d は admin のカテゴリ作成と seller の商品保存の競合である）。単一の
// `mockResolvedValue` では 2 つのロールを同時に表現できないので、AsyncLocalStorage
// で「今どちらの呼び出し文脈にいるか」を伝える。`await` を跨いでも文脈が保たれるため、
// 並行実行でも取り違えない。
import { AsyncLocalStorage } from "node:async_hooks";

const authContext = new AsyncLocalStorage<{
    id: string;
    role: "ADMIN" | "SELLER";
}>();

jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(async () => {
        const store = authContext.getStore();
        if (!store) return null;
        return { id: store.id, privateMetadata: { role: store.role } };
    }),
}));

// ----------------------------------------------------------------------------

import { cpus } from "os";

import type { Category } from "@prisma/client";
import type { ProductWithVariantType } from "@/lib/types";
import { upsertCategory } from "@/queries/category";
import { getProducts, upsertProduct } from "@/queries/product";
import { disconnectTestDb, getTestDb } from "./setup/db";
import { resetDb } from "./setup/reset-db";
import {
    seedCategoryWithSubcategory,
    seedProductWithVariantAndSize,
    seedStore,
    seedUser,
} from "./setup/seed";

const db = getTestDb();

const ADMIN_ID = "admin-category-tree";

/** ADMIN 文脈で実行する（`upsertCategory` 用）。 */
const asAdmin = <T>(fn: () => Promise<T>): Promise<T> =>
    authContext.run({ id: ADMIN_ID, role: "ADMIN" }, fn);

/** SELLER 文脈で実行する（`upsertProduct` 用）。 */
const asSeller = <T>(userId: string, fn: () => Promise<T>): Promise<T> =>
    authContext.run({ id: userId, role: "SELLER" }, fn);

/** `upsertCategory` へ渡す 1 ノード分の入力を組み立てる。 */
const nodeInput = (
    node: Pick<Category, "id" | "name" | "url">,
    overrides: { parentId?: string | null; sortOrder?: number } = {}
) => ({
    id: node.id,
    name: node.name,
    image: "https://example.test/node.png",
    url: node.url,
    featured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    parentId: overrides.parentId ?? null,
    sortOrder: overrides.sortOrder ?? 0,
});

/** 素の行作成（検証対象ではない前提データを作るための最短経路）。 */
const createNode = async (
    name: string,
    url: string,
    parent: { id: string; path: string; depth: number } | null
): Promise<Category> => {
    const node = await db.category.create({
        data: {
            name,
            image: "https://example.test/node.png",
            url,
            parentId: parent?.id ?? null,
            path: parent ? `${parent.path}/${url}` : url,
            depth: parent ? parent.depth + 1 : 0,
        },
    });
    if (parent) {
        await db.category.update({
            where: { id: parent.id },
            data: { childCount: { increment: 1 } },
        });
    }
    return node;
};

beforeEach(async () => {
    await resetDb(db);
    jest.clearAllMocks();
});

afterAll(async () => {
    await disconnectTestDb();
});

// ============================================================================
// Scenario 1: V-7d —— 再親子化で子孫の path / depth が追随する
// ============================================================================

describe("Scenario 1: reparenting rebases every descendant", () => {
    it("moves the whole subtree and keeps depth consistent", async () => {
        // Arrange —— electronics/camera/lens/prime と、移動先の accessories
        const electronics = await createNode(
            "Electronics",
            "electronics",
            null
        );
        const camera = await createNode("Camera", "camera", electronics);
        const lens = await createNode("Lens", "lens", camera);
        const prime = await createNode("Prime", "prime", lens);
        const accessories = await createNode(
            "Accessories",
            "accessories",
            electronics
        );

        // Act —— camera を accessories の下へ移す
        await asAdmin(() =>
            upsertCategory(nodeInput(camera, { parentId: accessories.id }))
        );

        // Assert —— 子孫の path はすべて新しい祖先を前置に持つ
        const after = await db.category.findMany({
            where: { id: { in: [camera.id, lens.id, prime.id] } },
            select: { id: true, path: true, depth: true },
            orderBy: { depth: "asc" },
        });
        expect(after).toEqual([
            {
                id: camera.id,
                path: "electronics/accessories/camera",
                depth: 2,
            },
            {
                id: lens.id,
                path: "electronics/accessories/camera/lens",
                depth: 3,
            },
            {
                id: prime.id,
                path: "electronics/accessories/camera/lens/prime",
                depth: 4,
            },
        ]);

        // Assert —— childCount は旧親・新親の両方が実数に一致する
        const [electronicsAfter, accessoriesAfter] = await Promise.all([
            db.category.findUniqueOrThrow({ where: { id: electronics.id } }),
            db.category.findUniqueOrThrow({ where: { id: accessories.id } }),
        ]);
        expect(electronicsAfter.childCount).toBe(1); // accessories のみ
        expect(accessoriesAfter.childCount).toBe(1); // camera
    });

    it("rewrites nothing when the move would push a descendant past the depth cap", async () => {
        // Arrange —— 深さ 3 の受け皿と、子・孫を持つノード
        const a = await createNode("A", "a", null);
        const b = await createNode("B", "b", a);
        const c = await createNode("C", "c", b);
        const d3 = await createNode("D3", "d3", c); // depth 3

        const root = await createNode("Root", "root", null);
        const mid = await createNode("Mid", "mid", root); // depth 1
        const leaf = await createNode("Leaf", "leaf", mid); // depth 2

        const before = await db.category.findMany({
            select: { id: true, path: true, depth: true },
            orderBy: { id: "asc" },
        });

        // Act / Assert —— mid を d3 の下へ移すと leaf が depth 5 になる
        await expect(
            asAdmin(() => upsertCategory(nodeInput(mid, { parentId: d3.id })))
        ).rejects.toThrow(/depth/i);

        // Assert —— 部分適用が残っていない（対象ノード自身も含めて 1 行も動かない）
        const after = await db.category.findMany({
            select: { id: true, path: true, depth: true },
            orderBy: { id: "asc" },
        });
        expect(after).toEqual(before);
        expect(after.map((n) => n.id)).toContain(leaf.id);
    });
});

// ============================================================================
// Scenario 2: V-7d —— path の追随は検索結果に現れる
// ============================================================================

describe("Scenario 2: reparenting follows through to product search", () => {
    it("moves the product's subtree membership to the new ancestor", async () => {
        // Arrange —— 商品はリーフ（depth 1・legacy SubCategory 行あり）に紐づく
        const owner = await seedUser(db);
        const store = await seedStore(db, { userId: owner.id });
        const { category: oldRoot, subCategory } =
            await seedCategoryWithSubcategory(db);
        const newRoot = await createNode("New Root", "new-root", null);
        await seedProductWithVariantAndSize(db, {
            storeId: store.id,
            categoryId: oldRoot.id,
            subCategoryId: subCategory.id,
        });

        // 移動前は旧ルートのサブツリーでヒットする
        const beforeMove = await getProducts({ category: oldRoot.url });
        expect(beforeMove.totalCount).toBe(1);

        // Act —— リーフノードを別ルートの下へ移す
        const leafNode = await db.category.findUniqueOrThrow({
            where: { id: subCategory.id },
        });
        await asAdmin(() =>
            upsertCategory(nodeInput(leafNode, { parentId: newRoot.id }))
        );

        // Assert —— 新しい祖先で引ける
        const underNewRoot = await getProducts({ category: newRoot.url });
        expect(underNewRoot.totalCount).toBe(1);

        // Assert —— 旧祖先では引けない。path を書き換え損ねると、この 2 つ目の
        // assert だけが失敗する（DB の値を見るだけでは気づけない破損）。
        const underOldRoot = await getProducts({ category: oldRoot.url });
        expect(underOldRoot.totalCount).toBe(0);
    });
});

// ============================================================================
// Scenario 3: V-5d —— 並行リーフ化
// ============================================================================

/**
 * seed 済み product/variant から「カテゴリだけを付け替える」更新入力を組み立てる。
 * 変数をカテゴリ 1 点に絞ることで、失敗したときに原因が一意になる。
 */
function buildReassignInput(
    seeded: {
        product: {
            id: string;
            name: string;
            description: string;
            brand: string;
            shippingFeeMethod: ProductWithVariantType["shippingFeeMethod"];
            createdAt: Date;
        };
        variant: {
            id: string;
            variantName: string;
            variantDescription: string | null;
            variantImage: string;
            sku: string;
            weight: number | null;
        };
    },
    category: { categoryId: string; subCategoryId: string }
): ProductWithVariantType {
    return {
        productId: seeded.product.id,
        variantId: seeded.variant.id,
        name: seeded.product.name,
        description: seeded.product.description,
        variantName: seeded.variant.variantName,
        variantDescription: seeded.variant.variantDescription ?? "",
        images: [{ url: "https://example.test/updated.png" }],
        variantImage: seeded.variant.variantImage,
        categoryId: category.categoryId,
        subCategoryId: category.subCategoryId,
        isSale: false,
        brand: seeded.product.brand,
        sku: seeded.variant.sku,
        weight: seeded.variant.weight ?? 1,
        colors: [{ color: "Black" }],
        sizes: [{ size: "L", quantity: 5, price: 120, discount: 0 }],
        product_specs: [{ name: "material", value: "cotton" }],
        variant_specs: [{ name: "fit", value: "regular" }],
        keywords: ["test"],
        questions: [{ question: "Q1?", answer: "A1" }],
        freeShippingForAllCountries: false,
        freeShippingCountriesIds: [],
        shippingFeeMethod: seeded.product.shippingFeeMethod,
        createdAt: seeded.product.createdAt,
        updatedAt: new Date(),
    };
}

/**
 * Prisma の接続プール上限を求める。
 *
 * 並行ディスパッチテストは **プールが 1 だと 2 本が接続待ちで直列化され、競合を
 * 検証しないまま緑になる**（偽陽性）。「並行を検証できない環境」を silently pass
 * させないため、テスト内で明示的に expect する。
 *
 * （`store-status.test.ts` 等にも同じヘルパーがある。共通化するならまとめて
 * `setup/` へ出すこと。）
 */
function resolveConnectionLimit(): number {
    const url = process.env.DATABASE_URL;
    if (!url)
        throw new Error("DATABASE_URL が未設定です（globalSetup 未実行）");
    const explicit = new URL(url).searchParams.get("connection_limit");
    if (explicit !== null) {
        const parsed = Number(explicit.trim());
        if (!Number.isFinite(parsed)) {
            throw new Error(
                `connection_limit が数値ではありません: ${explicit}`
            );
        }
        return parsed;
    }
    return cpus().length * 2 + 1;
}

describe("Scenario 3: concurrent leaf assignment and child creation", () => {
    it("rejects the assignment when a child is being created under the same node", async () => {
        // 前提: プールが 1 だと 2 本が接続待ちで直列化され、競合を検証しないまま緑になる。
        expect(resolveConnectionLimit()).toBeGreaterThanOrEqual(2);

        // Arrange —— 商品は origin のリーフに紐づいた状態から、target のリーフへ
        // 付け替えようとする。
        const owner = await seedUser(db);
        const store = await seedStore(db, { userId: owner.id });
        const origin = await seedCategoryWithSubcategory(db);
        const target = await seedCategoryWithSubcategory(db);
        const seeded = await seedProductWithVariantAndSize(db, {
            storeId: store.id,
            categoryId: origin.category.id,
            subCategoryId: origin.subCategory.id,
        });
        const input = buildReassignInput(seeded, {
            categoryId: target.category.id,
            subCategoryId: target.subCategory.id,
        });

        // Act —— 「target の子を作る」トランザクションを**開いたまま**、
        // 商品の付け替えを走らせる。
        //
        // この tx が握るロックと書き込みは `upsertCategory` の critical section と
        // 同一である（親行の `SELECT … FOR UPDATE` → 子の INSERT → 親の
        // childCount 更新）。`upsertCategory` 自身を使わないのは、**コミットの
        // タイミングを掴めないと競合の窓を再現できない**ためで、ここでの被検証対象は
        // `upsertProduct` 側のロックである。
        let assignment!: Promise<unknown>;
        await db.$transaction(async (tx) => {
            await tx.$queryRaw`
                SELECT "id" FROM "Category" WHERE "id" = ${target.subCategory.id} FOR UPDATE
            `;
            await tx.category.create({
                data: {
                    name: `Child ${Date.now()}`,
                    image: "https://example.test/node.png",
                    url: `child-${Date.now()}`,
                    parentId: target.subCategory.id,
                    path: `${target.childNode.path}/child-${Date.now()}`,
                    depth: target.childNode.depth + 1,
                },
            });
            await tx.category.update({
                where: { id: target.subCategory.id },
                data: { childCount: { increment: 1 } },
            });

            // 商品側を起動して、ロック待ちに入らせる（まだコミットしない）
            assignment = asSeller(owner.id, () =>
                upsertProduct(input, store.url)
            ).catch((error: unknown) => error);
            await new Promise((resolve) => setTimeout(resolve, 300));
        });

        // Assert —— コミット後にロックが解放され、商品側は childCount = 1 を読む。
        // **ロックを外すと、商品側は未コミットの子を見ないまま childCount = 0 を
        // 読んで成功し、非リーフ紐づけが成立する**（このテストはそこで赤になる）。
        const result = await assignment;
        expect(result).toBeInstanceOf(Error);
        expect((result as Error).message).toMatch(/leaf/i);

        // Assert —— 副作用なし: 商品は元のリーフに残っている
        const productAfter = await db.product.findUniqueOrThrow({
            where: { id: seeded.product.id },
            select: { categoryNodeId: true, subCategoryId: true },
        });
        expect(productAfter.categoryNodeId).toBe(origin.subCategory.id);
        expect(productAfter.subCategoryId).toBe(origin.subCategory.id);
    });
});
