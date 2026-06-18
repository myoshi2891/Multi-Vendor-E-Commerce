"use server";

import { db } from "@/lib/db";
import { requireStoreOwner } from "@/lib/auth-guards";
import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import type { SalesPoint } from "@/queries/dashboard";

/**
 * src/queries/store-dashboard.ts
 * 販売者ダッシュボード F1「店舗統計」のサーバーアクション層。
 *
 * admin の src/queries/dashboard.ts（unstable_cache + Promise.all + 構造化ログ）を
 * 店舗スコープ版へ写したもの。新規発明を最小化する（design.md 判断1）。
 *
 * - getStoreDashboardStats: 店舗 KPI を並列集計（20 分キャッシュ・キーに storeId）
 * - getStoreSalesOverTime:  店舗の Paid 売上を期間別バケット集計（チャート用）
 * - getStoreRecentOrders:   直近 N 件の OrderGroup（store スコープ）
 * - getStoreTopProducts:    sales 降順で上位 N 件の Product
 *
 * 認可は src/lib/auth-guards.ts の requireStoreOwner を冒頭で呼ぶ（try/catch / cache の外）。
 * SalesPoint 型は admin dashboard.ts から再利用し、SalesChart の入力型と単一ソース化する。
 * 設計の正本: docs/design/seller-dashboard/design.md §3.1
 */

/** 店舗ダッシュボード KPI。Decimal は number 化済み（シリアライズ安全）。 */
export type StoreDashboardStats = {
    totalRevenue: number; // Paid 注文に紐づく OrderGroup.total の合計
    totalOrders: number; // 当該店舗の OrderGroup 件数
    totalViews: number; // Σ Product.views（既存フィールド）
    totalSales: number; // Σ Product.sales
    totalProducts: number;
    lowStockCount: number; // quantity <= lowStockThreshold の Size 件数（0 含む）
};

/**
 * @function getStoreDashboardStats
 * @description 店舗 KPI を並列集計する。requireStoreOwner() はキャッシュ外で認可し、
 *              キャッシュキーに storeId を含め店舗間混線を防ぐ（NFR-8）。20 分キャッシュ。
 * @access SELLER（店舗所有者のみ）
 * @param storeUrl 店舗 URL
 */
export const getStoreDashboardStats = async (
    storeUrl: string
): Promise<StoreDashboardStats> => {
    const { store } = await requireStoreOwner(storeUrl); // 認可は try/catch / キャッシュの外
    return getCachedStoreStats(store.id, store.lowStockThreshold);
};

/**
 * storeId をキャッシュキー配列・引数に含めることで店舗ごとに独立したキャッシュになる（NFR-8）。
 * lowStockThreshold もクロージャ引数で渡し、しきい値変更が在庫件数へ反映されるようにする。
 */
const getCachedStoreStats = (storeId: string, lowStockThreshold: number) =>
    unstable_cache(
        async (): Promise<StoreDashboardStats> => {
            try {
                const [
                    revenueAgg,
                    totalOrders,
                    viewsSalesAgg,
                    totalProducts,
                    lowStockCount,
                ] = await Promise.all([
                    // 店舗売上 = OrderGroup.total のうち親 Order.paymentStatus=Paid のみ（判断5）
                    db.orderGroup.aggregate({
                        _sum: { total: true },
                        where: { storeId, order: { paymentStatus: "Paid" } },
                    }),
                    db.orderGroup.count({ where: { storeId } }),
                    // Σ views / Σ sales（Product 単位）
                    db.product.aggregate({
                        _sum: { views: true, sales: true },
                        where: { storeId },
                    }),
                    db.product.count({ where: { storeId } }),
                    // 過小/在庫切れ件数（所有権チェーンで店舗スコープ）
                    db.size.count({
                        where: {
                            productVariant: { product: { storeId } },
                            quantity: { lte: lowStockThreshold },
                        },
                    }),
                ]);

                return {
                    totalRevenue: (
                        revenueAgg._sum.total ?? new Prisma.Decimal(0)
                    ).toNumber(),
                    totalOrders,
                    totalViews: viewsSalesAgg._sum.views ?? 0,
                    totalSales: viewsSalesAgg._sum.sales ?? 0,
                    totalProducts,
                    lowStockCount,
                };
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error(
                        "[StoreDashboard:getStoreDashboardStats] Failed to aggregate store dashboard stats",
                        { error: error.message, stack: error.stack }
                    );
                } else {
                    console.error(
                        "[StoreDashboard:getStoreDashboardStats] Unknown error",
                        { error }
                    );
                }
                throw new Error("Failed to aggregate store dashboard stats.");
            }
        },
        ["store-dashboard-stats", storeId], // ← storeId をキャッシュキーに含める（NFR-8）
        { revalidate: 60 * 20, tags: [`store-dashboard-${storeId}`] }
    )();

