import {
    getAllStoreProducts,
    deleteProduct,
    upsertProduct,
} from "@/queries/product";
import { getAllCategories } from "@/queries/category";
import { getAllOfferTags } from "@/queries/offer-tag";
import { getAllCountries } from "@/queries/country";
import { getEffectiveAttributeDefinitions } from "@/queries/attribute";
import { flattenCategoryTree } from "@/lib/category-tree";
import { serializeStoreProducts } from "@/lib/seller-products";
import SellerProducts from "@/components/dashboard/seller/seller-products";
import SellerPage from "@/components/dashboard/design/seller-page";
import { LookupFailure } from "@/components/dashboard/design/seller-error";
export const dynamic = "force-dynamic";
export default async function SellerProductPage({
    params,
}: {
    params: Promise<{ storeUrl: string }>;
}) {
    const { storeUrl } = await params;
    const data = await Promise.all([
        getAllStoreProducts(storeUrl),
        getAllCategories(),
        getAllOfferTags(storeUrl),
        getAllCountries(),
    ]).catch((error: unknown) => {
        if (error instanceof Error) {
            console.error("[SellerProductPage] Failed to load product data", {
                error: error.message,
                stack: error.stack,
            });
        } else {
            console.error("[SellerProductPage] Unknown error", { error });
        }
        return null;
    });
    if (!data)
        return (
            <SellerPage id="store-products" title="Products">
                <LookupFailure />
            </SellerPage>
        );
    const [products, tree, offerTags, countries] = data;
    return (
        <SellerProducts
            products={serializeStoreProducts(products)}
            categories={flattenCategoryTree(tree)}
            offerTags={offerTags}
            countries={countries}
            storeUrl={storeUrl}
            actions={{
                deleteProductAction: deleteProduct,
                upsertProductAction: upsertProduct,
                getAttributeDefinitionsAction: getEffectiveAttributeDefinitions,
            }}
        />
    );
}
