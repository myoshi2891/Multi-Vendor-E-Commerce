import SellerShipping from "@/components/dashboard/seller/seller-shipping";
import SellerPage from "@/components/dashboard/design/seller-page";
import {
    serializeShippingDefaults,
    serializeShippingCountries,
} from "@/lib/seller-shipping";
import {
    updateStoreDefaultShippingDetails,
    upsertShippingRate,
    getStoreDefaultShippingDetails,
    getStoreShippingRates,
} from "@/queries/store";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Renders the seller store shipping page by loading and displaying the store's default shipping details and shipping rates.
 *
 * @param params - A promise that resolves to route parameters containing `storeUrl`, the store identifier used to fetch shipping data.
 * @returns The page JSX containing `StoreDefaultShippingDetails` and a `DataTable` of shipping rates for the store. If the shipping details or rates cannot be loaded, the request is redirected to the site root (`/`).
 */
export default async function SellerStoreShippingPage({
    params,
}: {
    params: Promise<{ storeUrl: string }>;
}) {
    const { storeUrl } = await params;
    const shippingDetails = await getStoreDefaultShippingDetails(storeUrl);
    const shippingRates = await getStoreShippingRates(storeUrl);
    if (!shippingDetails || !shippingRates) return redirect("/");

    return (
        <SellerPage
            id="shipping-heading"
            title="Shipping settings"
            description="Manage default delivery and country-specific shipping rates."
        >
            <SellerShipping
                storeUrl={storeUrl}
                defaults={serializeShippingDefaults(shippingDetails)}
                rates={serializeShippingCountries(shippingRates)}
                updateDefaultsAction={updateStoreDefaultShippingDetails}
                upsertShippingRateAction={upsertShippingRate}
            />
        </SellerPage>
    );
}
