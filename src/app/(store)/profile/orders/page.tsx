import { getUserOrders } from "@/queries/profile";

export default async function ProfileOrdersPage() {
    const orders = await getUserOrders();

    return <div>ProfileOrdersPage</div>;
}
