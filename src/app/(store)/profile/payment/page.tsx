import { getUserPayments } from "@/queries/profile";

export default async function ProfilePaymentPage() {
    const payments = await getUserPayments();

    return <div>ProfilePaymentPage</div>;
}
