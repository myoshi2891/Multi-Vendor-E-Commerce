/**
 * カテゴリツリー Phase B の再同期 統合テスト (plan 067)
 *
 * 検証対象は `prisma/migrations/*_category_tree_phase_b_resync/migration.sql` の
 * `PHASE_B_RESYNC` 区間。Phase A と同じく**マイグレーション本体を SSOT として
 * 読み出してそのまま実行する**（写経すると片方だけ直す事故が起きる）。
 *
 * なぜ再同期が「読み取り切替の前提」なのか:
 * 066 の backfill は一度きりで、Phase A の書き込み経路は `categoryNodeId` を一切
 * 書かない。066 適用後に作成・カテゴリ変更された商品は新 FK が NULL / 旧値のまま
 * 残るため、先に読み取りを切り替えるとその商品が**静かに消える**。
 *
 * **新規行の追加だけを検証して合格にしないこと。** 066 適用後には rename・親付け替え・
 * featured 変更も起きており、`WHERE NOT EXISTS` の INSERT はそれらを一切拾わない。
 * stale な path を残したまま読み取りを切り替えると、その枝の商品が祖先フィルタから
 * 静かに落ちる（path は全サブツリー検索の prefix キーであるため）。
 *
 * 関連:
 * - docs/design/category-tree/design.md §2-Q2 / §4
 * - plans/067-implement-category-tree-queries.md（Done criteria の再同期 SQL）
 */

import type { PrismaClient } from "@prisma/client";
import { disconnectTestDb, getTestDb } from "./setup/db";
import {
    extractMarkedSection,
    readMigrationSql,
    runStatements,
    splitStatements,
} from "./setup/migration-sql";
import { resetDb } from "./setup/reset-db";

const RESYNC_STATEMENTS = splitStatements(
    extractMarkedSection(
        readMigrationSql("_category_tree_phase_b_resync"),
        "PHASE_B_RESYNC"
    )
);

/** 再同期を 1 回実行する。 */
async function runResync(db: PrismaClient): Promise<void> {
    await runStatements(db, RESYNC_STATEMENTS);
}

/** ルート Category を 1 行作る（移行済みの形）。 */
async function seedRoot(
    db: PrismaClient,
    id: string,
    url: string
): Promise<void> {
    await db.$executeRaw`
        INSERT INTO "Category" (id, name, image, url, featured, "path", "depth", "sortOrder", "childCount", "createdAt", "updatedAt")
        VALUES (${id}, ${`Name ${url}`}, 'https://example.test/c.png', ${url}, false,
                ${url}, 0, 0, 0, NOW(), NOW())`;
}

/** legacy SubCategory を 1 行作る。 */
async function seedSubCategory(
    db: PrismaClient,
    id: string,
    url: string,
    categoryId: string,
    options: { featured?: boolean; name?: string } = {}
): Promise<void> {
    await db.$executeRaw`
        INSERT INTO "SubCategory" (id, name, image, url, featured, "categoryId", "createdAt", "updatedAt")
        VALUES (${id}, ${options.name ?? `Name ${url}`}, 'https://example.test/s.png', ${url},
                ${options.featured ?? false}, ${categoryId}, NOW(), NOW())`;
}

/** Product を作るのに必要な User + Store を 1 組作る。 */
async function seedStoreOwner(db: PrismaClient): Promise<void> {
    await db.$executeRaw`
        INSERT INTO "User" (id, name, email, picture, role, "createdAt", "updatedAt")
        VALUES ('user-1', 'Owner', 'owner@example.test', 'https://example.test/p.png', 'SELLER', NOW(), NOW())`;
    await db.$executeRaw`
        INSERT INTO "Store" (id, name, description, email, phone, url, logo, cover, status, "userId", "createdAt", "updatedAt")
        VALUES ('store-1', 'Store', 'desc', 'store@example.test', '000', 'store-1',
                'https://example.test/l.png', 'https://example.test/c.png', 'ACTIVE', 'user-1', NOW(), NOW())`;
}

/**
 * Product を 1 行作る。`categoryNodeId` は明示的に渡す（NULL / stale を作り分けるため）。
 * NULL 以外を渡す場合、その id の Category ノードが既に存在している必要がある（FK）。
 */
