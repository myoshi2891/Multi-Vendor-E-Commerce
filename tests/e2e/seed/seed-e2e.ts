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
            // ルートなので path = url / depth = 0（マイグレーション A-1 と同じ規則）
            path: seed.category.url,
            depth: 0,
            childCount: 1,
        },
        update: {
            name: seed.category.name,
            image: seed.category.image,
            featured: false,
        },
    });

    // Phase A（plan 066）: 子カテゴリは Category ノードと legacy SubCategory 行の
    // 両方として書く。id を共有させるので categoryNodeId は subCategoryId と常に同値。
    //
    // 既存 DB（066 以前にシード済み）には SubCategory 行だけが残っている。その場合に
    // Category ノードを新しい uuid で作ると id 共有が崩れ、Product.categoryNodeId が
    // 存在しない Category を指して FK 違反になる（update では PK を変えられないので
    // 後追いでは直せない）。よって**ノード作成の前に** legacy 行の id を読み、
    // それを共有 id として使う。
    const existingSubCategory = await prisma.subCategory.findUnique({
        where: { url: seed.subCategory.url },
        select: { id: true },
    });

    const subCategoryNode = await prisma.category.upsert({
        where: { url: seed.subCategory.url },
        create: {
            ...(existingSubCategory ? { id: existingSubCategory.id } : {}),
            name: seed.subCategory.name,
            url: seed.subCategory.url,
            image: seed.subCategory.image,
            featured: false,
            parentId: category.id,
            path: `${seed.category.url}/${seed.subCategory.url}`,
            depth: 1,
        },
        update: {
            name: seed.subCategory.name,
            image: seed.subCategory.image,
            featured: false,
            parentId: category.id,
            path: `${seed.category.url}/${seed.subCategory.url}`,
            depth: 1,
        },
    });

    const subCategory = await prisma.subCategory.upsert({
        where: { url: seed.subCategory.url },
        create: {
            id: subCategoryNode.id,
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

    // id 共有は Product.categoryNodeId の FK 前提そのもの。ここが崩れた DB は
    // 上の補正でも救えない（両行が別 id で既存）ので、FK 違反より手前で落とす。
    if (subCategory.id !== subCategoryNode.id) {
        throw new Error(
            `[seed-e2e] SubCategory(${subCategory.id}) と Category ノード(${subCategoryNode.id}) の ` +
                `id が一致しません。E2E DB をリセットしてから再実行してください（url: ${seed.subCategory.url}）。`
        );
    }

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
            categoryNodeId: subCategoryNode.id,
        },
        update: {
            name: seed.product.name,
            description: seed.product.description,
            brand: seed.product.brand,
            shippingFeeMethod: "ITEM",
            storeId: store.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
            categoryNodeId: subCategoryNode.id,
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
            categoryNodeId: subCategoryNode.id,
        },
        update: {
            name: seed.productB.name,
            description: seed.productB.description,
            brand: seed.productB.brand,
            shippingFeeMethod: "ITEM",
            storeId: storeB.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
            categoryNodeId: subCategoryNode.id,
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

    // /browse ページネーション E2E 用（plan 046）。
    // 専用カテゴリに 12 商品（pageSize 10 超）を隔離して 2 ページ構成を決定的にする。
    // 既存 category に足すと search-filter のカテゴリフィルタ assert と
    // purchase-flow の件数前提が壊れる。
    const paginationCategory = await prisma.category.upsert({
        where: { url: seed.paginationCategory.url },
        create: {
            name: seed.paginationCategory.name,
            url: seed.paginationCategory.url,
            image: seed.paginationCategory.image,
            featured: false,
            // ルートなので path = url / depth = 0（マイグレーション A-1 と同じ規則）
            path: seed.paginationCategory.url,
            depth: 0,
            childCount: 1,
        },
        update: {
            name: seed.paginationCategory.name,
            image: seed.paginationCategory.image,
            featured: false,
        },
    });

    // Phase A（plan 066）: 子カテゴリは Category ノードと legacy SubCategory 行の
    // 両方として書く。id を共有させるので categoryNodeId は subCategoryId と常に同値。
    // メインカテゴリ側と同じ理由で、**ノード作成の前に** legacy 行の id を読む
    // （066 以前にシード済みの DB では SubCategory 行だけが残っており、新しい uuid で
    //  Category ノードを作ると id 共有が崩れて FK 違反になる）。
    const existingPaginationSubCategory = await prisma.subCategory.findUnique({
        where: { url: seed.paginationSubCategory.url },
        select: { id: true },
    });

    const paginationSubCategoryNode = await prisma.category.upsert({
        where: { url: seed.paginationSubCategory.url },
        create: {
            ...(existingPaginationSubCategory
                ? { id: existingPaginationSubCategory.id }
                : {}),
            name: seed.paginationSubCategory.name,
            url: seed.paginationSubCategory.url,
            image: seed.paginationSubCategory.image,
            featured: false,
            parentId: paginationCategory.id,
            path: `${seed.paginationCategory.url}/${seed.paginationSubCategory.url}`,
            depth: 1,
        },
        update: {
            name: seed.paginationSubCategory.name,
            image: seed.paginationSubCategory.image,
            featured: false,
            parentId: paginationCategory.id,
            path: `${seed.paginationCategory.url}/${seed.paginationSubCategory.url}`,
            depth: 1,
        },
    });

    const paginationSubCategory = await prisma.subCategory.upsert({
        where: { url: seed.paginationSubCategory.url },
        create: {
            id: paginationSubCategoryNode.id,
            name: seed.paginationSubCategory.name,
            url: seed.paginationSubCategory.url,
            image: seed.paginationSubCategory.image,
            featured: false,
            categoryId: paginationCategory.id,
        },
        update: {
            name: seed.paginationSubCategory.name,
            image: seed.paginationSubCategory.image,
            featured: false,
            categoryId: paginationCategory.id,
        },
    });

    // メインカテゴリ側と同じく、id 共有が崩れた DB は後追いでは直せないので
    // FK 違反より手前で落とす。
    if (paginationSubCategory.id !== paginationSubCategoryNode.id) {
        throw new Error(
            `[seed-e2e] SubCategory(${paginationSubCategory.id}) と Category ノード(${paginationSubCategoryNode.id}) の ` +
                `id が一致しません。E2E DB をリセットしてから再実行してください（url: ${seed.paginationSubCategory.url}）。`
        );
    }

    const paginationProducts: Array<{ id: string; slug: string }> = [];
    for (const p of seed.paginationProducts) {
        const paginationProduct = await prisma.product.upsert({
            where: { slug: p.slug },
            create: {
                name: p.name,
                description: p.description,
                slug: p.slug,
                brand: p.brand,
                shippingFeeMethod: "ITEM",
                storeId: store.id,
                categoryId: paginationCategory.id,
                subCategoryId: paginationSubCategory.id,
                categoryNodeId: paginationSubCategory.id,
            },
            update: {
                name: p.name,
                description: p.description,
                brand: p.brand,
                shippingFeeMethod: "ITEM",
                storeId: store.id,
                categoryId: paginationCategory.id,
                subCategoryId: paginationSubCategory.id,
                categoryNodeId: paginationSubCategory.id,
            },
        });

        const paginationVariant = await prisma.productVariant.upsert({
            where: { slug: p.variant.slug },
            create: {
                variantName: p.variant.name,
                variantDescription: p.variant.description,
                variantImage: p.variant.image,
                slug: p.variant.slug,
                sku: p.variant.sku,
                weight: p.variant.weight,
                productId: paginationProduct.id,
            },
            update: {
                variantName: p.variant.name,
                variantDescription: p.variant.description,
                variantImage: p.variant.image,
                sku: p.variant.sku,
                weight: p.variant.weight,
                productId: paginationProduct.id,
            },
        });

        await prisma.size.deleteMany({
            where: { productVariantId: paginationVariant.id },
        });
        await prisma.productVariantImage.deleteMany({
            where: { productVariantId: paginationVariant.id },
        });
        await prisma.color.deleteMany({
            where: { productVariantId: paginationVariant.id },
        });

        await prisma.size.create({
            data: {
                size: p.variant.size.size,
                quantity: p.variant.size.quantity,
                price: p.variant.size.price,
                discount: p.variant.size.discount,
                productVariantId: paginationVariant.id,
            },
        });

        await prisma.productVariantImage.create({
            data: {
                url: p.variant.variantImage.url,
                alt: p.variant.variantImage.alt,
                productVariantId: paginationVariant.id,
            },
        });

        await prisma.color.create({
            data: {
                name: p.variant.color.name,
                productVariantId: paginationVariant.id,
            },
        });

        paginationProducts.push({
            id: paginationProduct.id,
            slug: paginationProduct.slug,
        });
    }

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
        paginationCategory,
        paginationSubCategory,
        paginationProducts,
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
        // どの target で落ちたかを失敗メッセージに残す。並列ワーカーでは target ごとに
        // URL 名前空間が違うため、素の Prisma エラーだけでは対象を特定できない。
        try {
            await seedOnce(seed);
        } catch (error: unknown) {
            const label = `${target.projectName ?? "default"}#${target.parallelIndex}`;
            const cause =
                error instanceof Error ? error.message : String(error);
            throw new Error(
                `[seed-e2e] target ${label} のシードに失敗しました: ${cause}`,
                {
                    cause: error,
                }
            );
        }
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
