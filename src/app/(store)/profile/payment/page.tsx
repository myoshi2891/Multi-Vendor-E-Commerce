import PaymentsTable from "@/components/store/profile/payments/payments-table";
import { getUserPaymentsForDisplay } from "@/queries/profile";

export const dynamic = "force-dynamic";

export default async function ProfilePaymentPage() {
    let result: Awaited<ReturnType<typeof getUserPaymentsForDisplay>> = {
        payments: [],
        totalPages: 0,
    };
    let initialError = false;
    try {
        result = await getUserPaymentsForDisplay();
    } catch {
        initialError = true;
    }
    return (
        <PaymentsTable
            {...result}
            initialError={initialError}
            fetchPaymentsAction={getUserPaymentsForDisplay}
        />
    );
}
