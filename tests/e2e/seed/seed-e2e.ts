import { PrismaClient } from "@prisma/client";
import os from "os";
import playwrightConfig from "../../../playwright.config";
import { buildE2ESeed } from "./constants";

const databaseUrl =
    process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || "";

if (!databaseUrl) {
    throw new Error("E2E_DATABASE_URL or DATABASE_URL must be set.");
}

const prisma = new PrismaClient({
    datasources: {
        db: { url: databaseUrl },
    },
});

type SeedTarget = {
    parallelIndex: number;
    projectName?: string;
};

const parseIntEnv = (value?: string) => {
    if (!value) {
        return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const parseListEnv = (value?: string) =>
    value
        ?.split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

const normalizeWorkerCount = (value: unknown, fallback: number) => {
    const normalizeNumber = (count: number) => {
        if (!Number.isFinite(count)) {
            return fallback;
        }
        const normalized = Math.floor(count);
        return normalized >= 1 ? normalized : fallback;
    };

    if (typeof value === "number") {
        return normalizeNumber(value);
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
            return fallback;
        }
        if (trimmed.endsWith("%")) {
            const percentage = Number.parseFloat(trimmed.slice(0, -1));
            if (!Number.isFinite(percentage)) {
                return fallback;
            }
            const computed = Math.floor((percentage / 100) * os.cpus().length);
            return computed >= 1 ? computed : fallback;
        }
        const parsed = Number.parseInt(trimmed, 10);
        return normalizeNumber(parsed);
    }

    return fallback;
};

const resolveSeedTargets = (): SeedTarget[] => {
    const explicitParallelIndex = parseIntEnv(
        process.env.TEST_PARALLEL_INDEX || process.env.E2E_PARALLEL_INDEX
    );
    const explicitProjectName =
        process.env.TEST_PROJECT_NAME || process.env.E2E_PROJECT_NAME;
    const projectOverrides = parseListEnv(process.env.E2E_SEED_PROJECTS);
    const workerOverride = parseIntEnv(
        process.env.E2E_SEED_WORKERS || process.env.TEST_WORKER_COUNT
    );

    const configProjects = Array.isArray(playwrightConfig.projects)
        ? playwrightConfig.projects
        : [];
    const projectNames = projectOverrides?.length
        ? projectOverrides
        : explicitProjectName
          ? [explicitProjectName]
          : [];
    const resolvedProjectNames =
        projectNames.length > 0
            ? projectNames
            : configProjects
                  .map((project) => project.name)
                  .filter((name): name is string => Boolean(name));

    const fallbackProjectNames =
        resolvedProjectNames.length > 0 ? resolvedProjectNames : [undefined];

    const defaultWorkerCount = normalizeWorkerCount(
        process.env.PLAYWRIGHT_WORKERS,
        os.cpus().length
    );

    return fallbackProjectNames.flatMap((projectName) => {
        const projectConfig = configProjects.find(
            (project) => project.name === projectName
        );
        if (explicitParallelIndex !== undefined) {
            return [{ projectName, parallelIndex: explicitParallelIndex }];
        }
        const workerCount = normalizeWorkerCount(
            workerOverride ??
                projectConfig?.workers ??
                playwrightConfig.workers,
            defaultWorkerCount
        );
        // parallelIndex の値域は 0..workers-1。Playwright がワーカーを再起動しても
        // 同じスロット番号が再利用されるため、ここで投入した範囲と実行が常に一致する。
        return Array.from({ length: workerCount }, (_, parallelIndex) => ({
            projectName,
            parallelIndex,
        }));
    });
};

const seedOnce = async (seed: ReturnType<typeof buildE2ESeed>) => {
    const country = await prisma.country.upsert({
        where: { code: seed.country.code },
        create: {
            name: seed.country.name,
            code: seed.country.code,
        },
        update: {
            name: seed.country.name,
        },
    });

    const user = await prisma.user.upsert({
        where: { email: seed.user.email },
        create: {
            name: seed.user.name,
            email: seed.user.email,
            picture: seed.user.picture,
        },
        update: {
            name: seed.user.name,
            picture: seed.user.picture,
        },
    });

    const store = await prisma.store.upsert({
        where: { url: seed.store.url },
        create: {
            name: seed.store.name,
            description: seed.store.description,
            email: seed.store.email,
            phone: seed.store.phone,
            url: seed.store.url,
            logo: seed.store.logo,
            cover: seed.store.cover,
            status: "ACTIVE",
            defaultShippingService: "International Delivery",
            defaultShippingFeePerItem: 0,
            defaultShippingFeeForAdditionalItem: 0,
            defaultShippingFeePerKg: 0,
            defaultShippingFeeFixed: 0,
            defaultDeliveryTimeMin: 3,
            defaultDeliveryTimeMax: 7,
            returnPolicy: "Return in 30 days.",
            userId: user.id,
        },
        update: {
            name: seed.store.name,
            description: seed.store.description,
            email: seed.store.email,
            phone: seed.store.phone,
            logo: seed.store.logo,
            cover: seed.store.cover,
            status: "ACTIVE",
            defaultShippingService: "International Delivery",
            defaultShippingFeePerItem: 0,
            defaultShippingFeeForAdditionalItem: 0,
            defaultShippingFeePerKg: 0,
            defaultShippingFeeFixed: 0,
            defaultDeliveryTimeMin: 3,
            defaultDeliveryTimeMax: 7,
            returnPolicy: "Return in 30 days.",
            userId: user.id,
        },
    });

    const category = await prisma.category.upsert({
        where: { url: seed.category.url },
        create: {
            name: seed.category.name,
            url: seed.category.url,
            image: seed.category.image,
            featured: false,
        },
        update: {
            name: seed.category.name,
            image: seed.category.image,
            featured: false,
        },
    });

    const subCategory = await prisma.subCategory.upsert({
        where: { url: seed.subCategory.url },
        create: {
            name: seed.subCategory.name,
            url: seed.subCategory.url,
            image: seed.subCategory.image,
            featured: false,
            categoryId: category.id,
        },
        update: {
            name: seed.subCategory.name,
            image: seed.subCategory.image,
            featured: false,
            categoryId: category.id,
        },
    });

    const product = await prisma.product.upsert({
        where: { slug: seed.product.slug },
        create: {
            name: seed.product.name,
            description: seed.product.description,
            slug: seed.product.slug,
            brand: seed.product.brand,
            shippingFeeMethod: "ITEM",
            storeId: store.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
        },
        update: {
            name: seed.product.name,
            description: seed.product.description,
            brand: seed.product.brand,
            shippingFeeMethod: "ITEM",
            storeId: store.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
        },
    });

    const variants: Array<{ id: string; slug: string }> = [];
    for (const v of seed.variants) {
        const variant = await prisma.productVariant.upsert({
            where: { slug: v.slug },
            create: {
                variantName: v.name,
                variantDescription: v.description,
                variantImage: v.image,
                slug: v.slug,
                sku: v.sku,
                weight: v.weight,
                productId: product.id,
            },
            update: {
                variantName: v.name,
                variantDescription: v.description,
                variantImage: v.image,
                sku: v.sku,
                weight: v.weight,
                productId: product.id,
            },
        });

        await prisma.size.deleteMany({
            where: { productVariantId: variant.id },
        });
        await prisma.productVariantImage.deleteMany({
            where: { productVariantId: variant.id },
        });
        await prisma.color.deleteMany({
            where: { productVariantId: variant.id },
        });

        await prisma.size.create({
            data: {
                size: v.size.size,
                quantity: v.size.quantity,
                price: v.size.price,
                discount: v.size.discount,
                productVariantId: variant.id,
            },
        });

        await prisma.productVariantImage.create({
            data: {
                url: v.variantImage.url,
                alt: v.variantImage.alt,
                productVariantId: variant.id,
            },
        });

        await prisma.color.create({
            data: {
                name: v.color.name,
                productVariantId: variant.id,
            },
        });

        variants.push({ id: variant.id, slug: variant.slug });
    }

    // Second store + product (PLATFORM クーポンのマルチストア検証用)
    const storeB = await prisma.store.upsert({
        where: { url: seed.storeB.url },
        create: {
            name: seed.storeB.name,
            description: seed.storeB.description,
            email: seed.storeB.email,
            phone: seed.storeB.phone,
            url: seed.storeB.url,
            logo: seed.storeB.logo,
            cover: seed.storeB.cover,
            status: "ACTIVE",
            defaultShippingService: "International Delivery",
            defaultShippingFeePerItem: 0,
            defaultShippingFeeForAdditionalItem: 0,
            defaultShippingFeePerKg: 0,
            defaultShippingFeeFixed: 0,
            defaultDeliveryTimeMin: 3,
            defaultDeliveryTimeMax: 7,
            returnPolicy: "Return in 30 days.",
            userId: user.id,
        },
        update: {
            name: seed.storeB.name,
            description: seed.storeB.description,
            email: seed.storeB.email,
            phone: seed.storeB.phone,
            logo: seed.storeB.logo,
            cover: seed.storeB.cover,
            status: "ACTIVE",
            defaultShippingService: "International Delivery",
            defaultShippingFeePerItem: 0,
            defaultShippingFeeForAdditionalItem: 0,
            defaultShippingFeePerKg: 0,
            defaultShippingFeeFixed: 0,
            defaultDeliveryTimeMin: 3,
            defaultDeliveryTimeMax: 7,
            returnPolicy: "Return in 30 days.",
            userId: user.id,
        },
    });

    const productB = await prisma.product.upsert({
        where: { slug: seed.productB.slug },
        create: {
            name: seed.productB.name,
            description: seed.productB.description,
            slug: seed.productB.slug,
            brand: seed.productB.brand,
            shippingFeeMethod: "ITEM",
            storeId: storeB.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
        },
        update: {
            name: seed.productB.name,
            description: seed.productB.description,
            brand: seed.productB.brand,
            shippingFeeMethod: "ITEM",
            storeId: storeB.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
        },
    });

    const variantB = await prisma.productVariant.upsert({
        where: { slug: seed.variantB.slug },
        create: {
            variantName: seed.variantB.name,
            variantDescription: seed.variantB.description,
            variantImage: seed.variantB.image,
            slug: seed.variantB.slug,
            sku: seed.variantB.sku,
            weight: seed.variantB.weight,
            productId: productB.id,
        },
        update: {
            variantName: seed.variantB.name,
            variantDescription: seed.variantB.description,
            variantImage: seed.variantB.image,
            sku: seed.variantB.sku,
            weight: seed.variantB.weight,
            productId: productB.id,
        },
    });

    await prisma.size.deleteMany({ where: { productVariantId: variantB.id } });
    await prisma.productVariantImage.deleteMany({
        where: { productVariantId: variantB.id },
    });
    await prisma.color.deleteMany({ where: { productVariantId: variantB.id } });

    await prisma.size.create({
        data: {
            size: seed.variantB.size.size,
            quantity: seed.variantB.size.quantity,
            price: seed.variantB.size.price,
            discount: seed.variantB.size.discount,
            productVariantId: variantB.id,
        },
    });

    await prisma.productVariantImage.create({
        data: {
            url: seed.variantB.variantImage.url,
            alt: seed.variantB.variantImage.alt,
            productVariantId: variantB.id,
        },
    });

    await prisma.color.create({
        data: {
            name: seed.variantB.color.name,
            productVariantId: variantB.id,
        },
    });

    // オファータグ（/offers 一覧 → /browse?offer=<url> 導線の E2E 用）。
    // productB に紐付けることで /offers のカードが「1 商品」以上を表示する。
    const offerTag = await prisma.offerTag.upsert({
        where: { url: seed.offerTag.url },
        create: {
            name: seed.offerTag.name,
            url: seed.offerTag.url,
        },
        update: {
            name: seed.offerTag.name,
        },
    });

    await prisma.product.update({
        where: { id: productB.id },
        data: { offerTagId: offerTag.id },
    });

    // PLATFORM スコープクーポン（storeId なし・全店舗対象）
    const platformCoupon = await prisma.coupon.upsert({
        where: { code: seed.platformCoupon.code },
        create: {
            code: seed.platformCoupon.code,
            discount: seed.platformCoupon.discount,
            startDate: seed.platformCoupon.startDate,
            endDate: seed.platformCoupon.endDate,
            isActive: true,
            scope: "PLATFORM",
            storeId: null,
        },
        update: {
            discount: seed.platformCoupon.discount,
            startDate: seed.platformCoupon.startDate,
            endDate: seed.platformCoupon.endDate,
            isActive: true,
            scope: "PLATFORM",
            storeId: null,
        },
    });

    return {
        country,
        user,
        store,
        category,
        subCategory,
        product,
        variants,
        variant: variants[0],
        storeB,
        productB,
        variantB,
        platformCoupon,
        offerTag,
    };
};

/**
 * Seed the database for all configured targets.
 *
 * Processes each computed seed target, applies its seed data to the database, and logs completion with the number of targets processed.
 */
async function main() {
    const seedTargets = resolveSeedTargets();

    for (const target of seedTargets) {
        const seed = buildE2ESeed(target);
        await seedOnce(seed);
    }
    console.log(`E2E seed completed (${seedTargets.length} target(s)).`);
}

main()
    .catch((error) => {
        console.error("E2E seed failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });