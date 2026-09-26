// Product Details form
import ProductDetails from "@/components/dashboard/forms/product-details";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
// Queries
import { getAllCategories } from "@/queries/category";
import { flattenCategoryTree } from "@/lib/category-tree";
import { getAllOfferTags } from "@/queries/offer-tag";
import { getProductVariantForEdit } from "@/queries/product";

export const dynamic = "force-dynamic";

/**
 * 既存バリアントの編集ページ。商品一覧のバリアントリンクの遷移先。
 *
 * 商品・バリアント・属性値（初期値とこのレコードのアーカイブ済み現在値）を
 * `getProductVariantForEdit` が店舗オーナー検証つきで読み、商品フォームへ渡す。
 */
export default async function SellerEditProductVariantPage({
    params,
}: {
    params: Promise<{ storeUrl: string; productId: string; variantId: string }>;
}) {
    const { storeUrl, productId, variantId } = await params;
    const product = await getProductVariantForEdit(
        storeUrl,
        productId,
        variantId
    );
    if (!product) notFound();

    // 商品フォームはツリーを 1 本の select で扱う（plan 068）
    const categories = flattenCategoryTree(await getAllCategories());
    const offerTags = await getAllOfferTags();
    const countries = await db.country.findMany({
        orderBy: { name: "asc" },
    });

    return (
        <div>
            <ProductDetails
                categories={categories}
                storeUrl={storeUrl}
                data={product}
                offerTags={offerTags}
                countries={countries}
            />
        </div>
    );
}
