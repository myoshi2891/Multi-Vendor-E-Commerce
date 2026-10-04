"use server";

import { db } from "@/lib/db";
import {
    PRODUCT_CATEGORY_DEPTH,
    resolveCategoryNode,
} from "@/lib/category-tree";
import { buildPrefixTsQuery } from "@/lib/search-query";
import { productDerivedColumnsUpdateSql } from "@/lib/product-derived-columns";
import {
    parseProductFilters,
    parseUserCountryCookie,
    toNumberSafe,
} from "@/lib/utils";
// Types
import {
    Country,
    FreeShippingWithCountriesType,
    ProductPageType,
    ProductShippingDetailsType,
    ProductType,
    ProductFacet,
    ProductFilters,
    ProductWithVariantType,
    RatingStatisticsType,
    SortOrder,
    VariantImageType,
    VariantSimplified,
} from "@/lib/types";

// Clerk
import { currentUser } from "@clerk/nextjs/server";
// 認可ガード (src/lib/auth-guards.ts) 経由でロール検証を集約する
import { requireSeller, requireStoreOwner } from "@/lib/auth-guards";
// カテゴリ別属性の検証・同期（plan 069 Step 8 の保存契約）
import {
    lockAttributeCategoryPath,
    parseAttributeInputs,
    precheckAttributeValues,
    syncAttributeValues,
    type AttributeSyncContext,
} from "@/lib/attribute-sync";
import type { AttributeValueInput } from "@/lib/attribute-definitions";
import {
    findAttributeFormValues,
    findProductAttributeDisplay,
    type ProductAttributeDisplay,
} from "@/lib/attribute-repository";

// Slugify
import slugify from "slugify";

// サーバー専用: slug の一意性を保証するヘルパー
const generateUniqueSlug = async (
    baseSlug: string,
    model: string,
    field: string = "slug",
    separator: string = "-"
) => {
    let slug = baseSlug;
    let suffix = 1;
    const maxAttempts = 100;

    for (let attempts = 0; attempts < maxAttempts; attempts++) {
        const existingRecord = await (db as Record<string, any>)[
            model
        ].findFirst({
            where: {
                [field]: slug,
            },
        });
        if (!existingRecord) {
            return slug;
        }
        slug = `${baseSlug}${separator}${suffix++}`;
    }

    throw new Error(
        `generateUniqueSlug: exceeded ${maxAttempts} attempts for model="${model}", field="${field}", baseSlug="${baseSlug}"`
    );
};

// db.$transaction のコールバックが受け取る tx の型（Accelerate 拡張済みクライアント）。
// 素の Prisma.TransactionClient とは非互換のため $transaction から導出する
// （`order.ts` の OrderTransactionClient と同じ理由・同じ形）。
type ProductTransactionClient = Parameters<
    Parameters<typeof db.$transaction>[0]
>[0];

/**
 * 商品配下のバリアントから導出する非正規化列（`searchKeywords` / `minPrice`）を、
 * 同じ tx の中で再計算する（plans 074 / 076・ADR-008）。導出式は
 * `src/lib/product-derived-columns.ts` に一元化してある（seed も同じ SQL を使う）。
 *
 * **バリアントのテキスト、またはサイズの price / discount を書き込むすべての経路**
 * （`handleProductCreate` / `handleVariantCreate` / `handleProductAndVariantUpdate`）の
 * tx の末尾で呼ぶこと。呼び忘れてもエラーにはならず、その商品が keywords で検索に出なく
 * なったり価格ソートの位置がずれたりするだけなので、新しい書き込み経路を足すときは
 * レビューで必ず確認する。
 *
 * 既存商品への書き込み経路では、tx の先頭で `lockProductRow` を取っておくこと
 * （ロックはここでは取らない）。
 *
 * @param tx - 呼び出し元の `db.$transaction` が渡すトランザクションクライアント
 * @param productId - 再計算する商品の id
 */
const recomputeProductDerivedColumns = async (
    tx: ProductTransactionClient,
    productId: string
): Promise<void> => {
    await tx.$executeRaw(productDerivedColumnsUpdateSql(productId));
};

/**
 * 既存商品の Product 行を `FOR UPDATE` で掴み、同じ商品への書き込み tx を直列化する。
 *
 * **`lockAttributeCategoryPath` の直後・子テーブルへの書き込みより前に呼ぶこと。**
 * - 子行（バリアント・サイズ等）の INSERT は FK で Product に `FOR KEY SHARE` を取る。
 *   子を書いた後で `FOR UPDATE` を要求すると、並行する 2 tx が互いの KEY SHARE を待って
 *   デッドロックする。
 * - READ COMMITTED のスナップショットは文の開始時に決まる。先に待ち切っておけば、
 *   `recomputeProductDerivedColumns` の UPDATE は並行 tx がコミットしたバリアント・サイズを
 *   読んで再計算できる（古い集計で上書きしない）。
 *
 * 新規作成（`handleProductCreate`）では行がまだ他 tx から見えないため呼ばない。
 *
 * @param tx - 呼び出し元の `db.$transaction` が渡すトランザクションクライアント
 * @param productId - 掴む商品の id
 */
const lockProductRow = async (
    tx: ProductTransactionClient,
    productId: string
): Promise<void> => {
    await tx.$queryRaw`
        SELECT "id" FROM "Product" WHERE "id" = ${productId} FOR UPDATE
    `;
};

/** リーフ検証で読む Category ノードの最小形。 */
interface LockedProductCategoryNode {
    id: string;
    parentId: string | null;
    depth: number;
    childCount: number;
}

/**
 * 商品の紐づけ先が「リーフである」ことをトランザクション内で検証する。
 *
 * **ロック無しの `childCount` 読みは TOCTOU である。** 「商品をリーフ L に紐づける」と
 * 「L の子を作る」が並行すると、前者は `childCount = 0` を読み、後者は L の子を INSERT
 * して `childCount` を 1 にする —— どちらも成功し、非リーフに商品が紐づいた状態が残る。
 * リーフ性は*他の行*に子があるかで決まる関係的な性質なので DB CHECK では担保できず
 * （CHECK は同一行の値しか参照できない）、行ロックによる直列化が唯一の砦である。
 *
 * ロック対象は `upsertCategory` が子の作成時に掴む行と**同じ行**でなければならない
 * （別々の行を掴んだのでは競合が検出できない）。
 *
 * **親の一致も同じロックの下で見る。** Phase B の商品は root（`categoryId`）と
 * リーフ（`subCategoryId`）の**二重 FK** を持つが、両者が親子であることは FK では
 * 表現できない（FK は参照先の存在しか見ない）。depth 検証は「リーフがルート直下で
 * ある」ことしか言わず、**どのルートの直下か**は無検査で残る —— Server Action は
 * 公開エンドポイントなので、フォームを経由しない呼び出しが無関係な root と leaf の
 * 組み合わせを渡せてしまい、`category` と `subCategory` / `categoryNode` が食い違った
 * 行が書ける。読み取りが新 FK 側へ切り替わっている以上、この食い違いはパンくず・
 * 絞り込みの両方を静かに壊す。
 *
 * @param tx - 商品を書き込むのと同じトランザクション（ロックを書き込みまで保持する）
 * @param categoryNodeId - 紐づけ先ノードの id（Phase B では subCategoryId と同一）
 * @param expectedParentId - 商品が併せて書く root の id（`product.categoryId`）
 */
const assertLeafCategoryNode = async (
    tx: ProductTransactionClient,
    categoryNodeId: string,
    expectedParentId: string
): Promise<void> => {
    // Prisma の fluent API はロック句を表現できないため $queryRaw を使う
    // （値は常にパラメータ化される）。
    const lockedRows = await tx.$queryRaw<LockedProductCategoryNode[]>`
        SELECT "id", "parentId", "depth", "childCount" FROM "Category" WHERE "id" = ${categoryNodeId} FOR SHARE
    `;
    const node = lockedRows[0] ?? null;
    if (!node) throw new Error("Category not found.");

    if (node.childCount !== 0) {
        throw new Error("Products can only be assigned to leaf categories.");
    }

    // Phase B の制約。depth 0（ルート）と depth 2 以上には legacy SubCategory 行が
    // 無く、NOT NULL の Product.subCategoryId を満たせない（詳細は
    // PRODUCT_CATEGORY_DEPTH の JSDoc）。UI 側の
    // `isProductAssignableCategory` は同じ規則を選択可否として使う。
    if (node.depth !== PRODUCT_CATEGORY_DEPTH) {
        throw new Error(
            `Products can only be assigned to categories at depth ${PRODUCT_CATEGORY_DEPTH} ` +
                "until the category tree cutover completes."
        );
    }

    // 二重 FK の整合。depth 検証の**後**に置く —— depth 違反のノードは親も一致しない
    // のが普通で、先に親不一致で弾くと移行期の構造制約（より具体的な理由）が
    // 呼び出し側に届かなくなる。
    if (node.parentId !== expectedParentId) {
        throw new Error(
            "The selected sub category does not belong to the selected category."
        );
    }
};

/**
 * リーフ検証を走らせるべきかを判定する。
 *
 * 検証は「カテゴリを新規設定した / 変更した」場合のみ。移行時に強制付け替えをして
 * いない以上、**既存の非リーフ紐づけは経過措置として残っており**、無条件検証にすると
 * それらの商品が在庫・価格の編集すらできなくなる（design.md §2-Q5）。
 *
 * **`categoryId` の一致だけを条件にしないこと（V-5c）。** 移行期の商品は root
 * （`categoryId`）とリーフ（`subCategoryId`）の二重 FK を持つため、同一 root 内で
 * リーフだけを非リーフノードへ差し替える更新が検証をすり抜ける。
 */
