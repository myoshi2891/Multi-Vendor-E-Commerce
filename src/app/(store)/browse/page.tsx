import ProductFilters from "@/components/store/browse-page/filters";
import StoreHeader from "@/components/store/layout/header/header";
import ProductList from "@/components/store/shared/product-list";
import { FiltersQueryType } from "@/lib/types";
import { getProducts } from "@/queries/product";
import { getFilteredSizes } from "@/queries/size";

export default async function BrowsePage({
    searchParams,
}: {
    searchParams: FiltersQueryType;
}) {
    const { category, offer, search, size, sort, subCategory } = searchParams;
    await getFilteredSizes({});
    const products_data = await getProducts(
        {
            search,
            category,
            subCategory,
            offer,
            size: Array.isArray(size)
                ? size
                : size
                  ? [size] // Convert string to array if it's not already an array
                  : undefined, // Default to undefined if size is not provided
        },
        sort
    );
    const { products } = products_data;

    return (
        <>
            <StoreHeader />
            <div className="mx-auto max-w-[95%]">
                <div className="mt-5 flex gap-x-5">
                    <ProductFilters queries={searchParams} />
                    <div className="space-y-5 p-4">
                        {/* Product sort */}
                        {/* Product list */}
                        <ProductList products={products} />
                    </div>
                </div>
            </div>
        </>
    );
}
