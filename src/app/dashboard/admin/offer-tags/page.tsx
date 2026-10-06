import {
    getAllOfferTags,
    getOfferTag,
    upsertOfferTag,
    deleteOfferTag,
} from "@/queries/offer-tag";
import AdminOfferTags from "@/components/dashboard/admin/admin-offer-tags";
import SellerPage from "@/components/dashboard/design/seller-page";
import LoadError from "@/components/dashboard/design/load-error";
export const dynamic = "force-dynamic";
export default async function AdminOfferTagsPage() {
    const tags = await getAllOfferTags().catch(() => null);
    if (!tags)
        return (
            <SellerPage
                workspace="Administration"
                id="admin-offer-tags"
                title="Offer tags"
            >
                <LoadError subject="offer tags" />
            </SellerPage>
        );
    return (
        <AdminOfferTags
            tags={tags}
            actions={{
                loadAction: getOfferTag,
                saveAction: upsertOfferTag,
                deleteAction: deleteOfferTag,
            }}
        />
    );
}
