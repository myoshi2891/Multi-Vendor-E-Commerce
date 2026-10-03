/**
 * @jest-environment node
 */
/**
 * tsvector 全文検索の実 PostgreSQL 統合テスト (plan 033 / TESTS-17)
 *
 * 検証対象の境界:
 *   - `src/app/api/search-products/route.ts` が `$queryRaw` で発行する **raw SQL そのもの**
 *     （unit テストは `@/lib/db` を全モックしており、この SQL 文字列は一度も実行されていない）
 *   - `'simple'` トークナイザーの挙動（小文字化する / ステミングしない）
 *   - `ts_rank` による関連度降順ソート
 *   - `Prisma.sql` のパラメータ化（SQL インジェクションが SQL として解釈されないこと）
 *   - 従属: `src/queries/subCategory.ts` の `ORDER BY RANDOM()` raw SQL が実 DB で成立すること
 *
 * 設計判断:
 *   - `@/lib/db` は **モックしない**。globalSetup (`setup/container.ts`) が `DATABASE_URL` を
 *     testcontainers PostgreSQL へ書き換えるため、route が import するシングルトンは実 DB に繋がる。
 *   - `testEnvironment` はファイル単位 docblock で `node` に上書きする。`jest.integration.config.js`
 *     の既定は jsdom だが、jsdom には Fetch API の `Request` / `Response` グローバルが無く、
 *     Route Handler を直接呼ぶテストが書けない（plan 032 の `webhook-payment.test.ts` と同じ理由・
 *     config は変更しない）。本ファイルは DOM を使わないため副作用もない。
 *   - 検索対象 Product は name / description を制御する必要があるため、
 *     `seedProductWithVariantAndSize`（name 固定）ではなく `db.product.create` を直接使う。
 *   - 応答はサジェスト用の `SearchResult`（name / link / image）+ id（plan 073）。link と image は
 *     先頭バリアントから作るため、既定でバリアントを 1 件付ける。バリアントの無い商品は
 *     リンク先が無いので、SQL の WHERE 段で除外される（LIMIT の後で間引くと件数が欠ける）。
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - plans/033-integration-test-tsvector-search.md
 * - docs/migration/ (Elasticsearch → tsvector の技術選定経緯)
 */
import type { PrismaClient, Product } from "@prisma/client";
import { GET } from "@/app/api/search-products/route";
import { getSubcategories } from "@/queries/subCategory";
import { disconnectTestDb, getTestDb } from "./setup/db";
import { resetDb } from "./setup/reset-db";
import {
    seedCategoryWithSubcategory,
    seedStore,
    seedUser,
} from "./setup/seed";

type SearchRow = {
    id: string;
    name: string;
    link: string;
    image: string;
};

let db: PrismaClient;
let base: { storeId: string; categoryId: string; subCategoryId: string };

/** `?q=...` 付きの GET。通常ケースはすべてこちらを使う。 */
async function search(
    q: string,
    param: "q" | "search" = "q"
): Promise<{ status: number; body: SearchRow[] }> {
    const res = await GET(
        new Request(
            `http://localhost:3000/api/search-products?${param}=${encodeURIComponent(q)}`
        )
    );
    return { status: res.status, body: (await res.json()) as SearchRow[] };
}

/**
 * `q` を **一切付けない** GET（`searchParams.get("q") === null` を再現する専用ヘルパー）。
 * 上の `search` は常に `?q=...` を付与するため null ケースを作れない。
 */
async function searchWithoutParam(): Promise<{
    status: number;
    body: SearchRow[];
}> {
    const res = await GET(new Request("http://localhost:3000/api/search-products"));
    return { status: res.status, body: (await res.json()) as SearchRow[] };
}

/**
 * name / description を呼び出し側が完全に制御できる Product を 1 件作る。
 * `withVariant: false` を渡さない限り、サジェストの link / image の元になるバリアントを 1 件付ける。
 */
async function seedSearchableProduct(input: {
    name: string;
    description: string;
    storeId: string;
    categoryId: string;
    subCategoryId: string;
    withVariant?: boolean;
}): Promise<Product> {
    const { withVariant = true, ...data } = input;
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const product = await db.product.create({
        data: {
            ...data,
            slug: `search-${suffix}`,
            brand: "TestBrand",
        },
    });
    if (withVariant) {
        await db.productVariant.create({
            data: {
                variantName: `Variant ${suffix}`,
                variantImage: `https://example.test/${suffix}.png`,
                slug: `variant-${suffix}`,
                sku: `SKU-${suffix}`,
                weight: 1,
                productId: product.id,
            },
        });
    }
    return product;
}

/** シナリオ 1〜4・6〜7 が共有する 3 商品（A / B / C）を作る。 */
async function seedProductSet(): Promise<{
    a: Product;
    b: Product;
    c: Product;
}> {
    const a = await seedSearchableProduct({
        ...base,
        name: "Alpha Widget",
        description: "a portable gadget",
    });
    const b = await seedSearchableProduct({
        ...base,
        name: "Beta Gadget",
        description: "widget widget widget accessories",
    });
    const c = await seedSearchableProduct({
        ...base,
        name: "Gamma Case",
        description: "unrelated leather case",
    });
    return { a, b, c };
}

