import BrowsePagination from "@/components/store/browse-page/browse-pagination";
import ProductFilters from "@/components/store/browse-page/filters";
import ProductSort from "@/components/store/browse-page/sort";
import ProductList from "@/components/store/shared/product-list";
import { FiltersQueryType } from "@/lib/types";
import { normalizePageParam } from "@/lib/utils";
import { getProducts } from "@/queries/product";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

/**
 * Builds a `/browse` URL with the specified page while preserving the other query parameters.
 *
 * @param query - The resolved search parameter values.
 * @param page - The page number to include in the URL.
 * @returns A `/browse` URL containing the preserved parameters and specified page.
 */
function buildBrowseHref(query: FiltersQueryType, page: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (key === "page" || value === undefined || value === null) continue;
        // size / color は同名パラメータが複数付き得るため append で全要素を残す
        if (Array.isArray(value)) {
            value.forEach((item) => params.append(key, item));
            continue;
        }
        params.set(key, String(value));
    }
    params.set("page", String(page));
    return `/browse?${params.toString()}`;
}

/**
 * Renders the store browse page using URL query parameters for filtering, sorting, and pagination.
 *
 * @param searchParams - Query parameters that define the product filters, sort order, and page.
 * @returns The browse page containing filter controls, sorting controls, products, and pagination when applicable.
 */
/**
 * URL 由来の価格パラメータを数値へ解決する。
 *
 * `Number(x) || fallback` は使わない —— `?maxPrice=0`（上限 0 の空レンジ）は
 * falsy なので fallback の `Number.MAX_SAFE_INTEGER` へ化け、
 * 「上限 0」が「上限なし」に反転して**全件が通ってしまう**。
 * `src/queries/product.ts` の `getProducts` は既に `hasPriceBound` による
 * 明示的な存在判定で 0 を正しい境界として受け付けるため、入口側でも
 * 0 を潰さず `lte: 0` がそのまま届くようにする。
 *
 * 未指定 / 空文字 / 非有限値 / 負値は fallback に寄せる。Next.js は同名
 * パラメータが複数付くと配列を渡すため、配列は先頭要素を採る
 * （`normalizePageParam` と同じ規約）。
 */
const normalizePriceParam = (value: unknown, fallback: number): number => {
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === undefined || raw === null || raw === "") return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return parsed;
};

export default async function BrowsePage({
    searchParams,
}: {
    searchParams: Promise<FiltersQueryType>;
}) {
    const query = await searchParams;
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
    } = query;

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
            minPrice: normalizePriceParam(minPrice, 0),
            maxPrice: normalizePriceParam(maxPrice, Number.MAX_SAFE_INTEGER),
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

    // 範囲外ページ（?page=999）は空リストを描画せず正準 URL へ寄せる。
    // ページャは page={currentPage} をハイライトするため、寄せないと
    // URL・ハイライト・表示内容の 3 者が食い違う。
    // 該当 0 件（totalPages === 0）のときは 1 ページ目を正準とする。
    // 遷移後は canonicalPage === currentPage になるのでループしない。
    // redirect() は NEXT_REDIRECT を throw するため try/catch の外に置くこと。
    const canonicalPage = totalPages >= 1 ? Math.min(currentPage, totalPages) : 1;
    if (canonicalPage !== currentPage) {
        redirect(buildBrowseHref(query, canonicalPage));
    }

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