const categoryAssignmentChanged = (
    product: ProductWithVariantType,
    existingProduct: {
        categoryId: string;
        subCategoryId: string;
    } | null
): boolean =>
    // `existingProduct === null` を別条件で書かずに optional chaining で畳む。
    // null のとき両辺は undefined になり、string との `!==` が必ず真になるため
    // 「既存が無い = 変更あり」という元の意味はそのまま保たれる。
    existingProduct?.categoryId !== product.categoryId ||
    existingProduct?.subCategoryId !== product.subCategoryId;

// Cookies
import { cookies } from "next/headers";

// Prisma
import {
    Prisma,
    ProductVariant,
    ShippingFeeMethod,
    Size,
    Store,
} from "@prisma/client";

// Function: upsertProduct
// Description: Upserts a Product into the database, updating if it exists or creating a new one if not.
// Permission Level: Seller only
// Parameters:
//   - Product: ProductWithVariant object containing details of the product and  the product to be upserted.
//   - storeUrl: URL of the store to which the product belongs.
// Returns: Updated or newly created Product with variant details.

export const upsertProduct = async (
    product: ProductWithVariantType,
    storeUrl: string
) => {
    try {
        // Ensure product data is provided
        if (!product) throw new Error("Please provide product data.");
        // 認証 + SELLER + 店舗所有権を集約検証 (IDOR 防御 / auth-guards 経由)
        // 旧実装の where: { url, userId } 検索は requireStoreOwner 内で同等に実行される。
        const { store } = await requireStoreOwner(storeUrl);

        // Check if the product already exist in this store
        const existingProduct = await db.product.findUnique({
            where: { id: product.productId, storeId: store.id },
        });

        // Check if the variant already exist for this product and store
        const existingVariant = await db.productVariant.findFirst({
            where: {
                id: product.variantId,
                productId: product.productId,
                product: {
                    storeId: store.id,
                },
            },
        });

        // 属性値（plan 069）。payload の形を検証し、外側で一度検証する —— 早期拒否と
        // 観測のため。書き込みと同じ tx 内で行を掴んだうえで必ず再検証する
        // （`syncAttributeValues`）。新バリアント追加は商品のカテゴリを変えないので、
        // 既存商品の紐づけ先を基準にする。
        const attributes: AttributeSyncArgs = {
            inputs: parseAttributeInputs(product.attributes),
            context: {
                storeId: store.id,
                productId: product.productId,
                categoryNodeId:
                    existingProduct && !existingVariant
                        ? existingProduct.subCategoryId
                        : product.subCategoryId,
                createsProduct: !existingProduct,
                createdVariantId: existingVariant ? null : product.variantId,
            },
        };
        await precheckAttributeValues(
            db,
            attributes.context,
            attributes.inputs
        );

        if (existingProduct) {
            if (existingVariant) {
                // 既存の商品とバリアントを更新
                await handleProductAndVariantUpdate(
                    product,
                    existingProduct,
                    existingVariant,
                    attributes
                );
            } else {
                // 既存商品に新規バリアントを追加
                await handleVariantCreate(product, attributes);
            }
        } else {
            // 新規商品・バリアント作成
            await handleProductCreate(product, store.id, attributes);
        }
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "Error in upsertProduct:",
                error.message,
                error.stack
            );
        } else {
            console.error("Error in upsertProduct:", error);
        }
        throw error;
    }
};

/** 属性の同期に必要な入力（検証済みの payload と所有先の文脈）。 */
interface AttributeSyncArgs {
    inputs: AttributeValueInput[];
    context: AttributeSyncContext;
}

const handleProductCreate = async (
    product: ProductWithVariantType,
    storeId: string,
    attributes: AttributeSyncArgs
) => {
    // Generate unique slugs for product and variant
    const productSlug = await generateUniqueSlug(
        slugify(product.name, {
            replacement: "-",
            lower: true,
            trim: true,
        }),
        "product"
    );

    const variantSlug = await generateUniqueSlug(
        slugify(product.variantName, {
            replacement: "-",
            lower: true,
            trim: true,
        }),
        "productVariant"
    );

    const productData = {
        id: product.productId,
        name: product.name,
        description: product.description,
        slug: productSlug,
        store: { connect: { id: storeId } },
        // dual-write（カテゴリツリー Phase B / plan 067）。読み取りは新 FK
        // （categoryNode）へ切り替わっているが、旧 2 列は Phase C（plan 068）まで
        // 書き続ける —— 旧列が生きているうちだけ読み取りを巻き戻せるため。
        //
        // categoryNodeId に subCategoryId をそのまま使えるのは、Phase A の移行
        // （A-3）が legacy SubCategory 行の id を流用して Category ノードを作り、
        // **両者が id を共有している**からである（A-6 の backfill と同じ規則）。
        // この不変条件は統合シードのガードと統合テストで守られている。
        category: { connect: { id: product.categoryId } },
        subCategory: { connect: { id: product.subCategoryId } },
        categoryNode: { connect: { id: product.subCategoryId } },
        offerTag: product.offerTagId
            ? { connect: { id: product.offerTagId } }
            : undefined,
        brand: product.brand,
        specs: {
            create: product.product_specs.map((spec) => ({
                name: spec.name,
                value: spec.value,
            })),
        },
        questions: {
            create: product.questions.map((q) => ({
                question: q.question,
                answer: q.answer,
            })),
        },
        variants: {
            create: [
                {
                    id: product.variantId,
                    variantName: product.variantName,
                    variantDescription: product.variantDescription,
                    slug: variantSlug,
                    variantImage: product.variantImage,
                    sku: product.sku,
                    weight: product.weight,
                    keywords: product.keywords.join(","),
                    isSale: product.isSale,
                    saleEndDate: product.saleEndDate,
                    images: {
                        create: product.images.map((image) => ({
                            url: image.url,
                        })),
                    },
                    colors: {
                        create: product.colors.map((color) => ({
                            name: color.color,
                        })),
                    },
                    sizes: {
                        create: product.sizes.map((size) => ({
                            size: size.size,
                            quantity: size.quantity,
                            price: size.price,
                            discount: size.discount,
                        })),
                    },
                    specs: {
                        create: product.variant_specs.map((spec) => ({
                            name: spec.name,
                            value: spec.value,
                        })),
                    },
                    createdAt: product.createdAt,
                    updatedAt: product.updatedAt,
                },
            ],
        },
        shippingFeeMethod: product.shippingFeeMethod,
        freeShippingForAllCountries: product.freeShippingForAllCountries,
        freeShipping: product.freeShippingForAllCountries
            ? undefined
            : product.freeShippingCountriesIds &&
                product.freeShippingCountriesIds.length > 0
              ? {
                    create: {
                        eligibleCountries: {
                            create: product.freeShippingCountriesIds.map(
                                (country) => ({
                                    country: { connect: { id: country.value } },
                                })
                            ),
                        },
                    },
                }
              : undefined,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
    };

    // 作成も検証と同じ tx に入れる —— 検証だけを別 tx で先に済ませると、
    // ロックが create の前に解放されて TOCTOU の窓が開いたままになる。
    const new_product = await db.$transaction(async (tx) => {
        // 属性の継承元（選択ノード + 祖先）を id 昇順で先に掴む。リーフ単独のロック
        // （assertLeafCategoryNode）より前に置き、カテゴリ更新とロック順を揃える。
        await lockAttributeCategoryPath(tx, attributes.context.categoryNodeId);
        // V-5: 新規作成は常に「カテゴリを新規設定した」ケースにあたる
        await assertLeafCategoryNode(
            tx,
            product.subCategoryId,
            product.categoryId
        );
        const created = await tx.product.create({ data: productData });
        await syncAttributeValues(tx, attributes.context, attributes.inputs);
        await recomputeProductDerivedColumns(tx, created.id);
        return created;
    });
    return new_product;
};

const handleVariantCreate = async (
    product: ProductWithVariantType,
    attributes: AttributeSyncArgs
) => {
    // Generate unique slug for variant
    const variantSlug = await generateUniqueSlug(
        slugify(product.variantName, {
            replacement: "-",
            lower: true,
            trim: true,
        }),
        "productVariant"
    );

    const variantData = {
        id: product.variantId,
        productId: product.productId,
        variantName: product.variantName,
        variantDescription: product.variantDescription,
        slug: variantSlug,
        isSale: product.isSale,
        saleEndDate: product.isSale ? (product.saleEndDate ?? null) : null,
        sku: product.sku,
        keywords: product.keywords.join(","),
        weight: product.weight,
        variantImage: product.variantImage,
        images: {
            create: product.images.map((image) => ({
                url: image.url,
            })),
        },
        colors: {
            create: product.colors.map((color) => ({
                name: color.color,
            })),
        },
        sizes: {
            create: product.sizes.map((size) => ({
                size: size.size,
                quantity: size.quantity,
                price: size.price,
                discount: size.discount,
            })),
        },
        specs: {
            create: product.variant_specs.map((spec) => ({
                name: spec.name,
                value: spec.value,
            })),
        },

        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
    };

    // 属性の同期（VARIANT スコープの必須を含む）とバリアント作成を 1 tx に入れる
    const new_variant = await db.$transaction(async (tx) => {
        await lockAttributeCategoryPath(tx, attributes.context.categoryNodeId);
        await lockProductRow(tx, product.productId);
        const created = await tx.productVariant.create({ data: variantData });
        await syncAttributeValues(tx, attributes.context, attributes.inputs);
        await recomputeProductDerivedColumns(tx, created.productId);
        return created;
    });

    return new_variant;
};

