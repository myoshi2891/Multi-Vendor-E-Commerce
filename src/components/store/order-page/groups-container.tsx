import { OrderGroupWithItemsType } from "@/lib/types";
import { getShippingDatesRange } from "@/lib/utils";
import OrderGroupTable from "./group-table";

export default function OrderGroupsContainer({
    groups,
}: {
    groups: OrderGroupWithItemsType[];
}) {
    const deliveryDetails = groups.map((group) => {
        const { minDate, maxDate } = getShippingDatesRange(
            group.shippingDeliveryMin,
            group.shippingDeliveryMax,
            group.createdAt
        );
        return {
            shippingService: group.shippingService,
            deliveryTimeMin: minDate,
            deliveryTimeMax: maxDate,
        };
    });
    return (
        <div>
            <section className="relative p-2">
                <div className="w-full space-y-4">
                    {groups.map((group, index) => {
                        const deliveryInfo = deliveryDetails[index];
                        return (
                            <OrderGroupTable
                                key={group.id}
                                group={group}
                                deliveryInfo={deliveryInfo}
                            />
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
