"use client";
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
                columns={getProductColumns(actions.deleteProductAction)}
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
