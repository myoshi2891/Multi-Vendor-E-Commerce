/**
 * 共通テストフィクスチャ
 * 全エンティティのモックデータファクトリ（overridesパターン）
 */

import { TEST_CONFIG } from "./test-config";

// ---- ユーザー ----
export const createMockUser = (overrides: Record<string, unknown> = {}) => ({
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
export const createMockStore = (overrides: Record<string, unknown> = {}) => ({
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
    defaultShippingFeePerItem: 5.0,
    defaultShippingFeeForAdditionalItem: 2.0,
    defaultShippingFeePerKg: 1.5,
    defaultShippingFeeFixed: 10.0,
    defaultDeliveryTimeMin: 3,
    defaultDeliveryTimeMax: 14,
    returnPolicy: TEST_CONFIG.DEFAULT_RETURN_POLICY,
    userId: TEST_CONFIG.DEFAULT_USER_ID,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// ---- 商品 ----
export const createMockProduct = (
    overrides: Record<string, unknown> = {}
) => ({
    id: "product-001",
    name: "Test Product",
    description:
        "A detailed test product description with sufficient length for validation.",
    slug: "test-product",
    brand: "Test Brand",
    rating: 4.5,
    sales: 100,
    numReviews: 20,
    shippingFeeMethod: "ITEM" as const,
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
    overrides: Record<string, unknown> = {}
) => ({
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
export const createMockSize = (overrides: Record<string, unknown> = {}) => ({
    id: "size-001",
    size: "M",
    quantity: 50,
    price: 29.99,
    discount: 0,
    productVariantId: "variant-001",
    ...overrides,
});

// ---- カテゴリ ----
export const createMockCategory = (
    overrides: Record<string, unknown> = {}
) => ({
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
    overrides: Record<string, unknown> = {}
) => ({
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
    overrides: Record<string, unknown> = {}
) => ({
    id: "order-001",
    userId: TEST_CONFIG.DEFAULT_USER_ID,
    shippingAddressId: "address-001",
    orderStatus: "Pending",
    paymentStatus: "Pending",
    paymentMethod: null,
    shippingFees: 10.0,
    subTotal: 59.98,
    total: 69.98,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// ---- 注文グループ（店舗単位） ----
export const createMockOrderGroup = (
    overrides: Record<string, unknown> = {}
) => ({
    id: "order-group-001",
    orderId: "order-001",
    storeId: TEST_CONFIG.DEFAULT_STORE_ID,
    status: "Pending",
    shippingService: TEST_CONFIG.DEFAULT_SHIPPING_SERVICE,
    shippingDeliveryMin: 3,
    shippingDeliveryMax: 14,
    shippingFees: 5.0,
    subTotal: 29.99,
    total: 34.99,
    couponId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// ---- 注文アイテム ----
export const createMockOrderItem = (
    overrides: Record<string, unknown> = {}
) => ({
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
    price: 29.99,
    shippingFee: 5.0,
    totalPrice: 64.98,
    status: "Pending",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// ---- クーポン ----
export const createMockCoupon = (
    overrides: Record<string, unknown> = {}
) => ({
    id: "coupon-001",
    code: "SAVE10",
    startDate: new Date("2024-01-01"),
    endDate: new Date("2025-12-31"),
    discount: 10,
    storeId: TEST_CONFIG.DEFAULT_STORE_ID,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// ---- 配送先住所 ----
export const createMockShippingAddress = (
    overrides: Record<string, unknown> = {}
) => ({
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
    overrides: Record<string, unknown> = {}
) => ({
    id: "payment-001",
    paymentIntentId: "pi_test_123",
    paymentMethod: "Stripe",
    status: "Completed",
    amount: 6998,
    currency: "usd",
    orderId: "order-001",
    userId: TEST_CONFIG.DEFAULT_USER_ID,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// ---- カート ----
export const createMockCart = (overrides: Record<string, unknown> = {}) => ({
    id: "cart-001",
    userId: TEST_CONFIG.DEFAULT_USER_ID,
    couponId: null,
    shippingFees: 5.0,
    subTotal: 59.98,
    total: 64.98,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// ---- カートアイテム ----
export const createMockCartItem = (
    overrides: Record<string, unknown> = {}
) => ({
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
    price: 29.99,
    shippingFee: 5.0,
    totalPrice: 64.98,
    ...overrides,
});

// ---- カート商品（フロントエンド CartProductType 用） ----
export const createMockCartProduct = (
    overrides: Record<string, unknown> = {}
) => ({
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
    overrides: Record<string, unknown> = {}
) => ({
    id: "country-001",
    name: "Japan",
    code: "JP",
    ...overrides,
});

// ---- オファータグ ----
export const createMockOfferTag = (
    overrides: Record<string, unknown> = {}
) => ({
    id: "offer-tag-001",
    name: "Summer Sale",
    url: "summer-sale",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// ---- ウィッシュリスト ----
export const createMockWishlistItem = (
    overrides: Record<string, unknown> = {}
) => ({
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
    overrides: Record<string, unknown> = {}
) => ({
    id: "image-001",
    url: "https://example.com/product-image-1.jpg",
    alt: "Product Image 1",
    productVariantId: "variant-001",
    ...overrides,
});

// ---- 完全な商品構造（Product + Variant + Size + Image を含む） ----
export const createMockFullProduct = (
    overrides: Record<string, unknown> = {}
) => ({
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
