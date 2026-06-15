"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";

/** ダッシュボード KPI の集計結果。Decimal は number 化済み（シリアライズ安全）。 */
export type AdminDashboardStats = {
    totalRevenue: number;
    totalOrders: number;
    activeStores: number;
    pendingStores: number;
    totalUsers: number;
    totalProducts: number;
    totalCategories: number;
    totalSubCategories: number;
};

/** チャート用売上データポイント */
export type SalesPoint = { label: string; revenue: number };

/**
 * @function getAdminDashboardStats
 * @description 管理者ダッシュボードの KPI を並列集計する。
 *              requireAdmin() はキャッシュ外で呼び、認可結果をキャッシュに含めない。
 *              20 分のデータキャッシュを介す（統計にリアルタイム性は不要）。
 * @access ADMIN
 */
export const getAdminDashboardStats =
    async (): Promise<AdminDashboardStats> => {
        await requireAdmin(); // 多層防御（キャッシュの外で認可）
        return getCachedStats();
    };

// requireAdmin の後にキャッシュ層を呼ぶ（認可をキャッシュに含めない）
const getCachedStats = unstable_cache(
    async (): Promise<AdminDashboardStats> => {
        try {
            const [
                revenueAgg,
                totalOrders,
                storeGroups,
                totalUsers,
                totalProducts,
                totalCategories,
                totalSubCategories,
            ] = await Promise.all([
                // paymentStatus=Paid のみ集計（Refunded/Cancelled/Failed 等を除外・F1-2/F1-3）
                // 論理削除ストアの Paid 注文も算入（F1-5）
                db.order.aggregate({
                    _sum: { total: true },
                    where: { paymentStatus: "Paid" },
                }),
                db.order.count(),
                // ストア数は isDeleted=false のみカウント（F1-4）
                db.store.groupBy({
                    by: ["status"],
                    where: { isDeleted: false },
                    _count: { _all: true },
                }),
                db.user.count(),
                db.product.count(),
                db.category.count(),
                db.subCategory.count(),
            ]);

            const findCount = (s: string) =>
                storeGroups.find((g) => g.status === s)?._count._all ?? 0;

            return {
                totalRevenue: (
                    revenueAgg._sum.total ?? new Prisma.Decimal(0)
                ).toNumber(),
                totalOrders,
                activeStores: findCount("ACTIVE"),
                pendingStores: findCount("PENDING"),
                totalUsers,
                totalProducts,
                totalCategories,
                totalSubCategories,
            };
        } catch (error: unknown) {
            console.error("[Dashboard:getAdminDashboardStats] Error", {
                error:
                    error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw new Error("Failed to aggregate dashboard stats.");
        }
    },
    ["admin-dashboard-stats"],
    { revalidate: 60 * 20, tags: ["admin-dashboard"] }
);

/**
 * @function getSalesOverTime
 * @description 期間別の Paid 売上を集計し、チャート用の配列で返す。
 * @access ADMIN
 * @param period 'daily'（直近 30 日）| 'monthly'（直近 12 ヶ月）
 */
export const getSalesOverTime = async (
    period: "daily" | "monthly" = "monthly"
): Promise<SalesPoint[]> => {
    await requireAdmin();
    try {
        const now = new Date();
        let since: Date;

        if (period === "daily") {
            since = new Date(now);
            since.setDate(since.getDate() - 30);
        } else {
            since = new Date(now);
            since.setMonth(since.getMonth() - 12);
        }

        const orders = await db.order.findMany({
            where: {
                paymentStatus: "Paid",
                createdAt: { gte: since },
            },
            select: { createdAt: true, total: true },
            orderBy: { createdAt: "asc" },
        });

        // JS 側でバケット集計（規模拡大時は SQL date_trunc + groupBy へ移行）
        const buckets = new Map<string, number>();

        for (const order of orders) {
            const label =
                period === "daily"
                    ? order.createdAt.toISOString().slice(0, 10) // "YYYY-MM-DD"
                    : order.createdAt.toISOString().slice(0, 7); // "YYYY-MM"

            buckets.set(
                label,
                (buckets.get(label) ?? 0) + order.total.toNumber()
            );
        }

        return Array.from(buckets.entries()).map(([label, revenue]) => ({
            label,
            revenue,
        }));
    } catch (error: unknown) {
        console.error("[Dashboard:getSalesOverTime] Error", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw new Error("Failed to fetch sales over time.");
    }
};

/**
 * @function getRecentOrders
 * @description 最近の注文を直近 limit 件返す（F1-7）。
 * @access ADMIN
 */
export const getRecentOrders = async (limit = 5) => {
    await requireAdmin();
    try {
        return await db.order.findMany({
            include: {
                groups: { include: { store: true } },
                shippingAddress: { include: { user: true } },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });
    } catch (error: unknown) {
        console.error("[Dashboard:getRecentOrders] Error", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw new Error("Failed to fetch recent orders.");
    }
};

/**
 * @function getRecentStores
 * @description 新規ストアを直近 limit 件返す（F1-7）。論理削除済みを除外。
 * @access ADMIN
 */
export const getRecentStores = async (limit = 5) => {
    await requireAdmin();
    try {
        return await db.store.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" },
            take: limit,
        });
    } catch (error: unknown) {
        console.error("[Dashboard:getRecentStores] Error", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw new Error("Failed to fetch recent stores.");
    }
};
