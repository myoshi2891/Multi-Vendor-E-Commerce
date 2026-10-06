"use client";
import type { Coupon } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import { getTimeUntil } from "@/lib/utils";

/**
 * 管理者・販売者のクーポン表で共通の列（割引率・期間・残り時間）。
 *
 * 行型は Coupon を含むもの（管理者表は store 名を足した型）を受け付ける。
 */
export function getCouponPeriodColumns<
    TRow extends Coupon,
>(): ColumnDef<TRow>[] {
    return [
        {
            accessorKey: "discount",
            header: "Discount",
            cell: ({ row }) => <span>{row.original.discount}%</span>,
        },
        {
            accessorKey: "startDate",
            header: "Start date",
            cell: ({ row }) => (
                <span>{new Date(row.original.startDate).toDateString()}</span>
            ),
        },
        {
            accessorKey: "endDate",
            header: "End date",
            cell: ({ row }) => (
                <span>{new Date(row.original.endDate).toDateString()}</span>
            ),
        },
        {
            id: "timeleft",
            header: "Time left",
            cell: ({ row }) => {
                const { days, hours } = getTimeUntil(row.original.endDate);
                return (
                    <span>
                        {days} days and {hours} hours
                    </span>
                );
            },
        },
    ];
}
