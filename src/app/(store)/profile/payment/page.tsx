import PaymentsTable from "@/components/store/profile/payments/payments-table";
import { getUserPayments } from "@/queries/profile";

export default async function ProfilePaymentPage() {
    const payments_data = await getUserPayments();
    const { payments, totalPages } = payments_data;

    return (
        <div>
            <PaymentsTable payments={payments} totalPages={totalPages} />
        </div>
    );
}
