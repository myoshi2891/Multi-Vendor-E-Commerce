/**
 * Integration テスト用 DB リセットヘルパー。
 *
 * 各 `describe` の `beforeEach` で呼び、関連テーブルを TRUNCATE ... RESTART IDENTITY CASCADE
 * する。テーブル列挙は prisma/schema.prisma を SSOT とし、本ファイルでは
 * Integration tier で触れる可能性が高いテーブルを `APPLICATION_TABLES` (現在 26 件) に
 * 列挙している。件数は配列定義を直接参照すること (このコメントは目安)。
 *
 * パフォーマンス特性:
 *   - 1 TRUNCATE ALL クエリで完結 (50ms 程度)
 *   - 個別 DELETE より 5-10x 速い
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - prisma/schema.prisma
 */
import type { PrismaClient } from "@prisma/client";

/**
 * 対象テーブル一覧。順序は CASCADE 依存解決により任意で良い。
 * Country は SEED として共有することが多いため除外し、各テストでクリアしたい場合は
 * `resetDb(db, { includeReferenceData: true })` を渡す。
 */
const APPLICATION_TABLES = [
    "Wishlist",
    "Review",
    "ReviewImage",
    "Question",
    "PaymentDetails",
    "OrderItem",
    "OrderGroup",
    "Order",
    "CartItem",
    "Cart",
    "Coupon",
    "FreeShippingCountry",
    "FreeShipping",
    "ShippingRate",
    "ShippingAddress",
    "Spec",
    "ProductVariantImage",
    "ProductVariant",
    "Product",
    "Size",
    "Color",
    "Store",
    "SubCategory",
    "Category",
    "OfferTag",
    "User",
] as const;

const REFERENCE_TABLES = ["Country"] as const;

export interface ResetDbOptions {
    /** Country テーブル等のリファレンスデータも消す場合は true */
    includeReferenceData?: boolean;
}

/**
 * 関連テーブルを TRUNCATE ... RESTART IDENTITY CASCADE する。
 *
 * @example
 *   beforeEach(async () => {
 *     await resetDb(db);
 *   });
 */
export async function resetDb(
    db: PrismaClient,
    options: ResetDbOptions = {}
): Promise<void> {
    const tables = options.includeReferenceData
        ? [...APPLICATION_TABLES, ...REFERENCE_TABLES]
        : APPLICATION_TABLES;

    // PostgreSQL の単一 TRUNCATE 文で全テーブルを一気にリセットする。
    // テーブル名はダブルクォートで quote (Prisma が PascalCase を引用識別子として扱うため)。
    const quoted = tables.map((name) => `"${name}"`).join(", ");
    await db.$executeRawUnsafe(
        `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`
    );
}
