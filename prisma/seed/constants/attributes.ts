import type {
    SeedAttributeDefinition,
    SeedAttributeOption,
    SeedAttributeValue,
} from "../types";

const options = (...pairs: [string, string][]): SeedAttributeOption[] =>
    pairs.map(([value, label]) => ({ value, label }));

/** ファッション部門の定義（design.md §4 部門 4）。衣料の 2 ルートに同じ key で置く。 */
const fashionDefinitions = (categoryUrl: string): SeedAttributeDefinition[] => [
    {
        categoryUrl,
        key: "material",
        name: "Material",
        type: "ENUM",
        scope: "PRODUCT",
        unit: null,
        required: true,
        facetable: true,
        multiValued: false,
        options: options(
            ["cotton", "Cotton"],
            ["wool", "Wool"],
            ["silk", "Silk"],
            ["linen", "Linen"],
            ["cashmere", "Cashmere"],
            ["leather", "Leather"],
            ["polyester", "Polyester"]
        ),
    },
    {
        categoryUrl,
        key: "pattern",
        name: "Pattern",
        type: "ENUM",
        scope: "PRODUCT",
        unit: null,
        required: false,
        facetable: true,
        multiValued: false,
        options: options(
            ["solid", "Solid"],
            ["striped", "Striped"],
            ["check", "Check"],
            ["floral", "Floral"]
        ),
    },
    {
        categoryUrl,
        key: "season",
        name: "Season",
        type: "ENUM",
        scope: "PRODUCT",
        unit: null,
        required: false,
        facetable: true,
        multiValued: false,
        options: options(
            ["spring_summer", "Spring / Summer"],
            ["autumn_winter", "Autumn / Winter"],
            ["all_season", "All season"]
        ),
    },
    {
        categoryUrl,
        key: "length",
        name: "Length",
        type: "NUMBER",
        scope: "PRODUCT",
        unit: "cm",
        required: false,
        facetable: true,
        multiValued: false,
    },
];

/**
 * パイロット 3 部門（家電・ファッション・食品）の属性定義（plan 069 Step 10 / design.md §4）。
 *
 * - 家電: 接続規格はルート、カメラ固有の定義は子ノードに置き、**継承**を実データで見せる
 * - 食品: `allergens` が唯一の**多値**（ENUM 限定・design.md §4「多値属性の決定」）。
 *   必須はコンプライアンス要件（Q5 hard）
 * - E2E シード（`e2e-*` カテゴリ）には属性を置かない —— 必須属性が既存 E2E の
 *   商品作成フローを落とさないよう `lux-*` に閉じる
 */
export const SEED_ATTRIBUTE_DEFINITIONS: SeedAttributeDefinition[] = [
    // ===== 家電（部門 1）=====
    {
        categoryUrl: "lux-electronics",
        key: "connectivity",
        name: "Connectivity",
        type: "ENUM",
        scope: "PRODUCT",
        unit: null,
        required: false,
        facetable: true,
        multiValued: false,
        options: options(
            ["hdmi_2_1", "HDMI 2.1"],
            ["usb_c", "USB-C"],
            ["wi_fi_6", "Wi-Fi 6"]
        ),
    },
    {
        categoryUrl: "lux-electronics-cameras",
        key: "screen_size",
        name: "Screen size",
        type: "NUMBER",
        scope: "PRODUCT",
        unit: "inch",
        required: false,
        facetable: true,
        multiValued: false,
    },
    {
        categoryUrl: "lux-electronics-cameras",
        key: "resolution",
        name: "Resolution",
        type: "ENUM",
        scope: "PRODUCT",
        unit: null,
        required: false,
        facetable: true,
        multiValued: false,
        options: options(["fhd", "FHD"], ["4k", "4K"], ["8k", "8K"]),
    },
    {
        categoryUrl: "lux-electronics-cameras",
        key: "storage_capacity",
        name: "Storage capacity",
        type: "NUMBER",
        scope: "VARIANT",
        unit: "GB",
        required: false,
        facetable: true,
        multiValued: false,
    },

    // ===== ファッション（部門 4）=====
    ...fashionDefinitions("lux-women"),
    ...fashionDefinitions("lux-men"),

    // ===== 食品（部門 9）=====
    {
        categoryUrl: "lux-gourmet",
        key: "allergens",
        name: "Allergens",
        type: "ENUM",
        scope: "PRODUCT",
        unit: null,
        required: true,
        facetable: true,
        multiValued: true,
        options: options(
            ["wheat", "Wheat"],
            ["egg", "Egg"],
            ["milk", "Milk"],
            ["peanut", "Peanut"],
            ["tree_nuts", "Tree nuts"],
            ["soy", "Soy"],
            ["none", "None"]
        ),
    },
    {
        categoryUrl: "lux-gourmet",
        key: "origin_country",
        name: "Country of origin",
        type: "ENUM",
        scope: "PRODUCT",
        unit: null,
        required: true,
        facetable: true,
        multiValued: false,
        options: options(
            ["be", "Belgium"],
            ["ch", "Switzerland"],
            ["fr", "France"],
            ["jp", "Japan"],
            ["in", "India"]
        ),
    },
    {
        categoryUrl: "lux-gourmet",
        key: "net_weight",
        name: "Net weight",
        type: "NUMBER",
        scope: "VARIANT",
        unit: "g",
        required: true,
        facetable: true,
        multiValued: false,
    },
    {
        categoryUrl: "lux-gourmet",
        key: "best_before_type",
        name: "Date label",
        type: "ENUM",
        scope: "PRODUCT",
        unit: null,
        required: false,
        facetable: true,
        multiValued: false,
        options: options(["best_before", "Best before"], ["use_by", "Use by"]),
    },
];