// 既存の商品+バリアントをアトミックに更新
const handleProductAndVariantUpdate = async (
    product: ProductWithVariantType,
    existingProduct: {
        name: string;
        slug: string;
        categoryId: string;
        subCategoryId: string;
    },
    existingVariant: { variantName: string; slug: string },
    attributes: AttributeSyncArgs
): Promise<void> => {
    // 名前が変わった場合のみ slug を再生成（URL 安定性のため）
    const productSlug =
        product.name !== existingProduct.name
            ? await generateUniqueSlug(
                  slugify(product.name, {
                      replacement: "-",
                      lower: true,
                      trim: true,
                  }),
                  "product"
              )
            : existingProduct.slug;

    const variantSlug =
        product.variantName !== existingVariant.variantName
            ? await generateUniqueSlug(
                  slugify(product.variantName, {
                      replacement: "-",
                      lower: true,
                      trim: true,
                  }),
                  "productVariant"
              )
            : existingVariant.slug;

    await db.$transaction(async (tx) => {
        // 属性の継承元を id 昇順で先に掴む（handleProductCreate と同じ理由）
        await lockAttributeCategoryPath(tx, attributes.context.categoryNodeId);
        await lockProductRow(tx, product.productId);

        // V-5: 紐づけ先がリーフであることを、書き込みと同じ tx 内で（ロックを
        // 握ったまま）検証する。カテゴリを変えない更新は経過措置として素通しする。
        if (categoryAssignmentChanged(product, existingProduct)) {
            await assertLeafCategoryNode(
                tx,
                product.subCategoryId,
                product.categoryId
            );
        }

        // Product 本体の更新
        await tx.product.update({
            where: { id: product.productId },
            data: {
                name: product.name,
                description: product.description,
                slug: productSlug,
                brand: product.brand,
                // dual-write（Phase B）。詳細は upsertProduct 側の注記を参照。
                category: { connect: { id: product.categoryId } },
                subCategory: { connect: { id: product.subCategoryId } },
                categoryNode: { connect: { id: product.subCategoryId } },
                offerTag: product.offerTagId
                    ? { connect: { id: product.offerTagId } }
                    : { disconnect: true },
                shippingFeeMethod: product.shippingFeeMethod,
                freeShippingForAllCountries:
                    product.freeShippingForAllCountries,
                updatedAt: product.updatedAt,
            },
        });

        // Product specs: 削除 + 再作成
        await tx.spec.deleteMany({ where: { productId: product.productId } });
        if (product.product_specs.length > 0) {
            await tx.spec.createMany({
                data: product.product_specs.map((spec) => ({
                    name: spec.name,
                    value: spec.value,
                    productId: product.productId,
                })),
            });
        }

        // Questions: 削除 + 再作成
        await tx.question.deleteMany({
            where: { productId: product.productId },
        });
        if (product.questions.length > 0) {
            await tx.question.createMany({
                data: product.questions.map((q) => ({
                    question: q.question,
                    answer: q.answer,
                    productId: product.productId,
                })),
            });
        }

        // FreeShipping: 既存削除 + 条件付き再作成
        await tx.freeShipping.deleteMany({
            where: { productId: product.productId },
        });
        if (
            !product.freeShippingForAllCountries &&
            product.freeShippingCountriesIds &&
            product.freeShippingCountriesIds.length > 0
        ) {
            await tx.freeShipping.create({
                data: {
                    product: { connect: { id: product.productId } },
                    eligibleCountries: {
                        create: product.freeShippingCountriesIds.map(
                            (country) => ({
                                country: { connect: { id: country.value } },
                            })
                        ),
                    },
                },
            });
        }

        // Variant 本体の更新
        await tx.productVariant.update({
            where: { id: product.variantId },
            data: {
                variantName: product.variantName,
                variantDescription: product.variantDescription,
                slug: variantSlug,
                variantImage: product.variantImage,
                sku: product.sku,
                weight: product.weight,
                keywords: product.keywords.join(","),
                isSale: product.isSale,
                saleEndDate: product.isSale
                    ? (product.saleEndDate ?? null)
                    : null,
                updatedAt: product.updatedAt,
            },
        });

        // Variant images: 削除 + 再作成
        await tx.productVariantImage.deleteMany({
            where: { productVariantId: product.variantId },
        });
        if (product.images.length > 0) {
            await tx.productVariantImage.createMany({
                data: product.images.map((image) => ({
                    url: image.url,
                    productVariantId: product.variantId,
                })),
            });
        }

        // Colors: 削除 + 再作成
        await tx.color.deleteMany({
            where: { productVariantId: product.variantId },
        });
        if (product.colors.length > 0) {
            await tx.color.createMany({
                data: product.colors.map((color) => ({
                    name: color.color,
                    productVariantId: product.variantId,
                })),
            });
        }

        // Sizes: 削除 + 再作成
        await tx.size.deleteMany({
            where: { productVariantId: product.variantId },
        });
        if (product.sizes.length > 0) {
            await tx.size.createMany({
                data: product.sizes.map((size) => ({
                    size: size.size,
                    quantity: size.quantity,
                    price: size.price,
                    discount: size.discount,
                    productVariantId: product.variantId,
                })),
            });
        }

        // Variant specs: 削除 + 再作成
        await tx.spec.deleteMany({ where: { variantId: product.variantId } });
        if (product.variant_specs.length > 0) {
            await tx.spec.createMany({
                data: product.variant_specs.map((spec) => ({
                    name: spec.name,
                    value: spec.value,
                    variantId: product.variantId,
                })),
            });
        }

        // 属性値: 商品・バリアントの書き込み後に、掴んだ行で再検証してから同期する
        await syncAttributeValues(tx, attributes.context, attributes.inputs);
        await recomputeProductDerivedColumns(tx, product.productId);
    });
};

// Function: getProductMainInfo
// Description: Retrieves product main information (including product and variant details)
// Access Level: Public
// Parameters:
// - productId: ID of the product to retrieve.
// Returns: Product main information (including product and variant details) or null if the product is not  found.

export const getProductMainInfo = async (productId: string) => {
    // Retrieve product and variant details
    const product = await db.product.findUnique({
        where: { id: productId },
        include: { questions: true, specs: true },
    });
    if (!product) return null;

    // Return the main information of the product
    return {
        productId: product.id,
        name: product.name,
        description: product.description,
        brand: product.brand,
        categoryId: product.categoryId,
        subCategoryId: product.subCategoryId,
        offerTagId: product.offerTagId || undefined,
        storeId: product.storeId,
        shippingFeeMethod: product.shippingFeeMethod,
        questions: product.questions.map((q) => ({
            question: q.question,
            answer: q.answer,
        })),
        product_specs: product.specs.map((spec) => ({
            name: spec.name,
            value: spec.value,
        })),
    };
};

// Function: getProductVariantForEdit
// Description: 既存バリアントの編集ページ用に、商品 + バリアントを商品フォームの形
//              （ProductWithVariantType）へ戻して返す。属性値はフォーム初期値と、
//              このレコードの現在値に含まれるアーカイブ済み選択肢（A-11）を添える。
// Permission Level: Seller only（店舗オーナー）
// Parameters:
//   - storeUrl: 編集中の店舗
//   - productId / variantId: 編集対象
// Returns: フォーム初期値。商品が店舗に無い / バリアントが商品に無い場合は null

export const getProductVariantForEdit = async (
    storeUrl: string,
    productId: string,
    variantId: string
) => {
    // 認可ガードは try の外（認可エラーを汎用メッセージで上書きしない・tech.md）
    const { store } = await requireStoreOwner(storeUrl);

    try {
        const product = await db.product.findUnique({
            where: { id: productId, storeId: store.id },
            include: {
                specs: true,
                questions: true,
                freeShipping: {
                    include: {
                        eligibleCountries: { include: { country: true } },
                    },
                },
                variants: {
                    where: { id: variantId },
                    include: {
                        images: true,
                        colors: true,
                        sizes: true,
                        specs: true,
                    },
                },
            },
        });
        const variant = product?.variants[0];
        if (!product || !variant) return null;

        const attributes = await findAttributeFormValues(db, {
            productId: product.id,
            variantId: variant.id,
        });

        return {
            productId: product.id,
            variantId: variant.id,
            name: product.name,
            description: product.description,
            variantName: variant.variantName,
            variantDescription: variant.variantDescription ?? "",
            images: variant.images.map((image) => ({
                id: image.id,
                url: image.url,
            })),
            variantImage: variant.variantImage,
            categoryId: product.categoryId,
            subCategoryId: product.subCategoryId,
            offerTagId: product.offerTagId ?? undefined,
            isSale: variant.isSale,
            saleEndDate: variant.saleEndDate,
            brand: product.brand,
            sku: variant.sku,
            weight: variant.weight,
            colors: variant.colors.map((color) => ({
                id: color.id,
                color: color.name,
            })),
            sizes: variant.sizes.map((size) => ({
                id: size.id,
                size: size.size,
                quantity: size.quantity,
                price: toNumberSafe(size.price),
                discount: size.discount,
            })),
            product_specs: product.specs.map((spec) => ({
                id: spec.id,
                name: spec.name,
                value: spec.value,
            })),
            variant_specs: variant.specs.map((spec) => ({
                id: spec.id,
                name: spec.name,
                value: spec.value,
            })),
            // 保存側は keywords.join(",") で 1 列に詰めている
            keywords: variant.keywords
                ? variant.keywords.split(",").filter((k) => k.length > 0)
                : [],
            questions: product.questions.map((q) => ({
                id: q.id,
                question: q.question,
                answer: q.answer,
            })),
            freeShippingForAllCountries: product.freeShippingForAllCountries,
            freeShippingCountriesIds: (
                product.freeShipping?.eligibleCountries ?? []
            ).map(({ country }) => ({
                label: country.name,
                value: country.id,
            })),
            shippingFeeMethod: product.shippingFeeMethod,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
            ...attributes,
        };
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[product:getProductVariantForEdit] Failed to load product",
                { error: error.message, stack: error.stack }
            );
        } else {
            console.error("[product:getProductVariantForEdit] Unknown error", {
                error,
            });
        }
        throw new Error("Failed to load the product for editing.");
    }
};

