/**
 * 商品seeder: Product + ProductVariant + Size + Image + Color + Spec + Question
 */

import { PrismaClient } from "@prisma/client";
import { ALL_SEED_PRODUCTS } from "../constants/products";
import type { SeedMaps } from "../types";
import { rootAncestorUrl } from "../category-tree";

/**
 * Run one seeding stage, tagging Prisma failures with the stage name and product slug.
 *
 * 商品ループの Prisma 呼び出しは商品ごとに同じ形をしているため、素の Prisma エラー
 * （`Unique constraint failed on the fields: (slug)` 等）だけでは**どの商品のどの段階で
 * 落ちたか**が分からない。元の例外は `cause` に保持して情報を失わせない。
 *
 * @param stage - 段階名（例: "Question の再作成"）
 * @param slug - 対象商品の slug
 * @param run - 実行する Prisma 処理
 * @returns `run` の戻り値
 * @throws Error 段階名と slug を載せた Error（元の例外は `cause`）
 */
async function runStage<T>(
    stage: string,
    slug: string,
    run: () => Promise<T>
): Promise<T> {
    try {
        return await run();
    } catch (error: unknown) {
        throw new Error(`${stage} に失敗しました: ${slug}`, { cause: error });
    }
}

/**
 * Seeds products, their variants, sizes, and related records into the database using Prisma.
 *
 * Validates references from `maps`, upserts products and variants by slug, removes stale related
 * records, and recreates questions, specs, sizes, images, colors, and free-shipping data
 * according to the seed definitions.
 *
 * @param prisma - PrismaClient instance used for database operations
 * @param maps - Lookup maps required to resolve relations:
 *   - `stores`, `categories`, `subCategories`, `offerTags`, `countries` (map keys used in seed data → corresponding IDs)
 * @returns An object with three Maps:
 *   - `products`: maps product slug → product id
 *   - `variants`: maps variant slug → variant id
 *   - `sizes`: maps "variantSlug:size" → size id
 * @throws Error if a referenced store, category, subcategory, offer tag, or country code from the seed data cannot be resolved via the provided maps, or if a product's `categoryUrl` points at a root category instead of a leaf
 */
