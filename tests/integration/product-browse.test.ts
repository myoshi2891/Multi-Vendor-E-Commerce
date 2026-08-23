/**
 * Product Browse Integration Tests (getProducts)
 *
 * `/browse` の供給源 `getProducts`（`src/queries/product.ts`）を実 DB
 * (testcontainers PostgreSQL) で検証する。category / subCategory / size / offer /
 * search / price / color を `whereClause.AND` へ動的合成する部分は、Prisma が実際に
 * SQL を生成して初めて確定する領域で、db 全モックの unit テストでは固定できない:
 *
 *   - ネストした `variants.some.sizes.some` / `variants.some.colors.some`
 *   - `contains` + `mode: "insensitive"` の OR 検索
 *   - `lte: Infinity` を Decimal カラムへ渡す価格境界
 *   - URL 由来フィルタが解決できないときの挙動（fail-closed。下記シナリオ 2）
 *   - DB ソート（views / createdAt）と**ページ内 JS ソート**（price 系）の違い
 *
 * 実 DB で固定することで、Prisma のメジャーアップグレード（DEPS-04 spike）の
 * 回帰網としても機能する。認証は不要（Public）なので Clerk mock も要らない。
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - src/queries/product.ts (getProducts)
 * - plans/039-integration-test-product-browse-filters.md
 */

// ----------------------------------------------------------------------------
// Mocks (must be declared before importing the modules they affect)
// ----------------------------------------------------------------------------

// `getProducts` は認証を要求しない（Public）が、**モジュール `src/queries/product.ts` が
// `@clerk/nextjs/server` を import している**ため、モックが無いと読み込み時点で
// `@clerk/backend` の ESM (`export const webcrypto = ...`) を jest が解釈できず
// SyntaxError になる。判断基準は「その関数が使うか」ではなく「そのモジュールが読み込むか」。
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

// ----------------------------------------------------------------------------

import { Prisma } from "@prisma/client";
import { getProducts } from "@/queries/product";
import { disconnectTestDb, getTestDb } from "./setup/db";
import { resetDb } from "./setup/reset-db";
import {
    seedCategoryWithSubcategory,
    seedProductWithVariantAndSize,
    seedStore,
    seedUser,
} from "./setup/seed";

const db = getTestDb();

type Fixture = Awaited<ReturnType<typeof arrangeCatalog>>;

/**
 * 商品 3 件のカタログを作る。
 *
 * **assert が依存する値はすべてここで明示する**のが本ファイルの原則:
 * - `views` / `createdAt` を相異なる既知の値に固定する。既定 orderBy は views desc で、
 *   seed 直後は全商品 `views: 0` の**同値**になり、PostgreSQL は同値行の順序を保証しない。
 *   固定しないとページング検証が実 DB の行順に依存したフレークテストになる。
 * - **全商品の全 Size** の `price` と `discount` を明示する。フィルタは生の `price` を
 *   `some` で見る（どれか 1 Size が範囲内なら商品全体がヒットする）ため追加 Size が
 *   絞り込みへ紛れ込みうる。ソートは `discount` 込みの割引後価格を見るため、
 *   スキーマ既定値に委ねると既定が変わった瞬間に並び順が静かに壊れる。
 */