beforeAll(() => {
    db = getTestDb();
});

afterAll(async () => {
    await disconnectTestDb();
});

beforeEach(async () => {
    // 各テスト前にクリーン化する。リセットが無いと前テストの商品が残り、
    // 「1 件ヒット」「count === seed 数」といった assert が実行順に依存して壊れる。
    await resetDb(db);
    const user = await seedUser(db);
    const store = await seedStore(db, { userId: user.id });
    const { category, subCategory } = await seedCategoryWithSubcategory(db);
    base = {
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
    };
});

describe("GET /api/search-products (tsvector full-text search)", () => {
    it("シナリオ1: name に含まれる語でヒットし、'simple' トークナイザーが大文字小文字を無視する", async () => {
        // Arrange
        const { a } = await seedProductSet();

        // Act — "Alpha" を小文字 "alpha" で検索する
        const { status, body } = await search("alpha");

        // Assert
        expect(status).toBe(200);
        expect(body).toHaveLength(1);
        expect(body[0].id).toBe(a.id);
    });

    it("シナリオ2: description にのみ含まれる語でヒットする", async () => {
        // Arrange
        const { a } = await seedProductSet();

        // Act — "portable" は A の description にのみ存在する
        const { status, body } = await search("portable");

        // Assert
        expect(status).toBe(200);
        expect(body).toHaveLength(1);
        expect(body[0].id).toBe(a.id);
    });

    it("シナリオ3: 重み付き ts_rank で並ぶ（name の 1 回が description の 3 回より上位・ADR-008）", async () => {
        // Arrange — A は name に "Widget" を 1 回、B は description に "widget" を 3 回持つ。
        // 重み無しの旧実装では出現頻度の高い B が先頭だった。name(A) > description(D) の
        // 重み付けでは A が先頭になる（plan 074 で意図的に反転させた期待値）。
        const { a, b } = await seedProductSet();

        // Act
        const { status, body } = await search("widget");

        // Assert
        expect(status).toBe(200);
        expect(body).toHaveLength(2);
        expect(body.map((row) => row.id)).toEqual([a.id, b.id]);
    });

    it("シナリオ4: どの商品にも無い語では 200 + 空配列", async () => {
        // Arrange
        await seedProductSet();

        // Act
        const { status, body } = await search("nonexistentterm12345");

        // Assert
        expect(status).toBe(200);
        expect(body).toEqual([]);
    });

    it("シナリオ5: 空白のみのクエリは DB 到達前に 200 + 空配列で早期 return する", async () => {
        // Arrange — 商品を 1 件も seed しない状態でも成立する（DB に触れない分岐）

        // Act
        const { status, body } = await search("   ");

        // Assert
        expect(status).toBe(200);
        expect(body).toEqual([]);
    });

    it("シナリオ5b: q パラメータ自体が無い場合（searchParams.get('q') === null）も 200 + 空配列", async () => {
        // Arrange — 5 とは分岐が異なる（null vs 空文字列）ため独立ケースとして固定する

        // Act
        const { status, body } = await searchWithoutParam();

        // Assert
        expect(status).toBe(200);
        expect(body).toEqual([]);
    });

    it("シナリオ6: SQL インジェクション文字列はパラメータとして扱われ、テーブルに影響しない", async () => {
        // Arrange
        await seedProductSet();
        const before = await db.product.count();
        expect(before).toBe(3);

        // Act
        const { status } = await search('\'; DROP TABLE "Product"; --');

        // Assert — 500 でない = SQL として解釈されていない
        expect(status).toBe(200);
        expect(await db.product.count()).toBe(3);
    });

    it("シナリオ7: 複数語は plainto_tsquery の AND 意味論で連結される", async () => {
        // Arrange
        const { b } = await seedProductSet();

        // Act — A は "gadget" のみを持つため AND では脱落する
        const { status, body } = await search("beta gadget");

        // Assert
        expect(status).toBe(200);
        expect(body).toHaveLength(1);
        expect(body[0].id).toBe(b.id);
    });
});

describe("検索ベクトルの対象列（plan 074 / ADR-008）", () => {
    it("シナリオ14: brand に含まれる語でヒットする", async () => {
        // Arrange — seedSearchableProduct の brand は "TestBrand"
        const { a, b, c } = await seedProductSet();

        // Act
        const { body } = await search("testbrand");

        // Assert
        expect(body.map((row) => row.id).sort()).toEqual([a.id, b.id, c.id].sort());
    });

    it("シナリオ15: バリアントの keywords（searchKeywords 経由）でヒットする", async () => {
        // Arrange — keywords は name / description / brand のどこにも無い語
        const { a } = await seedProductSet();
        await db.productVariant.updateMany({
            where: { productId: a.id },
            data: { keywords: "tourmaline,beryl" },
        });
        // searchKeywords はアプリ層（upsertProduct の tx）が書く非正規化列。
        // ここでは直接の DB 更新なので、同じ SQL（backfill と同形）で再計算しておく。
        await db.$executeRaw`
            UPDATE "Product" p SET "searchKeywords" = COALESCE((
                SELECT string_agg(replace(pv."keywords", ',', ' '), ' ')
                FROM "ProductVariant" pv WHERE pv."productId" = p."id" AND pv."keywords" IS NOT NULL
            ), '') WHERE p."id" = ${a.id}`;

        // Act
        const { body } = await search("beryl");

        // Assert
        expect(body.map((row) => row.id)).toEqual([a.id]);
    });
});

