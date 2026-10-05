"use client";
import StoreDefaultShippingDetails from "../forms/store-default-shipping-details";
import DataTable from "@/components/ui/data-table";
import { createShippingColumns } from "@/app/dashboard/seller/stores/[storeUrl]/shipping/columns";
import type { StoreDefaultShippingInput } from "@/lib/types";
import type {
    ShippingCountryRow,
    ShippingActions,
} from "@/lib/seller-shipping";
export default function SellerShipping({
    storeUrl,
    defaults,
    rates,
    updateDefaultsAction,
    upsertShippingRateAction,
}: ShippingActions & {
    storeUrl: string;
    defaults: StoreDefaultShippingInput;
    rates: ShippingCountryRow[];
}) {
    return (
        <>
            <StoreDefaultShippingDetails
                data={defaults}
                storeUrl={storeUrl}
                updateDefaultsAction={updateDefaultsAction}
                design="seller"
            />
            <section aria-labelledby="country-rates-heading">
                <h2 id="country-rates-heading">Country shipping rates</h2>
                <DataTable
                    filterValue="countryName"
                    data={rates}
                    columns={createShippingColumns({
                        storeUrl,
                        upsertShippingRateAction,
                    })}
                    searchPlaceholder="Search by country name..."
                    design="seller"
                />
            </section>
        </>
    );
}
