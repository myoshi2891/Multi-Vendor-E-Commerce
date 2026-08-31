/**
 * カテゴリツリー Phase A のデータ移行 統合テスト (plan 066 / V-3・V-4)
 *
 * 検証対象は `prisma/migrations/*_category_tree_phase_a/migration.sql` の
 * `PHASE_A_DATA_MOVE` 区間（A-1〜A-6）である。**マイグレーション本体を SSOT として
 * そのまま読み出して実行する** —— SQL をテスト側に写経すると、片方だけ直したときに
 * 「テストは緑だが本番の移行は壊れている」状態になる。
 *
 * なぜテスト側で明示的に実行するのか:
 * globalSetup (`setup/container.ts`) は `prisma migrate deploy` を**空 DB** に掛けるため、
 * DML はそこでは常に no-op として通過する。移行そのものを検証するには、旧形状の
 * データを投入したうえで同じ SQL を能動的に再実行するしかない。
 *
 * TDD の Red: design.md §4 の「概略」SQL（素の `INSERT ... SELECT FROM "SubCategory"`）を
 * 使い捨ての PostgreSQL で 2 回実行すると
 * `duplicate key value violates unique constraint "Category_pkey"` で落ちることを実測した。
 * 冪等性は後付けの願望ではなく、この失敗を潰すために DO ブロック化した結果である。
 *
 * 関連:
 * - ADR-006: docs/architecture/decisions/006-category-tree-representation.md
 * - docs/design/category-tree/design.md §2-Q2（統合と slug）/ §4（移行 SQL）/ §5（V-3・V-4）
 * - plans/066-implement-category-tree-schema.md
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { disconnectTestDb, getTestDb } from "./setup/db";
import { resetDb } from "./setup/reset-db";

// ----------------------------------------------------------------------------
// マイグレーション本体から DML 区間を取り出す
// ----------------------------------------------------------------------------

const START_MARKER = "-- >>> PHASE_A_DATA_MOVE >>>";
const END_MARKER = "-- <<< PHASE_A_DATA_MOVE <<<";

/** Phase A のマイグレーション SQL 全文を読む。 */
function readPhaseAMigration(): string {
    const root = join(process.cwd(), "prisma", "migrations");
    const dir = readdirSync(root).find((d) =>
        d.endsWith("_category_tree_phase_a")
    );
    if (!dir) {
        throw new Error(
            "category_tree_phase_a のマイグレーションが見つかりません"
        );
    }
    return readFileSync(join(root, dir, "migration.sql"), "utf-8");
}

/**
 * マーカーで囲まれた DML 区間だけを抜き出す。
 *
 * DDL を巻き込むと 2 回目の実行が `CREATE TYPE ... already exists` で落ちるため、
 * 「再実行できる区間」をマイグレーション側で明示している前提に依存している。
 */
function extractDataMove(sql: string): string {
    const start = sql.indexOf(START_MARKER);
    const end = sql.indexOf(END_MARKER);
    if (start === -1 || end === -1) {
        throw new Error("PHASE_A_DATA_MOVE マーカーが見つかりません");
    }
    return sql.slice(start + START_MARKER.length, end);
}

/**
 * SQL を文単位に分割する。
 *
 * Prisma の `$executeRawUnsafe` は 1 呼び出し 1 文しか受け付けない。素朴に `;` で
 * split すると A-3 の `DO $PHASE_A$ ... $PHASE_A$` が内部のセミコロンで刻まれるので、
 * ドル引用符・単一引用符・行コメントを跨がない位置でだけ切る。
 */
