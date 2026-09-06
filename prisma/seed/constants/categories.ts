import type { SeedCategory } from "../types";

const defaultImage = "/assets/images/no_image.png";

/**
 * カテゴリツリー（ルート 7 + 子 25 = 32 ノード）。
 *
 * plan 066 Phase A で SubCategory を廃し、`parentUrl` を持つ単一の木にした。
 * 商品は必ず**リーフ**（= 子を持たないノード）に紐づく。
 *
 * 現状は depth 1 までしか置いていない。Phase A の Product はまだ旧 FK
 * （categoryId = ルート / subCategoryId = リーフ）が必須で、legacy SubCategory 行は
 * ルート直下しか表現できないためである。3 階層目は読み取りが新 FK へ移る
 * plan 067 以降で入れる。
 */
export const SEED_CATEGORIES: SeedCategory[] = [
    // ===== ルート（depth 0）=====
    { name: "Women", url: "lux-women", image: defaultImage, featured: true },
    { name: "Men", url: "lux-men", image: defaultImage, featured: true },
    {
        name: "Accessories",
        url: "lux-accessories",
        image: defaultImage,
        featured: true,
    },
    { name: "Shoes", url: "lux-shoes", image: defaultImage, featured: false },
    { name: "Bags", url: "lux-bags", image: defaultImage, featured: true },
    {
        name: "Jewelry",
        url: "lux-jewelry",
        image: defaultImage,
        featured: false,
    },
    {
        name: "Watches",
        url: "lux-watches",
        image: defaultImage,
        featured: false,
    },

    // ===== 子（depth 1）=====
    // Women
    {
        name: "Dresses",
        url: "lux-women-dresses",
        image: defaultImage,
        featured: true,
        parentUrl: "lux-women",
    },
    {
        name: "Coats",
        url: "lux-women-coats",
        image: defaultImage,
        featured: true,
        parentUrl: "lux-women",
    },
    {
        name: "Blouses",
        url: "lux-women-blouses",
        image: defaultImage,
        featured: false,
        parentUrl: "lux-women",
    },
    {
        name: "Skirts",
        url: "lux-women-skirts",
        image: defaultImage,
        featured: false,
        parentUrl: "lux-women",
    },
    {
        name: "Trousers",
        url: "lux-women-trousers",
        image: defaultImage,
        featured: false,
        parentUrl: "lux-women",
    },

    // Men
    {
        name: "Suits",
        url: "lux-men-suits",
        image: defaultImage,
        featured: true,
        parentUrl: "lux-men",
    },
    {
        name: "Shirts",
        url: "lux-men-shirts",
        image: defaultImage,
        featured: false,
        parentUrl: "lux-men",
    },
    {
        name: "Trousers",
        url: "lux-men-trousers",
        image: defaultImage,
        featured: false,
        parentUrl: "lux-men",
    },
    {
        name: "Outerwear",
        url: "lux-men-outerwear",
        image: defaultImage,
        featured: true,
        parentUrl: "lux-men",
    },

    // Accessories
    {
        name: "Scarves",
        url: "lux-acc-scarves",
        image: defaultImage,
        featured: true,
        parentUrl: "lux-accessories",
    },
    {
        name: "Belts",
        url: "lux-acc-belts",
        image: defaultImage,
        featured: false,
        parentUrl: "lux-accessories",
    },
    {
        name: "Sunglasses",
        url: "lux-acc-sunglasses",
        image: defaultImage,
        featured: false,
        parentUrl: "lux-accessories",
    },
    {
        name: "Gloves",
        url: "lux-acc-gloves",
        image: defaultImage,
        featured: false,
        parentUrl: "lux-accessories",
    },

    // Shoes
    {
        name: "Heels",
        url: "lux-shoes-heels",
        image: defaultImage,
        featured: true,
        parentUrl: "lux-shoes",
    },
    {
        name: "Loafers",
        url: "lux-shoes-loafers",
        image: defaultImage,
        featured: false,
        parentUrl: "lux-shoes",
    },
    {
        name: "Boots",
        url: "lux-shoes-boots",
        image: defaultImage,
        featured: false,
        parentUrl: "lux-shoes",
    },

    // Bags
    {
        name: "Handbags",
        url: "lux-bags-handbags",
        image: defaultImage,
        featured: true,
        parentUrl: "lux-bags",
    },
    {
        name: "Clutches",
        url: "lux-bags-clutches",
        image: defaultImage,
        featured: false,
        parentUrl: "lux-bags",
    },
    {
        name: "Totes",
        url: "lux-bags-totes",
        image: defaultImage,
        featured: false,
        parentUrl: "lux-bags",
    },

    // Jewelry
    {
        name: "Necklaces",
        url: "lux-jewelry-necklaces",
        image: defaultImage,
        featured: true,
        parentUrl: "lux-jewelry",
    },
    {
        name: "Rings",
        url: "lux-jewelry-rings",
        image: defaultImage,
        featured: false,
        parentUrl: "lux-jewelry",
    },
    {
        name: "Earrings",
        url: "lux-jewelry-earrings",
        image: defaultImage,
        featured: false,
        parentUrl: "lux-jewelry",
    },
    {
        name: "Bracelets",
        url: "lux-jewelry-bracelets",
        image: defaultImage,
        featured: false,
        parentUrl: "lux-jewelry",
    },

    // Watches
    {
        name: "Classic",
        url: "lux-watches-classic",
        image: defaultImage,
        featured: true,
        parentUrl: "lux-watches",
    },
    {
        name: "Sport",
        url: "lux-watches-sport",
        image: defaultImage,
        featured: false,
        parentUrl: "lux-watches",
    },
];