export async function seedProducts(
    prisma: PrismaClient,
    maps: Pick<SeedMaps, "stores" | "categories" | "offerTags" | "countries">
): Promise<{
    products: Map<string, string>;
    variants: Map<string, string>;
    sizes: Map<string, string>;
}> {
    const products = new Map<string, string>();
    const variants = new Map<string, string>();
    const sizes = new Map<string, string>();

    for (const p of ALL_SEED_PRODUCTS) {
        const storeId = maps.stores.get(p.storeUrl);
        if (!storeId) {
            throw new Error(
                `ストアが見つかりません: ${p.storeUrl}（商品: ${p.name}）`
            );
        }

        // p.categoryUrl はリーフを指す。旧 FK の categoryId（ルート）は木を遡って導出する。
        const leafId = maps.categories.get(p.categoryUrl);
        if (!leafId) {
            throw new Error(
                `カテゴリが見つかりません: ${p.categoryUrl}（商品: ${p.name}）`
            );
        }

        const rootUrl = rootAncestorUrl(p.categoryUrl);
        // 商品はリーフに紐づく前提（categoryId = ルート / subCategoryId = リーフ）。
        // ルート自身を指すと両者が同じノードへ落ち、`maps.categories.get(rootUrl)` は
        // **成功してしまう**ので下の「ルートカテゴリが見つかりません」では捕まらない。
        // 木の宣言データの誤りとして、投入前にここで落とす。
        if (rootUrl === p.categoryUrl) {
            throw new Error(
                `商品のカテゴリはルート直下に置けません（リーフを指すこと）: ${p.categoryUrl}（商品: ${p.name}）`
            );
        }
        const rootId = maps.categories.get(rootUrl);
        if (!rootId) {
            throw new Error(
                `ルートカテゴリが見つかりません: ${rootUrl}（商品: ${p.name}）`
            );
        }

        let offerTagId: string | null = null;
        if (p.offerTagUrl) {
            const resolved = maps.offerTags.get(p.offerTagUrl);
            if (!resolved) {
                throw new Error(
                    `オファータグが見つかりません: ${p.offerTagUrl}（商品: ${p.slug}）`
                );
            }
            offerTagId = resolved;
        }

        // Product upsert
        // どの商品で落ちたかを Prisma の生エラーに載せて再送出する（slug で特定する）。
        const productRecord = await runStage("商品の upsert", p.slug, () =>
            prisma.product.upsert({
                where: { slug: p.slug },
                update: {
                    name: p.name,
                    description: p.description,
                    brand: p.brand,
                    shippingFeeMethod: p.shippingFeeMethod,
                    storeId,
                    categoryId: rootId,
                    subCategoryId: leafId,
                    categoryNodeId: leafId,
                    offerTagId,
                },
                create: {
                    name: p.name,
                    description: p.description,
                    slug: p.slug,
                    brand: p.brand,
                    shippingFeeMethod: p.shippingFeeMethod,
                    storeId,
                    // Phase A は新旧 FK を並走させる。categoryId はルート、subCategoryId は
                    // リーフを指す従来どおりの意味で、categoryNodeId が新しいリーフ 1 本。
                    categoryId: rootId,
                    subCategoryId: leafId,
                    categoryNodeId: leafId,
                    offerTagId,
                },
            })
        );
        products.set(p.slug, productRecord.id);

        // Question: deleteMany → createMany
        await runStage("Question の再作成", p.slug, async () => {
            await prisma.question.deleteMany({
                where: { productId: productRecord.id },
            });
            if (p.questions.length > 0) {
                await prisma.question.createMany({
                    data: p.questions.map((q) => ({
                        question: q.question,
                        answer: q.answer,
                        productId: productRecord.id,
                    })),
                });
            }
        });

        // Spec（商品レベル）: deleteMany（バリアントレベルは後で処理）
        await runStage("商品レベル Spec の削除", p.slug, () =>
            prisma.spec.deleteMany({
                where: { productId: productRecord.id, variantId: null },
            })
        );

        // 定義に含まれないバリアントを削除（ダングリング防止）
        const expectedSlugs = p.variants.map((v) => v.slug);
        await runStage("孤立バリアントの削除", p.slug, () =>
            prisma.productVariant.deleteMany({
                where: {
                    productId: productRecord.id,
                    slug: { notIn: expectedSlugs },
                },
            })
        );

        // 各バリアント
        for (const v of p.variants) {
            const variantRecord = await runStage(
                `バリアント "${v.slug}" の upsert`,
                p.slug,
                () =>
                    prisma.productVariant.upsert({
                        where: { slug: v.slug },
                        update: {
                            variantName: v.variantName,
                            variantDescription: v.variantDescription ?? "",
                            variantImage: v.images[0]?.url ?? "",
                            isSale: v.isSale,
                            saleEndDate: v.saleEndDate ?? null,
                            keywords: v.keywords.join(", "),
                            sku: v.sku,
                            weight: v.weight,
                            productId: productRecord.id,
                        },
                        create: {
                            variantName: v.variantName,
                            variantDescription: v.variantDescription ?? "",
                            variantImage: v.images[0]?.url ?? "",
                            slug: v.slug,
                            isSale: v.isSale,
                            saleEndDate: v.saleEndDate ?? null,
                            keywords: v.keywords.join(", "),
                            sku: v.sku,
                            weight: v.weight,
                            productId: productRecord.id,
                        },
                    })
            );
            variants.set(v.slug, variantRecord.id);

            // Size: deleteMany → createMany
            const sizeRecords = await runStage(
                `バリアント "${v.slug}" の Size 再作成`,
                p.slug,
                async () => {
                    await prisma.size.deleteMany({
                        where: { productVariantId: variantRecord.id },
                    });
                    return Promise.all(
                        v.sizes.map((s) =>
                            prisma.size.create({
                                data: {
                                    size: s.size,
                                    quantity: s.quantity,
                                    price: s.price,
                                    discount: s.discount,
                                    productVariantId: variantRecord.id,
                                },
                            })
                        )
                    );
                }
            );
            for (let i = 0; i < v.sizes.length; i++) {
                sizes.set(`${v.slug}:${v.sizes[i].size}`, sizeRecords[i].id);
            }

            // Image: deleteMany → createMany
            await runStage(
                `バリアント "${v.slug}" の Image 再作成`,
                p.slug,
                async () => {
                    await prisma.productVariantImage.deleteMany({
                        where: { productVariantId: variantRecord.id },
                    });
                    if (v.images.length === 0) return;
                    await prisma.productVariantImage.createMany({
                        data: v.images.map((img) => ({
                            url: img.url,
                            alt: img.alt,
                            productVariantId: variantRecord.id,
                        })),
                    });
                }
            );

            // Color: deleteMany → createMany
            await runStage(
                `バリアント "${v.slug}" の Color 再作成`,
                p.slug,
                async () => {
                    await prisma.color.deleteMany({
                        where: { productVariantId: variantRecord.id },
                    });
                    if (v.colors.length === 0) return;
                    await prisma.color.createMany({
                        data: v.colors.map((c) => ({
                            name: c.name,
                            productVariantId: variantRecord.id,
                        })),
                    });
                }
            );

            // Spec（バリアントレベル）: deleteMany → createMany
            await runStage(
                `バリアント "${v.slug}" の Spec 再作成`,
                p.slug,
                async () => {
                    await prisma.spec.deleteMany({
                        where: { variantId: variantRecord.id },
                    });
                    if (v.specs.length === 0) return;
                    await prisma.spec.createMany({
                        data: v.specs.map((s) => ({
                            name: s.name,
                            value: s.value,
                            variantId: variantRecord.id,
                        })),
                    });
                }
            );
        }

        // FreeShipping: 常に既存を削除（冪等性）
        await runStage("FreeShipping の削除", p.slug, () =>
            prisma.freeShipping.deleteMany({
                where: { productId: productRecord.id },
            })
        );

        // 対象国が指定されている場合のみ再作成
        if (
            p.freeShippingCountryCodes &&
            p.freeShippingCountryCodes.length > 0
        ) {
            // 全コードを検証（不明なコードはエラー）
            const countryIds: string[] = [];
            for (const code of p.freeShippingCountryCodes) {
                const countryId = maps.countries.get(code);
                if (!countryId) {
                    throw new Error(
                        `国コードが見つかりません: ${code}（商品: ${p.slug}）`
                    );
                }
                countryIds.push(countryId);
            }

            // 国コードの検証（上のループ）は seed 定義の誤りなので runStage の外に置く ——
            // Prisma 由来の失敗と混ぜると、エラーの出所が読み手に分からなくなる。
            await runStage("FreeShipping の再作成", p.slug, async () => {
                const freeShipping = await prisma.freeShipping.create({
                    data: { productId: productRecord.id },
                });
                await prisma.freeShippingCountry.createMany({
                    data: countryIds.map((countryId) => ({
                        freeShippingId: freeShipping.id,
                        countryId,
                    })),
                });
            });
        }
    }

    return { products, variants, sizes };
}
