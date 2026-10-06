import OfferTagForm from "@/components/dashboard/admin/offer-tag-form";
import SellerPage from "@/components/dashboard/design/seller-page";
import { upsertOfferTag } from "@/queries/offer-tag";
export default function AdminNewOfferTagPage() {
    return (
        <SellerPage
            workspace="Administration"
            id="admin-new-offer-tag"
            title="Create offer tag"
            description="Create an offer label and its collection URL."
        >
            <OfferTagForm saveAction={upsertOfferTag} />
        </SellerPage>
    );
}
