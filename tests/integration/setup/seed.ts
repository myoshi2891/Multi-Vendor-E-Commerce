/**
 * Integration テスト用 DB シードヘルパー。
 *
 * 既存 `src/config/test-fixtures.ts` の shape を踏襲しつつ、メモリ上 fixture ではなく
 * 実 DB へ INSERT する版を提供する。各ヘルパーは `Partial<Override>` を受け取り、
 * 必要最小限のフィールドだけを呼び出し側で上書きできるようにする。
 *
 * 戻り値は Prisma の `findUnique` 相当の完全な型で、後続の関連レコード作成で参照しやすくする。
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - src/config/test-fixtures.ts (in-memory モック版)
 * - prisma/schema.prisma
 */
import {
    Prisma,
    Role,
    ShippingFeeMethod,
    StoreStatus,
    type Cart,
    type CartItem,
    type Category,
    type Country,
    type Coupon,
    type PrismaClient,
    type Product,
    type ProductVariant,
    type ProductVariantImage,
    type ShippingAddress,
    type Size,
    type Store,
    type SubCategory,
    type User,
} from "@prisma/client";
import { randomUUID } from "node:crypto";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// 一意性を担保するための短い接尾辞 (slug / url / sku / email の衝突を避ける)
const uniq = (): string => randomUUID().slice(0, 8);

// ----------------------------------------------------------------------------
// User
/**
 * Create a test user record with a short unique suffix and return the created User.
 *
 * @param overrides - Partial user fields to override the defaults (for example `name`, `email`, `role`)
 * @returns The created `User` record
 */

export async function seedUser(
    db: PrismaClient,
    overrides: Partial<Prisma.UserCreateInput> = {}
): Promise<User> {
    const suffix = uniq();
    return db.user.create({
        data: {
            name: `Test User ${suffix}`,
            email: `user-${suffix}@example.test`,
            picture: "https://example.test/avatar.png",
            role: Role.USER,
            ...overrides,
        },
    });
}

// ----------------------------------------------------------------------------
// Category / SubCategory
/**
 * Create a Category and a SubCategory linked to it in the database for tests.
 *
 * @returns An object with `category` as the created Category and `subCategory` as the created SubCategory whose `categoryId` references `category.id`.
 */

export async function seedCategoryWithSubcategory(
    db: PrismaClient
): Promise<{ category: Category; subCategory: SubCategory }> {
    const suffix = uniq();
    const category = await db.category.create({
        data: {
            name: `Category ${suffix}`,
            image: "https://example.test/category.png",
            url: `category-${suffix}`,
        },
    });
    const subCategory = await db.subCategory.create({
        data: {
            name: `SubCategory ${suffix}`,
            image: "https://example.test/subcategory.png",
            url: `subcategory-${suffix}`,
            categoryId: category.id,
        },
    });
    return { category, subCategory };
}

// ----------------------------------------------------------------------------
// Store
// ----------------------------------------------------------------------------

export interface SeedStoreInput {
    userId: string;
    overrides?: Partial<Prisma.StoreUncheckedCreateInput>;
}

/**
 * Creates and inserts a test Store record with default values and a unique suffix.
 *
 * @param userId - ID of the user who will own the created store
 * @param overrides - Partial fields applied on top of the defaults (merged into the create `data`)
 * @returns The created Store record
 */
export async function seedStore(
    db: PrismaClient,
    { userId, overrides = {} }: SeedStoreInput
): Promise<Store> {
    const suffix = uniq();
    return db.store.create({
        data: {
            name: `Store ${suffix}`,
            description: "Integration test store",
            email: `store-${suffix}@example.test`,
            phone: "000-0000-0000",
            url: `store-${suffix}`,
            logo: "https://example.test/logo.png",
            cover: "https://example.test/cover.png",
            status: StoreStatus.ACTIVE,
            userId,
            ...overrides,
        },
    });
}

// ----------------------------------------------------------------------------
// Product + Variant + Size
// ----------------------------------------------------------------------------

export interface SeedProductInput {
    storeId: string;
    categoryId: string;
    subCategoryId: string;
    /** 商品レベルの配送方式。Cart→Checkout の shipping 計算検証で重要 */
    shippingFeeMethod?: ShippingFeeMethod;
    /** Variant の重さ (WEIGHT 方式で利用) */
    weight?: number;
    /** Size 1 件あたりの価格 */
    sizePrice?: number;
    /** Size 在庫 */
    sizeQuantity?: number;
}

