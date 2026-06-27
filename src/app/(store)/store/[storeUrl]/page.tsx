import ProductFilters from "@/components/store/browse-page/filters";
import ProductSort from "@/components/store/browse-page/sort";
import CategoriesHeader from "@/components/store/layout/categories-header/categories-header";
import StoreDetails from "@/components/store/store-page/store-details";
import StoreProducts from "@/components/store/store-page/store-products";
import { FiltersQueryType } from "@/lib/types";
import { getStorePageDetails } from "@/queries/store";

export const dynamic = 'force-dynamic';

/**
 * Renders the store page for a given store URL.
 *
 * The page includes the category header, store details, filter controls, sort controls, and product listings.
 *
 * @param params - Resolves to the store URL for the page.
 * @param searchParams - Resolves to the filter and query parameters used by the product controls.
 * @returns The JSX for the store page.
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
