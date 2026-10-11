"use client";
import { useMemo, useState } from "react";
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
    // flexRender は cell 関数をコンポーネント型として createElement するため、列定義を毎 render
    // 作り直すと router.refresh() のたびに行の操作ボタンが remount され、料率 Dialog を閉じたときの
    // フォーカス復帰先（returnFocusTo）が DOM から外れる。inventory-table-client と同じく、
    // refresh ごとに別参照になる Server Action は初回の参照を固定し、列定義を useMemo で固定する
    const [stableUpsertAction] = useState(() => upsertShippingRateAction);
    const columns = useMemo(
        () =>
            createShippingColumns({
                storeUrl,
                upsertShippingRateAction: stableUpsertAction,
            }),
        [storeUrl, stableUpsertAction]
    );
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
                    columns={columns}
                    searchPlaceholder="Search by country name..."
                    design="seller"
                />
            </section>
        </>
    );
}
