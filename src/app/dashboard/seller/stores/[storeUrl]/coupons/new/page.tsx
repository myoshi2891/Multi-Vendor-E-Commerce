import CouponDetails from '@/components/dashboard/forms/coupon-details'
import ProductDetails from '@/components/dashboard/forms/product-details'
import { db } from '@/lib/db'
import { getAllCategories } from '@/queries/category'
import { getAllOfferTags } from '@/queries/offer-tag'

export default async function SellerNewCouponPage({
    params,
}: {
    params: Promise<{ storeUrl: string }>
}) {
    const { storeUrl } = await params;
    return (
        <div className="w-full">
            <CouponDetails storeUrl={storeUrl} />
        </div>
    )
}
