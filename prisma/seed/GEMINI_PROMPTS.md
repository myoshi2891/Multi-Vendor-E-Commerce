# Gemini用 ダミーデータ生成プロンプト集

フェーズ4〜5で必要な定数データをGeminiで生成するためのプロンプトです。

---

## フェーズ4: レビューデータ生成プロンプト

### 対象ファイル: `prisma/seed/constants/reviews.ts`

```
マルチベンダーEコマースプロジェクトのレビューダミーデータを生成してください。

## 要件
- ラグジュアリーファッション（20〜40代ターゲット）をテーマとした高品質なレビュー
- 全36商品に対して、各商品3-5件のレビュー（合計120件程度）
- 評価は主に4-5星（一部3星を含む）、1-2星は含めない
- レビュー文は具体的で説得力があり、10文字以上の英語
- 画像は0-3枚/レビュー（全てのレビューに画像があるわけではない）

## 型定義

```typescript
import type { SeedReview } from "../types";

// SeedReview の構造:
type SeedReview = {
  variant: string;        // バリアント名
  review: string;         // レビュー本文（10文字以上の英語）
  rating: number;         // 1-5（主に4-5）
  color: string;          // カラー名
  size: string;           // サイズ名
  quantity: string;       // 購入数量（"1", "2"など）
  likes: number;          // いいね数（0-50の範囲）
  userEmail: string;      // レビュアーのemail（SEED_USERSのUSERロール）
  productSlug: string;    // 商品のslug
  images: { url: string; alt: string }[];  // 0-3枚
};
```

## 利用可能なデータ

### レビュアー（SEED_USERS の USER ロール、5名）
```typescript
// prisma/seed/constants/users.ts より
const reviewerEmails = [
  "lux-seed-user-yuki@example.com",     // Yuki Tanaka
  "lux-seed-user-emily@example.com",    // Emily Chen
  "lux-seed-user-sophie@example.com",   // Sophie Martin
  "lux-seed-user-alex@example.com",     // Alexander Kim
  "lux-seed-user-bella@example.com",    // Isabella Romano
];
```

### 商品リスト（36商品）
各商品のslug、バリアント、カラー、サイズは以下の通り:

#### NOIR ELEGANCE (6商品)
1. lux-noir-cashmere-double-breasted-coat
   - Variant: Classic Black / Ivory / Camel
   - Colors: Black / Ivory / Camel
   - Sizes: XS, S, M, L
2. lux-noir-silk-charmeuse-evening-dress
   - Variant: Midnight Black / Pearl White
   - Colors: Midnight Black / Pearl White
   - Sizes: 2, 4, 6, 8, 10
3. lux-noir-italian-wool-three-piece-suit
   - Variant: Charcoal Grey
   - Colors: Charcoal Grey
   - Sizes: 46, 48, 50, 52, 54
4. lux-noir-merino-wool-turtleneck
   - Variant: Black / Cream
   - Colors: Black / Cream
   - Sizes: XS, S, M, L, XL
5. lux-noir-tailored-wide-leg-trousers
   - Variant: Black Crepe / Grey Flannel
   - Colors: Black / Grey
   - Sizes: 2, 4, 6, 8, 10, 12
6. lux-noir-leather-chelsea-boots
   - Variant: Black Calfskin / Brown Suede
   - Colors: Black / Brown
   - Sizes: 36, 37, 38, 39, 40, 41, 42

#### MAISON LUXE (6商品)
1. lux-maison-embroidered-cocktail-dress
   - Variant: Burgundy / Navy
   - Colors: Burgundy / Navy
   - Sizes: XS, S, M, L
2. lux-maison-silk-organza-blouse
   - Variant: Ivory
   - Colors: Ivory
   - Sizes: XS, S, M, L, XL
3. lux-maison-tailored-blazer
   - Variant: Black / Navy
   - Colors: Black / Navy
   - Sizes: 34, 36, 38, 40, 42
4. lux-maison-pleated-midi-skirt
   - Variant: Black / Dusty Rose
   - Colors: Black / Dusty Rose
   - Sizes: XS, S, M, L
5. lux-maison-cashmere-wrap-coat
   - Variant: Camel / Charcoal
   - Colors: Camel / Charcoal
   - Sizes: S, M, L, XL
6. lux-maison-leather-shoulder-bag
   - Variant: Black / Cognac
   - Colors: Black / Cognac
   - Sizes: One Size

#### ATELIER DIVINE (6商品)
1. lux-atelier-artisan-gold-chain-necklace
   - Variant: 18K Yellow Gold
   - Colors: Yellow Gold
   - Sizes: 45cm, 50cm
2. lux-atelier-diamond-pave-ring
   - Variant: White Gold Pave
   - Colors: White Gold
   - Sizes: 5, 6, 7, 8
3. lux-atelier-hammered-silver-cuff
   - Variant: Oxidized Sterling Silver
   - Colors: Oxidized Silver
   - Sizes: S (15cm), M (17cm), L (19cm)
4. lux-atelier-pearl-drop-earrings
   - Variant: White Pearl Gold
   - Colors: White Pearl
   - Sizes: One Size
5. lux-atelier-leather-portfolio-briefcase
   - Variant: Cognac Brown / Black Edition
   - Colors: Cognac Brown / Black
   - Sizes: One Size
6. lux-atelier-hand-painted-silk-scarf
   - Variant: Garden Botanica
   - Colors: Multi (Green/Gold/Burgundy)
   - Sizes: 90cm x 90cm

#### VELVET CROWN (6商品)
1. lux-velvet-quilted-leather-shoulder-bag
   - Variant: Burgundy / Black
   - Colors: Burgundy / Black
   - Sizes: Small, Medium
2. lux-velvet-suede-ankle-boots
   - Variant: Black Suede / Taupe Suede
   - Colors: Black / Taupe
   - Sizes: 36, 37, 38, 39, 40, 41
3. lux-velvet-silk-evening-clutch
   - Variant: Emerald / Sapphire / Ruby
   - Colors: Emerald / Sapphire / Ruby
   - Sizes: One Size
4. lux-velvet-patent-leather-pumps
   - Variant: Black Patent / Nude Patent
   - Colors: Black / Nude
   - Sizes: 36, 37, 38, 39, 40
5. lux-velvet-structured-tote-bag
   - Variant: Ivory / Camel
   - Colors: Ivory / Camel
   - Sizes: One Size
6. lux-velvet-embossed-leather-belt
   - Variant: Gold Buckle / Silver Buckle
   - Colors: Gold / Silver
   - Sizes: 70cm, 75cm, 80cm, 85cm, 90cm

#### ORO PALAZZO (6商品)
1. lux-oro-chronograph-dress-watch
   - Variant: Steel Bracelet / Leather Strap
   - Colors: Steel / Brown Leather
   - Sizes: One Size
2. lux-oro-italian-leather-loafers
   - Variant: Black / Cognac
   - Colors: Black / Cognac
   - Sizes: 40, 41, 42, 43, 44, 45
3. lux-oro-silk-pocket-square-set
   - Variant: Classic Collection
   - Colors: Multi
   - Sizes: One Size
4. lux-oro-cashmere-overcoat
   - Variant: Navy / Charcoal
   - Colors: Navy / Charcoal
   - Sizes: 48, 50, 52, 54
5. lux-oro-gold-cufflinks
   - Variant: Yellow Gold / Rose Gold
   - Colors: Yellow Gold / Rose Gold
   - Sizes: One Size
6. lux-oro-suede-bomber-jacket
   - Variant: Navy Suede / Olive Suede
   - Colors: Navy / Olive
   - Sizes: S, M, L, XL

#### LUMIERE PARIS (6商品)
1. lux-lumiere-lace-overlay-dress
   - Variant: Blush Pink / Midnight Blue
   - Colors: Blush Pink / Midnight Blue
   - Sizes: XS, S, M, L
2. lux-lumiere-satin-midi-skirt
   - Variant: Champagne
   - Colors: Champagne
   - Sizes: XS, S, M, L, XL
3. lux-lumiere-crepe-tailored-trousers
   - Variant: Black / Navy
   - Colors: Black / Navy
   - Sizes: 2, 4, 6, 8, 10
4. lux-lumiere-vintage-inspired-sunglasses
   - Variant: Tortoiseshell / Jet Black
   - Colors: Tortoiseshell / Jet Black
   - Sizes: One Size
5. lux-lumiere-monogrammed-canvas-tote
   - Variant: Natural Canvas with Tan Leather
   - Colors: Natural / Tan
   - Sizes: One Size
6. lux-lumiere-lambskin-driving-gloves
   - Variant: Cognac / Black
   - Colors: Cognac / Black
   - Sizes: S, M, L

## 出力形式

```typescript
import type { SeedReview } from "../types";

