import { getAllStores, updateStoreStatus, deleteStore } from "@/queries/store";
import { serializeAdminStores } from "@/lib/admin-stores";
import AdminStores from "@/components/dashboard/admin/admin-stores";
import SellerPage from "@/components/dashboard/design/seller-page";
import LoadError from "@/components/dashboard/design/load-error";
export const dynamic = "force-dynamic";
export default async function AdminStoresPage() {
    const stores = await getAllStores().catch(() => null);
    if (!stores)
        return (
            <SellerPage
                workspace="Administration"
                id="admin-stores"
                title="Stores"
            >
                <LoadError subject="stores" />
            </SellerPage>
        );
    return (
        <AdminStores
            stores={serializeAdminStores(stores)}
            actions={{
                updateStatusAction: updateStoreStatus,
                deleteAction: deleteStore,
            }}
        />
    );
}
