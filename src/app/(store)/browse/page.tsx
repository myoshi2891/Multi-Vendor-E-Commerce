import ProductFilters from "@/components/store/browse-page/filters";
import ProductSort from "@/components/store/browse-page/sort";
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
    const {
        category,
        offer,
        search,
        size,
        sort,
        subCategory,
        maxPrice,
        minPrice,
        color,
    } = searchParams;
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
            minPrice: Number(minPrice) || 0, // Default to 0 if minPrice is not provided
            maxPrice: Number(maxPrice) || Number.MAX_SAFE_INTEGER, // Default to the maximum safe integer if maxPrice is not provided
            color: Array.isArray(color)
                ? color
                : color
                  ? [color] // Convert single color string to array
                  : undefined, // If no color, keep it undefined
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
                        <ProductSort />
                        {/* Product list */}
                        <ProductList products={products} />
                    </div>
                </div>
            </div>
        </>
    );
}