const img = "/assets/images/no_image.png";

/** レビューデータ（約120件） */
export const SEED_REVIEWS: SeedReview[] = [
  // NOIR ELEGANCE
  {
    variant: "Classic Black",
    review: "Absolutely stunning coat! The cashmere is incredibly soft and the tailoring is impeccable. Worth every penny.",
    rating: 5,
    color: "Black",
    size: "M",
    quantity: "1",
    likes: 23,
    userEmail: "lux-seed-user-yuki@example.com",
    productSlug: "lux-noir-cashmere-double-breasted-coat",
    images: [
      { url: img, alt: "Review image - coat front view" },
    ],
  },
  // ... 残り約119件
];
```

## 注意事項
- レビュー文は10文字以上の英語で、具体的な体験を含める
- 評価分布: 5星60%, 4星35%, 3星5%
- 画像は約30%のレビューに1-3枚
- 同じユーザーが同じ商品に複数レビューしない
- 各商品に少なくとも3件のレビューを割り当てる
- 人気商品（バッグ、コート、ジュエリー）には5件レビューを割り当てる

上記の要件を満たす `prisma/seed/constants/reviews.ts` ファイルの内容を生成してください。
```

---

## フェーズ5: コマースデータ生成プロンプト（3つのファイル）

### 5-1. クーポンデータ

