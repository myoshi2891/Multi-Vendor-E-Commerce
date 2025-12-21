export const E2E_SEED = {
  country: {
    name: "United States",
    code: "US",
    city: "",
    region: "",
  },
  user: {
    name: "E2E Seller",
    email: "e2e-seller@example.com",
    picture: "/assets/images/default-user.jpg",
  },
  store: {
    name: "E2E Store",
    description: "E2E seed store for Playwright tests.",
    email: "e2e-store@example.com",
    phone: "0000000000",
    url: "e2e-store",
    logo: "/assets/images/logo.png",
    cover: "/assets/images/home-wallpaper.webp",
  },
  category: {
    name: "E2E Category",
    url: "e2e-category",
    image: "/assets/images/no_image.png",
  },
  subCategory: {
    name: "E2E Subcategory",
    url: "e2e-subcategory",
    image: "/assets/images/no_image.png",
  },
  product: {
    name: "E2E Test Product",
    slug: "e2e-test-product",
    description: "Seeded product for Playwright cart smoke test.",
    brand: "E2E Brand",
  },
  variant: {
    name: "Default",
    slug: "e2e-variant",
    description: "Default variant for E2E testing.",
    sku: "E2E-SKU-1",
    weight: 1.2,
    image: "/assets/images/no_image.png",
  },
  size: {
    size: "M",
    quantity: 10,
    price: 99,
    discount: 0,
  },
  variantImage: {
    url: "/assets/images/no_image.png",
    alt: "E2E product image",
  },
  color: {
    name: "Black",
  },
} as const;
