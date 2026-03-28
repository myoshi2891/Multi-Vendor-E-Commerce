import CouponDetails from '@/components/dashboard/forms/coupon-details'

/**
 * Render the seller's "new coupon" page for a specific store.
 *
 * @param params - A promise resolving to an object with `storeUrl`, the store identifier used to render the coupon details UI.
 * @returns The page's JSX element containing the coupon details component for the specified store.
 */
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