// Function: getAllStoreProducts
// Description: Retrieves all products associated with a specific store based on the store URL
// Access Level: Public
// Parameters:
// - storeUrl: URL of the store to retrieve products from.
// Returns: Array of products associated with the store, including category, subcategory, and variant details or an empty array if no products are found.

export const getAllStoreProducts = async (storeUrl: string) => {
    // Retrieve store details from the database using the store URL
    const store = await db.store.findUnique({
        where: { url: storeUrl },
    });

    if (!store) throw new Error(`Store with URL "${storeUrl}" not found.`);

    // Retrieve products associated with the store using the store ID
    const products = await db.product.findMany({
        where: {
            storeId: store.id,
        },
        include: {
            category: true,
            subCategory: true,
            offerTag: true,
            variants: {
                include: {
                    images: true,
                    colors: true,
                    sizes: true,
                },
            },
            store: {
                select: {
                    id: true,
                    url: true,
                },
            },
        },
    });
    return products;
};

// Function: deleteProduct
// Description: Deletes a product and its associated variants from the database
// Access Level: Seller only
// Parameters:
// - productId: ID of the product to be deleted.
// Returns: True if the product and its variants are successfully deleted, false otherwise.

export const deleteProduct = async (productId: string) => {
    try {
        // 認証 + SELLER ロールを集約検証 (auth-guards に統一)
        // 旧実装の "Only sellers and administrators can perform this action."
        // メッセージは実コード (role !== "SELLER") と乖離があったため、
        // 統一メッセージ "Only sellers can perform this action." に揃える。
        const user = await requireSeller();
        // Ensure product data is provided
        if (!productId) throw new Error("Please provide product ID.");

        // 所有権検証: 商品のストアが現在のユーザーに属するか確認（IDOR防止）
        const product = await db.product.findUnique({
            where: { id: productId },
            include: { store: { select: { userId: true } } },
        });
        if (!product) throw new Error("Product not found.");
        if (product.store.userId !== user.id)
            throw new Error("You can only delete your own products.");

        // Delete the product and its variants
        const response = await db.product.delete({
            where: { id: productId },
        });
        return response;
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "Error in deleteProduct:",
                error.message,
                error.stack
            );
        } else {
            console.error("Error in deleteProduct:", error);
        }
        throw error;
    }
};

// Function: getProducts
// Description: Retrieves filtered products based on specified criteria. Supports pagination.
// Access Level: Public
// Parameters:
// - filters: Object containing filter criteria (e.g., category, subCategory, offerTag, minPrice, maxPrice, keywords).
// - sortBy: Sorting criteria (e.g., Most popular, New Arrival, Top Rated...).
// - page: Page number for pagination. (default = 1)
// - pageSize: Number of products per page. (default = 10)
// Returns: Array of filtered products, including category, subcategory, variants, and pagination metadata (totalPages, currentPage, pageSize, totalCount).

/** `resolveFilterSlugs` の結果。URL の slug を DB の id / path に解決したもの。 */
type ResolvedProductFilterRefs = {
    storeId?: string;
    /** category / subCategory それぞれのサブツリー根の path（両方指定なら 2 つの積） */
    categoryPaths: string[];
    offerTagId?: string;
};

/**
 * store / category / subCategory / offer の slug を、**並列に**解決する（plan 075 / design.md §2-Q6）。
 *
 * 旧実装は 4 つを逐次 `await` しており、DB 往復が直列に積み上がっていた。互いに独立なので
 * `Promise.all` で同時に引く。
 *
 * **どれか 1 つでも解決できなければ `null`**（呼び出し側は 0 件を返す）。見つからないフィルタを
 * 黙って捨てると「該当なし」が「全件表示」に化ける（存在しないカテゴリ URL で全カタログが出る）。
 *
 * カテゴリツリー Phase B（ADR-006）: category / subCategory は「そのノードを根とするサブツリー」で
 * 絞る。**2 系統を `??` で 1 本に畳まない**（両方指定時に片方が黙って捨てられる）。
 * `?subCategory=` は恒久的に受理する（別名表経由の解決は `resolveCategoryNode` の担当）。
 *
 * @param filters - `parseProductFilters` 済みのフィルタ
 * @returns 解決済みの参照、または未解決を表す `null`
 */
const resolveFilterSlugs = async (
    filters: ProductFilters
): Promise<ResolvedProductFilterRefs | null> => {
    const [store, categoryNode, subCategoryNode, offer] = await Promise.all([
        filters.store
            ? db.store.findUnique({
                  where: { url: filters.store },
                  select: { id: true },
              })
            : undefined,
        filters.category
            ? resolveCategoryNode(filters.category, "CATEGORY")
            : undefined,
        filters.subCategory
            ? resolveCategoryNode(filters.subCategory, "SUB_CATEGORY")
            : undefined,
        filters.offer
            ? db.offerTag.findUnique({
                  where: { url: filters.offer },
                  select: { id: true },
              })
            : undefined,
    ]);
    // undefined = 指定なし / null = 指定したが見つからない
    if (store === null || categoryNode === null) return null;
    if (subCategoryNode === null || offer === null) return null;
    return {
        storeId: store?.id,
        categoryPaths: [categoryNode?.path, subCategoryNode?.path].filter(
            (path): path is string => path !== undefined
        ),
        offerTagId: offer?.id,
    };
};

/**
 * 属性値 1 行を「URL に載せる機械値」へ写す式（`v` = 属性値の行、`o` = AttributeOption）。
 * ENUM は option.value、それ以外は型別カラムの文字列表現。NUMBER は `trim_scale` で
 * 末尾の 0 を落とす（Decimal(18,6) の `55.000000` を `55` にする）。
 * 絞り込み（`buildProductPredicates`）と集計（`getProductFacets`）で**同じ式**を使うこと。
 */
const FACET_VALUE_SQL = Prisma.sql`COALESCE(o.value, v."valueText", v."valueBool"::text, trim_scale(v."valueNumber")::text)`;

/** 表示名の式。ENUM は option.label、それ以外は値そのもの。 */
const FACET_LABEL_SQL = Prisma.sql`COALESCE(o.label, v."valueText", v."valueBool"::text, trim_scale(v."valueNumber")::text)`;

/**
 * 属性 1 key の選択（値の OR）を満たす商品の述語。PRODUCT スコープの値と、バリアントに付いた
 * VARIANT スコープの値の**両方**を見る（片方だけだと VARIANT スコープのファセットが効かない・ADR-007）。
 * facetable でない定義やアーカイブ済みの定義では絞り込めない（存在しない key と同じく 0 件）。
 */
const attributeSelectionSql = (key: string, values: string[]): Prisma.Sql => Prisma.sql`(
    EXISTS (
        SELECT 1 FROM "ProductAttributeValue" v
        JOIN "AttributeDefinition" d ON d.id = v."definitionId"
        LEFT JOIN "AttributeOption" o ON o.id = v."optionId"
        WHERE v."productId" = p.id
          AND d.key = ${key} AND d.facetable AND d."archivedAt" IS NULL
          AND ${FACET_VALUE_SQL} = ANY(${values}::text[])
    )
    OR EXISTS (
        SELECT 1 FROM "VariantAttributeValue" v
        JOIN "ProductVariant" pv ON pv.id = v."variantId"
        JOIN "AttributeDefinition" d ON d.id = v."definitionId"
        LEFT JOIN "AttributeOption" o ON o.id = v."optionId"
        WHERE pv."productId" = p.id
          AND d.key = ${key} AND d.facetable AND d."archivedAt" IS NULL
          AND ${FACET_VALUE_SQL} = ANY(${values}::text[])
    )
)`;

/**
 * `getProducts` の絞り込み条件を、生 SQL の述語（`p` = "Product"）の配列として組み立てる。
 *
 * **すべての述語を同じ SQL の `WHERE` に入れ、LIMIT は最終段にだけ置く**（design.md §2-Q2）。
 * 「検索で上位 N 件を確定 → 後段で絞り込み」の順にすると、件数が欠けて適合商品を取りこぼす。
 *
 * 値はすべて `Prisma.sql` のパラメータとして渡す（文字列連結しない）。
 * size / price / color はそれぞれ独立した `EXISTS`（旧 Prisma の `variants.some.sizes.some`
 * と同じ意味: どれか 1 つのバリアント・サイズが条件を満たせば商品全体がヒットする）。
 *
 * @param filters - `parseProductFilters` 済みのフィルタ
 * @param refs - `resolveFilterSlugs` で解決済みの参照
 * @param tsQuery - `buildPrefixTsQuery` の結果（検索語なしなら `null`）
 * @param excludeAttributeKey - この属性 key の選択だけを外す（ファセットの disjunctive 集計用）
 * @returns `Prisma.join(…, " AND ")` で連結する述語の配列
 */
