import BrowsePagination from "@/components/store/browse-page/browse-pagination";
import FilterPanel from "@/components/store/browse-page/filter-panel";
import ProductFilters from "@/components/store/browse-page/filters";
import ProductSort from "@/components/store/browse-page/sort";
import ProductList from "@/components/store/shared/product-list";
import { FiltersQueryType } from "@/lib/types";
import {
    extractAttributeParams,
    normalizePageParam,
    normalizePriceParam,
    toArrayParam,
} from "@/lib/utils";
import { getProductFacets, getProducts } from "@/queries/product";
import { permanentRedirect, redirect } from "next/navigation";
import { isWithinSubtree, resolveCategoryNode } from "@/lib/category-tree";
import styles from "./browse.module.css";

export const dynamic = "force-dynamic";

/**
 * 解決済み search params を `URLSearchParams` へ写す。
 *
 * `omit` に挙げたキーは落とす（呼び出し側が値を差し替えて `set` し直すため）。
 * size / color は同名パラメータが複数付き得るため、配列は `append` で全要素を残す。
 *
 * @param query - The resolved search parameter values.
 * @param omit - 写さないキーの集合。
 * @returns 保持すべきパラメータだけを含む `URLSearchParams`。
 */
function toBrowseSearchParams(
    query: FiltersQueryType,
    omit: ReadonlySet<string>
): URLSearchParams {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (omit.has(key) || value === undefined || value === null) continue;
        if (Array.isArray(value)) {
            value.forEach((item) => params.append(key, item));
            continue;
        }
        params.set(key, String(value));
    }
    return params;
}

const PAGE_PARAM_KEY: ReadonlySet<string> = new Set(["page"]);
const CATEGORY_PARAM_KEYS: ReadonlySet<string> = new Set([
    "category",
    "subCategory",
]);

/**
 * Builds a `/browse` URL with the specified page while preserving the other query parameters.
 *
 * @param query - The resolved search parameter values.
 * @param page - The page number to include in the URL.
 * @returns A `/browse` URL containing the preserved parameters and specified page.
 */
function buildBrowseHref(query: FiltersQueryType, page: number): string {
    const params = toBrowseSearchParams(query, PAGE_PARAM_KEY);
    params.set("page", String(page));
    return `/browse?${params.toString()}`;
}

/**
 * 旧 URL（`?subCategory=`）を正準形（`?category=`）へ畳むべきかを判定し、
 * 畳む場合の遷移先 href を返す。畳まない場合は `null`。
 *
 * 受理そのものは**恒久的に続ける** —— 外部被リンク・ブックマークがこの形で
 * 届いており、切ると SEO と既存導線を同時に落とす（design.md §2-Q4）。
 * 寄せるのはパラメータ名と、リネームされた slug の正準化だけである。
 *
 * **無条件に `?category=<sub>` へ畳まないこと。** category と subCategory は
 * 2 つのサブツリーの積として効いており、両者が親子でない場合に畳むと
 * 「0 件」が「sub の結果」へ化けて絞り込みが緩くなる。sub が category の
 * 子孫（または同一）であるときだけ畳み、それ以外は URL をそのまま残す
 * （どちらにせよ getProducts 側が両方を解決するので結果は正しい）。
 */
async function resolveCanonicalCategoryHref(
    query: FiltersQueryType
): Promise<string | null> {
    const { category, subCategory } = query;
    if (typeof subCategory !== "string" || subCategory.length === 0) {
        return null;
    }
    const subNode = await resolveCategoryNode(subCategory, "SUB_CATEGORY");
    if (subNode === null) return null;

    // 「category が指定されていない」と「指定されたが解決できない」を
    // 区別する。後者を「未指定」に丸めると、category を落として
    // `?category=<sub>` へ畳んでしまい、getProducts が fail-closed で
    // 返すはずの 0 件が **sub の結果**へ化ける（絞り込みが緩くなる）。
    // 配列（`?category=a&category=b`）も getProducts 側と同じく
    // 「解決できない指定」として扱う。
    const hasCategoryFilter = Array.isArray(category)
        ? category.length > 0
        : typeof category === "string" && category.length > 0;
    const parentNode =
        typeof category === "string" && category.length > 0
            ? await resolveCategoryNode(category, "CATEGORY")
            : null;
    // 親子判定は subtreeOf と同じ境界定義を使う（isWithinSubtree）。
    // ここで `startsWith` を書き下すと、prefix 境界の定義が 2 箇所に散る。
    const isNested =
        parentNode === null
            ? !hasCategoryFilter
            : isWithinSubtree(subNode.path, parentNode.path);
    if (!isNested) return null;

    const params = toBrowseSearchParams(query, CATEGORY_PARAM_KEYS);
    params.set("category", subNode.url);
    return `/browse?${params.toString()}`;
}

