import { upsertStore } from "@/queries/store";
import StoreDetails from "@/components/dashboard/forms/store-details";

export default function SellerNewStorePage() {
    return (
        <div className="p-2">
            <StoreDetails upsertStoreAction={upsertStore} />
        </div>
    );
}
