"use server";

import { db } from "@/lib/db";
import { requireStoreOwner } from "@/lib/auth-guards";
import { UpdateSizeStockSchema } from "@/lib/schemas";

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

/** 在庫一覧の 1 行（バリアント×サイズ単位）。Decimal は number 化済み。 */
export type StoreInventoryRow = {
    sizeId: string;
    productName: string;
    variantName: string;
    size: string;
    quantity: number;
    price: number;
    sku: string;
    productSlug: string;
    variantId: string;
};

/**
 * @function getStoreInventory
 * @description 当該店舗の全 Size を「商品→バリアント→サイズ」の階層で取得し、
 *              在庫一覧用にフラット化して返す。
 * @access SELLER（店舗所有者のみ）
 */
export const getStoreInventory = async (
    storeUrl: string
): Promise<StoreInventoryRow[]> => {
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
        console.error("[Inventory:getStoreInventory] Error", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
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
        // IDOR 防止: size → variant → product.storeId が当該店舗か検証（判断4）
        const owned = await db.size.findFirst({
            where: {
                id: sizeId,
                productVariant: { product: { storeId: store.id } },
            },
            select: { id: true },
        });
        if (!owned) {
            // 他店舗の Size を指定した場合（副作用を起こさず拒否）
            throw new Error("Forbidden: size not owned by current store.");
        }

        const updated = await db.size.update({
            where: { id: sizeId },
            data: { quantity: parsed.data.quantity },
            select: { id: true, quantity: true },
        });
        return { sizeId: updated.id, quantity: updated.quantity };
    } catch (error: unknown) {
        console.error("[Inventory:updateSizeStock] Error", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw error; // 認可/Forbidden はそのまま伝播
    }
};

/**
 * @function updateStoreLowStockThreshold
 * @description 店舗単位の過小在庫しきい値を更新する（在庫アラートのバッジ判定に使用）。
 * @access SELLER（店舗所有者のみ）
 */
export const updateStoreLowStockThreshold = async (
    _storeUrl: string,
    _threshold: number
): Promise<{ lowStockThreshold: number }> => {
    throw new Error("Not implemented");
};
