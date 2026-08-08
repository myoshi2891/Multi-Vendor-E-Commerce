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
 *     variant / size は検索 SQL に不要。
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
    description: string | null;
    relevance: number;
};

let db: PrismaClient;
let base: { storeId: string; categoryId: string; subCategoryId: string };

/** `?q=...` 付きの GET。通常ケースはすべてこちらを使う。 */
async function search(
    q: string
): Promise<{ status: number; body: SearchRow[] }> {
    const res = await GET(
        new Request(
            `http://localhost:3000/api/search-products?q=${encodeURIComponent(q)}`
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

/** name / description を呼び出し側が完全に制御できる Product を 1 件作る。 */
async function seedSearchableProduct(input: {
    name: string;
    description: string;
    storeId: string;
    categoryId: string;
    subCategoryId: string;
}): Promise<Product> {
    return db.product.create({
        data: {
            ...input,
            slug: `search-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            brand: "TestBrand",
        },
    });
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

    it("シナリオ3: ts_rank による関連度の降順で並ぶ（出現頻度の高い B が先頭）", async () => {
        // Arrange
        const { a, b } = await seedProductSet();

        // Act
        const { status, body } = await search("widget");

        // Assert
        expect(status).toBe(200);
        expect(body).toHaveLength(2);
        expect(body.map((row) => row.id)).toEqual([b.id, a.id]);
        // relevance は number で降順
        expect(typeof body[0].relevance).toBe("number");
        expect(body[0].relevance).toBeGreaterThan(body[1].relevance);
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
