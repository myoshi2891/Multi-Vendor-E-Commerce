import StoreHeader from '@/components/store/layout/header/header'
import { getOrder } from '@/queries/order'

export default async function OrderPage({
    params,
}: {
    params: { orderId: string }
}) {
    const order = await getOrder(params.orderId)

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
    return <div>
        <StoreHeader />
    </div>
}
