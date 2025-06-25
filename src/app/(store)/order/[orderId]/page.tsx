import OrderUserDetailsCard from '@/components/store/cards/order/user'
import StoreHeader from '@/components/store/layout/header/header'
import OrderHeader from '@/components/store/order-page/header'
import { getOrder } from '@/queries/order'
import { redirect } from 'next/navigation'

export default async function OrderPage({
    params,
}: {
    params: { orderId: string }
}) {
    const order = await getOrder(params.orderId)
    if (!order) return redirect('/')

    // Get the total count of items across all groups
    const totalItemsCount = order?.groups.reduce(
        (total, group) => total + group._count.items,
        0
    )

    // Calculate the total number of delivered items
    const deliveredItemsCount = order?.groups.reduce((total, group) => {
        if (group.status === 'Delivered') {
            return total + group.items.length
        }
        return total
    }, 0)
    return (
        <div>
            <StoreHeader />
            <div className="p-2">
                <OrderHeader order={order} />
                <div
                    className="grid w-full"
                    style={{
                        gridTemplateColumns:
                            order.paymentStatus === 'Pending' ||
                            order.orderStatus === 'Failed'
                                ? '400px 3fr 1fr'
                                : '1fr 4fr',
                    }}
                >
                    {/* Col 1 -> User, Order details */}
                    <div className="scrollbar flex h-[calc(100vh-137px)] flex-col gap-y-5 overflow-auto">
                        <OrderUserDetailsCard details={order.shippingAddress} />
                        {/* Order info */}
                        {(order.paymentStatus !== 'Pending' ||
                            order.orderStatus !== 'Failed') && (
                            <div> {/* Order total details */}</div>
                        )}
                    </div>
                    {/* Col 2 -> Order Groups */}
                    <div className="scrollbar h-[calc(100vh-137px)] gap-y-5 overflow-auto">
                        {/* Order group details */}
                    </div>
                    {/* Col 3 -> Payment Gateways */}
                    {(order.paymentStatus === 'Pending' ||
                        order.orderStatus === 'Failed') && (
                        <div className="scrollbar h-[calc(100vh-137px)] gap-y-5 space-y-5 overflow-auto border-l p-4 px-2">
                            {/* Order total details */}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
