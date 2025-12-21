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
    workerIndex: number;
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
    const explicitWorkerIndex = parseIntEnv(
        process.env.TEST_WORKER_INDEX || process.env.E2E_WORKER_INDEX
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
        if (explicitWorkerIndex !== undefined) {
            return [{ projectName, workerIndex: explicitWorkerIndex }];
        }
        const workerCount = normalizeWorkerCount(
            workerOverride ??
                projectConfig?.workers ??
                playwrightConfig.workers,
            defaultWorkerCount
        );
        return Array.from({ length: workerCount }, (_, workerIndex) => ({
            projectName,
            workerIndex,
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

    const variant = await prisma.productVariant.upsert({
        where: { slug: seed.variant.slug },
        create: {
            variantName: seed.variant.name,
            variantDescription: seed.variant.description,
            variantImage: seed.variant.image,
            slug: seed.variant.slug,
            sku: seed.variant.sku,
            weight: seed.variant.weight,
            productId: product.id,
        },
        update: {
            variantName: seed.variant.name,
            variantDescription: seed.variant.description,
            variantImage: seed.variant.image,
            sku: seed.variant.sku,
            weight: seed.variant.weight,
            productId: product.id,
        },
    });

    await prisma.size.deleteMany({ where: { productVariantId: variant.id } });
    await prisma.productVariantImage.deleteMany({
        where: { productVariantId: variant.id },
    });
    await prisma.color.deleteMany({ where: { productVariantId: variant.id } });

    await prisma.size.create({
        data: {
            size: seed.size.size,
            quantity: seed.size.quantity,
            price: seed.size.price,
            discount: seed.size.discount,
            productVariantId: variant.id,
        },
    });

    await prisma.productVariantImage.create({
        data: {
            url: seed.variantImage.url,
            alt: seed.variantImage.alt,
            productVariantId: variant.id,
        },
    });

    await prisma.color.create({
        data: {
            name: seed.color.name,
            productVariantId: variant.id,
        },
    });

    return { country, user, store, category, subCategory, product, variant };
};

/**
 * Seeds the database once for each computed seed target.
 *
 * Iterates the targets produced by resolveSeedTargets, builds a seed for each target with buildE2ESeed, executes seedOnce for each seed, and logs completion with the number of targets processed.
 */
async function main() {
    const seedTargets = resolveSeedTargets();

    for (const target of seedTargets) {
        const seed = buildE2ESeed(target);
        await seedOnce(seed);
    }
    console.log(`E2E seed completed (${seedTargets.length} target(s)).`);
}