function splitStatements(sql: string): string[] {
    const statements: string[] = [];
    let buffer = "";
    let dollarTag: string | null = null;
    let inSingleQuote = false;
    let inLineComment = false;
    let i = 0;

    while (i < sql.length) {
        const rest = sql.slice(i);
        const char = sql[i];

        if (inLineComment) {
            buffer += char;
            if (char === "\n") inLineComment = false;
            i += 1;
            continue;
        }
        if (dollarTag !== null) {
            if (rest.startsWith(dollarTag)) {
                buffer += dollarTag;
                i += dollarTag.length;
                dollarTag = null;
                continue;
            }
            buffer += char;
            i += 1;
            continue;
        }
        if (inSingleQuote) {
            buffer += char;
            if (char === "'") inSingleQuote = false;
            i += 1;
            continue;
        }
        if (rest.startsWith("--")) {
            inLineComment = true;
            buffer += char;
            i += 1;
            continue;
        }
        if (char === "'") {
            inSingleQuote = true;
            buffer += char;
            i += 1;
            continue;
        }
        const dollarOpen = /^\$[A-Za-z_]*\$/.exec(rest);
        if (dollarOpen) {
            dollarTag = dollarOpen[0];
            buffer += dollarTag;
            i += dollarTag.length;
            continue;
        }
        if (char === ";") {
            statements.push(buffer);
            buffer = "";
            i += 1;
            continue;
        }
        buffer += char;
        i += 1;
    }
    statements.push(buffer);

    return statements
        .map((s) => s.trim())
        .filter((s) => {
            const withoutComments = s
                .split("\n")
                .filter((line) => !line.trim().startsWith("--"))
                .join("\n")
                .trim();
            return withoutComments.length > 0;
        });
}

const DATA_MOVE_STATEMENTS = splitStatements(
    extractDataMove(readPhaseAMigration())
);

/** Phase A のデータ移行を 1 回実行する。 */
async function runDataMove(db: PrismaClient): Promise<void> {
    for (const statement of DATA_MOVE_STATEMENTS) {
        await db.$executeRawUnsafe(statement);
    }
}

// ----------------------------------------------------------------------------
// 旧形状（統合前）のデータを投入するヘルパー
// ----------------------------------------------------------------------------

/**
 * 移行前の Category 行を作る。
 *
 * `path` は移行後の schema では NOT NULL なので NULL では入れられない。代わりに
 * **わざと誤った値**を入れて、A-1 が `path = url` / `depth = 0` へ正すことを検証する。
 */
async function seedLegacyRoot(
    db: PrismaClient,
    id: string,
    url: string
): Promise<void> {
    await db.$executeRaw`
        INSERT INTO "Category" (id, name, image, url, featured, "path", "depth", "sortOrder", "childCount", "createdAt", "updatedAt")
        VALUES (${id}, ${`Name ${url}`}, 'https://example.test/c.png', ${url}, false,
                'STALE', 9, 0, 0, NOW(), NOW())`;
}

async function seedLegacySubCategory(
    db: PrismaClient,
    id: string,
    url: string,
    categoryId: string,
    createdAt: Date
): Promise<void> {
    await db.$executeRaw`
        INSERT INTO "SubCategory" (id, name, image, url, featured, "categoryId", "createdAt", "updatedAt")
        VALUES (${id}, ${`Name ${url}`}, 'https://example.test/s.png', ${url}, false,
                ${categoryId}, ${createdAt}, ${createdAt})`;
}

/** 検証用のスナップショット（順序を固定して 2 回の実行結果を比較できるようにする）。 */
async function snapshot(db: PrismaClient) {
    const categories = await db.category.findMany({
        orderBy: { id: "asc" },
        select: {
            id: true,
            url: true,
            path: true,
            depth: true,
            parentId: true,
            childCount: true,
        },
    });
    const aliases = await db.categorySlugAlias.findMany({
        orderBy: [{ entityType: "asc" }, { oldSlug: "asc" }],
        select: { entityType: true, oldSlug: true, categoryId: true },
    });
    return { categories, aliases };
}

// ----------------------------------------------------------------------------

