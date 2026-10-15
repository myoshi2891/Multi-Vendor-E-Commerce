import type { ReactNode } from "react";
import type { OrderGroupWithItemsType } from "@/lib/types";
import { getShippingDatesRange } from "@/lib/utils";
import OrderGroupTable from "./group-table";
import styles from "../shared/commerce.module.css";
export default function OrderGroupsContainer({
    groups,
    returnSlots = {},
}: {
    groups: OrderGroupWithItemsType[];
    /** group ごとの返品欄（plan 088 Step 5）。無い group には何も出さない */
    returnSlots?: Record<string, ReactNode>;
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
                            returns={returnSlots[group.id]}
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
