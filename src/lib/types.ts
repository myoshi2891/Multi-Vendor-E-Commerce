import {
    getAllStoreProducts,
    getProductPageData,
    getProducts,
    getRatingStatistics,
    getShippingDetails,
    retrieveProductDetails,
} from "@/queries/product";
import { getStoreDefaultShippingDetails } from "@/queries/store";
import { getAllSubCategories } from "@/queries/subCategory";
import {
    Cart,
    CartItem,
    Color,
    FreeShipping,
    FreeShippingCountry,
    Prisma,
    ProductVariantImage,
    Review,
    ReviewImage,
    ShippingAddress,
    ShippingFeeMethod,
    ShippingRate,
    Size,
    User,
    Country as CountryPrisma,
    Coupon,
    OrderGroup,
    OrderItem,
    Store,
    Category,
    SubCategory,
} from "@prisma/client";

export interface DashboardSidebarMenuInterface {
    label: string;
    icon: string;
    link: string;
}

// SubCategory + parent category
export type SubCategoryWithCategoryType = Prisma.PromiseReturnType<
    typeof getAllSubCategories
>[0];

// Product + variant
export type ProductWithVariantType = {
    productId: string;
    variantId: string;
    name: string;
    description: string;
    variantName: string;
    variantDescription: string;
    images: { id?: string; url: string }[];
    variantImage: string;
    categoryId: string;
    subCategoryId: string;
    offerTagId?: string;
    isSale: boolean;
    saleEndDate?: string;
    brand: string;
    sku: string;
    weight: number;
    colors: { id?: string; color: string }[];
    sizes: {
        id?: string;
        size: string;
        quantity: number;
        price: number;
        discount: number;
    }[];
    product_specs: { id?: string; name: string; value: string }[];
    variant_specs: { id?: string; name: string; value: string }[];
    keywords: string[];
    questions: { id?: string; question: string; answer: string }[];
    freeShippingForAllCountries: boolean;
    freeShippingCountriesIds: { id?: string; label: string; value: string }[];
    shippingFeeMethod: ShippingFeeMethod;
    createdAt: Date;
    updatedAt: Date;
};

// Store product
export type StoreProductType = Prisma.PromiseReturnType<
    typeof getAllStoreProducts
>[0];

// Store default shipping details
export type StoreDefaultShippingType = Prisma.PromiseReturnType<
    typeof getStoreDefaultShippingDetails
>;

export type CountryWithShippingRatesType = {
    countryId: string;
    countryName: string;
    shippingRate: ShippingRate;
};

export interface Country {
    name: string;
    code: string;
    city: string;
    region: string;
}

import countries from "@/data/countries.json";
import { getOrder } from "@/queries/order";
import {
    getUserOrders,
    getUserPayments,
    getUserWishlist,
} from "@/queries/profile";

export type SelectMenuOption = (typeof countries)[number];

export type ProductType = Prisma.PromiseReturnType<
    typeof getProducts
>["products"][0];

export type ProductWishListType = Prisma.PromiseReturnType<
    typeof getUserWishlist
>["wishlist"][0];

export type VariantSimplified = {
    variantId: string;
    variantSlug: string;
    variantName: string;
    images: ProductVariantImage[];
    sizes: Size[];
};

export type VariantImageType = {
    url: string;
    image: string;
};

export type ProductPageType = Prisma.PromiseReturnType<
    typeof retrieveProductDetails
>;

export type ProductPageDataType = Prisma.PromiseReturnType<
    typeof getProductPageData
>;

export type ProductShippingDetailsType = Prisma.PromiseReturnType<
    typeof getShippingDetails
>;

export type RatingStatisticsType = Prisma.PromiseReturnType<
    typeof getRatingStatistics
>;

export type StatisticsCardType = Prisma.PromiseReturnType<
    typeof getRatingStatistics
>["ratingStatistics"];

export type FreeShippingWithCountriesType = FreeShipping & {
    eligibleCountries: FreeShippingCountry[];
};