/**
 * Create a Product with a ProductVariant, a Size, and one ProductVariantImage, inserting all four records into the database.
 *
 * Ensures a variant image is created because the application code expects `variant.images[0].url` to exist during order flows.
 *
 * @param input - Creation inputs. Required: `storeId`, `categoryId`, `subCategoryId`. Optional: `shippingFeeMethod` (defaults to `ShippingFeeMethod.ITEM`), `weight` for the variant (defaults to `1`), `sizePrice` (defaults to `100`), and `sizeQuantity` (defaults to `10`).
 * @returns An object containing the created `product`, its `variant`, the associated `size`, and the created variant `image`.
 */
export async function seedProductWithVariantAndSize(
    db: PrismaClient,
    input: SeedProductInput
): Promise<{
    product: Product;
    variant: ProductVariant;
    size: Size;
    image: ProductVariantImage;
}> {
    const suffix = uniq();
    const product = await db.product.create({
        data: {
            name: `Product ${suffix}`,
            description: "Integration test product",
            slug: `product-${suffix}`,
            brand: "TestBrand",
            shippingFeeMethod: input.shippingFeeMethod ?? ShippingFeeMethod.ITEM,
            storeId: input.storeId,
            categoryId: input.categoryId,
            subCategoryId: input.subCategoryId,
        },
    });

    const variant = await db.productVariant.create({
        data: {
            variantName: `Variant ${suffix}`,
            variantImage: "https://example.test/variant.png",
            slug: `variant-${suffix}`,
            sku: `SKU-${suffix.toUpperCase()}`,
            weight: input.weight ?? 1,
            productId: product.id,
        },
    });

    const size = await db.size.create({
        data: {
            size: "M",
            quantity: input.sizeQuantity ?? 10,
            price: new Prisma.Decimal(input.sizePrice ?? 100),
            productVariantId: variant.id,
        },
    });

    // placeOrder が参照する variant.images[0].url を満たすため画像を 1 件作成
    const image = await db.productVariantImage.create({
        data: {
            url: `https://example.test/variant-${suffix}.png`,
            alt: `Variant ${suffix} image`,
            productVariantId: variant.id,
        },
    });

    return { product, variant, size, image };
}

// ----------------------------------------------------------------------------
// Coupon
// ----------------------------------------------------------------------------

export interface SeedCouponInput {
    storeId: string;
    /** 割引率 (0-100)。Coupon.discount は Int */
    discount?: number;
    /** 有効期間。デフォルトは過去 1 日〜未来 1 年 */
    startDate?: string;
    endDate?: string;
    /** 一意な code をテストごとに作るため接尾辞を制御したい場合 */
    code?: string;
    /** Coupon に紐付ける User (many-to-many)。未指定なら紐付けなし */
    connectUserIds?: string[];
}

/**
 * Creates and inserts a coupon record with sensible defaults for testing.
 *
 * The returned value is the created Coupon record.
 *
 * Detailed behavior:
 * - `code` defaults to `COUPON-<SUFFIX>` when `input.code` is not provided.
 * - `startDate` defaults to 24 hours in the past and `endDate` defaults to one year from now when not provided.
 * - `discount` defaults to `10` when not provided.
 * - If `input.connectUserIds` is provided and non-empty, the coupon will be connected to those users; otherwise no user connections are made.
 *
 * @param input - SeedCouponInput describing required `storeId` and optional fields (`discount`, `startDate`, `endDate`, `code`, `connectUserIds`) and their defaulting behavior
 */
export async function seedCoupon(
    db: PrismaClient,
    input: SeedCouponInput
): Promise<Coupon> {
    const suffix = uniq();
    const now = Date.now();
    return db.coupon.create({
        data: {
            code: input.code ?? `COUPON-${suffix.toUpperCase()}`,
            startDate:
                input.startDate ?? new Date(now - 24 * 60 * 60 * 1000).toISOString(),
            endDate:
                input.endDate ?? new Date(now + ONE_YEAR_MS).toISOString(),
            discount: input.discount ?? 10,
            storeId: input.storeId,
            users: input.connectUserIds && input.connectUserIds.length > 0
                ? { connect: input.connectUserIds.map((id) => ({ id })) }
                : undefined,
        },
    });
}

// ----------------------------------------------------------------------------
// Cart + CartItem
// ----------------------------------------------------------------------------

export interface SeedCartInput {
    userId: string;
    couponId?: string;
    subTotal?: number;
    shippingFees?: number;
    total?: number;
}

/**
 * Create and persist a cart record using the provided input.
 *
 * @param input - Seed data: must include `userId`; optional `couponId`. Numeric `subTotal`, `shippingFees`, and `total` default to 0 when omitted and are stored as decimals.
 * @returns The created Cart record
 */
