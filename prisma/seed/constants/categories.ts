import type { SeedCategory, SeedSubCategory } from "../types";

const defaultImage = "/assets/images/no_image.png";

/** メインカテゴリ（7カテゴリ） */
export const SEED_CATEGORIES: SeedCategory[] = [
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
];

/** サブカテゴリ（25個） */
export const SEED_SUB_CATEGORIES: SeedSubCategory[] = [
  // Women
  {
    name: "Dresses",
    url: "lux-women-dresses",
    image: defaultImage,
    featured: true,
    categoryUrl: "lux-women",
  },
  {
    name: "Coats",
    url: "lux-women-coats",
    image: defaultImage,
    featured: true,
    categoryUrl: "lux-women",
  },
  {
    name: "Blouses",
    url: "lux-women-blouses",
    image: defaultImage,
    featured: false,
    categoryUrl: "lux-women",
  },
  {
    name: "Skirts",
    url: "lux-women-skirts",
    image: defaultImage,
    featured: false,
    categoryUrl: "lux-women",
  },
  {
    name: "Trousers",
    url: "lux-women-trousers",
    image: defaultImage,
    featured: false,
    categoryUrl: "lux-women",
  },

  // Men
  {
    name: "Suits",
    url: "lux-men-suits",
    image: defaultImage,
    featured: true,
    categoryUrl: "lux-men",
  },
  {
    name: "Shirts",
    url: "lux-men-shirts",
    image: defaultImage,
    featured: false,
    categoryUrl: "lux-men",
  },
  {
    name: "Trousers",
    url: "lux-men-trousers",
    image: defaultImage,
    featured: false,
    categoryUrl: "lux-men",
  },
  {
    name: "Outerwear",
    url: "lux-men-outerwear",
    image: defaultImage,
    featured: true,
    categoryUrl: "lux-men",
  },

  // Accessories
  {
    name: "Scarves",
    url: "lux-acc-scarves",
    image: defaultImage,
    featured: true,
    categoryUrl: "lux-accessories",
  },
  {
    name: "Belts",
    url: "lux-acc-belts",
    image: defaultImage,
    featured: false,
    categoryUrl: "lux-accessories",
  },
  {
    name: "Sunglasses",
    url: "lux-acc-sunglasses",
    image: defaultImage,
    featured: false,
    categoryUrl: "lux-accessories",
  },
  {
    name: "Gloves",
    url: "lux-acc-gloves",
    image: defaultImage,
    featured: false,
    categoryUrl: "lux-accessories",
  },

  // Shoes
  {
    name: "Heels",
    url: "lux-shoes-heels",
    image: defaultImage,
    featured: true,
    categoryUrl: "lux-shoes",
  },
  {
    name: "Loafers",
    url: "lux-shoes-loafers",
    image: defaultImage,
    featured: false,
    categoryUrl: "lux-shoes",
  },
  {
    name: "Boots",
    url: "lux-shoes-boots",
    image: defaultImage,
    featured: false,
    categoryUrl: "lux-shoes",
  },

  // Bags
  {
    name: "Handbags",
    url: "lux-bags-handbags",
    image: defaultImage,
    featured: true,
    categoryUrl: "lux-bags",
  },
  {
    name: "Clutches",
    url: "lux-bags-clutches",
    image: defaultImage,
    featured: false,
    categoryUrl: "lux-bags",
  },
  {
    name: "Totes",
    url: "lux-bags-totes",
    image: defaultImage,
    featured: false,
    categoryUrl: "lux-bags",
  },

  // Jewelry
  {
    name: "Necklaces",
    url: "lux-jewelry-necklaces",
    image: defaultImage,
    featured: true,
    categoryUrl: "lux-jewelry",
  },
  {
    name: "Rings",
    url: "lux-jewelry-rings",
    image: defaultImage,
    featured: false,
    categoryUrl: "lux-jewelry",
  },
  {
    name: "Earrings",
    url: "lux-jewelry-earrings",
    image: defaultImage,
    featured: false,
    categoryUrl: "lux-jewelry",
  },
  {
    name: "Bracelets",
    url: "lux-jewelry-bracelets",
    image: defaultImage,
    featured: false,
    categoryUrl: "lux-jewelry",
  },

  // Watches
  {
    name: "Classic",
    url: "lux-watches-classic",
    image: defaultImage,
    featured: true,
    categoryUrl: "lux-watches",
  },
  {
    name: "Sport",
    url: "lux-watches-sport",
    image: defaultImage,
    featured: false,
    categoryUrl: "lux-watches",
  },
];
