// DB
import { db } from "@/lib/db";

import StoreDetails from "@/components/dashboard/forms/store-details";
import { redirect } from "next/navigation";
import { upsertStore } from "@/queries/store";
import SellerPage from "@/components/dashboard/design/seller-page";

export const dynamic = "force-dynamic";

async function loadStoreDetails(storeUrl: string) {
    try {
        return await db.store.findUnique({
            select: {
                id: true,
                name: true,
                description: true,
                email: true,
                phone: true,
                logo: true,
                cover: true,
                url: true,
                featured: true,
                status: true,
            },
            where: {
                url: storeUrl,
            },
        });
    } catch (error) {
        console.error(
            "[SellerStoreSettings] Store lookup failed",
            error instanceof Error ? error.message : "Unknown error"
        );
        throw error;
    }
}

/**
 * Render the seller's store settings page for the store identified by `storeUrl`.
 *
 * @param params - A promise that resolves to an object with the route parameter `storeUrl`, used to look up the store.
 * @returns A React element displaying the store's settings via <StoreDetails />; if the store does not exist, a redirect to "/dashboard/seller/stores" is performed.
 */
export default async function SellerStoreSettingPage({
    params,
}: {
    params: Promise<{ storeUrl: string }>;
}) {
    const { storeUrl } = await params;
    const storeDetails = await loadStoreDetails(storeUrl);
    if (!storeDetails) redirect("/dashboard/seller/stores");
    return (
        <SellerPage
            id="store-settings-heading"
            title="Store settings"
            description="Update your store profile, images and contact information."
        >
            <StoreDetails
                data={storeDetails}
                upsertStoreAction={upsertStore}
                design="seller"
            />
        </SellerPage>
    );
}