#### 対象ファイル: `prisma/seed/constants/coupons.ts`

```
マルチベンダーEコマースプロジェクトのクーポンダミーデータを生成してください。

## 要件
- 6店舗に対して各2個のクーポン（合計12個）
- 有効・期限切れ・未開始の3種類のステータスを含む
- 割引率は1-99%（主に10%, 15%, 20%, 25%, 30%）
- コードは2-50字の英数字のみ

## 型定義

```typescript
import type { SeedCoupon } from "../types";

type SeedCoupon = {
  code: string;        // クーポンコード（2-50字英数字）
  storeUrl: string;    // ストアのurl
  startDate: string;   // ISO8601形式
  endDate: string;     // ISO8601形式
  discount: number;    // 割引率（1-99）
};
```

## 店舗リスト
```typescript
const storeUrls = [
  "lux-noir-elegance",
  "lux-maison-luxe",
  "lux-atelier-divine",
  "lux-velvet-crown",
  "lux-oro-palazzo",
  "lux-lumiere-paris",
];
```

## 出力形式

```typescript
import type { SeedCoupon } from "../types";

/** クーポンデータ（12個） */
export const SEED_COUPONS: SeedCoupon[] = [
  {
    code: "NOIR2026SPRING",
    storeUrl: "lux-noir-elegance",
    startDate: "2026-03-01T00:00:00Z",
    endDate: "2026-04-30T23:59:59Z",
    discount: 15,
  },
  // ... 残り11個
];
```

上記の要件を満たす `prisma/seed/constants/coupons.ts` ファイルの内容を生成してください。
```

---

### 5-2. 配送先データ

#### 対象ファイル: `prisma/seed/constants/shipping.ts`

```
マルチベンダーEコマースプロジェクトの配送先住所ダミーデータを生成してください。

## 要件
- 5名の顧客（USERロール）に対して、各1-2個の配送先住所（合計7-10個）
- リアルな住所データ（国によって異なる形式）
- デフォルト配送先を1つ設定

## 型定義

```typescript
import type { SeedShippingAddress } from "../types";

type SeedShippingAddress = {
  userEmail: string;      // ユーザーのemail（SEED_USERSのUSERロール）
  firstName: string;
  lastName: string;
  phone: string;
  address1: string;
  address2?: string;
  state: string;
  city: string;
  zip_code: string;
  countryCode: string;    // 国のcode（SEED_COUNTRIESより）
  default: boolean;       // デフォルト配送先か
};
```

## 利用可能なデータ

### 顧客ユーザー（5名）
```typescript
const userEmails = [
  "lux-seed-user-yuki@example.com",     // Yuki Tanaka (日本)
  "lux-seed-user-emily@example.com",    // Emily Chen (米国/カナダ)
  "lux-seed-user-sophie@example.com",   // Sophie Martin (フランス)
  "lux-seed-user-alex@example.com",     // Alexander Kim (韓国/米国)
  "lux-seed-user-bella@example.com",    // Isabella Romano (イタリア)
];
```

### 国コード（SEED_COUNTRIES より）
```typescript
const countryCodes = ["JP", "US", "FR", "IT", "GB", "DE", "KR", "CN", "AU", "CA"];
```

## 出力形式

```typescript
import type { SeedShippingAddress } from "../types";

