import ProductDetails from '@/components/dashboard/forms/product-details'
import { db } from '@/lib/db'
import { getAllCategories } from '@/queries/category'
import { getAllOfferTags } from '@/queries/offer-tag'

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
    params: Promise<{ storeUrl: string }>
}) {
    const { storeUrl } = await params;
    const categories = await getAllCategories()
    const offerTags = await getAllOfferTags()
    const countries = await db.country.findMany({
        orderBy: { name: 'asc' },
    })

    return (
        <div className="w-full">
            <ProductDetails
                categories={categories}
                storeUrl={storeUrl}
                offerTags={offerTags}
                countries={countries}
            />
        </div>
    )
}
