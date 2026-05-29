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
// ----------------------------------------------------------------------------

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
// ----------------------------------------------------------------------------

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

export async function seedProductWithVariantAndSize(
    db: PrismaClient,
    input: SeedProductInput
): Promise<{ product: Product; variant: ProductVariant; size: Size }> {
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

    return { product, variant, size };
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
// ----------------------------------------------------------------------------

export async function seedCountry(
    db: PrismaClient,
    overrides: Partial<Prisma.CountryCreateInput> = {}
): Promise<Country> {
    const suffix = uniq().toUpperCase();
    return db.country.create({
        data: {
            name: `Country ${suffix}`,
            code: `C${suffix.slice(0, 2)}`,
            ...overrides,
        },
    });
}
