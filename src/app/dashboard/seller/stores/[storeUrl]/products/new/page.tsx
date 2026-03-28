import ProductDetails from '@/components/dashboard/forms/product-details'
import { db } from '@/lib/db'
import { getAllCategories } from '@/queries/category'
import { getAllOfferTags } from '@/queries/offer-tag'

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