const buildProductPredicates = (
    filters: ProductFilters,
    refs: ResolvedProductFilterRefs,
    tsQuery: string | null,
    excludeAttributeKey?: string
): Prisma.Sql[] => {
    const predicates: Prisma.Sql[] = [];

    if (refs.storeId !== undefined) {
        predicates.push(Prisma.sql`p."storeId" = ${refs.storeId}`);
    }
    // 新 FK（categoryNodeId）のサブツリー。LIKE は slug 中の "_" / "%" をワイルドカードとして
    // 扱ってしまうので starts_with を使う（design.md §0-13。`subtreeOf` と同じ境界）。
    for (const path of refs.categoryPaths) {
        predicates.push(Prisma.sql`EXISTS (
            SELECT 1 FROM "Category" c
            WHERE c.id = p."categoryNodeId"
              AND (c.path = ${path} OR starts_with(c.path, ${`${path}/`}))
        )`);
    }
    if (refs.offerTagId !== undefined) {
        predicates.push(Prisma.sql`p."offerTagId" = ${refs.offerTagId}`);
    }
    if (tsQuery !== null) {
        predicates.push(
            Prisma.sql`p."searchVector" @@ to_tsquery('simple', ${tsQuery})`
        );
    }
    if (filters.size !== undefined) {
        predicates.push(Prisma.sql`EXISTS (
            SELECT 1 FROM "ProductVariant" pv
            JOIN "Size" s ON s."productVariantId" = pv.id
            WHERE pv."productId" = p.id AND s.size = ANY(${filters.size}::text[])
        )`);
    }
    // 「未指定」と「0」を truthy 判定で混同しない（`maxPrice: 0` は上限 0 の空レンジ）。
    // 上限が無いときは条件を付けない。下限だけ未指定なら 0 を下限にする（旧実装と同じ）。
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        const lower = new Prisma.Decimal(filters.minPrice ?? 0);
        const upper =
            filters.maxPrice !== undefined
                ? Prisma.sql` AND s.price <= ${new Prisma.Decimal(filters.maxPrice)}`
                : Prisma.empty;
        predicates.push(Prisma.sql`EXISTS (
            SELECT 1 FROM "ProductVariant" pv
            JOIN "Size" s ON s."productVariantId" = pv.id
            WHERE pv."productId" = p.id AND s.price >= ${lower}${upper}
        )`);
    }
    if (filters.color !== undefined) {
        predicates.push(Prisma.sql`EXISTS (
            SELECT 1 FROM "ProductVariant" pv
            JOIN "Color" co ON co."productVariantId" = pv.id
            WHERE pv."productId" = p.id AND co.name = ANY(${filters.color}::text[])
        )`);
    }
    // 属性ファセット: 同じ key の値は OR、key 同士は AND（plan 076）
    for (const [key, values] of Object.entries(filters.attributes ?? {})) {
        if (key === excludeAttributeKey) continue;
        predicates.push(attributeSelectionSql(key, values));
    }
    return predicates;
};

/**
 * 並び順の `ORDER BY` 句を返す。**末尾に必ず `p.id ASC` の tie-breaker を置く**。
 *
 * views / rating は 0 の商品が大半を占めうる（ローカル実測で views=0 が 80 件中 73 件）。
 * PostgreSQL は同値行の順序を保証しないので、単一キーのままページングすると、ある商品が
 * 2 ページに出たり、どのページにも出なかったりする（plan 073）。
 *
 * 検索語があり sort が未指定なら関連度（ts_rank）順にする。
 *
 * price 系は非正規化列 `minPrice`（割引後の最小価格）で並べる（plan 076）。旧実装は
 * ページング「後」にメモリ上で並べ替えていたため、表示中の 1 ページしか価格順にならなかった。
 * サイズの無い商品（`minPrice` が NULL）は昇順・降順とも末尾に置く。
 *
 * @param sortBy - URL の sort パラメータ
 * @param tsQuery - 検索語の tsquery（検索なしなら `null`）
 */
const productOrderBySql = (
    sortBy: string,
    tsQuery: string | null
): Prisma.Sql => {
    switch (sortBy) {
        case "new-arrivals":
            return Prisma.sql`ORDER BY p."createdAt" DESC, p.id ASC`;
        case "top-rated":
            return Prisma.sql`ORDER BY p.rating DESC, p.id ASC`;
        case "price-low-to-high":
            return Prisma.sql`ORDER BY p."minPrice" ASC NULLS LAST, p.id ASC`;
        case "price-high-to-low":
            return Prisma.sql`ORDER BY p."minPrice" DESC NULLS LAST, p.id ASC`;
        case "":
            if (tsQuery !== null) {
                return Prisma.sql`ORDER BY ts_rank(p."searchVector", to_tsquery('simple', ${tsQuery})) DESC, p.id ASC`;
            }
            return Prisma.sql`ORDER BY p.views DESC, p.id ASC`;
        case "most-popular":
        default:
            return Prisma.sql`ORDER BY p.views DESC, p.id ASC`;
    }
};

/** `getProductFacets` の集計 1 行 */
type FacetCountRow = {
    key: string;
    name: string;
    unit: string | null;
    def_order: number;
    value: string;
    label: string;
    option_order: number | null;
    count: bigint;
};

/**
 * 母集合（`whereSql` を満たす商品）について、facetable な属性の「key × 値 × 商品数」を集計する。
 * ADR-007 の集計雛形の母集合を `base` CTE に差し替えたもの（design.md §2-Q3）。
 * 1 商品が同じ値のバリアントを複数持っても重複計上しないよう `count(DISTINCT …)` にする。
 */
const queryFacetCounts = (
    whereSql: Prisma.Sql,
    keyFilter: Prisma.Sql
): Promise<FacetCountRow[]> =>
    db.$queryRaw<FacetCountRow[]>(Prisma.sql`
        WITH base AS (
            SELECT p.id FROM "Product" p ${whereSql}
        ), attr_value AS (
            SELECT v."productId" AS product_id, v."definitionId", v."optionId",
                   v."valueText", v."valueBool", v."valueNumber"
            FROM "ProductAttributeValue" v JOIN base b ON b.id = v."productId"
            UNION ALL
            SELECT pv."productId", v."definitionId", v."optionId",
                   v."valueText", v."valueBool", v."valueNumber"
            FROM "VariantAttributeValue" v
            JOIN "ProductVariant" pv ON pv.id = v."variantId"
            JOIN base b ON b.id = pv."productId"
        )
        SELECT d.key,
               min(d.name) AS name,
               min(d.unit) AS unit,
               min(d."sortOrder") AS def_order,
               ${FACET_VALUE_SQL} AS value,
               min(${FACET_LABEL_SQL}) AS label,
               min(o."sortOrder") AS option_order,
               count(DISTINCT v.product_id) AS count
        FROM attr_value v
        JOIN "AttributeDefinition" d ON d.id = v."definitionId"
             AND d.facetable AND d."archivedAt" IS NULL
        LEFT JOIN "AttributeOption" o ON o.id = v."optionId"
        WHERE ${keyFilter}
        -- 別名（value / label）では GROUP BY しない。GROUP BY の名前解決は入力列が優先されるため、
        -- "value" は別名ではなく AttributeOption の列 o.value として解釈されてしまう。
        -- label は GROUP BY に含めず集約する。含めると同じ key × value が label 違いで複数行に割れ、
        -- 件数が分散する（1 つの値に 1 行・1 件数を保証する）。
        GROUP BY d.key, ${FACET_VALUE_SQL}
    `);

/**
 * ブラウズの属性ファセット（件数つき）を返す（plan 076 / design.md §2-Q3）。
 *
 * - **カテゴリ（category / subCategory）が指定されたときだけ**返す。属性定義はカテゴリに属し、
 *   カタログ全体で集計すると無関係な部門の属性が並ぶため（ADR-007）。
 * - 件数は検索語・カテゴリ・価格などの他の条件をすべて課した母集合で数える。
 * - **disjunctive faceting**: 選択中の key の件数は「その key 自身の選択だけを外した」母集合で数える
 *   （色で赤を選んでも、青の件数が 0 にならない）。クエリ数は「選択中の key の数 + 1」。
 * - 件数そのものはキャッシュしない（検索語と条件の組み合わせごとに変わり、当たらない）。
 *   表示名は集計と同じクエリで引くので、定義のための別往復も無い。
 *
 * @param filters - `getProducts` と同じフィルタ
 * @returns ファセットの配列（定義の sortOrder → key 順。値は option の sortOrder → 件数の多い順）
 */
