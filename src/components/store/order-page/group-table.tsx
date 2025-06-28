import { OrderGroupWithItemsType } from "@/lib/types";
import React from "react";

export default function OrderGroupTable({
    group,
    deliveryInfo,
}: {
    group: OrderGroupWithItemsType;
    deliveryInfo: {
        shippingService: string;
        deliveryTimeMin: string;
        deliveryTimeMax: string;
    };
}) {
    const { shippingService } = deliveryInfo;
    return (
        <div className="max-w-xl rounded-xl border border-gray-200 pt-6 max-lg:mx-auto lg:max-w-full">
            <div className="flex flex-col justify-between border-b border-gray-200 px-6 pb-6 lg:flex-row lg:items-center">
                <div>
                    <p className="text-base font-semibold leading-7 text-black">
                        Order Id:
                        <span className="ms-2 font-medium text-blue-primary">
                            #{group.id}
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
}
