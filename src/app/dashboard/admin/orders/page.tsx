import DataTable from "@/components/ui/data-table";
import { columns } from "./columns";
import { getAllOrders } from "@/queries/order";
import { OrderStatus, PaymentStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

// limit の上限（getAllOrders 側の AdminOrderFilterSchema でも clamp されるが UI 側でも明示）
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

/**
 * 数値 URL パラメータの正規化（tech.md「URL パラメータ正規化」準拠）。
 * `searchParams` の値は文字列のため、まず `Number()` で数値化してから
 * `Infinity` / `NaN` / 小数 / 1 未満を排除する。
 *
 * @param raw searchParams から得た生の文字列（または未定義）
 * @param fallback 正規化に失敗した場合の既定値
 * @param max 上限（指定時にキャップ）
 */
function normalizePositiveInt(
    raw: string | undefined,
    fallback: number,
    max?: number
): number {
    const num = Number(raw);
    const normalized =
        Number.isFinite(num) && num >= 1 ? Math.floor(num) : fallback;
    return max ? Math.min(normalized, max) : normalized;
}

/**
 * searchParams の生文字列を文字列 enum の値へ絞り込む（境界での正規化）。
 * 列挙値に含まれない・未定義の場合は `undefined`（フィルタ無し）に倒す。
 * `includes` による実行時検証で守られた局所キャストのため `any` は不要。
 *
 * @param enumObj 文字列 enum（`OrderStatus` / `PaymentStatus`）
 * @param raw searchParams から得た生の文字列（または未定義）
 */
function toEnumValue<T extends Record<string, string>>(
    enumObj: T,
    raw: string | undefined
): T[keyof T] | undefined {
    if (raw === undefined) return undefined;
    return (Object.values(enumObj) as string[]).includes(raw)
        ? (raw as T[keyof T])
        : undefined;
}

/**
 * 全店舗横断の admin 注文管理ページ。
 *
 * `getAllOrders()`（`requireAdmin` 内包）で取得した Order 群を DataTable に渡す。
 * 各行は 1 Order（複数 OrderGroup を内包）で、Store 列・group ごとの Status 変更・
 * 詳細モーダルを columns.tsx 側で描画する。
 *
 * @param searchParams ページ番号・件数・フィルタ（文字列）。数値は正規化のうえ query へ渡す。
 */
export default async function AdminOrdersPage({
    searchParams,
}: {
    searchParams: Promise<{
        page?: string;
        limit?: string;
        paymentStatus?: string;
        orderStatus?: string;
        search?: string;
    }>;
}) {
    const sp = await searchParams;
    const page = normalizePositiveInt(sp.page, 1);
    const limit = normalizePositiveInt(sp.limit, DEFAULT_LIMIT, MAX_LIMIT);
    const paymentStatus = toEnumValue(PaymentStatus, sp.paymentStatus);
    const orderStatus = toEnumValue(OrderStatus, sp.orderStatus);

    let orders: Awaited<ReturnType<typeof getAllOrders>>["orders"] = [];
    try {
        const result = await getAllOrders({
            page,
            limit,
            search: sp.search,
            paymentStatus,
            orderStatus,
        });
        orders = result.orders;
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[AdminOrders] Failed to fetch orders:",
                error.message,
                error.stack
            );
        } else {
            console.error("[AdminOrders] Failed to fetch orders:", error);
        }
    }

    return (
        <div>
            <DataTable
                filterValue="id"
                data={orders}
                columns={columns}
                searchPlaceholder="Search order by id ..."
            />
        </div>
    );
}