describe("カテゴリツリー Phase A のデータ移行", () => {
    let db: PrismaClient;

    beforeAll(() => {
        db = getTestDb();
    });

    afterAll(async () => {
        await disconnectTestDb();
    });

    beforeEach(async () => {
        await resetDb(getTestDb());
    });

    it("マイグレーション本体から DML 区間を抽出できること", () => {
        // 抽出に失敗していると以降のテストが「何も実行していないのに緑」になるため、
        // 区間そのものの存在を先に固定する。
        expect(DATA_MOVE_STATEMENTS.length).toBeGreaterThanOrEqual(5);

        // 各文はコメント行で始まるので、判定は実コード部分に対して行う
        const code = DATA_MOVE_STATEMENTS.map((s) =>
            s
                .split("\n")
                .filter((line) => !line.trim().startsWith("--"))
                .join("\n")
                .trim()
        );
        // A-3 の DO ブロックが内部のセミコロンで刻まれていないこと
        expect(
            code.some((s) => s.startsWith("DO ") && s.includes("$PHASE_A$"))
        ).toBe(true);
        // DDL を巻き込んでいたら 2 回目の実行で必ず落ちる
        expect(code.some((s) => /^(CREATE|ALTER|DROP)\b/i.test(s))).toBe(false);
    });

    it("A-1: ルートの path / depth が url / 0 へ正規化されること", async () => {
        await seedLegacyRoot(db, "root-a", "electronics");

        await runDataMove(db);

        const root = await db.category.findUniqueOrThrow({
            where: { id: "root-a" },
        });
        expect(root.path).toBe("electronics");
        expect(root.depth).toBe(0);
    });

    it("A-3: SubCategory が子ノードとして取り込まれ、id が共有されること", async () => {
        await seedLegacyRoot(db, "root-a", "electronics");
        await seedLegacySubCategory(
            db,
            "sub-lens",
            "lens",
            "root-a",
            new Date("2024-02-01")
        );

        await runDataMove(db);

        // id を流用しているので、A-6 の backfill が単純な列コピーで済む
        const child = await db.category.findUniqueOrThrow({
            where: { id: "sub-lens" },
        });
        expect(child.url).toBe("lens");
        expect(child.parentId).toBe("root-a");
        expect(child.depth).toBe(1);
        expect(child.path).toBe("electronics/lens");
    });

    it("衝突: SubCategory 側がリネームされ、alias 2 行が共存すること", async () => {
        // 統合前は Category.url と SubCategory.url が別テーブルの別 unique なので、
        // 同一 slug の共存が合法だった。ここが移行で P2002 を踏み得る唯一の点。
        await seedLegacyRoot(db, "root-a", "electronics");
        await seedLegacyRoot(db, "root-camera", "camera");
        await seedLegacySubCategory(
            db,
            "sub-camera",
            "camera",
            "root-a",
            new Date("2024-02-01")
        );

        await runDataMove(db);

        // 上位 URL を温存し、SubCategory 由来の側を <親slug>-<旧slug> へ寄せる
        const renamed = await db.category.findUniqueOrThrow({
            where: { id: "sub-camera" },
        });
        expect(renamed.url).toBe("electronics-camera");
        expect(renamed.path).toBe("electronics/electronics-camera");

        const root = await db.category.findUniqueOrThrow({
            where: { id: "root-camera" },
        });
        expect(root.url).toBe("camera");

        // キーが (entityType, oldSlug) なので "camera" が 2 行共存できる。
        // oldSlug 単体キーだったら、この表が存在する理由そのものである
        // リネーム対象ペアが引けなくなる（design.md §2-Q2-3）。
        const cameraAliases = await db.categorySlugAlias.findMany({
            where: { oldSlug: "camera" },
            orderBy: { entityType: "asc" },
        });
        expect(cameraAliases).toHaveLength(2);
        expect(cameraAliases.map((a) => [a.entityType, a.categoryId])).toEqual([
            ["CATEGORY", "root-camera"],
            ["SUB_CATEGORY", "sub-camera"],
        ]);
    });

    it("衝突: <親slug>-<旧slug> も埋まっている場合は最初の空き番号が採られること", async () => {
        await seedLegacyRoot(db, "root-a", "electronics");
        await seedLegacyRoot(db, "root-camera", "camera");
        // リネーム先の第一候補を先に塞いでおく
        await seedLegacyRoot(db, "root-taken", "electronics-camera");
        await seedLegacySubCategory(
            db,
            "sub-camera",
            "camera",
            "root-a",
            new Date("2024-02-01")
        );

        await runDataMove(db);

        const renamed = await db.category.findUniqueOrThrow({
            where: { id: "sub-camera" },
        });
        expect(renamed.url).toBe("electronics-camera-2");
    });

    it("V-3: 移行を 2 回実行しても結果が変わらないこと（冪等性）", async () => {
        await seedLegacyRoot(db, "root-a", "electronics");
        await seedLegacyRoot(db, "root-camera", "camera");
        await seedLegacySubCategory(
            db,
            "sub-camera",
            "camera",
            "root-a",
            new Date("2024-02-01")
        );
        await seedLegacySubCategory(
            db,
            "sub-lens",
            "lens",
            "root-a",
            new Date("2024-02-02")
        );

        await runDataMove(db);
        const first = await snapshot(db);

        await runDataMove(db);
        const second = await snapshot(db);

        // 素の INSERT ... SELECT では 2 回目が PK 衝突で落ちる。
        // ここが緑であることが「移行を再実行しても安全」の根拠になる。
        expect(second).toEqual(first);
        expect(first.categories).toHaveLength(4);
    });

    it("V-4: childCount が再計算値と一致すること", async () => {
        await seedLegacyRoot(db, "root-a", "electronics");
        await seedLegacyRoot(db, "root-empty", "empty");
        await seedLegacySubCategory(
            db,
            "sub-lens",
            "lens",
            "root-a",
            new Date("2024-02-01")
        );
        await seedLegacySubCategory(
            db,
            "sub-tripod",
            "tripod",
            "root-a",
            new Date("2024-02-02")
        );

        await runDataMove(db);

        const drift = await db.$queryRaw<{ n: bigint }[]>`
            SELECT count(*) AS n FROM "Category" p
            WHERE p."childCount" <> (
                SELECT count(*) FROM "Category" ch WHERE ch."parentId" = p.id
            )`;
        expect(Number(drift[0].n)).toBe(0);

        const withChildren = await db.category.findUniqueOrThrow({
            where: { id: "root-a" },
        });
        expect(withChildren.childCount).toBe(2);

        const leafRoot = await db.category.findUniqueOrThrow({
            where: { id: "root-empty" },
        });
        expect(leafRoot.childCount).toBe(0);
    });

    it("A-5: 子が消えていた場合も childCount のドリフトが残らないこと", async () => {
        await seedLegacyRoot(db, "root-a", "electronics");
        await seedLegacySubCategory(
            db,
            "sub-lens",
            "lens",
            "root-a",
            new Date("2024-02-01")
        );
        await runDataMove(db);

        // 差分更新ではなく全件再計算にしてあるので、子の削除にも追随する
        await db.category.delete({ where: { id: "sub-lens" } });
        await db.subCategory.delete({ where: { id: "sub-lens" } });
        await runDataMove(db);

        const root = await db.category.findUniqueOrThrow({
            where: { id: "root-a" },
        });
        expect(root.childCount).toBe(0);
    });

    it("A-6: Product.categoryNodeId が subCategoryId から backfill されること", async () => {
        await seedLegacyRoot(db, "root-a", "electronics");
        await seedLegacySubCategory(
            db,
            "sub-lens",
            "lens",
            "root-a",
            new Date("2024-02-01")
        );
        await db.$executeRaw`
            INSERT INTO "User" (id, name, email, picture, role, "createdAt", "updatedAt")
            VALUES ('user-a', 'Owner', 'owner@example.test', 'https://example.test/p.png', 'SELLER', NOW(), NOW())`;
        await db.$executeRaw`
            INSERT INTO "Store" (id, name, description, email, phone, url, logo, cover, status, "userId", "createdAt", "updatedAt")
            VALUES ('store-a', 'Store', 'desc', 'store@example.test', '000', 'store-a',
                    'https://example.test/l.png', 'https://example.test/c.png', 'ACTIVE', 'user-a', NOW(), NOW())`;
        await db.$executeRaw`
            INSERT INTO "Product" (id, name, description, slug, brand, rating, "numReviews", "shippingFeeMethod",
                                   views, sales, "storeId", "categoryId", "subCategoryId", "categoryNodeId", "createdAt", "updatedAt")
            VALUES ('prod-a', 'Product', 'desc', 'product-a', 'Brand', 0, 0, 'ITEM',
                    0, 0, 'store-a', 'root-a', 'sub-lens', NULL, NOW(), NOW())`;

        await runDataMove(db);

        const product = await db.product.findUniqueOrThrow({
            where: { id: "prod-a" },
        });
        expect(product.categoryNodeId).toBe("sub-lens");
        expect(product.categoryNodeId).toBe(product.subCategoryId);
    });
});
