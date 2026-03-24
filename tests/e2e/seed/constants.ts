type E2ESeedOptions = {
  workerIndex?: number;
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
  store: {
    name: "E2E Store",
    description: "E2E seed store for Playwright tests.",
    email: "e2e-store@example.com",
    phone: "0000000000",
    url: "e2e-store",
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

const normalizeSeedSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const resolveWorkerIndex = (workerIndex?: number) => {
  if (typeof workerIndex === "number" && Number.isFinite(workerIndex)) {
    return workerIndex;
  }
  const envIndex =
    process.env.TEST_WORKER_INDEX || process.env.E2E_WORKER_INDEX;
  if (!envIndex) {
    return undefined;
  }
  const parsed = Number.parseInt(envIndex, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
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
  const workerIndex = resolveWorkerIndex(options?.workerIndex);
  const workerSegment =
    workerIndex === undefined ? "" : `w${workerIndex}`;
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
    variant: {
      ...BASE_E2E_SEED.variant,
      slug: withSuffix(BASE_E2E_SEED.variant.slug, suffix),
      sku: withSuffix(BASE_E2E_SEED.variant.sku, suffix),
    },
    size: BASE_E2E_SEED.size,
    variantImage: BASE_E2E_SEED.variantImage,
    color: BASE_E2E_SEED.color,
  };
};

export const E2E_SEED = buildE2ESeed();
