/**
 * 共通テストフィクスチャ
 * 全エンティティのモックデータファクトリ（Partial<T> overridesパターン）
 */

import { Prisma } from "@prisma/client";
import { TEST_CONFIG } from "./test-config";
import { CartProductType } from "@/lib/types";

// 相対日付の基準値（test-scenarios.ts と同パターン、循環依存回避のため独立定義）
const NOW = Date.now();
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// ---- ヘルパー ----

/** テスト用：number も受け入れて Prisma.Decimal に変換 */
type DecimalLike = number | Prisma.Decimal;

/** Decimal フィールドに number も受け入れるよう緩和 */
type RelaxDecimal<T> = {
    [K in keyof T]: T[K] extends Prisma.Decimal ? DecimalLike : T[K];
};

const toDecimal = (v: DecimalLike): Prisma.Decimal =>
    v instanceof Prisma.Decimal ? v : new Prisma.Decimal(String(v));

// ---- 型定義 ----
type MockUser = {
    id: string;
    name: string;
    email: string;
    picture: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
};

type MockStore = {
    id: string;
    name: string;
    description: string;
    email: string;
    phone: string;
    url: string;
    logo: string;
    cover: string;
    status: string;
    featured: boolean;
    averageRating: number;
    numReviews: number;
    defaultShippingService: string;
    defaultShippingFeePerItem: Prisma.Decimal;
    defaultShippingFeeForAdditionalItem: Prisma.Decimal;
    defaultShippingFeePerKg: Prisma.Decimal;
    defaultShippingFeeFixed: Prisma.Decimal;
    defaultDeliveryTimeMin: number;
    defaultDeliveryTimeMax: number;
    returnPolicy: string;
    userId: string;
    isDeleted: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

type MockProduct = {
    id: string;
    name: string;
    description: string;
    slug: string;
    brand: string;
    rating: number;
    sales: number;
    numReviews: number;
    shippingFeeMethod: "ITEM" | "WEIGHT" | "FIXED" | "FREE";
    views: number;
    freeShipping: Record<string, unknown> | null;
    categoryId: string;
    subCategoryId: string;
    offerTagId: string | null;
    storeId: string;
    createdAt: Date;
    updatedAt: Date;
};

type MockProductVariant = {
    id: string;
    variantName: string;
    variantDescription: string;
    variantImage: string;
    slug: string;
    isSale: boolean;
    saleEndDate: Date | null;
    keywords: string[];
    sku: string;
    sales: number;
    weight: number;
    productId: string;
    createdAt: Date;
    updatedAt: Date;
};

type MockSize = {
    id: string;
    size: string;
    quantity: number;
    price: number;
    discount: number;
    productVariantId: string;
    createdAt: Date;
    updatedAt: Date;
};

type MockCategory = {
    id: string;
    name: string;
    image: string;
    url: string;
    featured: boolean;
    createdAt: Date;
    updatedAt: Date;
};

type MockSubCategory = {
    id: string;
    name: string;
    image: string;
    url: string;
    featured: boolean;
    categoryId: string;
    createdAt: Date;
    updatedAt: Date;
};

type MockOrder = {
    id: string;
    userId: string;
    shippingAddressId: string;
    orderStatus: string;
    paymentStatus: string;
    paymentMethod: string | null;
    shippingFees: Prisma.Decimal;
    subTotal: Prisma.Decimal;
    total: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
};

type MockOrderGroup = {
    id: string;
    orderId: string;
    storeId: string;
    status: string;
    shippingService: string;
    shippingDeliveryMin: number;
    shippingDeliveryMax: number;
    shippingFees: Prisma.Decimal;
    subTotal: Prisma.Decimal;
    total: Prisma.Decimal;
    couponId: string | null;
    createdAt: Date;
    updatedAt: Date;
};

type MockOrderItem = {
    id: string;
    orderGroupId: string;
    productId: string;
    variantId: string;
    sizeId: string;
    productSlug: string;
    variantSlug: string;
    sku: string;
    name: string;
    image: string;
    size: string;
    quantity: number;
    price: Prisma.Decimal;
    shippingFee: Prisma.Decimal;
    totalPrice: Prisma.Decimal;
    status: string;
    createdAt: Date;
    updatedAt: Date;
};

type MockCoupon = {
    id: string;
    code: string;
    startDate: Date;
    endDate: Date;
    discount: number;
    storeId: string;
    createdAt: Date;
    updatedAt: Date;
    store?: Record<string, unknown>;
};

type MockShippingAddress = {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    address1: string;
    address2: string;
    state: string;
    city: string;
    zip_code: string;
    default: boolean;
    userId: string;
    countryId: string;
    createdAt: Date;
    updatedAt: Date;
};

type MockPaymentDetails = {
    id: string;
    paymentIntentId: string;
    paymentMethod: string;
    status: string;
    amount: Prisma.Decimal;
    currency: string;
    orderId: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
};

type MockCart = {
    id: string;
    userId: string;
    couponId: string | null;
    shippingFees: Prisma.Decimal;
    subTotal: Prisma.Decimal;
    total: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
    cartItems?: MockCartItem[];
    coupon?: MockCoupon | null;
};

type MockCartItem = {
    id: string;
    cartId: string;
    productId: string;
    variantId: string;
    sizeId: string;
    storeId: string;
    productSlug: string;
    variantSlug: string;
    sku: string;
    name: string;
    image: string;
    size: string;
    quantity: number;
    price: Prisma.Decimal;
    shippingFee: Prisma.Decimal;
    totalPrice: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
};

type MockCountry = {
    id: string;
    name: string;
    code: string;
    createdAt: Date;
    updatedAt: Date;
};

type MockOfferTag = {
    id: string;
    name: string;
    url: string;
    createdAt: Date;
    updatedAt: Date;
};

type MockWishlistItem = {
    id: string;
    userId: string;
    productId: string;
    variantId: string;
    sizeId: string | null;
    createdAt: Date;
    updatedAt: Date;
};

type MockVariantImage = {
    id: string;
    url: string;
    alt: string;
    productVariantId: string;
};

type MockFullProduct = MockProduct & {
    store: MockStore;
    variants: Array<
        MockProductVariant & {
            sizes: MockSize[];
            images: MockVariantImage[];
        }
    >;
};

// ---- ファクトリ関数 ----

// ---- ユーザー ----
export const createMockUser = (
    overrides: Partial<MockUser> = {}
): MockUser => ({
    id: TEST_CONFIG.DEFAULT_USER_ID,
    name: "Test User",
    email: TEST_CONFIG.TEST_EMAIL,
    picture: "https://example.com/avatar.jpg",
    role: "USER",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// ---- ストア ----
export const createMockStore = (
    overrides: Partial<RelaxDecimal<MockStore>> = {}
): MockStore => {
    const {
        defaultShippingFeePerItem,
        defaultShippingFeeForAdditionalItem,
        defaultShippingFeePerKg,
        defaultShippingFeeFixed,
        ...rest
    } = overrides;
    return {
        id: TEST_CONFIG.DEFAULT_STORE_ID,
        name: "Test Store",
        description:
            "A test store description with sufficient length for validation.",
        email: "store@example.com",
        phone: TEST_CONFIG.TEST_PHONE,
        url: TEST_CONFIG.TEST_STORE_URL,
        logo: "https://example.com/logo.jpg",
        cover: "https://example.com/cover.jpg",
        status: "ACTIVE",
        featured: false,
        averageRating: 0,
        numReviews: 0,
        defaultShippingService: TEST_CONFIG.DEFAULT_SHIPPING_SERVICE,
        defaultShippingFeePerItem: toDecimal(defaultShippingFeePerItem ?? 5.0),
        defaultShippingFeeForAdditionalItem: toDecimal(defaultShippingFeeForAdditionalItem ?? 2.0),
        defaultShippingFeePerKg: toDecimal(defaultShippingFeePerKg ?? 1.5),
        defaultShippingFeeFixed: toDecimal(defaultShippingFeeFixed ?? 10.0),
        defaultDeliveryTimeMin: 3,
        defaultDeliveryTimeMax: 14,
        returnPolicy: TEST_CONFIG.DEFAULT_RETURN_POLICY,
        userId: TEST_CONFIG.DEFAULT_USER_ID,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        ...rest,
    };
};

// ---- 商品 ----
export const createMockProduct = (
    overrides: Partial<MockProduct> = {}
): MockProduct => ({
    id: "product-001",
    name: "Test Product",
    description:
        "A detailed test product description with sufficient length for validation.",
    slug: "test-product",
    brand: "Test Brand",
    rating: 4.5,
    sales: 100,
    numReviews: 20,
    shippingFeeMethod: "ITEM",
    views: 500,
    freeShipping: null,
    categoryId: "category-001",
    subCategoryId: "subcategory-001",
    offerTagId: null,
    storeId: TEST_CONFIG.DEFAULT_STORE_ID,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// ---- 商品バリアント ----
export const createMockProductVariant = (
    overrides: Partial<MockProductVariant> = {}
): MockProductVariant => ({
    id: "variant-001",
    variantName: "Red Edition",
    variantDescription: "Red variant of the product",
    variantImage: "https://example.com/variant-red.jpg",
    slug: "red-edition",
    isSale: false,
    saleEndDate: null,
    keywords: ["red", "edition", "limited", "color", "exclusive"],
    sku: "SKU-RED-001",
    sales: 50,
    weight: 0.5,
    productId: "product-001",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// ---- サイズ（在庫・価格） ----
export const createMockSize = (
    overrides: Partial<MockSize> = {}
): MockSize => {
    const { price, ...rest } = overrides;
    return {
        id: "size-001",
        size: "M",
        quantity: 50,
        price: price ?? 29.99,
        discount: 0,
        productVariantId: "variant-001",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        ...rest,
    };
};

// ---- カテゴリ ----
export const createMockCategory = (
    overrides: Partial<MockCategory> = {}
): MockCategory => ({
    id: "category-001",
    name: "Electronics",
    image: "https://example.com/electronics.jpg",
    url: "electronics",
    featured: false,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// ---- サブカテゴリ ----
export const createMockSubCategory = (
    overrides: Partial<MockSubCategory> = {}
): MockSubCategory => ({
    id: "subcategory-001",
    name: "Smartphones",
    image: "https://example.com/smartphones.jpg",
    url: "smartphones",
    featured: false,
    categoryId: "category-001",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// ---- 注文 ----
export const createMockOrder = (
    overrides: Partial<RelaxDecimal<MockOrder>> = {}
): MockOrder => {
    const { shippingFees, subTotal, total, ...rest } = overrides;
    return {
        id: "order-001",
        userId: TEST_CONFIG.DEFAULT_USER_ID,
        shippingAddressId: "address-001",
        orderStatus: "Pending",
        paymentStatus: "Pending",
        paymentMethod: null,
        shippingFees: toDecimal(shippingFees ?? 10.0),
        subTotal: toDecimal(subTotal ?? 59.98),
        total: toDecimal(total ?? 69.98),
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        ...rest,
    };
};

// ---- 注文グループ（店舗単位） ----
export const createMockOrderGroup = (
    overrides: Partial<RelaxDecimal<MockOrderGroup>> = {}
): MockOrderGroup => {
    const { shippingFees, subTotal, total, ...rest } = overrides;
    return {
        id: "order-group-001",
        orderId: "order-001",
        storeId: TEST_CONFIG.DEFAULT_STORE_ID,
        status: "Pending",
        shippingService: TEST_CONFIG.DEFAULT_SHIPPING_SERVICE,
        shippingDeliveryMin: 3,
        shippingDeliveryMax: 14,
        shippingFees: toDecimal(shippingFees ?? 5.0),
        subTotal: toDecimal(subTotal ?? 29.99),
        total: toDecimal(total ?? 34.99),
        couponId: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        ...rest,
    };
};

// ---- 注文アイテム ----
export const createMockOrderItem = (
    overrides: Partial<RelaxDecimal<MockOrderItem>> = {}
): MockOrderItem => {
    const { price, shippingFee, totalPrice, ...rest } = overrides;
    return {
        id: "order-item-001",
        orderGroupId: "order-group-001",
        productId: "product-001",
        variantId: "variant-001",
        sizeId: "size-001",
        productSlug: "test-product",
        variantSlug: "red-edition",
        sku: "SKU-RED-001",
        name: "Test Product ・ Red Edition",
        image: "https://example.com/product.jpg",
        size: "M",
        quantity: 2,
        price: toDecimal(price ?? 29.99),
        shippingFee: toDecimal(shippingFee ?? 5.0),
        totalPrice: toDecimal(totalPrice ?? 64.98),
        status: "Pending",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        ...rest,
    };
};

// ---- クーポン ----
export const createMockCoupon = (
    overrides: Partial<MockCoupon> = {}
): MockCoupon => ({
    id: "coupon-001",
    code: "SAVE10",
    startDate: new Date(NOW - ONE_YEAR_MS),
    endDate: new Date(NOW + ONE_YEAR_MS),
    discount: 10,
    storeId: TEST_CONFIG.DEFAULT_STORE_ID,
    createdAt: new Date(NOW - ONE_YEAR_MS),
    updatedAt: new Date(NOW - ONE_YEAR_MS),
    ...overrides,
});

// ---- 配送先住所 ----
export const createMockShippingAddress = (
    overrides: Partial<MockShippingAddress> = {}
): MockShippingAddress => ({
    id: "address-001",
    firstName: "Test",
    lastName: "User",
    phone: TEST_CONFIG.TEST_PHONE,
    address1: "123 Test Street",
    address2: "",
    state: "Test State",
    city: "Test City",
    zip_code: "12345",
    default: true,
    userId: TEST_CONFIG.DEFAULT_USER_ID,
    countryId: "country-001",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// ---- 決済詳細 ----
export const createMockPaymentDetails = (
    overrides: Partial<RelaxDecimal<MockPaymentDetails>> = {}
): MockPaymentDetails => {
    const { amount, ...rest } = overrides;
    return {
        id: "payment-001",
        paymentIntentId: "pi_test_123",
        paymentMethod: "Stripe",
        status: "Completed",
        amount: toDecimal(amount ?? 69.98),
        currency: "usd",
        orderId: "order-001",
        userId: TEST_CONFIG.DEFAULT_USER_ID,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        ...rest,
    };
};

// ---- カート ----
export const createMockCart = (
    overrides: Partial<RelaxDecimal<MockCart>> = {}
): MockCart => {
    const { shippingFees, subTotal, total, ...rest } = overrides;
    return {
        id: "cart-001",
        userId: TEST_CONFIG.DEFAULT_USER_ID,
        couponId: null,
        shippingFees: toDecimal(shippingFees ?? 5.0),
        subTotal: toDecimal(subTotal ?? 59.98),
        total: toDecimal(total ?? 64.98),
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        ...rest,
    };
};

// ---- カートアイテム ----
export const createMockCartItem = (
    overrides: Partial<RelaxDecimal<MockCartItem>> = {}
): MockCartItem => {
    const { price, shippingFee, totalPrice, ...rest } = overrides;
    return {
        id: "cart-item-001",
        cartId: "cart-001",
        productId: "product-001",
        variantId: "variant-001",
        sizeId: "size-001",
        storeId: TEST_CONFIG.DEFAULT_STORE_ID,
        productSlug: "test-product",
        variantSlug: "red-edition",
        sku: "SKU-RED-001",
        name: "Test Product ・ Red Edition",
        image: "https://example.com/product.jpg",
        size: "M",
        quantity: 2,
        price: toDecimal(price ?? 29.99),
        shippingFee: toDecimal(shippingFee ?? 5.0),
        totalPrice: toDecimal(totalPrice ?? 64.98),
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        ...rest,
    };
};

// ---- カート商品（フロントエンド CartProductType 用） ----
export const createMockCartProduct = (
    overrides: Partial<CartProductType> = {}
): CartProductType => ({
    productId: "product-001",
    variantId: "variant-001",
    productSlug: "test-product",
    variantSlug: "red-edition",
    name: "Test Product",
    variantName: "Red Edition",
    image: "https://example.com/product.jpg",
    variantImage: "https://example.com/variant-red.jpg",
    sizeId: "size-001",
    size: "M",
    quantity: 2,
    price: 29.99,
    stock: 50,
    weight: 0.5,
    shippingMethod: "ITEM",
    shippingService: TEST_CONFIG.DEFAULT_SHIPPING_SERVICE,
    shippingFee: 5.0,
    extraShippingFee: 2.0,
    deliveryTimeMin: 3,
    deliveryTimeMax: 14,
    isFreeShipping: false,
    ...overrides,
});

// ---- 国 ----
export const createMockCountry = (
    overrides: Partial<MockCountry> = {}
): MockCountry => ({
    id: "country-001",
    name: "Japan",
    code: "JP",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// ---- オファータグ ----
export const createMockOfferTag = (
    overrides: Partial<MockOfferTag> = {}
): MockOfferTag => ({
    id: "offer-tag-001",
    name: "Summer Sale",
    url: "summer-sale",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// ---- ウィッシュリスト ----
export const createMockWishlistItem = (
    overrides: Partial<MockWishlistItem> = {}
): MockWishlistItem => ({
    id: "wishlist-001",
    userId: TEST_CONFIG.DEFAULT_USER_ID,
    productId: "product-001",
    variantId: "variant-001",
    sizeId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// ---- バリアント画像 ----
export const createMockVariantImage = (
    overrides: Partial<MockVariantImage> = {}
): MockVariantImage => ({
    id: "image-001",
    url: "https://example.com/product-image-1.jpg",
    alt: "Product Image 1",
    productVariantId: "variant-001",
    ...overrides,
});

// ---- 完全な商品構造（Product + Variant + Size + Image を含む） ----
export const createMockFullProduct = (
    overrides: Partial<MockFullProduct> = {}
): MockFullProduct => ({
    ...createMockProduct(),
    store: createMockStore(),
    freeShipping: null,
    variants: [
        {
            ...createMockProductVariant(),
            sizes: [createMockSize()],
            images: [createMockVariantImage()],
        },
    ],
    ...overrides,
});

// ---- ストアデフォルト配送設定（フォーム入力用） ----
type MockStoreDefaultShipping = {
    defaultShippingService: string;
    defaultShippingFeePerItem: number;
    defaultShippingFeeForAdditionalItem: number;
    defaultShippingFeePerKg: number;
    defaultShippingFeeFixed: number;
    defaultDeliveryTimeMin: number;
    defaultDeliveryTimeMax: number;
    returnPolicy: string;
};

export const createMockStoreDefaultShipping = (
    overrides: Partial<MockStoreDefaultShipping> = {}
): MockStoreDefaultShipping => ({
    defaultShippingService: "Express Delivery",
    defaultShippingFeePerItem: 10.5,
    defaultShippingFeeForAdditionalItem: 5.25,
    defaultShippingFeePerKg: 2.75,
    defaultShippingFeeFixed: 15.0,
    defaultDeliveryTimeMin: 3,
    defaultDeliveryTimeMax: 7,
    returnPolicy: "Return within 14 days with receipt.",
    ...overrides,
});

// ---- ストアデフォルト配送設定（DB 出力用、Decimal） ----
type MockStoreDefaultShippingDb = {
    defaultShippingService: string;
    defaultShippingFeePerItem: Prisma.Decimal;
    defaultShippingFeeForAdditionalItem: Prisma.Decimal;
    defaultShippingFeePerKg: Prisma.Decimal;
    defaultShippingFeeFixed: Prisma.Decimal;
    defaultDeliveryTimeMin: number;
    defaultDeliveryTimeMax: number;
    returnPolicy: string;
};

export const createMockStoreDefaultShippingDb = (
    overrides: Partial<Record<string, unknown>> = {}
): MockStoreDefaultShippingDb => ({
    defaultShippingService: "Express Delivery",
    defaultShippingFeePerItem: new Prisma.Decimal("10.5"),
    defaultShippingFeeForAdditionalItem: new Prisma.Decimal("5.25"),
    defaultShippingFeePerKg: new Prisma.Decimal("2.75"),
    defaultShippingFeeFixed: new Prisma.Decimal("15.0"),
    defaultDeliveryTimeMin: 3,
    defaultDeliveryTimeMax: 7,
    returnPolicy: "Return within 14 days with receipt.",
    ...overrides,
});
