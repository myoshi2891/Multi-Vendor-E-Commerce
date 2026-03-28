import ProductFilters from "@/components/store/browse-page/filters";
import ProductSort from "@/components/store/browse-page/sort";
import CategoriesHeader from "@/components/store/layout/categories-header/categories-header";
import StoreHeader from "@/components/store/layout/header/header";
import StoreDetails from "@/components/store/store-page/store-details";
import StoreProducts from "@/components/store/store-page/store-products";
import { FiltersQueryType } from "@/lib/types";
import { getStorePageDetails } from "@/queries/store";

/**
 * Renders the store page for a given store URL, including headers, store details, filters, sort controls, and product listings.
 *
 * Renders a complete store UI composed of StoreHeader, CategoriesHeader, StoreDetails, ProductFilters, ProductSort, and StoreProducts.
 *
 * @param params - A promise that resolves to an object containing `storeUrl`, the identifier for the store to render
 * @param searchParams - A promise that resolves to filter/query parameters used by ProductFilters and StoreProducts
 * @returns The JSX for the store page
 */
export default async function StorePage({
    params,
    searchParams,
}: {
    params: Promise<{ storeUrl: string }>;
    searchParams: Promise<FiltersQueryType>;
}) {
    const { storeUrl } = await params;
    const resolvedSearchParams = await searchParams;
    const store = await getStorePageDetails(storeUrl);
    return (
        <>
            <StoreHeader />
            <CategoriesHeader />
            <StoreDetails details={store} />
            <div className="mx-auto max-w-[95%] border-t">
                <div className="mt-5 flex gap-x-5">
                    <ProductFilters
                        queries={resolvedSearchParams}
                        storeUrl={storeUrl}
                    />
                    <div className="space-y-5 p-4">
                        <ProductSort />
                        <StoreProducts
                            searchParams={resolvedSearchParams}
                            store={storeUrl}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