describe("入力途中の語での前方一致（plan 075）", () => {
    it("シナリオ16: 最後の語は前方一致する（'alph' で Alpha Widget）", async () => {
        // Arrange
        const { a } = await seedProductSet();

        // Act
        const { body } = await search("alph");

        // Assert
        expect(body.map((row) => row.id)).toEqual([a.id]);
    });

    it("シナリオ17: 最後以外の語は完全一致のまま（'alph widget' は 0 件）", async () => {
        // Arrange
        await seedProductSet();

        // Act
        const { body } = await search("alph widget");

        // Assert
        expect(body).toEqual([]);
    });

    it("シナリオ18: tsquery の演算子だけの入力は 200 + 空配列（構文エラーで 500 にしない）", async () => {
        // Arrange
        await seedProductSet();

        // Act
        const { status, body } = await search("&|!():*");

        // Assert
        expect(status).toBe(200);
        expect(body).toEqual([]);
    });
});

describe("サジェスト応答の形と件数（plan 073）", () => {
    it("シナリオ9: 応答は SearchResult 形で、link は先頭バリアントの商品ページ・image は variantImage", async () => {
        // Arrange
        const { a } = await seedProductSet();
        const variant = await db.productVariant.findFirstOrThrow({
            where: { productId: a.id },
        });

        // Act
        const { status, body } = await search("alpha");

        // Assert
        expect(status).toBe(200);
        expect(body).toEqual([
            {
                id: a.id,
                name: a.name,
                link: `/product/${a.slug}/${variant.slug}`,
                image: variant.variantImage,
            },
        ]);
    });

    it("シナリオ10: バリアントの無い商品はリンク先が無いため返さない", async () => {
        // Arrange
        await seedSearchableProduct({
            ...base,
            name: "Orphan Widget",
            description: "no variant yet",
            withVariant: false,
        });

        // Act
        const { body } = await search("orphan");

        // Assert
        expect(body).toEqual([]);
    });

    it("シナリオ11: 件数は 8 件まで。バリアントの無い商品が上位にあっても 8 件が欠けない", async () => {
        // Arrange — 名前に語を含む（rank が高い）バリアント無し商品を 3 件、
        // description にだけ含むバリアント有り商品を 9 件。LIMIT の後で除外する実装だと 5 件に欠ける。
        for (let i = 0; i < 3; i++) {
            await seedSearchableProduct({
                ...base,
                name: `Zircon Zircon ${i}`,
                description: "zircon",
                withVariant: false,
            });
        }
        for (let i = 0; i < 9; i++) {
            await seedSearchableProduct({
                ...base,
                name: `Stone ${i}`,
                description: "zircon",
            });
        }

        // Act
        const { body } = await search("zircon");

        // Assert
        expect(body).toHaveLength(8);
    });

    it("シナリオ12: 同じ関連度の商品は id 昇順で並ぶ（tie-breaker）", async () => {
        // Arrange — name / description が同一なので ts_rank は完全に同点
        const seeded: Product[] = [];
        for (let i = 0; i < 4; i++) {
            seeded.push(
                await seedSearchableProduct({
                    ...base,
                    name: "Twin Item",
                    description: "identical",
                })
            );
        }

        // Act
        const { body } = await search("twin");

        // Assert
        expect(body.map((row) => row.id)).toEqual(
            seeded.map((p) => p.id).sort()
        );
    });

    it("シナリオ13: 互換のため ?search= でも検索できる", async () => {
        // Arrange
        const { a } = await seedProductSet();

        // Act
        const { body } = await search("alpha", "search");

        // Assert
        expect(body.map((row) => row.id)).toEqual([a.id]);
    });
});

describe("getSubcategories(limit, random=true) の raw SQL", () => {
    it("シナリオ8: ORDER BY RANDOM() の raw SQL が実 DB で成立し limit 件返す", async () => {
        // Arrange — beforeEach の 1 件に加えて 2 件（計 3 件）
        const extra = await Promise.all([
            seedCategoryWithSubcategory(db),
            seedCategoryWithSubcategory(db),
        ]);
        const seededIds = new Set([
            base.subCategoryId,
            ...extra.map(({ subCategory }) => subCategory.id),
        ]);
        expect(seededIds.size).toBe(3);

        // Act
        const result = await getSubcategories(2, true);

        // Assert — 順序は RANDOM のため assert しない（件数と id 集合の部分集合性のみ）
        expect(result).toHaveLength(2);
        for (const row of result) {
            expect(seededIds.has(row.id)).toBe(true);
        }
    });
});