async function arrangeCatalog() {
    const owner = await seedUser(db);
    const store = await seedStore(db, { userId: owner.id });
    const cat1 = await seedCategoryWithSubcategory(db);
    const cat2 = await seedCategoryWithSubcategory(db);

    // 商品 A: カテゴリ 1 / M=50・XL=60 / Color "Red"
    const a = await seedProductWithVariantAndSize(db, {
        storeId: store.id,
        categoryId: cat1.category.id,
        subCategoryId: cat1.subCategory.id,
        sizePrice: 50,
    });
    await db.size.update({ where: { id: a.size.id }, data: { discount: 0 } });
    await db.size.create({
        data: {
            size: "XL",
            quantity: 10,
            price: new Prisma.Decimal(60),
            discount: 0,
            productVariantId: a.variant.id,
        },
    });
    await db.color.create({
        data: { name: "Red", productVariantId: a.variant.id },
    });

    // 商品 B: カテゴリ 1 / M=150
    const b = await seedProductWithVariantAndSize(db, {
        storeId: store.id,
        categoryId: cat1.category.id,
        subCategoryId: cat1.subCategory.id,
        sizePrice: 150,
    });
    await db.size.update({ where: { id: b.size.id }, data: { discount: 0 } });

    // 商品 C: カテゴリ 2 / M=300 / 検索用に name・description を既知の文字列へ
    const c = await seedProductWithVariantAndSize(db, {
        storeId: store.id,
        categoryId: cat2.category.id,
        subCategoryId: cat2.subCategory.id,
        sizePrice: 300,
    });
    await db.size.update({ where: { id: c.size.id }, data: { discount: 0 } });
    await db.product.update({
        where: { id: c.product.id },
        data: { name: "Aurora Lamp", description: "handmade walnut base" },
    });

    // 既定 orderBy（views desc）と new-arrivals（createdAt desc）が
    // どちらも A → B → C になるよう固定する
    await db.product.update({
        where: { id: a.product.id },
        data: { views: 30, createdAt: new Date("2026-01-03T00:00:00Z") },
    });
    await db.product.update({
        where: { id: b.product.id },
        data: { views: 20, createdAt: new Date("2026-01-02T00:00:00Z") },
    });
    await db.product.update({
        where: { id: c.product.id },
        data: { views: 10, createdAt: new Date("2026-01-01T00:00:00Z") },
    });

    return { store, cat1, cat2, a, b, c };
}

/** 返却された products の id 配列（並び順を保つ） */
const idsOf = (result: { products: { id: string }[] }) =>
    result.products.map((p) => p.id);

let fx: Fixture;

// ----------------------------------------------------------------------------
// Lifecycle
// ----------------------------------------------------------------------------

afterAll(async () => {
    await disconnectTestDb();
});

beforeEach(async () => {
    await resetDb(db);
    fx = await arrangeCatalog();
});

// ============================================================================
// Scenario 1: category / subCategory フィルタ
// ============================================================================

describe("Scenario 1: category and subCategory filters", () => {
    it("narrows the catalog by category URL", async () => {
        const result = await getProducts({ category: fx.cat1.category.url });

        expect(result.totalCount).toBe(2);
        expect(idsOf(result).sort()).toEqual(
            [fx.a.product.id, fx.b.product.id].sort()
        );
    });

    it("narrows the catalog by subCategory URL", async () => {
        const result = await getProducts({
            subCategory: fx.cat2.subCategory.url,
        });

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([fx.c.product.id]);
    });
});

// ============================================================================
// Scenario 2: 解決できない URL フィルタ（fail-closed）
// ============================================================================

describe("Scenario 2: unresolvable URL filters", () => {
    it("returns no results instead of the whole catalog", async () => {
        const result = await getProducts({ category: "no-such-category" });

        // **プラン 039 執筆時点の実装は fail-open**（URL が解決できないとフィルタを黙って
        // 捨て、全 3 件を返す）で、本シナリオはその characterization を指示していた。
        // その挙動は `cce53407`（2026-08-12 "fix(queries): return no results when a URL
        // filter matches no row"）で **fail-closed に修正済み**である ——
        // 「該当なし」が「全件表示」に化けると、存在しないカテゴリ URL で全カタログが出る。
        // プラン本文が指定する反転先（totalCount === 0）へ期待値を反転させた。
        expect(result.totalCount).toBe(0);
        expect(result.products).toHaveLength(0);
        expect(result.totalPages).toBe(0);
    });

    it("applies the same fail-closed rule to store and offer URLs", async () => {
        // 同じ URL 解決は store / offer にもある。まとめて固定しておかないと、
        // 片方だけ fail-open へ退行しても検出できない。
        await expect(
            getProducts({ store: "no-such-store" })
        ).resolves.toMatchObject({ totalCount: 0 });
        await expect(
            getProducts({ offer: "no-such-offer" })
        ).resolves.toMatchObject({ totalCount: 0 });
    });
});

// ============================================================================
// Scenario 3: size / color のネスト some フィルタ
// ============================================================================

describe("Scenario 3: nested some filters", () => {
    it("filters by size through variants.sizes", async () => {
        const result = await getProducts({ size: ["XL"] });

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([fx.a.product.id]);
    });

    it("filters by color passed as a bare string", async () => {
        // 単一文字列を渡す経路（実装側で配列化される）を通す
        const result = await getProducts({ color: "Red" });

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([fx.a.product.id]);
    });
});

// ============================================================================
// Scenario 4: 価格境界（Decimal + Infinity 経路）
// ============================================================================