export type CartProductType = {
    productId: string;
    variantId: string;
    productSlug: string;
    variantSlug: string;
    name: string;
    variantName: string;
    image: string;
    variantImage: string;
    sizeId: string;
    size: string;
    quantity: number;
    price: number;
    stock: number;
    weight: number;
    shippingMethod: string;
    shippingService: string;
    shippingFee: number;
    extraShippingFee: number;
    deliveryTimeMin: number;
    deliveryTimeMax: number;
    isFreeShipping: boolean;
};

export type ReviewWithImageType = Review & {
    images: ReviewImage[];
    user: User;
};

// Define a local SortOrder type
export type SortOrder = "asc" | "desc";

export type ReviewsFilterType = {
    rating?: number;
    hasImages?: boolean;
};

export type ReviewsOrderType = {
    orderBy: "latest" | "oldest" | "highest";
};

export type VariantInfoType = {
    variantName: string;
    variantSlug: string;
    variantImage: string;
    variantUrl: string;
    images: ProductVariantImage[];
    sizes: Size[];
    colors: Partial<Color>[];
};

export type ReviewDetailsType = {
    id: string;
    review: string;
    rating: number;
    images: { url: string }[];
    size: string;
    quantity: string;
    variant: string;
    color: string;
};

export type CartWithCartItemsType = Cart & {
    cartItems: CartItem[];
    coupon: (Coupon & { store: Store }) | null;
};

export type UserShippingAddressType = ShippingAddress & {
    country: CountryPrisma;
    user: User;
};

export type OrderFullType = Prisma.PromiseReturnType<typeof getOrder>;

export enum OrderStatus {
    Pending = "Pending",
    Confirmed = "Confirmed",
    Processing = "Processing",
    Shipped = "Shipped",
    OutForDelivery = "OutForDelivery",
    Delivered = "Delivered",
    Canceled = "Canceled",
    Failed = "Failed",
    Returned = "Returned",
    Refunded = "Refunded",
    PartiallyShipped = "PartiallyShipped",
    OnHold = "OnHold",
}

export enum PaymentStatus {
    Pending = "Pending",
    Paid = "Paid",
    Failed = "Failed",
    Declined = "Declined",
    Cancelled = "Cancelled",
    Refunded = "Refunded",
    PartiallyRefunded = "PartiallyRefunded",
    ChargeBack = "ChargeBack",
}

export type OrderGroupWithItemsType = OrderGroup & {
    items: OrderItem[];
    store: Store;
    _count: {
        items: number;
    };
    coupon: Coupon | null;
};

export enum ProductStatus {
    Pending = "Pending",
    Processing = "Processing",
    ReadyForShipment = "ReadyForShipment",
    Shipped = "Shipped",
    Delivered = "Delivered",
    Canceled = "Canceled",
    Returned = "Returned",
    Refunded = "Refunded",
    FailedDelivery = "FailedDelivery",
    OnHold = "OnHold",
    BackOrdered = "BackOrdered",
    PartiallyShipped = "PartiallyShipped",
    ExchangeRequested = "ExchangeRequested",
    AwaitingPickup = "AwaitingPickup",
}

export interface SearchResult {
    name: string;
    link: string;
    image: string;
}

export type OrderTableFilter =
    | ""
    | "unpaid"
    | "toShip"
    | "shipped"
    | "delivered";

export type OrderTableDateFilter =
    | ""
    | "last-6-months"
    | "last-1-year"
    | "last-2-years";

export type UserOrderType = Prisma.PromiseReturnType<
    typeof getUserOrders
>["orders"][0];

export type UserPaymentType = Prisma.PromiseReturnType<
    typeof getUserPayments
>["payments"][0];

export type PaymentTableFilter = "" | "paypal" | "credit-card";

export type PaymentTableDateFilter =
    | ""
    | "last-6-months"
    | "last-1-year"
    | "last-2-years";

export type ReviewFilter = "5" | "4" | "3" | "2" | "1" | "";

export type ReviewDateFilter =
    | ""
    | "last-6-months"
    | "last-1-year"
    | "last-2-years";

export type FiltersQueryType = {
    search: string;
    category: string;
    subCategory: string;
    offer: string;
    size: string;
    sort: string;
};

export type CategoryWithSubsType = Category & {
    subCategories: SubCategory[];
};