/**
 * @function getStoreSalesOverTime
 * @description 店舗の Paid 売上を期間別に集計し、チャート用配列で返す（admin getSalesOverTime の店舗版）。
 * @access SELLER（店舗所有者のみ）
 * @param storeUrl 店舗 URL
 * @param period 'daily'（直近 30 日）| 'monthly'（直近 12 ヶ月）
 */
export const getStoreSalesOverTime = async (
    storeUrl: string,
    period: "daily" | "monthly" = "monthly"
): Promise<SalesPoint[]> => {
    const { store } = await requireStoreOwner(storeUrl); // 認可は try/catch の外
    try {
        const now = new Date();
        const since = new Date(now);
        if (period === "daily") {
            since.setDate(since.getDate() - 30);
        } else {
            since.setMonth(since.getMonth() - 12);
        }

        const groups = await db.orderGroup.findMany({
            where: {
                storeId: store.id,
                order: { paymentStatus: "Paid" },
                createdAt: { gte: since },
            },
            select: { createdAt: true, total: true },
            orderBy: { createdAt: "asc" },
        });

        // JS 側でバケット集計（Decimal は .add()、return 境界でのみ .toNumber()・NFR-3）
        const buckets = new Map<string, Prisma.Decimal>();
        for (const group of groups) {
            const label =
                period === "daily"
                    ? group.createdAt.toISOString().slice(0, 10) // "YYYY-MM-DD"
                    : group.createdAt.toISOString().slice(0, 7); // "YYYY-MM"
            buckets.set(
                label,
                (buckets.get(label) ?? new Prisma.Decimal(0)).add(group.total)
            );
        }

        return Array.from(buckets.entries()).map(([label, revenue]) => ({
            label,
            revenue: revenue.toNumber(),
        }));
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[StoreDashboard:getStoreSalesOverTime] Failed to fetch store sales over time",
                { error: error.message, stack: error.stack }
            );
        } else {
            console.error(
                "[StoreDashboard:getStoreSalesOverTime] Unknown error",
                { error }
            );
        }
        throw new Error("Failed to fetch store sales over time.");
    }
};

/**
 * @function getStoreRecentOrders
 * @description 当該店舗の直近 limit 件の OrderGroup を返す（items/coupon/親 Order を include）。
 *              getStoreOrders（store.ts）の include 構造を踏襲し take を加える。
 * @access SELLER（店舗所有者のみ）
 */
export const getStoreRecentOrders = async (
    storeUrl: string,
    limit = 5
) => {
    const { store } = await requireStoreOwner(storeUrl); // 認可は try/catch の外
    try {
        return await db.orderGroup.findMany({
            where: { storeId: store.id },
            include: {
                items: true,
                coupon: true,
                order: {
                    select: {
                        paymentStatus: true,
                        shippingAddress: {
                            include: {
                                country: true,
                                user: { select: { email: true } },
                            },
                        },
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
            take: limit,
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[StoreDashboard:getStoreRecentOrders] Failed to fetch store recent orders",
                { error: error.message, stack: error.stack }
            );
        } else {
            console.error(
                "[StoreDashboard:getStoreRecentOrders] Unknown error",
                { error }
            );
        }
        throw new Error("Failed to fetch store recent orders.");
    }
};

/**
 * @function getStoreTopProducts
 * @description 当該店舗の販売数（sales）上位 limit 件の Product を返す。
 * @access SELLER（店舗所有者のみ）
 */
export const getStoreTopProducts = async (
    storeUrl: string,
    limit = 5
) => {
    const { store } = await requireStoreOwner(storeUrl); // 認可は try/catch の外
    try {
        return await db.product.findMany({
            where: { storeId: store.id },
            orderBy: { sales: "desc" },
            take: limit,
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[StoreDashboard:getStoreTopProducts] Failed to fetch store top products",
                { error: error.message, stack: error.stack }
            );
        } else {
            console.error(
                "[StoreDashboard:getStoreTopProducts] Unknown error",
                { error }
            );
        }
        throw new Error("Failed to fetch store top products.");
    }
};
