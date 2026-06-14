import DataTable from "@/components/ui/data-table";
import { columns } from "./columns";
import { getAllOrders } from "@/queries/order";
import { OrderStatus, PaymentStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

// limit の上限（getAllOrders 側の AdminOrderFilterSchema でも clamp されるが UI 側でも明示）
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

/**
 * Normalizes a string URL parameter to a positive integer.
 *
 * @param raw - The raw string from search parameters
 * @param fallback - The value returned if normalization fails
 * @param max - Optional upper bound to cap the result
 * @returns The normalized positive integer (at least 1), or the `fallback` value, capped at `max` if provided
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
 * Narrows a string value to a valid enum member.
 *
 * @param enumObj - The enum object to validate against
 * @param raw - The string value to narrow, or undefined for no filter
 * @returns The value if it is a valid enum member, undefined otherwise
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
 * Renders an admin page for managing orders across all stores.
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
