"use client";
import { useMemo, useState } from "react";
import type { Category, Country, OfferTag } from "@prisma/client";
import type {
    ProductListActions,
    StoreProductRow,
} from "@/lib/seller-products";
import { getProductColumns } from "@/app/dashboard/seller/stores/[storeUrl]/products/columns";
import DataTable from "@/components/ui/data-table";
import ProductDetails from "../forms/product-details";
import SellerPage from "../design/seller-page";
export default function SellerProducts({
    products,
    categories,
    countries,
    offerTags,
    storeUrl,
    actions,
}: {
    products: StoreProductRow[];
    categories: Category[];
    countries: Country[];
    offerTags: OfferTag[];
    storeUrl: string;
    actions: ProductListActions;
}) {
    // 列定義を毎 render 作ると router.refresh() のたびに行内の要素が remount され、成功表示や
    // Dialog のフォーカス復帰先が失われる。refresh ごとに別参照になる Server Action は初回の参照を
    // 固定し、列定義を useMemo で固定する（seller-shipping.tsx と同じ）
    const [stableDeleteAction] = useState(() => actions.deleteProductAction);
    const columns = useMemo(
        () => getProductColumns(stableDeleteAction),
        [stableDeleteAction]
    );
    return (
        <SellerPage
            id="store-products"
            title="Products"
            description="Manage products, variants and availability."
        >
            <DataTable
                design="seller"
                heading="Create product"
                subheading="Add a product and its first variant to your store."
                actionButtonText="Create New Product"
                newTabLink={`/dashboard/seller/stores/${storeUrl}/products/new`}
                searchPlaceholder="Search product name..."
                filterValue="name"
                data={products}
                columns={columns}
                modalChildren={
                    <ProductDetails
                        design="seller"
                        categories={categories}
                        countries={countries}
                        offerTags={offerTags}
                        storeUrl={storeUrl}
                        {...actions}
                    />
                }
            />
        </SellerPage>
    );
}
