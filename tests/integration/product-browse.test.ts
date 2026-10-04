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
 *   - 下限のみの価格フィルタ（maxPrice 未指定なら `lte` を付けない）の成立可否
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
import { productDerivedColumnsUpdateSql } from "@/lib/product-derived-columns";
import type { ProductFacet, ProductFilters } from "@/lib/types";
import { getProductFacets, getProducts } from "@/queries/product";
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

    // 価格ソートが使う非正規化列 minPrice を埋める。アプリの書き込み経路
    // （recomputeProductDerivedColumns）を通さずに行を作っているので、アプリと同じ
    // 導出 SQL を流す（同期そのものは product-update.test.ts が検証する）。
    await fillMinPrice();

    return { store, cat1, cat2, a, b, c };
}

/** 全商品の非正規化列（minPrice / searchKeywords）を、アプリと同じ導出 SQL で埋め直す。 */
async function fillMinPrice(): Promise<void> {
    await db.$executeRaw(productDerivedColumnsUpdateSql());
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
        // Server Action への直接入力は型どおりとは限らない（parseProductFilters が配列へ揃える）
        const result = await getProducts({ color: "Red" } as unknown as ProductFilters);

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([fx.a.product.id]);
    });
});

// ============================================================================
// Scenario 4: 価格境界（Decimal カラムへの gte/lte 組み立て）
// ============================================================================

