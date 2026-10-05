import { upsertProduct } from "@/queries/product";
import { getEffectiveAttributeDefinitions } from "@/queries/attribute";
import ProductDetails from "@/components/dashboard/forms/product-details";
import { db } from "@/lib/db";
import { getAllCategories } from "@/queries/category";
import { flattenCategoryTree } from "@/lib/category-tree";
import { getAllOfferTags } from "@/queries/offer-tag";
import SellerPage from "@/components/dashboard/design/seller-page";

export const dynamic = "force-dynamic";

/**
 * Prepare data and render the product-creation form for a specific store.
 *
 * Awaits `params` to obtain `storeUrl`, fetches categories, offer tags, and countries, and renders the page containing the ProductDetails form populated with those values.
 *
 * @param params - Promise resolving to an object with `storeUrl`, the store identifier used to scope the new product
 * @returns The page React element that renders `ProductDetails` with `categories`, `offerTags`, `countries`, and `storeUrl`
 */
export default async function SellerNewProductPage({
    params,
}: {
    params: Promise<{ storeUrl: string }>;
}) {
    const { storeUrl } = await params;
    // 商品フォームはツリーを 1 本の select で扱う（plan 068）。
    // pre-order で平坦化して渡すと、選択肢の並びがそのまま木の形になる。
    const categories = flattenCategoryTree(await getAllCategories());
    const offerTags = await getAllOfferTags();
    const countries = await db.country.findMany({
        orderBy: { name: "asc" },
    });

    return (
        <SellerPage
            id="create-product-heading"
            title="Create product"
            description="Add product information and its first variant to your store."
        >
            <ProductDetails
                design="seller"
                upsertProductAction={upsertProduct}
                getAttributeDefinitionsAction={getEffectiveAttributeDefinitions}
                categories={categories}
                storeUrl={storeUrl}
                offerTags={offerTags}
                countries={countries}
            />
        </SellerPage>
    );
}