/**
 * Renders the store browse page using URL query parameters for filtering, sorting, and pagination.
 *
 * @param searchParams - Query parameters that define the product filters, sort order, and page.
 * @returns The browse page containing filter controls, sorting controls, products, and pagination when applicable.
 */
export default async function BrowsePage({
    searchParams,
}: {
    // 属性ファセットの選択は `?attr.<key>=<value>`（plan 076）
    searchParams: Promise<
        FiltersQueryType & { [key: `attr.${string}`]: string | string[] | undefined }
    >;
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

    // 旧 URL（?subCategory=）を正準形（?category=）へ 308 で寄せる。
    // permanentRedirect は NEXT_REDIRECT を throw するため、href 解決
    // （resolveCanonicalCategoryHref）とは分けてここで呼ぶ。
    const canonicalCategoryHref = await resolveCanonicalCategoryHref(query);
    if (canonicalCategoryHref !== null) {
        // permanentRedirect は 308（redirect は 307）。恒久的な正準化なので
        // 検索エンジンに正準 URL を伝えられる 308 でなければならない。
        permanentRedirect(canonicalCategoryHref);
    }

    // ページ番号の正規化（.claude/steering/tech.md「URL パラメータ正規化」規約）。
    // Infinity / NaN / 小数 / 0 以下は 1 ページ目、MAX_PAGE 超は上限へクランプする。
    const currentPage = normalizePageParam(page);

    const filters = {
        search,
        category,
        subCategory,
        offer,
        size: toArrayParam(size),
        minPrice: normalizePriceParam(minPrice, 0),
        maxPrice: normalizePriceParam(maxPrice, Number.MAX_SAFE_INTEGER),
        color: toArrayParam(color),
        attributes: extractAttributeParams(query),
    };
    // 一覧とファセット件数は同じフィルタから並列に取る。ファセットは補助的な情報なので、
    // 集計に失敗しても一覧は表示する（getProductFacets が構造化ログを出してから throw する）。
    const [products_data, facets] = await Promise.all([
        getProducts(filters, sort, currentPage),
        getProductFacets(filters).catch(() => []),
    ]);
    const { products, totalPages, totalCount } = products_data;

    // 範囲外ページ（?page=999）は空リストを描画せず正準 URL へ寄せる。
    // ページャは page={currentPage} をハイライトするため、寄せないと
    // URL・ハイライト・表示内容の 3 者が食い違う。
    // 該当 0 件（totalPages === 0）のときは 1 ページ目を正準とする。
    // 遷移後は canonicalPage === currentPage になるのでループしない。
    // redirect() は NEXT_REDIRECT を throw するため try/catch の外に置くこと。
    const canonicalPage =
        totalPages >= 1 ? Math.min(currentPage, totalPages) : 1;
    if (canonicalPage !== currentPage) {
        redirect(buildBrowseHref(query, canonicalPage));
    }

    const searchTerm = typeof search === "string" ? search.trim() : "";
    const resultCount = totalCount ?? products.length;

    return (
        <main className={styles.browse}>
            <header className={styles.hero}>
                <div className={styles.heroInner}>
                    <p className={styles.eyebrow}>THE EDIT / CURATED FOR YOU</p>
                    <h1>{searchTerm ? "Search results" : "The collection"}<span>.</span></h1>
                    <p className={styles.heroDescription}>
                        {searchTerm ? `Pieces matching “${searchTerm}”` : "Explore pieces worth keeping, chosen for the everyday extraordinary."}
                    </p>
                    <div className={styles.heroFoot}>
                        <span>DISCOVER SOMETHING SPECIAL</span>
                        <span lang="ja">心ときめくひとつを、ここから。</span>
                    </div>
                </div>
            </header>

            <div className={styles.catalog}>
                <div className={styles.catalogIntro}>
                    <div>
                        <p className={styles.eyebrow}>EXPLORE THE EDIT</p>
                        <h2>Find your <em>favorite.</em></h2>
                    </div>
                    <p>{resultCount} {resultCount === 1 ? "piece" : "pieces"}</p>
                </div>
                <div className={styles.catalogLayout}>
                    <section className={styles.filters} aria-label="Refine the collection">
                        <p className={styles.sectionLabel}>REFINE YOUR SEARCH</p>
                        <FilterPanel>
                            <ProductFilters
                                queries={{ category, offer, search, size, sort, subCategory, maxPrice, minPrice, color }}
                                facets={facets}
                            />
                        </FilterPanel>
                    </section>
                    <section className={styles.results} aria-label="Collection results">
                        <div className={styles.resultsBar}>
                            <span>THE COLLECTION <span className={styles.resultNumber}>/ {String(currentPage).padStart(2, "0")}</span></span>
                            <ProductSort />
                        </div>
                        <ProductList products={products} variant="editorial" />
                        {totalPages > 1 && (
                            <div className={styles.pagination}>
                                <BrowsePagination page={currentPage} totalPages={totalPages} />
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
}