describe("Scenario 4: price boundaries", () => {
    it("filters within an explicit min/max range", async () => {
        const result = await getProducts({ minPrice: 100, maxPrice: 200 });

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([fx.b.product.id]);
    });

    it("accepts a bare minPrice by omitting the lte bound entirely", async () => {
        // 回帰テスト: 下限のみの価格フィルタが成立することを固定する。
        // 実装は maxPrice 未指定のとき `lte` を**付けない**（`src/queries/product.ts`）。
        // 以前は `lte: filters.maxPrice || Infinity` を渡しており、Prisma は Decimal
        // カラムのフィルタに Infinity を載せられずシリアライズ時に throw していた
        // （plan 039 の STOP 条件に該当し本体を修正）。実 DB でしか観測できない経路。
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

describe("Scenario 5b: search through searchVector (plan 075)", () => {
    // 旧実装（name / description / variantName / variantDescription への ILIKE）では
    // 当たらなかった語で検索し、検索ベクトル経由に切り替わったことを固定する。

    it("matches the brand, which the former ILIKE search never looked at", async () => {
        // Arrange
        await db.product.update({
            where: { id: fx.b.product.id },
            data: { brand: "Zephyrcraft" },
        });

        // Act
        const result = await getProducts({ search: "zephyrcraft" });

        // Assert
        expect(idsOf(result)).toEqual([fx.b.product.id]);
    });

    it("matches variant keywords via the denormalized searchKeywords column", async () => {
        // Arrange — searchKeywords の同期（recomputeProductDerivedColumns）は
        // product-update.test.ts が検証する。ここでは列に値がある前提で検索経路だけを見る
        await db.product.update({
            where: { id: fx.a.product.id },
            data: { searchKeywords: "tourmaline beryl" },
        });

        // Act
        const result = await getProducts({ search: "beryl" });

        // Assert
        expect(idsOf(result)).toEqual([fx.a.product.id]);
    });

    it("matches a partially typed last word as a prefix", async () => {
        // Act — "auro" は Aurora Lamp の前方一致
        const result = await getProducts({ search: "auro" });

        // Assert
        expect(idsOf(result)).toEqual([fx.c.product.id]);
    });

    it("applies filters before paging, so later pages still hold matches", async () => {
        // Arrange — 3 商品すべてに同じ語を持たせ、カテゴリ 1（A・B）で絞る。
        // 「検索で上位 N 件を確定 → 後段で絞り込み」の順だと、ページ 2 が空になったり
        // totalCount が絞り込み前の件数になったりする（design.md §2-Q2 の anti-pattern）
        await db.product.updateMany({ data: { searchKeywords: "obsidian" } });

        // Act
        const page1 = await getProducts(
            { search: "obsidian", category: fx.cat1.category.url },
            "most-popular",
            1,
            1
        );
        const page2 = await getProducts(
            { search: "obsidian", category: fx.cat1.category.url },
            "most-popular",
            2,
            1
        );

        // Assert
        expect(page1.totalCount).toBe(2);
        expect(idsOf(page1)).toEqual([fx.a.product.id]);
        expect(idsOf(page2)).toEqual([fx.b.product.id]);
    });

    it("orders by relevance when no sort is given, name hits before description hits", async () => {
        // Arrange — A は name に、C は description にだけ "garnet" を持つ。
        // views は C(10) < A(30) なので、views 順なら A が先に来てしまい区別できない。
        // そこで A の views を最小にして、relevance でしか A が先頭にならない状態を作る。
        await db.product.update({
            where: { id: fx.a.product.id },
            data: { name: "Garnet Ring", views: 0 },
        });
        await db.product.update({
            where: { id: fx.c.product.id },
            data: { description: "garnet inlay" },
        });

        // Act
        const result = await getProducts({ search: "garnet" });

        // Assert
        expect(idsOf(result)).toEqual([fx.a.product.id, fx.c.product.id]);
    });

    it("returns no results for a search made only of tsquery operators", async () => {
        // Act
        const result = await getProducts({ search: "&|!():*" });

        // Assert
        expect(result.totalCount).toBe(0);
        expect(result.products).toEqual([]);
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

    it("breaks ties on the sort key by id so pages neither overlap nor drop items", async () => {
        // Arrange — views を全件同値にする。seed 直後の実データ（views=0 が大半）と同じ状況で、
        // tie-breaker が無いとページ境界の行が実行ごとに入れ替わりうる（plan 073）。
        // さらに **id の降順**に 1 件ずつ UPDATE して、ヒープ上の物理順序を id 降順にそろえる
        // （UPDATE は新しい行バージョンをヒープ末尾に書く）。同点の並びは保証されないだけで、
        // 小さなデータでは物理順のまま返りやすい。物理順を期待値（id 昇順）の逆にしておけば、
        // tie-breaker を外したときにこのテストが確実に落ちる。
        const expected = [fx.a.product.id, fx.b.product.id, fx.c.product.id].sort();
        for (const id of [...expected].reverse()) {
            await db.product.update({ where: { id }, data: { views: 0 } });
        }

        // Act — ページサイズ 2 で全ページを走査する
        const page1 = await getProducts({}, "most-popular", 1, 2);
        const page2 = await getProducts({}, "most-popular", 2, 2);

        // Assert — 同点は id 昇順。2 ページの和集合が全件と一致し、重複も欠落も無い
        expect([...idsOf(page1), ...idsOf(page2)]).toEqual(expected);
    });

    it("orders ascending by discounted price for price-low-to-high", async () => {
        // ページを跨いだ全体順序は "orders by price across the whole catalog" が検証する
        // （plan 076 で price 系ソートを DB の minPrice 列へ移した）。
        const result = await getProducts({}, "price-low-to-high", 1, 10);

        expect(idsOf(result)).toEqual([
            fx.a.product.id, // 50
            fx.b.product.id, // 150
            fx.c.product.id, // 300
        ]);
    });

    it("orders by price across the whole catalog, not just within the page", async () => {
        // Arrange — views は A(30) > B(20) > C(10)、価格は A(50) < B(150) < C(300)。
        // 旧実装は views 順で 1 ページ分（A, B）を取ってからメモリ上で並べ替えていたため、
        // 高い順の 1 ページ目が [B, A] になり、最も高い C が 2 ページ目へ押し出されていた。

        // Act
        const page1 = await getProducts({}, "price-high-to-low", 1, 2);
        const page2 = await getProducts({}, "price-high-to-low", 2, 2);

        // Assert
        expect(idsOf(page1)).toEqual([fx.c.product.id, fx.b.product.id]);
        expect(idsOf(page2)).toEqual([fx.a.product.id]);
    });

    it("uses the discounted price and puts products without sizes last", async () => {
        // Arrange — B に 80% 引き（150 → 30.00）を付けて最安にし、C のサイズを消す
        await db.size.update({
            where: { id: fx.b.size.id },
            data: { discount: 80 },
        });
        await db.size.deleteMany({ where: { productVariantId: fx.c.variant.id } });
        await fillMinPrice();

        // Act
        const result = await getProducts({}, "price-low-to-high", 1, 10);

        // Assert — B(30) → A(50) → C(価格なし)
        expect(idsOf(result)).toEqual([
            fx.b.product.id,
            fx.a.product.id,
            fx.c.product.id,
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

// ============================================================================
// Scenario 9: カテゴリツリーのサブツリー検索（plan 067 Phase B）
// ============================================================================

/**
 * 3 階層のカテゴリツリーと、各ノードに紐づく商品を作る。
 *
 * ```
 * electronics                     (depth 0)
 * ├── camera                      (depth 1)  ← 商品 camProduct
 * │   └── lens                    (depth 2)  ← 商品 lensProduct
 * └── camera-accessories          (depth 1)  ← 商品 accProduct
 * ```
 *
 * **`camera` と `camera-accessories` が兄弟であることが本シナリオの核**で、
 * 素の `startsWith("electronics/camera")` は後者を子孫として拾う。境界文字 `/` を
 * 伴う `subtreeOf` でのみ 2 者が分離される（V-1）。
 *
 * 商品の seed ヘルパーは「`SubCategory` と `Category` ノードが id を共有する」
 * Phase A の不変条件を検証するため、depth 1 / depth 2 のノードには対応する
 * `SubCategory` 行を**同じ id で**作る（移行 A-3 と同じ規則）。
 */
async function arrangeCategoryTree() {
    const owner = await seedUser(db);
    const store = await seedStore(db, { userId: owner.id });

    const root = await db.category.create({
        data: {
            name: "Electronics",
            image: "https://example.test/electronics.png",
            url: "electronics",
            path: "electronics",
            depth: 0,
            childCount: 2,
        },
    });

    /**
     * Category ノードと、id を共有する SubCategory 行を対で作る。
     *
     * legacy 側の `SubCategory.categoryId` は**ルート**（= `root`）を指す。2 階層モデルの
     * SubCategory は常にトップレベルの Category にぶら下がる行なので、直近の親が中間ノード
     * （camera）でもミラーはルートを向くのが legacy として正しい形になる。
     */
    const createNode = async (
        name: string,
        url: string,
        parent: { id: string; path: string }
    ) => {
        const node = await db.category.create({
            data: {
                name,
                image: `https://example.test/${url}.png`,
                url,
                parentId: parent.id,
                path: `${parent.path}/${url}`,
                depth: parent.path.split("/").length,
            },
        });
        await db.subCategory.create({
            data: {
                id: node.id,
                name,
                image: `https://example.test/${url}.png`,
                url,
                categoryId: root.id,
            },
        });
        return node;
    };

    const camera = await createNode("Camera", "camera", root);
    const accessories = await createNode(
        "Camera Accessories",
        "camera-accessories",
        root
    );
    const lens = await createNode("Lens", "lens", camera);
    // camera は lens を持つ**非リーフ**なので商品を直接ぶら下げられない（V-5）。
    // camera 直下の商品は、もう 1 枚のリーフ camera-body に置く。
    // サブツリー検索の観点は変わらない（どちらも electronics/camera 配下）。
    const cameraBody = await createNode("Camera Body", "camera-body", camera);

    // legacy の categoryId は**ルート**を指す（camera は中間ノードであってルートではない）。
    const camProduct = await seedProductWithVariantAndSize(db, {
        storeId: store.id,
        categoryId: root.id,
        subCategoryId: cameraBody.id,
    });
    const accProduct = await seedProductWithVariantAndSize(db, {
        storeId: store.id,
        categoryId: root.id,
        subCategoryId: accessories.id,
    });
    const lensProduct = await seedProductWithVariantAndSize(db, {
        storeId: store.id,
        categoryId: root.id,
        subCategoryId: lens.id,
    });

    return {
        root,
        camera,
        cameraBody,
        accessories,
        lens,
        camProduct,
        accProduct,
        lensProduct,
    };
}

describe("Scenario 9: category subtree filtering", () => {
    it("excludes a sibling whose slug shares the prefix (V-1)", async () => {
        // Arrange
        const tree = await arrangeCategoryTree();

        // Act —— electronics/camera のサブツリー
        const result = await getProducts({ category: tree.camera.url });

        // Assert: camera と その子孫 lens のみ。
        // electronics/camera-accessories は **prefix が一致するだけの兄弟**なので入らない。
        expect(idsOf(result).sort()).toEqual(
            [tree.camProduct.product.id, tree.lensProduct.product.id].sort()
        );
        expect(idsOf(result)).not.toContain(tree.accProduct.product.id);
    });

    it("matches a depth-2 product through its root ancestor", async () => {
        // Arrange —— ツリー化の本題。2 段固定の旧実装では 3 階層目に到達できない
        const tree = await arrangeCategoryTree();

        // Act
        const result = await getProducts({ category: tree.root.url });

        // Assert: 祖先 1 つで全 3 商品（depth 1 と depth 2 の両方）が取れる
        expect(result.totalCount).toBe(3);
        expect(idsOf(result)).toContain(tree.lensProduct.product.id);
    });

    it("resolves the legacy ?subCategory= slug to the same subtree", async () => {
        // Arrange
        const tree = await arrangeCategoryTree();

        // Act —— 旧パラメータも恒久的に受理する（design.md §2-Q4）
        const result = await getProducts({ subCategory: tree.camera.url });

        // Assert: ?category= と同じサブツリーに落ちる（子孫 lens を含む）
        expect(idsOf(result).sort()).toEqual(
            [tree.camProduct.product.id, tree.lensProduct.product.id].sort()
        );
    });

    it("prefers the SUB_CATEGORY alias over a colliding canonical slug", async () => {
        // Arrange —— 旧 slug "camera" が **別ノードの正準 slug のまま**という衝突を作る。
        // lens を "optics" にリネームし、旧 slug "camera" の別名を lens へ張る。
        // このとき DB には url="camera" の Category（本物の camera）が残っているので、
        // `resolveCategoryNode` が url 完全一致を先に引く実装だと**別サブツリー**に
        // 落ちる。SUB_CATEGORY だけ別名表を先に引く理由がここにある
        // （src/lib/category-tree.ts / design.md §2-Q4）。unit テストは db を全モック
        // するため、この優先順位は実 DB でしか固定できない。
        const tree = await arrangeCategoryTree();
        const renamed = await db.category.update({
            where: { id: tree.lens.id },
            data: { url: "optics", path: "electronics/camera/optics" },
        });
        await db.categorySlugAlias.create({
            data: {
                entityType: "SUB_CATEGORY",
                oldSlug: "camera",
                categoryId: renamed.id,
            },
        });

        // Act —— 外部被リンクに残った旧 slug
        const result = await getProducts({ subCategory: "camera" });

        // Assert: 別名が指す **リネーム後の子**のサブツリーへ解決される。
        // 正準 slug "camera" を持つ本物の camera ノード（配下に camProduct）ではない。
        expect(idsOf(result)).toEqual([tree.lensProduct.product.id]);
        expect(idsOf(result)).not.toContain(tree.camProduct.product.id);
    });

    it("returns no results for an unresolvable subCategory slug (V-6)", async () => {
        // Arrange
        await arrangeCategoryTree();

        // Act
        const result = await getProducts({ subCategory: "no-such-subcategory" });

        // Assert: fail-closed。旧パラメータ側だけ fail-open へ退行しても
        // Scenario 2（category 側）では検出できないので個別に固定する。
        expect(result.totalCount).toBe(0);
        expect(result.products).toHaveLength(0);
        expect(result.totalPages).toBe(0);
    });
});

// ============================================================================
// Scenario 11: 属性ファセット（plan 076 / ADR-007）
// ============================================================================

/**
 * カテゴリ 1 のルートノードに facetable な属性定義を作り、A・B に値を付ける。
 *
 * | key      | scope   | A          | B      |
 * |----------|---------|------------|--------|
 * | material | PRODUCT | wool       | silk   |
 * | pattern  | PRODUCT | solid      | solid  |
 * | finish   | VARIANT | matte（バリアント） | —  |
 * | hidden   | PRODUCT | x（facetable=false） | — |
 *
 * VARIANT スコープを含めるのは、ProductAttributeValue だけを見る実装だと
 * そのファセットが丸ごと消えるため（ADR-007 の注意書き）。
 */
async function arrangeAttributes() {
    const nodeId = fx.cat1.category.id;
    const define = async (
        key: string,
        scope: "PRODUCT" | "VARIANT",
        facetable: boolean,
        options: string[]
    ) => {
        const definition = await db.attributeDefinition.create({
            data: {
                categoryId: nodeId,
                key,
                name: key.charAt(0).toUpperCase() + key.slice(1),
                type: "ENUM",
                scope,
                facetable,
                options: {
                    create: options.map((value, i) => ({
                        value,
                        label: value.charAt(0).toUpperCase() + value.slice(1),
                        sortOrder: i,
                    })),
                },
            },
            include: { options: true },
        });
        const optionId = (value: string) => {
            const option = definition.options.find((o) => o.value === value);
            if (!option) throw new Error(`option ${value} not found`);
            return option.id;
        };
        return { definition, optionId };
    };
    const productValue = async (
        def: Awaited<ReturnType<typeof define>>,
        productId: string,
        value: string
    ) =>
        db.productAttributeValue.create({
            data: {
                productId,
                definitionId: def.definition.id,
                scope: "PRODUCT",
                type: "ENUM",
                multiValued: false,
                optionId: def.optionId(value),
            },
        });

    const material = await define("material", "PRODUCT", true, ["wool", "silk"]);
    const pattern = await define("pattern", "PRODUCT", true, ["solid"]);
    const finish = await define("finish", "VARIANT", true, ["matte"]);
    const hidden = await define("hidden", "PRODUCT", false, ["x"]);

    await productValue(material, fx.a.product.id, "wool");
    await productValue(material, fx.b.product.id, "silk");
    await productValue(pattern, fx.a.product.id, "solid");
    await productValue(pattern, fx.b.product.id, "solid");
    await productValue(hidden, fx.a.product.id, "x");
    await db.variantAttributeValue.create({
        data: {
            variantId: fx.a.variant.id,
            definitionId: finish.definition.id,
            scope: "VARIANT",
            type: "ENUM",
            multiValued: false,
            optionId: finish.optionId("matte"),
        },
    });
}

/** facet を key → { value: count } の形にして比較しやすくする */
const facetCounts = (facets: ProductFacet[]) =>
    Object.fromEntries(
        facets.map((f) => [
            f.key,
            Object.fromEntries(f.values.map((v) => [v.value, v.count])),
        ])
    );

describe("Scenario 11: attribute facets", () => {
    beforeEach(async () => {
        await arrangeAttributes();
    });

    it("filters by an attribute value (PRODUCT scope)", async () => {
        const result = await getProducts({
            category: fx.cat1.category.url,
            attributes: { material: ["wool"] },
        });

        expect(idsOf(result)).toEqual([fx.a.product.id]);
    });

    it("ORs values within a key and ANDs across keys", async () => {
        const both = await getProducts({
            category: fx.cat1.category.url,
            attributes: { material: ["wool", "silk"] },
        }, "most-popular");
        const narrowed = await getProducts({
            category: fx.cat1.category.url,
            attributes: { material: ["wool", "silk"], finish: ["matte"] },
        });

        expect(idsOf(both)).toEqual([fx.a.product.id, fx.b.product.id]);
        expect(idsOf(narrowed)).toEqual([fx.a.product.id]);
    });

    it("filters by a VARIANT-scope attribute", async () => {
        const result = await getProducts({
            category: fx.cat1.category.url,
            attributes: { finish: ["matte"] },
        });

        expect(idsOf(result)).toEqual([fx.a.product.id]);
    });

    it("returns no results for an unknown key or a non-facetable key (fail-closed)", async () => {
        const unknown = await getProducts({ attributes: { color_family: ["red"] } });
        const notFacetable = await getProducts({ attributes: { hidden: ["x"] } });

        expect(unknown.totalCount).toBe(0);
        expect(notFacetable.totalCount).toBe(0);
    });

    it("counts facet values within the category subtree, including VARIANT scope", async () => {
        const facets = await getProductFacets({ category: fx.cat1.category.url });

        expect(facetCounts(facets)).toEqual({
            material: { silk: 1, wool: 1 },
            pattern: { solid: 2 },
            finish: { matte: 1 },
        });
        // facetable=false の定義はファセットに出さない
        expect(facets.map((f) => f.key)).not.toContain("hidden");
        // 表示名は option.label、定義名は name
        const material = facets.find((f) => f.key === "material");
        expect(material?.name).toBe("Material");
        expect(material?.values.map((v) => v.label).sort()).toEqual(["Silk", "Wool"]);
    });

    it("keeps the other values of a selected key countable (disjunctive faceting)", async () => {
        // Act — material=wool を選ぶ
        const facets = await getProductFacets({
            category: fx.cat1.category.url,
            attributes: { material: ["wool"] },
        });

        // Assert — material 自身の件数は自分の選択を外して数える（silk が 0 にならない）。
        // 他の key（pattern）は選択を課した母集合（A だけ）で数える。
        expect(facetCounts(facets)).toEqual({
            material: { silk: 1, wool: 1 },
            pattern: { solid: 1 },
            finish: { matte: 1 },
        });
        const wool = facets
            .find((f) => f.key === "material")
            ?.values.find((v) => v.value === "wool");
        expect(wool?.selected).toBe(true);
    });

    it("narrows facet counts by the search term too", async () => {
        // Act — "aurora" は C（カテゴリ 2）にしか無いので、カテゴリ 1 の母集合は空
        const facets = await getProductFacets({
            category: fx.cat1.category.url,
            search: "aurora",
        });

        // Assert
        expect(facets).toEqual([]);
    });

    it("still returns a selected key that has no values here, so it can be cleared", async () => {
        // Arrange — カテゴリを切り替えると前のカテゴリの attr.* が URL に残る。
        // その key がファセットに出ないと、0 件に絞られたまま解除する手段が無くなる。

        // Act
        const facets = await getProductFacets({
            category: fx.cat1.category.url,
            attributes: { voltage: ["220v"] },
        });

        // Assert
        expect(facets.find((f) => f.key === "voltage")).toEqual({
            key: "voltage",
            name: "voltage",
            unit: null,
            values: [{ value: "220v", label: "220v", count: 0, selected: true }],
        });
    });

    it("returns no facets without a category (facets are category-scoped)", async () => {
        expect(await getProductFacets({})).toEqual([]);
    });
});