export const getProductFacets = async (
    filters: ProductFilters = {}
): Promise<ProductFacet[]> => {
    try {
        const parsed = parseProductFilters(filters);
        if (parsed.kind === "invalid") return [];
        const { filters: parsedFilters } = parsed;
        if (!parsedFilters.category && !parsedFilters.subCategory) return [];

        let tsQuery: string | null = null;
        if (parsedFilters.search !== undefined) {
            tsQuery = buildPrefixTsQuery(parsedFilters.search);
            if (tsQuery === null) return [];
        }
        const refs = await resolveFilterSlugs(parsedFilters);
        if (refs === null) return [];

        const selections = parsedFilters.attributes ?? {};
        const selectedKeys = Object.keys(selections);
        const whereFor = (excludeKey?: string): Prisma.Sql => {
            const predicates = buildProductPredicates(
                parsedFilters,
                refs,
                tsQuery,
                excludeKey
            );
            return predicates.length > 0
                ? Prisma.sql`WHERE ${Prisma.join(predicates, " AND ")}`
                : Prisma.empty;
        };

        // 未選択の key はすべての選択を課した母集合で、選択中の key は自分の選択を外した母集合で数える
        const unselectedFilter =
            selectedKeys.length > 0
                ? Prisma.sql`d.key <> ALL(${selectedKeys}::text[])`
                : Prisma.sql`TRUE`;
        const runs = await Promise.all([
            queryFacetCounts(whereFor(), unselectedFilter),
            ...selectedKeys.map((key) =>
                queryFacetCounts(whereFor(key), Prisma.sql`d.key = ${key}`)
            ),
        ]);

        const facetsByKey = new Map<
            string,
            ProductFacet & { order: number; optionOrder: Map<string, number> }
        >();
        for (const row of runs.flat()) {
            const facet = facetsByKey.get(row.key) ?? {
                key: row.key,
                name: row.name,
                unit: row.unit,
                values: [],
                order: row.def_order,
                optionOrder: new Map<string, number>(),
            };
            facet.values.push({
                value: row.value,
                label: row.label,
                count: Number(row.count),
                selected: selections[row.key]?.includes(row.value) ?? false,
            });
            if (row.option_order !== null) {
                facet.optionOrder.set(row.value, row.option_order);
            }
            facetsByKey.set(row.key, facet);
        }

        // 選択中なのに母集合に 1 件も無い値も、選択を外せるよう件数 0 で残す。
        // key ごと見つからない場合（カテゴリを切り替えて前のカテゴリの attr.* が URL に残った等）も
        // 同じ。ファセットに出さないと、0 件に絞られたまま解除する手段が無くなる。
        for (const [key, values] of Object.entries(selections)) {
            const facet = facetsByKey.get(key) ?? {
                key,
                name: key,
                unit: null,
                values: [],
                order: Number.MAX_SAFE_INTEGER,
                optionOrder: new Map<string, number>(),
            };
            facetsByKey.set(key, facet);
            for (const value of values) {
                if (facet.values.some((v) => v.value === value)) continue;
                facet.values.push({ value, label: value, count: 0, selected: true });
            }
        }

        return [...facetsByKey.values()]
            .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
            .map(({ order: _order, optionOrder, ...facet }) => ({
                ...facet,
                values: [...facet.values].sort(
                    (a, b) =>
                        (optionOrder.get(a.value) ?? Number.MAX_SAFE_INTEGER) -
                            (optionOrder.get(b.value) ?? Number.MAX_SAFE_INTEGER) ||
                        b.count - a.count ||
                        a.label.localeCompare(b.label)
                ),
            }));
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("[product:getProductFacets]", error.message, {
                stack: error.stack,
            });
        } else {
            console.error("[product:getProductFacets]", error);
        }
        throw error;
    }
};

export const getProducts = async (
    filters: ProductFilters = {},
    sortBy = "",
    page: number = 1,
    pageSize: number = 10
) => {
    try {
        // Default values for page and pageSize
        const currentPage = page;
        const limit = pageSize;
        const skip = (currentPage - 1) * limit;

        // URL 由来のフィルタ（store / category / subCategory / offer）は、対応する行が
        // 存在しないことがある（古いブックマーク・打ち間違い・攻撃的な入力）。
        // 見つからないときにフィルタを**黙って捨てる**と「該当なし」が「全件表示」に化けるため
        // （存在しないカテゴリ URL で全カタログが出る）、明示的に 0 件を返す。
        const noMatchResult = {
            products: [] as typeof productsWithFilteredVariants,
            totalPages: 0,
            currentPage,
            pageSize,
            totalCount: 0,
        };

        // Server Action なので型に反する入力も届きうる。配列が単一値の位置に来た等の
        // 曖昧な指定は、解決できない指定と同じ扱いにして fail-closed で 0 件を返す。
        const parsed = parseProductFilters(filters);
        if (parsed.kind === "invalid") return noMatchResult;

        // 検索語は「全語 AND + 最後の語だけ前方一致」の tsquery にする。文字・数字を
        // 1 つも含まない検索語（"&|!" 等）は、何にも一致しない指定として 0 件を返す。
        let tsQuery: string | null = null;
        if (parsed.filters.search !== undefined) {
            tsQuery = buildPrefixTsQuery(parsed.filters.search);
            if (tsQuery === null) return noMatchResult;
        }

        const refs = await resolveFilterSlugs(parsed.filters);
        if (refs === null) return noMatchResult;

        const predicates = buildProductPredicates(parsed.filters, refs, tsQuery);
        const whereSql =
            predicates.length > 0
                ? Prisma.sql`WHERE ${Prisma.join(predicates, " AND ")}`
                : Prisma.empty;

        // 絞り込み → 並び替え → ページングを 1 本の SQL で行い、ID だけを取る（design.md §2-Q2）。
        // 件数は同じ WHERE で別に数える（OFFSET が最終ページを越えても正しい総数を返すため）。
        const [idRows, countRows] = await Promise.all([
            db.$queryRaw<{ id: string }[]>(Prisma.sql`
                SELECT p.id FROM "Product" p
                ${whereSql}
                ${productOrderBySql(sortBy, tsQuery)}
                LIMIT ${limit} OFFSET ${skip}
            `),
            db.$queryRaw<{ count: bigint }[]>(Prisma.sql`
                SELECT count(*) AS count FROM "Product" p
                ${whereSql}
            `),
        ]);
        const totalCount = Number(countRows[0]?.count ?? 0);
        const ids = idRows.map((row) => row.id);

        // 表示用の列は ID で hydrate する。findMany は順序を保証しないので ID の順に並べ直す。
        const hydrated =
            ids.length > 0
                ? await db.product.findMany({
                      where: { id: { in: ids } },
                      include: {
                          variants: {
                              include: {
                                  sizes: true,
                                  images: true,
                                  colors: true,
                              },
                          },
                      },
                  })
                : [];
        const byId = new Map(hydrated.map((product) => [product.id, product]));
        const products = ids.flatMap((id) => {
            const product = byId.get(id);
            return product ? [product] : [];
        });

        // Transform the products with filtered variants into ProductCardType structure
        const productsWithFilteredVariants = products.map((product) => {
            // Filter the variants based on the filters
            const filteredVariants = product.variants;

            // Transform the filtered variants into the VariantSimplified structure
            const variants: VariantSimplified[] = filteredVariants.map(
                (variant) => ({
                    variantId: variant.id,
                    variantSlug: variant.slug,
                    variantName: variant.variantName,
                    images: variant.images,
                    sizes: variant.sizes.map((s) => ({
                        ...s,
                        price: toNumberSafe(s.price),
                    })),
                })
            );

            // Extract variant images for the product
            const variantImages: VariantImageType[] = filteredVariants.map(
                (variant) => ({
                    url: `/product/${product.slug}/${variant.slug}`,
                    image: variant.variantImage
                        ? variant.variantImage
                        : (variant.images[0]?.url ?? ""),
                })
            );
            // Return the product in the ProductCardType structure
            return {
                id: product.id,
                slug: product.slug,
                name: product.name,
                rating: product.rating,
                sales: product.sales,
                numReviews: product.numReviews,
                variants,
                variantImages,
            };
        });

        // Calculate total pages
        const totalPages = Math.ceil(totalCount / pageSize);

        // Return the filtered products, pagination metadata, and total count
        return {
            products: productsWithFilteredVariants,
            totalPages,
            currentPage,
            pageSize,
            totalCount,
        };
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("[product:getProducts]", error.message, {
                stack: error.stack,
            });
        } else {
            console.error("[product:getProducts]", error);
        }
        throw error;
    }
};

// Function: getProductPageData
// Description: Retrieves product data (including product and variant details) for a specific product page
// Access Level: Public
// Parameters:
// - productId: The slug of the product to which the variant belongs.
// - variantId: The ID of the variant for which to retrieve data.
// Returns: Product data (including product and variant details) or null if the product or variant is not found.

export const getProductPageData = async (
    productSlug: string,
    variantSlug: string
) => {
    // Get current user
    const user = await currentUser();

    // Retrieve product and variant details from the database
    const product = await retrieveProductDetails(productSlug, variantSlug);
    if (!product) return;

    // Retrieve user country
    const userCountry = await getUserCountry();

    // Calculate and retrieve the shipping details
    const productShippingDetails = await getShippingDetails(
        product.shippingFeeMethod,
        userCountry,
        product.store,
        product.freeShipping
    );

    // Fetch store followers count
    const storeFollowersCount = await getStoreFollowersCount(product.storeId);

    // Check if user is following store
    const isUserFollowingStore = await checkIfUserFollowingStore(
        product.storeId,
        user?.id
    );

    // Handle product views
    await incrementProductViews(product.id);

    // Reviews stats
    const ratingStatistics = await getRatingStatistics(product.id);

    // 構造化属性（「仕様」セクション）。表示中のバリアント分だけ読む
    const attributes = await getProductAttributeDisplay(product);

    return formatProductResponse(
        product,
        productShippingDetails,
        storeFollowersCount,
        isUserFollowingStore,
        ratingStatistics,
        attributes
    );
};

