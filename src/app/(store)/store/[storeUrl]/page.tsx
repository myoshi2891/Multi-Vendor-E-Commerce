import ProductFilters from "@/components/store/browse-page/filters";
import ProductSort from "@/components/store/browse-page/sort";
import CategoriesHeader from "@/components/store/layout/categories-header/categories-header";
import StoreHeader from "@/components/store/layout/header/header";
import StoreDetails from "@/components/store/store-page/store-details";
import StoreProducts from "@/components/store/store-page/store-products";
import { FiltersQueryType } from "@/lib/types";
import { getStorePageDetails } from "@/queries/store";

export default async function StorePage({
    params,
    searchParams,
}: {
    params: { storeUrl: string };
    searchParams: FiltersQueryType;
}) {
    const store = await getStorePageDetails(params.storeUrl);
    return (
        <>
            <StoreHeader />
            <CategoriesHeader />
            <StoreDetails details={store} />
            <div className="mx-auto max-w-[95%] border-t">
                <div className="mt-5 flex gap-x-5">
                    <ProductFilters
                        queries={searchParams}
                        storeUrl={params.storeUrl}
                    />
                    <div className="space-y-5 p-4">
                        <ProductSort />
                        <StoreProducts
                            searchParams={searchParams}
                            store={params.storeUrl}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
