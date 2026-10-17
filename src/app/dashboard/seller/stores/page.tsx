import SellerStoresList from "@/components/dashboard/seller/seller-stores-list";
import { getSellerStores } from "@/queries/seller-stores";

export default async function SellerStoresPage() {
    return <SellerStoresList result={await getSellerStores()} />;
}