// Helper functions
export const retrieveProductDetails = async (
    productSlug: string,
    variantSlug: string
) => {
    const product = await db.product.findUnique({
        where: {
            slug: productSlug,
        },
        include: {
            category: true,
            // 構造化属性の有効定義はツリーノードの path から解決する（plan 069 Step 9）
            categoryNode: { select: { path: true } },
            subCategory: true,
            offerTag: true,
            store: true,
            specs: true,
            questions: true,
            reviews: {
                include: {
                    images: true,
                    user: true,
                },
                take: 4,
            },
            freeShipping: {
                include: {
                    eligibleCountries: true,
                },
            },
            variants: {
                where: {
                    slug: variantSlug,
                },
                include: {
                    images: true,
                    colors: true,
                    sizes: true,
                    specs: true,
                },
            },
        },
    });

    if (!product) return null;
    // Get variant info
    const variantsInfo = await db.productVariant.findMany({
        where: {
            productId: product.id,
        },
        include: {
            images: true,
            sizes: true,
            colors: true,
            product: {
                select: {
                    slug: true,
                },
            },
        },
    });

    return {
        ...product,
        variantsInfo: variantsInfo.map((variant) => ({
            variantName: variant.variantName,
            variantSlug: variant.slug,
            variantImage: variant.variantImage,
            variantUrl: `/product/${productSlug}/${variant.slug}`,
            images: variant.images,
            sizes: variant.sizes.map((s) => ({
                ...s,
                price: toNumberSafe(s.price),
            })),
            colors: variant.colors,
        })),
    };
};

const getProductAttributeDisplay = async (
    product: NonNullable<ProductPageType>
): Promise<ProductAttributeDisplay> => {
    try {
        return await findProductAttributeDisplay(db, {
            categoryPath: product.categoryNode?.path ?? null,
            productId: product.id,
            variantIds: product.variants.map((variant) => variant.id),
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[product:getProductAttributeDisplay] Failed to load attributes",
                { error: error.message, stack: error.stack }
            );
        } else {
            console.error(
                "[product:getProductAttributeDisplay] Unknown error",
                { error }
            );
        }
        // アレルゲン等の表示義務がある属性を黙って欠落させないため、ページごと失敗させる
        throw error;
    }
};

const getUserCountry = async () => {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get("userCountry")?.value;
    return parseUserCountryCookie(cookieValue);
};
const formatProductResponse = (
    product: ProductPageType,
    shippingDetails: ProductShippingDetailsType,
    storeFollowersCount: number,
    isUserFollowingStore: boolean,
    ratingStatistics: RatingStatisticsType,
    attributes: ProductAttributeDisplay
) => {
    if (!product) return;
    const variant = product.variants[0];
    const { store, category, subCategory, offerTag, questions, reviews } =
        product;
    const { images, colors, sizes } = variant;

    return {
        productId: product.id,
        variantId: variant.id,
        productSlug: product.slug,
        variantSlug: variant.slug,
        name: product.name,
        description: product.description,
        variantName: variant.variantName,
        variantDescription: variant.variantDescription,
        images,
        category,
        subCategory,
        offerTag,
        isSale: variant.isSale,
        saleEndDate: variant.saleEndDate,
        brand: product.brand,
        sku: variant.sku,
        weight: variant.weight,
        variantImage: variant.variantImage,
        store: {
            id: store.id,
            url: store.url,
            name: store.name,
            logo: store.logo,
            returnPolicy: store.returnPolicy,
            followersCount: storeFollowersCount,
            isUserFollowingStore,
        },
        colors,
        sizes: sizes.map((s) => ({
            ...s,
            price: toNumberSafe(s.price),
        })),
        specs: {
            product: product.specs,
            variant: variant.specs,
        },
        attributes: {
            product: attributes.product,
            variant: attributes.variants[variant.id] ?? [],
        },
        questions,
        rating: product.rating,
        reviews,
        reviewsStatistics: ratingStatistics,
        shippingDetails,
        relatedProducts: [],
        variantInfo: product.variantsInfo,
    };
};

const getStoreFollowersCount = async (storeId: string) => {
    const storeFollowersCount = await db.store.findUnique({
        where: {
            id: storeId,
        },
        select: {
            _count: {
                select: {
                    followers: true,
                },
            },
        },
    });
    return storeFollowersCount?._count.followers || 0;
};

const checkIfUserFollowingStore = async (
    storeId: string,
    userId: string | undefined
) => {
    let isUserFollowingStore = false;
    if (userId) {
        const storeFollowersInfo = await db.store.findUnique({
            where: {
                id: storeId,
            },
            select: {
                followers: {
                    where: {
                        id: userId, // Check if this user is following the store
                    },
                    select: { id: true }, // Select the user id if following
                },
            },
        });
        if (storeFollowersInfo && storeFollowersInfo.followers.length > 0) {
            isUserFollowingStore = true;
        }
    }

    return isUserFollowingStore;
};

export const getRatingStatistics = async (productId: string) => {
    const ratingStats = await db.review.groupBy({
        by: ["rating"],
        where: { productId },
        _count: {
            rating: true,
        },
    });

    const totalReviews = ratingStats.reduce(
        (sum, stat) => sum + stat._count.rating,
        0
    );

    const ratingCounts = Array(5).fill(0);

    ratingStats.forEach((stat) => {
        let rating = Math.floor(stat.rating);
        if (rating >= 1 && rating <= 5) {
            ratingCounts[rating - 1] = stat._count.rating;
        }
    });

    return {
        ratingStatistics: ratingCounts.map((count, index) => ({
            rating: index + 1,
            numReviews: count,
            percentage: totalReviews > 0 ? (count / totalReviews) * 100 : 0,
        })),
        reviewsWithImagesCount: await db.review.count({
            where: {
                productId,
                images: { some: {} },
            },
        }),
        totalReviews,
    };
};

// Function: getShippingDetails
// Description: Retrieves and calculates shipping details based on the product's shipping fee method and user's country
// Access Level: Public
// Parameters:
// - shippingFeeMethod: The shipping fee method of the product.
// - userCountry: The parsed user country object from cookies.
// - store: store details
// Returns: The calculated shipping details.
export const getShippingDetails = async (
    shippingFeeMethod: ShippingFeeMethod,
    userCountry: { name: string; code: string; city: string },
    store: Store,
    freeShipping: FreeShippingWithCountriesType | null
) => {
    try {
        let shippingDetails = {
            shippingFeeMethod,
            shippingService: "",
            shippingFee: 0,
            extraShippingFee: 0,
            deliveryTimeMin: 0,
            deliveryTimeMax: 0,
            returnPolicy: "",
            countryCode: userCountry.code,
            countryName: userCountry.name,
            city: userCountry.city,
            isFreeShipping: false,
        };

        const country = await db.country.findUnique({
            where: {
                name: userCountry.name,
                code: userCountry.code,
            },
        });

        if (country) {
            // Retrieve shipping rate for the country
            const shippingRate = await db.shippingRate.findFirst({
                where: {
                    countryId: country.id,
                    storeId: store.id,
                },
            });

            const returnPolicy =
                shippingRate?.returnPolicy || store.returnPolicy;
            const shippingService =
                shippingRate?.shippingService || store.defaultShippingService;
            const shippingFeePerItem =
                shippingRate?.shippingFeePerItem ||
                store.defaultShippingFeePerItem;
            const shippingFeeForAdditionalItem =
                shippingRate?.shippingFeeForAdditionalItem ||
                store.defaultShippingFeeForAdditionalItem;
            const shippingFeePerKg =
                shippingRate?.shippingFeePerKg || store.defaultShippingFeePerKg;
            const shippingFeeFixed =
                shippingRate?.shippingFeeFixed || store.defaultShippingFeeFixed;
            const deliveryTimeMin =
                shippingRate?.deliveryTimeMin || store.defaultDeliveryTimeMin;
            const deliveryTimeMax =
                shippingRate?.deliveryTimeMax || store.defaultDeliveryTimeMax;

            // Check for free shipping
            if (freeShipping) {
                const free_shipping_countries = freeShipping.eligibleCountries;
                const check_free_shipping = free_shipping_countries.find(
                    (c) => c.countryId === country.id
                );
                if (check_free_shipping) {
                    shippingDetails.isFreeShipping = true;
                }
            }

            shippingDetails = {
                shippingFeeMethod,
                shippingService: shippingService,
                shippingFee: 0,
                extraShippingFee: 0,
                deliveryTimeMin,
                deliveryTimeMax,
                returnPolicy,
                countryCode: userCountry.code,
                countryName: userCountry.name,
                city: userCountry.city,
                isFreeShipping: shippingDetails.isFreeShipping,
            };

            const { isFreeShipping } = shippingDetails;
            switch (shippingFeeMethod) {
                case "ITEM":
                    shippingDetails.shippingFee = isFreeShipping
                        ? 0
                        : shippingFeePerItem.toNumber();
                    shippingDetails.extraShippingFee = isFreeShipping
                        ? 0
                        : shippingFeeForAdditionalItem.toNumber();
                    break;

                case "WEIGHT":
                    shippingDetails.shippingFee = isFreeShipping
                        ? 0
                        : shippingFeePerKg.toNumber();
                    break;

                case "FIXED":
                    shippingDetails.shippingFee = isFreeShipping
                        ? 0
                        : shippingFeeFixed.toNumber();
                    break;

                default:
                    break;
            }
            return shippingDetails;
        }

        return false;
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "Error in getShippingDetails:",
                error.message,
                error.stack
            );
        } else {
            console.error("Error in getShippingDetails:", error);
        }
        throw error;
    }
};