/** 商品ごとの属性値（fashion は既存 Spec の Material 記述から明確に言えるものだけ）。 */
const fashion = (
    productSlug: string,
    material: string,
    season: string
): SeedAttributeValue[] => [
    { productSlug, key: "material", value: material },
    { productSlug, key: "pattern", value: "solid" },
    { productSlug, key: "season", value: season },
];

/**
 * 属性値のシード（plan 069 フォローアップ: 店頭の「Specifications」を実データで確認するため）。
 *
 * - **Spec からの機械移行ではない**（design.md Q3）。既存の Material 記述を人が読み、
 *   選択肢に明確に対応するものだけを書いた。混紡で主素材が言えない 2 商品
 *   （`lux-maison-embroidered-tulle-blouse` のチュール / `lux-noir-satin-midi-skirt` の
 *   ポリエステル・シルク混）は構造化値を入れず、Spec だけで残す
 * - パイロット 2 商品は必須属性（食品の allergens / origin_country / net_weight）を満たす
 */
export const SEED_ATTRIBUTE_VALUES: SeedAttributeValue[] = [
    // ===== ファッション =====
    ...fashion(
        "lux-noir-cashmere-double-breasted-coat",
        "cashmere",
        "autumn_winter"
    ),
    ...fashion("lux-noir-silk-charmeuse-evening-dress", "silk", "all_season"),
    ...fashion("lux-noir-italian-wool-tailored-suit", "wool", "all_season"),
    ...fashion("lux-noir-merino-turtleneck-sweater", "wool", "autumn_winter"),
    ...fashion("lux-maison-hand-draped-silk-gown", "silk", "all_season"),
    ...fashion("lux-maison-structured-tweed-jacket", "wool", "autumn_winter"),
    ...fashion(
        "lux-maison-pleated-chiffon-maxi-dress",
        "silk",
        "spring_summer"
    ),
    ...fashion("lux-oro-italian-linen-summer-suit", "linen", "spring_summer"),
    ...fashion("lux-oro-cashmere-blend-overcoat", "wool", "autumn_winter"),
    ...fashion("lux-lumiere-boucle-cropped-jacket", "wool", "autumn_winter"),
    ...fashion("lux-lumiere-silk-camisole-top", "silk", "spring_summer"),
    ...fashion(
        "lux-lumiere-high-waisted-palazzo-trousers",
        "polyester",
        "all_season"
    ),

    // ===== 家電（ルートの connectivity を継承 + カメラ子ノードの定義）=====
    {
        productSlug: "lux-atelier-rangefinder-camera",
        key: "connectivity",
        value: "usb_c",
    },
    {
        productSlug: "lux-atelier-rangefinder-camera",
        key: "screen_size",
        value: "3",
    },
    {
        productSlug: "lux-atelier-rangefinder-camera",
        key: "resolution",
        value: "4k",
    },
    {
        productSlug: "lux-atelier-rangefinder-camera",
        variantSlug: "lux-atelier-rangefinder-camera-256",
        key: "storage_capacity",
        value: "256",
    },
    {
        productSlug: "lux-atelier-rangefinder-camera",
        variantSlug: "lux-atelier-rangefinder-camera-512",
        key: "storage_capacity",
        value: "512",
    },

    // ===== 食品（必須 + 多値 allergens）=====
    {
        productSlug: "lux-lumiere-grand-cru-chocolate",
        key: "allergens",
        value: ["milk", "tree_nuts", "soy"],
    },
    {
        productSlug: "lux-lumiere-grand-cru-chocolate",
        key: "origin_country",
        value: "fr",
    },
    {
        productSlug: "lux-lumiere-grand-cru-chocolate",
        key: "best_before_type",
        value: "best_before",
    },
    {
        productSlug: "lux-lumiere-grand-cru-chocolate",
        variantSlug: "lux-lumiere-grand-cru-chocolate-12",
        key: "net_weight",
        value: "150",
    },
    {
        productSlug: "lux-lumiere-grand-cru-chocolate",
        variantSlug: "lux-lumiere-grand-cru-chocolate-24",
        key: "net_weight",
        value: "300",
    },
];
