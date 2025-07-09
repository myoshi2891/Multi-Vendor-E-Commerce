'use client'
import { UserOrderType } from "@/lib/types";
import { useState } from "react";

export default function OrdersTable({
    orders,
    totalPages,
}: {
    orders: UserOrderType[];
    totalPages: number;
}) {
    const [data, setData] = useState<UserOrderType[]>(orders);
    return (
        <div>
            <div className="space-y-4">
                {/* Header */}
                {/* Table */}
                <div className="overflow-hidden">
                    <div className="bg-white p-6">
                        {/* Scrollable Table Container */}
                        <div className="scrollbar max-h-[700px] overflow-auto rounded-md border">
                            <table className="w-full min-w-max table-auto text-left">
                                <thead>
                                    <tr>
                                        <th className="cursor-pointer border-y p-4 text-sm">
                                            Orders
                                        </th>
                                        <th className="cursor-pointer border-y p-4 text-sm">
                                            Products
                                        </th>
                                        <th className="cursor-pointer border-y p-4 text-sm">
                                            Items
                                        </th>
                                        <th className="cursor-pointer border-y p-4 text-sm">
                                            Payment
                                        </th>
                                        <th className="cursor-pointer border-y p-4 text-sm">
                                            Delivery
                                        </th>
                                        <th className="cursor-pointer border-y p-4 text-sm">
                                            Total
                                        </th>
                                        <th className="cursor-pointer border-y p-4 text-sm"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((order) => {
                                        const totalItemsCount =
                                            order.groups.reduce(
                                                (total, group) =>
                                                    total + group._count.items,
                                                0
                                            );
                                        const images = Array.from(
                                            order.groups.flatMap((g) =>
                                                g.items.map((p) => p.image)
                                            )
                                        );
                                        return (
                                            <tr
                                                key={order.id}
                                                className="border-b"
                                            >
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex flex-col">
                                                            <p className="block font-sans text-sm font-normal leading-normal antialiased">
                                                                #{order.id}
                                                            </p>
                                                            <p className="block font-sans text-sm font-normal leading-normal antialiased">
                                                                Placed on: {order.createdAt.toDateString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