// Function: getProductFilteredReviews
// Description: Retrieves filtered and sorted reviews for a product from the database,
// Access Level: Public
// Parameters:
// - productId: The ID of the product for which reviews are being fetched.
// - filters: An object containing filter options such as rating, and whether review
// - sort: An object defining sort order, such as latest, oldest, or highest rating.
// - page: The page number for pagination. (1-based index)
// - pageSize: The Number of reviews to retrieve per page.
// Returns: A paginated list of reviews that match the filter and sort criteria.
export const getProductFilteredReviews = async (
    productId: string,
    filters: {
        rating?: number;
        hasImages?: boolean;
    },
    sort: { orderBy: "latest" | "oldest" | "highest" } | undefined,
    page: number = 1,
    pageSize: number = 4
) => {
    const reviewFilter: any = {
        productId,
    };

    // Apply rating filter if provided
    if (filters.rating) {
        const rating = filters.rating;
        reviewFilter.rating = {
            in: [rating, rating + 0.5],
        };
    }

    // Apply image filter if provided
    if (filters.hasImages) {
        reviewFilter.images = {
            some: {},
        };
    }

    // Set sorting order using local SortOrder type
    const sortOption: { createdAt?: SortOrder; rating?: SortOrder } =
        sort && sort.orderBy === "latest"
            ? { createdAt: "desc" }
            : sort && sort.orderBy === "oldest"
              ? { createdAt: "asc" }
              : { rating: "desc" };

    // Calculate pagination parameters
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Fetch reviews from the database
    const reviews = await db.review.findMany({
        where: reviewFilter,
        include: {
            images: true,
            user: true,
        },
        orderBy: sortOption,
        skip, // Skip records for pagination
        take, // Take records for pagination
    });

    return reviews;
};

/**
 * @function getDeliveryDetailsForStoreByCountry
 * @description Returns delivery details for a store based on the store ID and country ID
 * @permissionLevel Public
 * @parameters - storeId: ID of the store
 * - countryId: ID of the country
 * @returns
 */

export const getDeliveryDetailsForStoreByCountry = async (
    storeId: string,
    countryId: string
) => {
    // Get shipping rate
    const shippingRate = await db.shippingRate.findFirst({
        where: {
            storeId,
            countryId,
        },
    });

    let storeDetails;
    if (!shippingRate) {
        storeDetails = await db.store.findUnique({
            where: {
                id: storeId,
            },
            select: {
                defaultShippingService: true,
                defaultDeliveryTimeMax: true,
                defaultDeliveryTimeMin: true,
            },
        });
    }

    const shippingService = shippingRate
        ? shippingRate.shippingService
        : storeDetails?.defaultShippingService;

    const deliveryTimeMin = shippingRate
        ? shippingRate.deliveryTimeMin
        : storeDetails?.defaultDeliveryTimeMin;

    const deliveryTimeMax = shippingRate
        ? shippingRate.deliveryTimeMax
        : storeDetails?.defaultDeliveryTimeMax;

    return { shippingService, deliveryTimeMax, deliveryTimeMin };
};

/**
 * @function getProductShippingFee
 * @description Retrieve and calculates shipping fee based on user country and product.
 * @permissionLevel Public
 * @parameters
 *   - shippingFeeMethod: The shipping fee method of the product
 *   - userCountry: The parsed user country object from cookies.
 *   - store: store details.
 *   - freeShipping.
 *   - weight.
 *   - quantity.
 * @returns Calculated total shipping fee for product.
 */
export const getProductShippingFee = async (
    shippingFeeMethod: ShippingFeeMethod,
    userCountry: Country,
    store: Store,
    freeShipping: FreeShippingWithCountriesType | null,
    weight: number,
    quantity: number
) => {
    try {
        // Fetch country information based on userCountry.name and userCountry.code
        const country = await db.country.findUnique({
            where: {
                name: userCountry.name,
                code: userCountry.code,
            },
        });

        if (country) {
            // Check if the user qualifies for free shipping
            if (freeShipping) {
                const free_shipping_countries = freeShipping.eligibleCountries;
                const isEligibleForFreeShipping = free_shipping_countries.some(
                    (c) => c.countryId === country.id
                );
                if (isEligibleForFreeShipping) {
                    return new Prisma.Decimal("0"); // Free shipping
                }
            }

            // Fetch shipping rate from the database for the given store and country
            const shippingRate = await db.shippingRate.findFirst({
                where: {
                    countryId: country.id,
                    storeId: store.id,
                },
            });

            // Destructure the shippingRate with defaults
            const {
                shippingFeePerItem = store.defaultShippingFeePerItem,
                shippingFeeForAdditionalItem = store.defaultShippingFeeForAdditionalItem,
                shippingFeePerKg = store.defaultShippingFeePerKg,
                shippingFeeFixed = store.defaultShippingFeeFixed,
            } = shippingRate || {};

            // Calculate the additional quantity (excluding the first item)
            const additionalItemsQty = Math.max(0, quantity - 1);

            // Define fee calculation methods in a map (using Decimal arithmetic)
            const feeCalculators: Record<string, () => Prisma.Decimal> = {
                ITEM: () =>
                    shippingFeePerItem.add(
                        shippingFeeForAdditionalItem.mul(additionalItemsQty)
                    ),
                WEIGHT: () => shippingFeePerKg.mul(weight).mul(quantity),
                FIXED: () => shippingFeeFixed,
            };

            // Check if the fee calculation method exists and calculate the fee
            const calculateFee = feeCalculators[shippingFeeMethod];
            if (calculateFee) {
                return calculateFee(); // Execute the corresponding calculation
            }

            // If no valid shipping method is found, return 0
            return new Prisma.Decimal("0");
        }

        // Return 0 if the country is not found
        return new Prisma.Decimal("0");
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "Error in getProductShippingFee:",
                error.message,
                error.stack
            );
        } else {
            console.error("Error in getProductShippingFee:", error);
        }
        throw error;
    }
};

/**
 * @function getProductsByIds
 * @description Retrieves product details based on an array of product ids.
 * @parameters - ids: An array of product ids to fetch details for.
 * @returns A promise that resolves to an array of product objects. If id doesn't exist in the database, it will be skipped.
 * @throws An error if the database query fails.
 */

export const getProductsByIds = async (
    ids: string[],
    page: number = 1,
    pageSize: number = 10
): Promise<{ products: ProductType[]; totalPages: number }> => {
    const MAX_IDS = 1000;
    // Check if ids array is empty
    if (!ids || ids.length === 0) {
        throw new Error("Ids are undefined");
    }

    if (ids.length > MAX_IDS) {
        console.warn(
            `Too many product IDs requested (${ids.length}). Truncating to maximum allowed (${MAX_IDS}).`
        );
        ids = ids.slice(0, MAX_IDS);
    }

    // Default values for page and pageSize
    const currentPage = page;
    const limit = pageSize;
    const skip = (currentPage - 1) * limit;
    try {
        // Query the database for products with the specified ids
        const variants = await db.productVariant.findMany({
            where: {
                id: {
                    in: ids,
                },
            },
            select: {
                id: true,
                variantName: true,
                variantImage: true,
                slug: true,
                images: true,
                sizes: true,
                product: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        rating: true,
                        sales: true,
                        numReviews: true,
                    },
                },
            },
        });

        // getProducts と同じ ProductType 互換の構造にマッピング
        const new_products: ProductType[] = variants.map((variant) => {
            const variantSimplified: VariantSimplified = {
                variantId: variant.id,
                variantSlug: variant.slug,
                variantName: variant.variantName,
                images: variant.images,
                sizes: variant.sizes.map((s) => ({
                    ...s,
                    price: toNumberSafe(s.price),
                })),
            };
            const variantImage: VariantImageType = {
                url: `/product/${variant.product.slug}/${variant.slug}`,
                image: variant.variantImage
                    ? variant.variantImage
                    : (variant.images[0]?.url ?? ""),
            };
            return {
                id: variant.product.id,
                slug: variant.product.slug,
                name: variant.product.name,
                rating: variant.product.rating,
                sales: variant.product.sales,
                numReviews: variant.product.numReviews,
                variants: [variantSimplified],
                variantImages: [variantImage],
            };
        });

        // Return products sorted in the order of ids provided
        const ordered_products = ids
            .map((id) =>
                new_products.find(
                    (product) => product.variants[0].variantId === id
                )
            )
            .filter((p): p is ProductType => Boolean(p));

        const paginated_products = ordered_products.slice(skip, skip + limit);

        const allProducts = ordered_products.length;
        const totalPages = Math.ceil(allProducts / pageSize);

        return {
            products: paginated_products,
            totalPages,
        };
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "Error retrieving products by ids:",
                error.message,
                error.stack
            );
        } else {
            console.error("Error retrieving products by ids:", error);
        }
        throw new Error("Failed to retrieve products. Please try again.");
    }
};

const incrementProductViews = async (productId: string) => {
    const cookieStore = await cookies();
    const isProductAlreadyViewed = cookieStore.get(
        `viewedProduct_${productId}`
    )?.value;

    if (!isProductAlreadyViewed) {
        await db.product.update({
            where: {
                id: productId,
            },
            data: {
                views: {
                    increment: 1,
                },
            },
        });
    }
};