/** 配送先住所データ（7-10個） */
export const SEED_SHIPPING_ADDRESSES: SeedShippingAddress[] = [
  {
    userEmail: "lux-seed-user-yuki@example.com",
    firstName: "Yuki",
    lastName: "Tanaka",
    phone: "+81-3-1234-5678",
    address1: "1-2-3 Shibuya",
    address2: "Apt 101",
    state: "Tokyo",
    city: "Shibuya-ku",
    zip_code: "150-0002",
    countryCode: "JP",
    default: true,
  },
  // ... 残り6-9個
];
```

上記の要件を満たす `prisma/seed/constants/shipping.ts` ファイルの内容を生成してください。
```

---

### 5-3. 注文データ

#### 対象ファイル: `prisma/seed/constants/orders.ts`

```
マルチベンダーEコマースプロジェクトの注文ダミーデータを生成してください。

## 要件
- 15-20件の注文
- 全OrderStatus値を網羅（PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED）
- 全PaymentStatus値を網羅（PENDING, PAID, FAILED, REFUNDED, CANCELLED）
- 一部の注文でクーポンを使用
- 各注文は1-3店舗のグループを含む
- 各グループは1-4商品を含む

## 型定義

```typescript
import type { SeedOrder, SeedOrderGroup, SeedOrderItem } from "../types";

type SeedOrderItem = {
  productSlug: string;     // 商品のslug
  variantSlug: string;     // バリアントのslug
  size: string;            // サイズ名
  quantity: number;        // 購入数量（1-3）
  status: ProductStatus;   // "ACTIVE" | "INACTIVE"（通常はACTIVE）
};

type SeedOrderGroup = {
  storeUrl: string;        // ストアのurl
  status: OrderStatus;     // 注文ステータス
  couponCode?: string;     // クーポンコード（オプション）
  items: SeedOrderItem[];  // 商品リスト
};

type SeedOrder = {
  seedKey: string;              // 決定論的ID生成用キー（例: "order-001"）
  userEmail: string;            // 注文者のemail
  shippingAddressIndex: number; // 配送先インデックス（0 = default）
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod; // "STRIPE" | "PAYPAL"（オプション）
  groups: SeedOrderGroup[];
};

// Enums
type OrderStatus = "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "CANCELLED";
type PaymentMethod = "STRIPE" | "PAYPAL";
type ProductStatus = "ACTIVE" | "INACTIVE";
```

## 利用可能なデータ

### 顧客（5名）
```typescript
const userEmails = [
  "lux-seed-user-yuki@example.com",
  "lux-seed-user-emily@example.com",
  "lux-seed-user-sophie@example.com",
  "lux-seed-user-alex@example.com",
  "lux-seed-user-bella@example.com",
];
```

### クーポンコード（coupons.ts より、例）
```typescript
const couponCodes = [
  "NOIR2026SPRING",
  "MAISON15OFF",
  "ATELIER20",
  // ... など
];
```

### 商品・バリアント・サイズ（reviews.ts のプロンプト参照）

## 出力形式

```typescript
import type { SeedOrder } from "../types";

/** 注文データ（15-20件） */
export const SEED_ORDERS: SeedOrder[] = [
  {
    seedKey: "order-001",
    userEmail: "lux-seed-user-yuki@example.com",
    shippingAddressIndex: 0,
    orderStatus: "DELIVERED",
    paymentStatus: "PAID",
    paymentMethod: "STRIPE",
    groups: [
      {
        storeUrl: "lux-noir-elegance",
        status: "DELIVERED",
        couponCode: "NOIR2026SPRING",
        items: [
          {
            productSlug: "lux-noir-cashmere-double-breasted-coat",
            variantSlug: "lux-noir-cashmere-coat-black",
            size: "M",
            quantity: 1,
            status: "ACTIVE",
          },
        ],
      },
    ],
  },
  // ... 残り14-19件
];
```

## 注意事項
- seedKeyは一意（例: "order-001", "order-002", ...）
- 各ステータスが最低1回は使われること
- 注文日時の古い順に並べる想定（seedKeyの番号順）
- DELIVERED注文は主にpaymentStatus: "PAID"
- CANCELLED注文は主にpaymentStatus: "CANCELLED"
- REFUNDED注文はpaymentStatus: "REFUNDED"

上記の要件を満たす `prisma/seed/constants/orders.ts` ファイルの内容を生成してください。
```

---

## 使用手順

1. 各プロンプトをGeminiにコピー&ペースト
2. 生成されたコードを対応するファイルに保存
3. バリデーションテストを実行: `bun run test -- --testPathPatterns="prisma/seed/__tests__/"`
4. エラーがあれば修正
5. seederの実装とテストを進める
