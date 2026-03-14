/**
 * Seed用型定義
 * Prismaスキーマに基づくダミーデータ投入用の型
 */

import type {
  Role,
  StoreStatus,
  ShippingFeeMethod,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  ProductStatus,
} from "@prisma/client";

// ===== 基底エンティティ =====

export type SeedCountry = {
  name: string;
  code: string;
};

export type SeedUser = {
  name: string;
  email: string;
  picture: string;
  role: Role;
};

export type SeedCategory = {
  name: string;
  url: string;
  image: string;
  featured: boolean;
};

export type SeedSubCategory = {
  name: string;
  url: string;
  image: string;
  featured: boolean;
  /** 親カテゴリのurl（紐付け用） */
  categoryUrl: string;
};

export type SeedOfferTag = {
  name: string;
  url: string;
};

// ===== ストア =====

export type SeedStore = {
  name: string;
  description: string;
  email: string;
  phone: string;
  url: string;
  logo: string;
  cover: string;
  status: StoreStatus;
  /** ストアオーナーのemail（User紐付け用） */
  ownerEmail: string;
  defaultShippingService: string;
  defaultShippingFeePerItem: number;
  defaultShippingFeeForAdditionalItem: number;
  defaultShippingFeePerKg: number;
  defaultShippingFeeFixed: number;
  defaultDeliveryTimeMin: number;
  defaultDeliveryTimeMax: number;
  returnPolicy: string;
};

// ===== 商品 =====

export type SeedSize = {
  size: string;
  quantity: number;
  price: number;
  discount: number;
};

export type SeedImage = {
  url: string;
  alt: string;
};

export type SeedColor = {
  name: string;
};

export type SeedSpec = {
  name: string;
  value: string;
};

export type SeedQuestion = {
  question: string;
  answer: string;
};

export type SeedProductVariant = {
  variantName: string;
  variantDescription: string;
  slug: string;
  sku: string;
  weight: number;
  isSale: boolean;
  saleEndDate?: string;
  keywords: string[];
  colors: SeedColor[];
  sizes: SeedSize[];
  images: SeedImage[];
  specs: SeedSpec[];
};

export type SeedProduct = {
  name: string;
  description: string;
  slug: string;
  brand: string;
  shippingFeeMethod: ShippingFeeMethod;
  /** ストアのurl（Store紐付け用） */
  storeUrl: string;
  /** カテゴリのurl（Category紐付け用） */
  categoryUrl: string;
  /** サブカテゴリのurl（SubCategory紐付け用） */
  subCategoryUrl: string;
  /** オファータグのurl（OfferTag紐付け用、オプション） */
  offerTagUrl?: string;
  variants: SeedProductVariant[];
  questions: SeedQuestion[];
  /** 送料無料設定（対象国コード配列、空なら未設定） */
  freeShippingCountryCodes?: string[];
};

// ===== レビュー =====

export type SeedReview = {
  variant: string;
  review: string;
  rating: number;
  color: string;
  size: string;
  quantity: string;
  likes: number;
  /** レビュアーのemail（User紐付け用） */
  userEmail: string;
  /** 商品のslug（Product紐付け用） */
  productSlug: string;
  images: SeedImage[];
};

// ===== コマース =====

export type SeedCoupon = {
  code: string;
  /** ストアのurl（Store紐付け用） */
  storeUrl: string;
  startDate: string;
  endDate: string;
  discount: number;
};

export type SeedShippingAddress = {
  /** ユーザーのemail（User紐付け用） */
  userEmail: string;
  firstName: string;
  lastName: string;
  phone: string;
  address1: string;
  address2?: string;
  state: string;
  city: string;
  zip_code: string;
  /** 国のcode（Country紐付け用） */
  countryCode: string;
  default: boolean;
};

export type SeedOrderItem = {
  /** 商品のslug */
  productSlug: string;
  /** バリアントのslug */
  variantSlug: string;
  /** サイズ名 */
  size: string;
  quantity: number;
  status: ProductStatus;
};

export type SeedOrderGroup = {
  /** ストアのurl */
  storeUrl: string;
  status: OrderStatus;
  /** クーポンコード（オプション） */
  couponCode?: string;
  /** 配送サービス名（オプション、デフォルト: "Standard Shipping"） */
  shippingService?: string;
  /** 配送最短日数（オプション、デフォルト: 3） */
  shippingDeliveryMin?: number;
  /** 配送最長日数（オプション、デフォルト: 7） */
  shippingDeliveryMax?: number;
  items: SeedOrderItem[];
};

export type SeedOrder = {
  /** 決定論的ID生成用キー */
  seedKey: string;
  /** 注文者のemail */
  userEmail: string;
  /** 配送先インデックス（ユーザーの配送先リスト内） */
  shippingAddressIndex: number;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  groups: SeedOrderGroup[];
};

export type SeedWishlistItem = {
  /** ユーザーのemail */
  userEmail: string;
  /** 商品のslug */
  productSlug: string;
  /** バリアントのslug */
  variantSlug: string;
  /** サイズ名（オプション） */
  size?: string;
};

export type SeedCartItem = {
  /** 商品のslug */
  productSlug: string;
  /** バリアントのslug */
  variantSlug: string;
  /** サイズ名 */
  size: string;
  quantity: number;
};

export type SeedCart = {
  /** ユーザーのemail */
  userEmail: string;
  items: SeedCartItem[];
};

// ===== ShippingRate =====

export type SeedShippingRate = {
  /** ストアのurl */
  storeUrl: string;
  /** 国のcode */
  countryCode: string;
  shippingService: string;
  shippingFeePerItem: number;
  shippingFeeForAdditionalItem: number;
  shippingFeePerKg: number;
  shippingFeeFixed: number;
  deliveryTimeMin: number;
  deliveryTimeMax: number;
  returnPolicy: string;
};

// ===== Seeder戻り値 =====

export type SeedMaps = {
  countries: Map<string, string>; // code -> id
  users: Map<string, string>; // email -> id
  categories: Map<string, string>; // url -> id
  subCategories: Map<string, string>; // url -> id
  offerTags: Map<string, string>; // url -> id
  stores: Map<string, string>; // url -> id
  products: Map<string, string>; // slug -> id
  variants: Map<string, string>; // slug -> id
  sizes: Map<string, string>; // `${variantSlug}:${sizeName}` -> id
};
