import type { PaymentDetails } from "@prisma/client";
import styles from "../../shared/commerce.module.css";
export default function OrderInfoCard({
    totalItemsCount,
    deliveredItemsCount,
    paymentDetails,
}: {
    totalItemsCount: number;
    deliveredItemsCount: number;
    paymentDetails: PaymentDetails | null;
}) {
    const rows = [
        ["Total Items", totalItemsCount],
        ["Delivered", deliveredItemsCount],
        ["Payment Status", paymentDetails?.status ?? "Unpaid"],
        ["Payment Method", paymentDetails?.paymentMethod ?? "-"],
        ["Payment Reference", paymentDetails?.paymentIntentId ?? "-"],
        [
            "Paid at",
            paymentDetails?.status === "Completed"
                ? paymentDetails.updatedAt.toDateString()
                : "-",
        ],
    ];
    return (
        <section className={styles.panel}>
            <h2>Order information</h2>
            <dl>
                {rows.map(([label, value]) => (
                    <div className={styles.row} key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}
