'use server'

import { db } from "@/lib/db"
import { currentUser } from "@clerk/nextjs/server"

/**
 * @Function getOrder
 * @Description Retrieves a specific order by its ID and the current user's ID, including associated groups, items, store information, item count, and shipping address
 * @Parameters  
 *  - params: orderId.
 * @returns Object containing the order details with groups sorted by totalPrice in descending order.
 */

export const getOrder = async ( orderId: string ) => {
    // Retrieve the current user
    const user = await currentUser()

    // Ensure the user is authenticated
    if (!user) throw new Error('Unauthenticated.')

    // Get order details with groups, product items, and ordered by total price
    const order = await db.order.findUnique({
        where: {
            id: orderId,
            userId: user.id,
        },
        include: {
            groups: {
                include: {
                    items: true,
                    store: true,
                    coupon: true,
                    _count: {
                        select: {
                            items: true,
                        },
                    }
                },
                orderBy: {
                    total: "desc"
                }
            },
            shippingAddress: {
                include: {
                    country: true,
                    user: true,
                }
            },
            paymentDetails: true
        },
    })

    return order
}