describe("Scenario 4: price boundaries", () => {
    it("filters within an explicit min/max range", async () => {
        const result = await getProducts({ minPrice: 100, maxPrice: 200 });

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([fx.b.product.id]);
    });

    it("accepts a bare minPrice, which sends lte: Infinity to a Decimal column", async () => {
        // maxPrice 未指定だと実装は `lte: filters.maxPrice || Infinity` を渡す。
        // Prisma の Decimal フィルタが Infinity を受理するかは実 DB でしか確認できない。
        const result = await getProducts({ minPrice: 200 });

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([fx.c.product.id]);
    });
});

// ============================================================================
// Scenario 5: insensitive 検索
// ============================================================================

describe("Scenario 5: case-insensitive search", () => {
    it("matches the product name regardless of case", async () => {
        const result = await getProducts({ search: "aurora" });

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([fx.c.product.id]);
    });

    it("matches the description regardless of case", async () => {
        const result = await getProducts({ search: "WALNUT" });

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([fx.c.product.id]);
    });
});

// ============================================================================
// Scenario 6: ページング
// ============================================================================

describe("Scenario 6: pagination", () => {
    it("splits the catalog across pages without overlap", async () => {
        const page1 = await getProducts({}, "", 1, 2);
        const page2 = await getProducts({}, "", 2, 2);

        expect(page1.totalCount).toBe(3);
        expect(page1.totalPages).toBe(2);
        expect(page1.currentPage).toBe(1);

        // 具体的な並びまで固定する。Arrange で views を相異なる値にしてあるので
        // 既定 orderBy（views desc）の下でこれは決定論的になる ——
        // views が同値のままだと行順は非保証で、この assert はフレークする。
        expect(idsOf(page1)).toEqual([fx.a.product.id, fx.b.product.id]);
        expect(idsOf(page2)).toEqual([fx.c.product.id]);

        const overlap = idsOf(page1).filter((id) => idsOf(page2).includes(id));
        expect(overlap).toHaveLength(0);
    });
});

// ============================================================================
// Scenario 7: 複合フィルタ（AND 合成）
// ============================================================================

describe("Scenario 7: composed filters", () => {
    it("intersects category and price constraints", async () => {
        const result = await getProducts({
            category: fx.cat1.category.url,
            minPrice: 100,
        });

        // カテゴリ 1 は A(50/60) と B(150)。price >= 100 を満たすのは B だけ。
        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([fx.b.product.id]);
    });
});

// ============================================================================
// Scenario 8: ソート（DB ソートとページ内 JS ソート）
// ============================================================================

describe("Scenario 8: sorting", () => {
    it("orders by createdAt desc for new-arrivals", async () => {
        const result = await getProducts({}, "new-arrivals", 1, 10);

        expect(idsOf(result)).toEqual([
            fx.a.product.id,
            fx.b.product.id,
            fx.c.product.id,
        ]);
    });

    it("orders by views desc for most-popular", async () => {
        const result = await getProducts({}, "most-popular", 1, 10);

        expect(idsOf(result)).toEqual([
            fx.a.product.id,
            fx.b.product.id,
            fx.c.product.id,
        ]);
    });

    it("orders ascending by discounted price for price-low-to-high", async () => {
        // pageSize は全 3 件が 1 ページに収まる 10 を渡す。
        // TODO(characterization): price 系ソートは DB の orderBy ではなく
        // **取得後の配列に対する JS ソート**で、ページ内でしか効かない。pageSize=2 だと
        // 「DB が views desc で選んだ 2 件だけを価格順に並べ替える」結果になり、全体の
        // 価格順とは一致しない（ページを跨ぐと価格順が壊れるという現実装の帰結）。
        // DB レベルソートへ改善された場合は、pageSize=2 でページを跨いだ全体順序を
        // assert するケースを追加すること（本ケースの期待値は 1 ページに収める限り不変）。
        const result = await getProducts({}, "price-low-to-high", 1, 10);

        expect(idsOf(result)).toEqual([
            fx.a.product.id, // 50
            fx.b.product.id, // 150
            fx.c.product.id, // 300
        ]);
    });

    it("orders descending by discounted price for price-high-to-low", async () => {
        const result = await getProducts({}, "price-high-to-low", 1, 10);

        expect(idsOf(result)).toEqual([
            fx.c.product.id,
            fx.b.product.id,
            fx.a.product.id,
        ]);
    });
});
