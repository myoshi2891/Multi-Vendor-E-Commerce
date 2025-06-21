import CouponDetails from '@/components/dashboard/forms/coupon-details'
import ProductDetails from '@/components/dashboard/forms/product-details'
import { db } from '@/lib/db'
import { getAllCategories } from '@/queries/category'
import { getAllOfferTags } from '@/queries/offer-tag'

export default async function SellerNewCouponPage({
    params,
}: {
    params: { storeUrl: string }
}) {
    return (
        <div className="w-full">
            <CouponDetails/>
        </div>
    )
}
