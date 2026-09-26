import type { SeedProduct } from "../../types";

const img = "/assets/images/no_image.png";

/**
 * カテゴリ別属性のパイロット部門（家電・食品）の商品（plan 069 フォローアップ）。
 *
 * ファッション 6 店舗の各 6 商品（36 商品）とは別枠。家電・食品のカテゴリは属性定義の
 * 置き場所として追加したが商品が無く、店頭で「Specifications」を確認できなかったため
 * 1 部門 1 商品だけ置く。属性値は `constants/attributes.ts` の `SEED_ATTRIBUTE_VALUES`。
 */
export const PILOT_PRODUCTS: SeedProduct[] = [
    // ── 家電: 継承（ルートの connectivity + カメラ子ノードの定義）と VARIANT 属性の例 ──
    {
        name: "Rangefinder Digital Camera",
        description:
            "The Rangefinder Digital Camera pairs a hand-finished brass top plate with a full-frame sensor tuned for natural skin tones and deep blacks. The optical rangefinder is calibrated by hand in our atelier, and the leather wrap is cut from the same vegetable-tanned hides used in our small leather goods. A bright rear display and silent electronic shutter make it as discreet at an evening event as it is on the street.",
        slug: "lux-atelier-rangefinder-camera",
        brand: "ATELIER DIVINE",
        shippingFeeMethod: "ITEM",
        storeUrl: "lux-atelier-divine",
        categoryUrl: "lux-electronics-cameras",
        variants: [
            {
                variantName: "Brass 256GB",
                variantDescription:
                    "Brushed brass top plate with 256GB of internal storage.",
                slug: "lux-atelier-rangefinder-camera-256",
                sku: "ATEL-EC-001-256",
                weight: 0.7,
                isSale: false,
                keywords: [
                    "rangefinder",
                    "digital camera",
                    "full frame",
                    "brass camera",
                    "luxury camera",
                ],
                colors: [{ name: "Brass" }],
                sizes: [
                    { size: "One Size", quantity: 4, price: 6900, discount: 0 },
                ],
                images: [
                    {
                        url: img,
                        alt: "Rangefinder Digital Camera - Front View",
                    },
                    { url: img, alt: "Rangefinder Digital Camera - Top Plate" },
                    {
                        url: img,
                        alt: "Rangefinder Digital Camera - Rear Display",
                    },
                ],
                specs: [
                    { name: "Warranty", value: "3 years (atelier service)" },
                ],
            },
            {
                variantName: "Black 512GB",
                variantDescription:
                    "Black chrome top plate with 512GB of internal storage.",
                slug: "lux-atelier-rangefinder-camera-512",
                sku: "ATEL-EC-001-512",
                weight: 0.7,
                isSale: false,
                keywords: [
                    "rangefinder",
                    "digital camera",
                    "full frame",
                    "black camera",
                    "luxury camera",
                ],
                colors: [{ name: "Black Chrome" }],
                sizes: [
                    { size: "One Size", quantity: 3, price: 7600, discount: 0 },
                ],
                images: [
                    {
                        url: img,
                        alt: "Rangefinder Digital Camera Black - Front View",
                    },
                    {
                        url: img,
                        alt: "Rangefinder Digital Camera Black - Top Plate",
                    },
                    {
                        url: img,
                        alt: "Rangefinder Digital Camera Black - Rear",
                    },
                ],
                specs: [
                    { name: "Warranty", value: "3 years (atelier service)" },
                ],
            },
        ],
        questions: [
            {
                question: "Does the camera support interchangeable lenses?",
                answer: "Yes. It accepts M-mount lenses; the rangefinder is calibrated for focal lengths from 28mm to 90mm.",
            },
            {
                question: "Can the internal storage be expanded?",
                answer: "No. Storage is fixed per variant, which is why the 256GB and 512GB models are offered separately.",
            },
        ],
    },

    // ── 食品: 必須属性（allergens は多値）と VARIANT の内容量 ──
    {
        name: "Grand Cru Chocolate Assortment",
        description:
            "The Grand Cru Chocolate Assortment gathers single-origin ganaches and pralines made in small batches by our Paris chocolatier. Each piece is enrobed by hand in couverture from a single plantation and finished with a transfer print inspired by our seasonal collections. The assortment is presented in a lacquered keepsake box, making it an elegant gift for the holidays or a refined companion to afternoon tea.",
        slug: "lux-lumiere-grand-cru-chocolate",
        brand: "LUMIERE PARIS",
        shippingFeeMethod: "ITEM",
        storeUrl: "lux-lumiere-paris",
        categoryUrl: "lux-gourmet-chocolate",
        variants: [
            {
                variantName: "Box of 12",
                variantDescription: "Twelve assorted ganaches and pralines.",
                slug: "lux-lumiere-grand-cru-chocolate-12",
                sku: "LUMI-GC-001-12",
                weight: 0.3,
                isSale: false,
                keywords: [
                    "chocolate",
                    "grand cru",
                    "praline",
                    "ganache",
                    "gift box",
                ],
                colors: [{ name: "Noir" }],
                sizes: [
                    { size: "12 pieces", quantity: 20, price: 68, discount: 0 },
                ],
                images: [
                    {
                        url: img,
                        alt: "Grand Cru Chocolate Assortment 12 - Box",
                    },
                    {
                        url: img,
                        alt: "Grand Cru Chocolate Assortment 12 - Pieces",
                    },
                    {
                        url: img,
                        alt: "Grand Cru Chocolate Assortment 12 - Detail",
                    },
                ],
                specs: [
                    { name: "Storage", value: "Keep between 15 and 18 °C" },
                ],
            },
            {
                variantName: "Box of 24",
                variantDescription:
                    "Twenty-four assorted ganaches and pralines.",
                slug: "lux-lumiere-grand-cru-chocolate-24",
                sku: "LUMI-GC-001-24",
                weight: 0.55,
                isSale: false,
                keywords: [
                    "chocolate",
                    "grand cru",
                    "praline",
                    "ganache",
                    "gift box",
                ],
                colors: [{ name: "Noir" }],
                sizes: [
                    {
                        size: "24 pieces",
                        quantity: 12,
                        price: 124,
                        discount: 0,
                    },
                ],
                images: [
                    {
                        url: img,
                        alt: "Grand Cru Chocolate Assortment 24 - Box",
                    },
                    {
                        url: img,
                        alt: "Grand Cru Chocolate Assortment 24 - Pieces",
                    },
                    {
                        url: img,
                        alt: "Grand Cru Chocolate Assortment 24 - Detail",
                    },
                ],
                specs: [
                    { name: "Storage", value: "Keep between 15 and 18 °C" },
                ],
            },
        ],
        questions: [
            {
                question: "How long does the assortment keep?",
                answer: "Three weeks from the date of production when stored between 15 and 18 °C, away from light and strong odours.",
            },
            {
                question: "Is there a nut-free version?",
                answer: "Not for this assortment: several pralines contain hazelnuts and almonds, and all pieces are made on shared equipment.",
            },
        ],
    },
];
