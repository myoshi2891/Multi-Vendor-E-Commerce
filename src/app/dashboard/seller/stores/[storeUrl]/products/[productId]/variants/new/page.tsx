// Product Details form
import ProductDetails from "@/components/dashboard/forms/product-details";
import { db } from '@/lib/db'
// Queries
import { getAllCategories } from "@/queries/category";
import { flattenCategoryTree } from "@/lib/category-tree";
import { getAllOfferTags } from '@/queries/offer-tag'
import { getProductMainInfo } from '@/queries/product'

/**
 * Loads data for a product details form and renders the ProductDetails page for a specific product.
 *
 * @param params - A promise that resolves to an object with `storeUrl` and `productId` identifying the store and product
 * @returns The rendered ProductDetails React element for the product, or `null` if the product does not exist
 */
export default async function SellerNewProductVariantPage({
    params,
}: {
    params: Promise<{ storeUrl: string; productId: string }>
}) {
    const { storeUrl, productId } = await params;
    // 商品フォームはツリーを 1 本の select で扱う（plan 068）。
    // pre-order で平坦化して渡すと、選択肢の並びがそのまま木の形になる。
    const categories = flattenCategoryTree(await getAllCategories())
    const offerTags = await getAllOfferTags()
    const product = await getProductMainInfo(productId)
    if (!product) return null
    const countries = await db.country.findMany({
        orderBy: { name: 'asc' },
    })

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
    )
}