async function seedProduct(
    db: PrismaClient,
    id: string,
    rootId: string,
    subCategoryId: string,
    categoryNodeId: string | null
): Promise<void> {
    await db.$executeRaw`
        INSERT INTO "Product" (id, name, description, slug, brand, rating, "numReviews", "shippingFeeMethod",
                               views, sales, "storeId", "categoryId", "subCategoryId", "categoryNodeId", "createdAt", "updatedAt")
        VALUES (${id}, ${`Product ${id}`}, 'desc', ${`product-${id}`}, 'Brand', 0, 0, 'ITEM',
                0, 0, 'store-1', ${rootId}, ${subCategoryId}, ${categoryNodeId}, NOW(), NOW())`;
}

describe("カテゴリツリー Phase B — 再同期 (plan 067)", () => {
    let db: PrismaClient;

    beforeAll(() => {
        db = getTestDb();
    });

    beforeEach(async () => {
        await resetDb(db);
    });

    afterAll(async () => {
        await disconnectTestDb();
    });

    it("066 適用後に追加された SubCategory を Category ノードとして取り込む", async () => {
        // Arrange —— ルートは移行済み、子は移行後に追加された
        await seedRoot(db, "root-1", "electronics");
        await seedSubCategory(db, "sub-new", "camera", "root-1");

        // Act
        await runResync(db);

        // Assert
        const node = await db.category.findUnique({ where: { id: "sub-new" } });
        expect(node).toMatchObject({
            parentId: "root-1",
            url: "camera",
            path: "electronics/camera",
            depth: 1,
        });
    });

    it("既存ノードの rename / 親付け替え / featured 変更を追随する", async () => {
        // Arrange —— 一度取り込んだあとに legacy 側を書き換える
        await seedRoot(db, "root-1", "electronics");
        await seedRoot(db, "root-2", "toys");
        await seedSubCategory(db, "sub-1", "camera", "root-1");
        await runResync(db);

        await db.$executeRaw`
            UPDATE "SubCategory"
            SET url = 'camcorder', name = 'Camcorder', featured = true, "categoryId" = 'root-2'
            WHERE id = 'sub-1'`;

        // Act —— 新規行の追加だけでは、この変更は 1 つも反映されない
        await runResync(db);

        // Assert
        const node = await db.category.findUnique({ where: { id: "sub-1" } });
        expect(node).toMatchObject({
            url: "camcorder",
            name: "Camcorder",
            featured: true,
            parentId: "root-2",
            // path は親の変更と rename の**両方**を反映していること。
            // 片方だけだと祖先フィルタの prefix が外れ、枝が静かに落ちる。
            path: "toys/camcorder",
        });
    });

    it("rename しても旧 slug の alias 行は残す（旧 URL の 308 到達性）", async () => {
        // Arrange
        await seedRoot(db, "root-1", "electronics");
        await seedSubCategory(db, "sub-1", "camera", "root-1");
        await runResync(db);

        await db.$executeRaw`UPDATE "SubCategory" SET url = 'camcorder' WHERE id = 'sub-1'`;

        // Act
        await runResync(db);

        // Assert —— 旧 slug と新 slug の両方が同じノードを指す
        const aliases = await db.categorySlugAlias.findMany({
            where: { categoryId: "sub-1" },
            orderBy: { oldSlug: "asc" },
        });
        expect(aliases.map((a) => a.oldSlug)).toEqual(["camcorder", "camera"]);
    });

    it("slug 衝突時は <親slug>-<旧slug> へ寄せ、自分自身とは衝突扱いしない", async () => {
        // Arrange —— ルートが子と同じ slug を持つ
        await seedRoot(db, "root-1", "electronics");
        await seedRoot(db, "root-2", "camera");
        await seedSubCategory(db, "sub-1", "camera", "root-1");

        // Act —— 2 回実行する。自分自身を衝突相手から除いていないと、
        // 2 回目に自分の url へ衝突して不要なリネームが走る。
        await runResync(db);
        const first = await db.category.findUnique({ where: { id: "sub-1" } });
        await runResync(db);
        const second = await db.category.findUnique({ where: { id: "sub-1" } });

        // Assert
        expect(first?.url).toBe("electronics-camera");
        expect(second?.url).toBe("electronics-camera");
        expect(second?.path).toBe("electronics/electronics-camera");
    });

    it("2 ノードが url を交換しても、双方が SubCategory 側の url に揃う", async () => {
        // Arrange —— sub-a / sub-b を取り込んだあとで legacy 側の url を交換する
        await seedRoot(db, "root-1", "electronics");
        await seedSubCategory(db, "sub-a", "camera", "root-1");
        await seedSubCategory(db, "sub-b", "audio", "root-1");
        await runResync(db);

        // SubCategory.url も UNIQUE なので、legacy 側の交換自体が 2 段階になる
        // （まさにこの制約が、Category 側にも一時退避を要求している理由）。
        await db.$executeRaw`UPDATE "SubCategory" SET url = 'swap-tmp' WHERE id = 'sub-a'`;
        await db.$executeRaw`UPDATE "SubCategory" SET url = 'camera' WHERE id = 'sub-b'`;
        await db.$executeRaw`UPDATE "SubCategory" SET url = 'audio' WHERE id = 'sub-a'`;

        // Act —— 一時退避が無いと、先に処理される側が「相手がまだ旧 url を持っている」
        // ために衝突扱いされ、<親slug>-<旧slug> へ不要に寄せられる。
        await runResync(db);

        // Assert —— Category.url が SubCategory.url と一致している（片側だけずれない）
        const nodes = await db.category.findMany({
            where: { id: { in: ["sub-a", "sub-b"] } },
            orderBy: { id: "asc" },
            select: { id: true, url: true, path: true },
        });
        expect(nodes).toEqual([
            { id: "sub-a", url: "audio", path: "electronics/audio" },
            { id: "sub-b", url: "camera", path: "electronics/camera" },
        ]);
    });

    it("childCount を全件再計算する（親付け替えで両側が動くため）", async () => {
        // Arrange
        await seedRoot(db, "root-1", "electronics");
        await seedRoot(db, "root-2", "toys");
        await seedSubCategory(db, "sub-1", "camera", "root-1");
        await runResync(db);

        await db.$executeRaw`UPDATE "SubCategory" SET "categoryId" = 'root-2' WHERE id = 'sub-1'`;

        // Act
        await runResync(db);

        // Assert —— 移動元は減り、移動先は増える
        const roots = await db.category.findMany({
            where: { id: { in: ["root-1", "root-2"] } },
            orderBy: { id: "asc" },
            select: { id: true, childCount: true },
        });
        expect(roots).toEqual([
            { id: "root-1", childCount: 0 },
            { id: "root-2", childCount: 1 },
        ]);
    });

    it("066 適用後に作られた商品の NULL な categoryNodeId を埋める", async () => {
        // Arrange —— 066 の一度きりの backfill より後に作られた商品。
        // Phase A の書き込み経路は categoryNodeId を書かないので NULL のまま残る。
        await seedRoot(db, "root-1", "electronics");
        await seedSubCategory(db, "sub-new", "camera", "root-1");
        await seedStoreOwner(db);
        await seedProduct(db, "prod-null", "root-1", "sub-new", null);

        // Act
        await runResync(db);

        // Assert —— 埋まっていないと、読み取り切替後にこの商品が静かに消える
        const product = await db.product.findUniqueOrThrow({
            where: { id: "prod-null" },
        });
        expect(product.categoryNodeId).toBe("sub-new");
    });

    it("066 適用後にカテゴリ変更された商品の stale な categoryNodeId を追随させる", async () => {
        // Arrange —— 一度同期済みの商品のカテゴリを、Phase A の経路で付け替える。
        // 旧 FK だけが動き、新 FK は移行時点の値（stale）のまま取り残される。
        await seedRoot(db, "root-1", "electronics");
        await seedSubCategory(db, "sub-1", "camera", "root-1");
        await seedSubCategory(db, "sub-2", "audio", "root-1");
        await seedStoreOwner(db);
        await runResync(db);
        await seedProduct(db, "prod-stale", "root-1", "sub-1", "sub-1");

        await db.$executeRaw`UPDATE "Product" SET "subCategoryId" = 'sub-2' WHERE id = 'prod-stale'`;

        // Act —— NULL 埋めだけの実装（WHERE categoryNodeId IS NULL）ではこれを拾えない
        await runResync(db);

        // Assert
        const product = await db.product.findUniqueOrThrow({
            where: { id: "prod-stale" },
        });
        expect(product.categoryNodeId).toBe("sub-2");
        expect(product.categoryNodeId).toBe(product.subCategoryId);
    });

    it("再同期は冪等（2 回目で結果が変わらない）", async () => {
        // Arrange
        await seedRoot(db, "root-1", "electronics");
        await seedSubCategory(db, "sub-1", "camera", "root-1");
        await seedSubCategory(db, "sub-2", "audio", "root-1");

        // Act
        await runResync(db);
        const first = await db.category.findMany({
            orderBy: { id: "asc" },
            select: { id: true, url: true, path: true, depth: true, childCount: true },
        });
        await runResync(db);
        const second = await db.category.findMany({
            orderBy: { id: "asc" },
            select: { id: true, url: true, path: true, depth: true, childCount: true },
        });

        // Assert
        expect(second).toEqual(first);
    });
});
