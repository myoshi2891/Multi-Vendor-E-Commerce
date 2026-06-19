"use server";

import { db } from "@/lib/db";
import { requireStoreOwner } from "@/lib/auth-guards";
import { UpdateSizeStockSchema, LowStockThresholdSchema } from "@/lib/schemas";

/**
 * src/queries/inventory.ts
 * 販売者ダッシュボード F2「在庫管理」のサーバーアクション層。
 *
 * - getStoreInventory: 店舗の全 Size を商品→バリアント→サイズ階層でフラット化して取得
 * - updateSizeStock: 在庫数のクイック編集（所有権チェーンで IDOR 防止）
 * - updateStoreLowStockThreshold: 店舗単位の過小在庫しきい値を更新
 *
 * 認可は src/lib/auth-guards.ts の requireStoreOwner を冒頭で呼ぶ（try/catch の外）。
 * 設計の正本: docs/design/seller-dashboard/design.md §2.1〜§2.3
 */

/**
 * @function getStoreInventory
 * @description 当該店舗の全 Size を「商品→バリアント→サイズ」の階層で取得し、
 *              在庫一覧用にフラット化して返す。返却要素の型は
 *              src/lib/types.ts の StoreInventoryRow（PromiseReturnType で導出）。
 * @access SELLER（店舗所有者のみ）
 */
export const getStoreInventory = async (storeUrl: string) => {
    const { store } = await requireStoreOwner(storeUrl); // 認可は try/catch の外
    try {
        const products = await db.product.findMany({
            where: { storeId: store.id },
            select: {
                name: true,
                slug: true,
                variants: {
                    select: {
                        id: true,
                        variantName: true,
                        sku: true,
                        sizes: {
                            select: {
                                id: true,
                                size: true,
                                quantity: true,
                                price: true,
                            },
                        },
                    },
                },
            },
        });

        // 商品→バリアント→サイズ をフラット化（Decimal は return 境界で number 化・NFR-3）
        return products.flatMap((p) =>
            p.variants.flatMap((v) =>
                v.sizes.map((s) => ({
                    sizeId: s.id,
                    productName: p.name,
                    variantName: v.variantName,
                    size: s.size,
                    quantity: s.quantity,
                    price: s.price.toNumber(),
                    sku: v.sku,
                    productSlug: p.slug,
                    variantId: v.id,
                }))
            )
        );
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[Inventory:getStoreInventory] Failed to fetch store inventory",
                {
                    error: error.message,
                    stack: error.stack,
                }
            );
        } else {
            console.error("[Inventory:getStoreInventory] Unknown error", {
                error,
            });
        }
        throw new Error("Failed to fetch store inventory.");
    }
};

/**
 * @function updateSizeStock
 * @description 在庫数のクイック編集。店舗所有権 + Size の所有権チェーンを検証してから更新する。
 * @access SELLER（店舗所有者のみ・対象 Size が当該店舗の商品階層に属すること）
 */
export const updateSizeStock = async (
    sizeId: string,
    quantity: number,
    storeUrl: string
): Promise<{ sizeId: string; quantity: number }> => {
    const { store } = await requireStoreOwner(storeUrl); // 認可は try/catch の外

    // 入力バリデーション（Zod・int ≥ 0）
    const parsed = UpdateSizeStockSchema.safeParse({ sizeId, quantity });
    if (!parsed.success) {
        throw new Error("在庫数は 0 以上の整数で指定してください。");
    }

    try {
        // IDOR 防止 + TOCTOU 解消: 所有権チェーン（size → variant → product.storeId）を
        // 更新クエリの where に畳み込み、「検証」と「更新」を単一の原子的 UPDATE にする。
        // count === 0 は他店舗の Size か不存在を意味し、いずれも副作用なしで拒否される。
        const result = await db.size.updateMany({
            where: {
                id: sizeId,
                productVariant: { product: { storeId: store.id } },
            },
            data: { quantity: parsed.data.quantity },
        });
        if (result.count === 0) {
            throw new Error("Forbidden: size not owned by current store.");
        }
        return { sizeId, quantity: parsed.data.quantity };
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[Inventory:updateSizeStock] Failed to update size stock",
                {
                    error: error.message,
                    stack: error.stack,
                }
            );
        } else {
            console.error("[Inventory:updateSizeStock] Unknown error", {
                error,
            });
        }
        // 認可エラーのみ verbatim 伝播。それ以外（Prisma 等）は内部詳細を隠す汎用メッセージに。
        if (error instanceof Error && error.message.startsWith("Forbidden:")) {
            throw error;
        }
        throw new Error("Failed to update size stock.");
    }
};

/**
 * @function updateStoreLowStockThreshold
 * @description 店舗単位の過小在庫しきい値を更新する（在庫アラートのバッジ判定に使用）。
 * @access SELLER（店舗所有者のみ）
 */
export const updateStoreLowStockThreshold = async (
    storeUrl: string,
    threshold: number
): Promise<{ lowStockThreshold: number }> => {
    const { store } = await requireStoreOwner(storeUrl); // 認可は try/catch の外

    const parsed = LowStockThresholdSchema.safeParse({ threshold });
    if (!parsed.success) {
        throw new Error("しきい値は 0 以上の整数で指定してください。");
    }

    try {
        const updated = await db.store.update({
            where: { id: store.id },
            data: { lowStockThreshold: parsed.data.threshold },
            select: { lowStockThreshold: true },
        });
        return { lowStockThreshold: updated.lowStockThreshold };
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[Inventory:updateStoreLowStockThreshold] Failed to update low stock threshold",
                {
                    error: error.message,
                    stack: error.stack,
                }
            );
        } else {
            console.error(
                "[Inventory:updateStoreLowStockThreshold] Unknown error",
                { error }
            );
        }
        throw new Error("Failed to update low stock threshold.");
    }
};
