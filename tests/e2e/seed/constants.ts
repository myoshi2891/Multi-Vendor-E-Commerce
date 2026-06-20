type E2ESeedOptions = {
  // Playwright の parallelIndex（0..workers-1 で安定し、ワーカー再起動後も再利用される）。
  // 旧実装は揮発的な workerIndex（生成ごとに単調増加）をキーにしていたため、
  // ワーカー再起動で index が増えると seed と実行で suffix が食い違っていた。
  parallelIndex?: number;
  projectName?: string;
  suffix?: string;
};

const BASE_E2E_SEED = {
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
  customer: {
    name: "E2E Customer",
    email: "e2e-customer@example.com",
    picture: "/assets/images/default-user.jpg",
  },
  store: {
    name: "E2E Store",
    description: "E2E seed store for Playwright tests.",
    email: "e2e-store@example.com",
    phone: "0000000000",
    url: "e2e-store",
    logo: "/assets/images/no_image.png",
    cover: "/assets/images/home-wallpaper.webp",
  },
  storeB: {
    name: "E2E Store B",
    description: "Second E2E seed store for platform coupon Playwright tests.",
    email: "e2e-store-b@example.com",
    phone: "0000000001",
    url: "e2e-store-b",
    logo: "/assets/images/no_image.png",
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
  variants: [
    {
      name: "Default",
      slug: "e2e-variant",
      description: "Default variant for E2E testing.",
      sku: "E2E-SKU-1",
      weight: 1.2,
      image: "/assets/images/no_image.png",
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
    },
    {
      name: "Alternate",
      slug: "e2e-variant-2",
      description: "Second variant for multi-variant cart test.",
      sku: "E2E-SKU-2",
      weight: 1.2,
      image: "/assets/images/no_image.png",
      size: {
        size: "M",
        quantity: 10,
        price: 109,
        discount: 0,
      },
      variantImage: {
        url: "/assets/images/no_image.png",
        alt: "E2E product image 2",
      },
      color: {
        name: "White",
      },
    },
  ],
  productB: {
    name: "E2E Test Product B",
    slug: "e2e-test-product-b",
    description: "Second store's seeded product for platform coupon Playwright test.",
    brand: "E2E Brand B",
  },
  variantB: {
    name: "Default",
    slug: "e2e-variant-b",
    description: "Default variant for store B E2E testing.",
    sku: "E2E-SKU-B-1",
    weight: 1.0,
    image: "/assets/images/no_image.png",
    size: {
      size: "M",
      quantity: 10,
      price: 49,
      discount: 0,
    },
    variantImage: {
      url: "/assets/images/no_image.png",
      alt: "E2E product image B",
    },
    color: {
      name: "Blue",
    },
  },
  platformCoupon: {
    code: "E2E-PLATFORM-10",
    discount: 10,
    startDate: "2020-01-01",
    endDate: "2099-12-31",
  },
} as const;

const normalizeSeedSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// 負数・小数は `w-1` / `w1.5` のような不正な seed suffix を生むため、
// 非負整数のみを許可する。
const isNonNegativeInteger = (value: number) =>
  Number.isInteger(value) && value >= 0;

const resolveParallelIndex = (parallelIndex?: number) => {
  if (typeof parallelIndex === "number" && isNonNegativeInteger(parallelIndex)) {
    return parallelIndex;
  }
  const envIndex =
    process.env.TEST_PARALLEL_INDEX || process.env.E2E_PARALLEL_INDEX;
  if (!envIndex) {
    return undefined;
  }
  // Number.parseInt は部分パースのため "1.5"→1 / "2abc"→2 を通してしまう。
  // 完全な非負整数文字列のみを許可する。
  const trimmed = envIndex.trim();
  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return isNonNegativeInteger(parsed) ? parsed : undefined;
};

const resolveProjectName = (projectName?: string) => {
  const envProject =
    process.env.TEST_PROJECT_NAME || process.env.E2E_PROJECT_NAME;
  const raw = projectName || envProject;
  return raw ? normalizeSeedSegment(raw) : "";
};

const resolveSeedSuffix = (options?: E2ESeedOptions) => {
  if (options?.suffix) {
    return normalizeSeedSegment(options.suffix);
  }
  const projectSegment = resolveProjectName(options?.projectName);
  const parallelIndex = resolveParallelIndex(options?.parallelIndex);
  // suffix の `w` プレフィックスは既存 seed データとの互換のため維持する
  const workerSegment =
    parallelIndex === undefined ? "" : `w${parallelIndex}`;
  return [projectSegment, workerSegment].filter(Boolean).join("-");
};

const withSuffix = (value: string, suffix: string, separator = "-") =>
  suffix ? `${value}${separator}${suffix}` : value;

const withEmailSuffix = (email: string, suffix: string) => {
  if (!suffix) {
    return email;
  }
  const [local, domain] = email.split("@");
  if (!local || !domain) {
    return email;
  }
  return `${local}+${suffix}@${domain}`;
};

export const buildE2ESeed = (options?: E2ESeedOptions) => {
  const suffix = resolveSeedSuffix(options);
  const uppercaseSuffix = suffix ? suffix.toUpperCase() : "";

  const variants = BASE_E2E_SEED.variants.map((v) => ({
    name: v.name,
    description: v.description,
    image: v.image,
    weight: v.weight,
    slug: withSuffix(v.slug, suffix),
    sku: withSuffix(v.sku, suffix),
    size: { ...v.size },
    variantImage: { ...v.variantImage },
    color: { ...v.color },
  }));

  if (!variants || variants.length === 0) {
    throw new Error(
      "buildE2ESeed: cannot derive primaryVariant — `variants` is empty or undefined. Ensure BASE_E2E_SEED.variants has at least one entry."
    );
  }
  const primaryVariant = variants[0];

  return {
    country: {
      name: withSuffix(
        BASE_E2E_SEED.country.name,
        uppercaseSuffix,
        " "
      ),
      code: withSuffix(
        BASE_E2E_SEED.country.code,
        uppercaseSuffix,
        "-"
      ),
      city: BASE_E2E_SEED.country.city,
      region: BASE_E2E_SEED.country.region,
    },
    user: {
      ...BASE_E2E_SEED.user,
      email: withEmailSuffix(BASE_E2E_SEED.user.email, suffix),
    },
    customer: {
      ...BASE_E2E_SEED.customer,
      email: withEmailSuffix(BASE_E2E_SEED.customer.email, suffix),
    },
    store: {
      ...BASE_E2E_SEED.store,
      email: withEmailSuffix(BASE_E2E_SEED.store.email, suffix),
      url: withSuffix(BASE_E2E_SEED.store.url, suffix),
    },
    category: {
      ...BASE_E2E_SEED.category,
      url: withSuffix(BASE_E2E_SEED.category.url, suffix),
    },
    subCategory: {
      ...BASE_E2E_SEED.subCategory,
      url: withSuffix(BASE_E2E_SEED.subCategory.url, suffix),
    },
    product: {
      ...BASE_E2E_SEED.product,
      slug: withSuffix(BASE_E2E_SEED.product.slug, suffix),
    },
    variants,
    // 既存テスト互換: 単数エクスポートは variants[0] の別名
    variant: {
      name: primaryVariant.name,
      slug: primaryVariant.slug,
      description: primaryVariant.description,
      sku: primaryVariant.sku,
      weight: primaryVariant.weight,
      image: primaryVariant.image,
    },
    size: primaryVariant.size,
    variantImage: primaryVariant.variantImage,
    color: primaryVariant.color,
    storeB: {
      ...BASE_E2E_SEED.storeB,
      email: withEmailSuffix(BASE_E2E_SEED.storeB.email, suffix),
      url: withSuffix(BASE_E2E_SEED.storeB.url, suffix),
    },
    productB: {
      ...BASE_E2E_SEED.productB,
      slug: withSuffix(BASE_E2E_SEED.productB.slug, suffix),
    },
    variantB: {
      name: BASE_E2E_SEED.variantB.name,
      description: BASE_E2E_SEED.variantB.description,
      image: BASE_E2E_SEED.variantB.image,
      weight: BASE_E2E_SEED.variantB.weight,
      slug: withSuffix(BASE_E2E_SEED.variantB.slug, suffix),
      sku: withSuffix(BASE_E2E_SEED.variantB.sku, suffix),
      size: { ...BASE_E2E_SEED.variantB.size },
      variantImage: { ...BASE_E2E_SEED.variantB.variantImage },
      color: { ...BASE_E2E_SEED.variantB.color },
    },
    platformCoupon: {
      ...BASE_E2E_SEED.platformCoupon,
      code: withSuffix(BASE_E2E_SEED.platformCoupon.code, uppercaseSuffix),
    },
  };
};

export const E2E_SEED = buildE2ESeed();
