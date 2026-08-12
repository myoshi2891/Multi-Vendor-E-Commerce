import BrowsePagination from "@/components/store/browse-page/browse-pagination";
import ProductFilters from "@/components/store/browse-page/filters";
import ProductSort from "@/components/store/browse-page/sort";
import ProductList from "@/components/store/shared/product-list";
import { FiltersQueryType } from "@/lib/types";
import { normalizePageParam } from "@/lib/utils";
import { getProducts } from "@/queries/product";

export const dynamic = 'force-dynamic';

/**
 * Renders the store browse page with filter controls, sorting UI, and a product list derived from URL query parameters.
 *
 * @param searchParams - A promise resolving to the query parameters used to filter and sort products.
 * @returns The browse page React element containing the product filters, sort controls, and filtered product list.
 */
export default async function BrowsePage({
    searchParams,
}: {
    searchParams: Promise<FiltersQueryType>;
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
        page,
    } = await searchParams;

    // ページ番号の正規化（.claude/steering/tech.md「URL パラメータ正規化」規約）。
    // Infinity / NaN / 小数 / 0 以下は 1 ページ目、MAX_PAGE 超は上限へクランプする。
    const currentPage = normalizePageParam(page);

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
        sort,
        currentPage
    );
    const { products, totalPages } = products_data;

    return (
        <div className="mx-auto max-w-[95%]">
            <div className="mt-5 flex gap-x-5">
                <ProductFilters queries={{ category, offer, search, size, sort, subCategory, maxPrice, minPrice, color }} />
                <div className="space-y-5 p-4">
                    <ProductSort />
                    {/* Product list */}
                    <ProductList products={products} />
                    {totalPages > 1 && (
                        <BrowsePagination
                            page={currentPage}
                            totalPages={totalPages}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