export async function seedCart(
    db: PrismaClient,
    input: SeedCartInput
): Promise<Cart> {
    return db.cart.create({
        data: {
            userId: input.userId,
            couponId: input.couponId,
            subTotal: new Prisma.Decimal(input.subTotal ?? 0),
            shippingFees: new Prisma.Decimal(input.shippingFees ?? 0),
            total: new Prisma.Decimal(input.total ?? 0),
        },
    });
}

export interface SeedCartItemInput {
    cartId: string;
    storeId: string;
    product: Product;
    variant: ProductVariant;
    size: Size;
    quantity?: number;
    /** 行ごとの送料 (test side で computeShippingTotal で計算した値を入れることが多い) */
    shippingFee?: number;
}

/**
 * Create and persist a cart item with a snapshot of product/variant/size data and computed totals.
 *
 * @param input - Seed data containing `cartId`, `storeId`, `product`, `variant`, `size`, and optional `quantity` and `shippingFee`. The unit price is taken from `size.price`.
 * @returns The created `CartItem` record with `price`, `quantity`, `shippingFee`, and `totalPrice` (calculated as `price * quantity + shippingFee`).
 */
export async function seedCartItem(
    db: PrismaClient,
    input: SeedCartItemInput
): Promise<CartItem> {
    const quantity = input.quantity ?? 1;
    const unitPrice = input.size.price;
    const shippingFee = new Prisma.Decimal(input.shippingFee ?? 0);
    const lineTotal = unitPrice.mul(quantity).add(shippingFee);

    return db.cartItem.create({
        data: {
            cartId: input.cartId,
            storeId: input.storeId,
            productId: input.product.id,
            variantId: input.variant.id,
            sizeId: input.size.id,
            productSlug: input.product.slug,
            variantSlug: input.variant.slug,
            sku: input.variant.sku,
            name: `${input.product.name} - ${input.variant.variantName}`,
            image: input.variant.variantImage,
            size: input.size.size,
            price: unitPrice,
            quantity,
            shippingFee,
            totalPrice: lineTotal,
        },
    });
}

// ----------------------------------------------------------------------------
// Country
/**
 * Create and insert a Country record with a short unique suffix applied to the name and code.
 *
 * The default `name` is `Country <SUFFIX>` and the default `code` is `C${SUFFIX}` (suffix 全体の前に 'C' を付けたもの); any fields in `overrides` are merged into the create data.
 *
 * WARNING (BREAKING CHANGE):
 * The `code` format was changed to a 9-character format (`C${SUFFIX}`). This is a breaking change because:
 * 1. Existing tests that expect a standard 2 or 3-character ISO country code will fail due to mismatching format expectations.
 * 2. The `CountrySelector` component resolves flag URLs using the country code (e.g., via `flag-icons` stylesheets). A 9-character code format will fail flag URL resolution in `CountrySelector`.
 * Recommended action:
 * Update test suites to accept the suffix code pattern or pass an overrides dictionary matching expected formats.
 *
 * @param overrides - Partial fields to merge into the created Country record (applies on top of the defaults)
 * @returns The created `Country` record
 */

export async function seedCountry(
    db: PrismaClient,
    overrides: Partial<Prisma.CountryCreateInput> = {}
): Promise<Country> {
    const suffix = uniq().toUpperCase();
    return db.country.create({
        data: {
            name: `Country ${suffix}`,
            code: `C${suffix}`,
            ...overrides,
        },
    });
}

// ----------------------------------------------------------------------------
// ShippingAddress
// ----------------------------------------------------------------------------

export interface SeedShippingAddressInput {
    userId: string;
    countryId: string;
    overrides?: Partial<Prisma.ShippingAddressUncheckedCreateInput>;
}

/**
 * Create a persistent ShippingAddress for a given user and country to use in integration tests.
 *
 * This address is suitable for use by `placeOrder`, which resolves shipping details from the
 * shipping address `id` and `countryId`.
 *
 * @param input - Seed data: required `userId` and `countryId`; optional `overrides` merged into the created record.
 * @returns The created `ShippingAddress` record
 */
export async function seedShippingAddress(
    db: PrismaClient,
    { userId, countryId, overrides = {} }: SeedShippingAddressInput
): Promise<ShippingAddress> {
    const suffix = uniq();
    return db.shippingAddress.create({
        data: {
            firstName: "Test",
            lastName: `Buyer ${suffix}`,
            phone: "000-0000-0000",
            address1: "1 Integration Way",
            state: "Test State",
            city: "Test City",
            zip_code: "00000",
            userId,
            countryId,
            ...overrides,
        },
    });
}
