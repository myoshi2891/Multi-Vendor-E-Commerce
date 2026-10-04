import type { OrderGroupWithItemsType } from "@/lib/types";
import { getShippingDatesRange } from "@/lib/utils";
import OrderGroupTable from "./group-table";
import styles from "../shared/commerce.module.css";
export default function OrderGroupsContainer({
    groups,
}: {
    groups: OrderGroupWithItemsType[];
}) {
    return (
        <section aria-labelledby="order-items" className={styles.column}>
            <h2
                id="order-items"
                style={{ font: "400 28px/1.25 Georgia,serif" }}
            >
                Order items
            </h2>
            {groups.length ? (
                groups.map((group) => {
                    const { minDate, maxDate } = getShippingDatesRange(
                        group.shippingDeliveryMin,
                        group.shippingDeliveryMax,
                        group.createdAt
                    );
                    return (
                        <OrderGroupTable
                            key={group.id}
                            group={group}
                            deliveryInfo={{
                                shippingService: group.shippingService,
                                deliveryMinDate: minDate,
                                deliveryMaxDate: maxDate,
                            }}
                        />
                    );
                })
            ) : (
                <p className={styles.note}>No order items available.</p>
            )}
        </section>
    );
}
