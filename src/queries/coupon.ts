'use server'

import { db } from '@/lib/db'
import { CartWithCartItemsType } from '@/lib/types'
import { currentUser } from '@clerk/nextjs/server'
import { Coupon } from '@prisma/client'

/**
 * @Function upsertCoupon
 * @Description Upserts a coupon into the database, updating if it exists or creating a new one if not.
 * @PermissionLevel Seller only
 * @Parameters
 *  - coupon: Coupon object containing details of the coupon to be upserted.
 *  - storeURL: String representing the URL of the store, used to retrieve the store ID.
 * @Return Updated or newly created coupon details.
 */

export const upsertCoupon = async (coupon: Coupon, storeURL: string) => {
    try {
        // Get current user
        const user = await currentUser()

        // Ensure user is authenticated
        if (!user) throw new Error('Unauthenticated.')

        // Verify seller permission
        if (user.privateMetadata.role !== 'SELLER')
            throw new Error('Only sellers can perform this action.')

        // Ensure coupon data and storeUrl are provided
        if (!coupon) throw new Error('Please provide coupon data.')
        if (!storeURL) throw new Error('Please provide store URL.')

        // Retrieve store ID using the store URL
        const store = await db.store.findUnique({
            where: { url: storeURL },
        })

        if (!store) throw new Error(`Store with URL "${storeURL}" not found.`)

        // Throw error if a coupon with the same code and store ID already exists
        const existingCoupon = await db.coupon.findFirst({
            where: {
                AND: [
                    { code: coupon.code },
                    { storeId: store.id },
                    { NOT: { id: coupon.id } },
                ],
            },
        })

        if (existingCoupon) {
            throw new Error(
                `Coupon with the same code "${coupon.code}" already exists for this store.`
            )
        }

        // Upsert coupon into the database
        const couponDetails = await db.coupon.upsert({
            where: { id: coupon.id },
            update: { ...coupon, storeId: store.id },
            create: {
                ...coupon,
                storeId: store.id,
            },
        })

        return couponDetails
    } catch (error: any) {
        console.log(error)

        throw new Error(
            `Error occurred while trying to upsert coupon: ${error.message}`
        )
    }
}

/**
 * @Function getStoreCoupons
 * @Description  Fetches all coupons for a specific store based on the provided store URL.
 * @PermissionLevel Seller only
 * @Parameters
 *  - storeURL: String representing the store's unique URL, used to retrieve the store ID.
 * @Return Array of coupon details associated with the specific store.
 */

export const getStoreCoupons = async (storeURL: string) => {
    try {
        // Get current user
        const user = await currentUser()

        // Ensure user is authenticated
        if (!user) throw new Error('Unauthenticated.')

        // Verify seller permission
        if (user.privateMetadata.role !== 'SELLER')
            throw new Error('Only sellers can perform this action.')

        // Ensure storeUrl is provided
        if (!storeURL) throw new Error('Please provide store URL.')

        // Retrieve store ID using the storeURL and ensure it belongs to the current user
        const store = await db.store.findUnique({
            where: { url: storeURL },
        })

        if (!store || store.userId !== user.id) {
            throw new Error(
                'You do not have permission to access coupons for this store.'
            )
        }

        // Fetch all coupons associated with the store
        const coupons = await db.coupon.findMany({
            where: { storeId: store.id },
        })

        return coupons
    } catch (error: any) {
        console.log(error)
        throw new Error(
            `Error occurred while trying to fetch store coupons: ${error.message}`
        )
    }
}

/**
 * @Function getCoupon
 * @Description Retrieves a specific coupon from the database.
 * @PermissionLevel Public
 * @Parameters
 *  - couponId: ID of the coupon to be retrieved.
 * @Return Coupon details if found, otherwise undefined.
 */

export const getCoupon = async (couponId: string) => {
    try {
        // Ensure couponId is provided
        if (!couponId) throw new Error('Please provide coupon ID.')

        // Retrieve coupon from the database
        const coupon = await db.coupon.findUnique({
            where: { id: couponId },
        })

        return coupon
    } catch (error: any) {
        console.log(error)

        throw new Error(
            `Error occurred while trying to fetch coupon: ${error.message}`
        )
    }
}

/**
 * @Function deleteCoupon
 * @Description Deletes a specific coupon from the database.
 * @PermissionLevel  Seller only (must be the owner of the store)
 * @Parameters
 *  - couponId: ID of the coupon to be deleted.
 *  - storeURL: String representing the URL of the store, used to retrieve the store ID.
 * @Return Response indicating whether the coupon was deleted successfully.
 */

export const deleteCoupon = async (couponId: string, storeURL: string) => {
    try {
        // Get current user
        const user = await currentUser()

        // Ensure user is authenticated
        if (!user) throw new Error('Unauthenticated.')

        // Verify seller permission
        if (user.privateMetadata.role !== 'SELLER')
            throw new Error('Only sellers can perform this action.')

        // Ensure couponId and storeUrl are provided
        if (!couponId) throw new Error('Please provide coupon ID.')
        if (!storeURL) throw new Error('Please provide store URL.')

        // Retrieve store ID using the storeURL and ensure it belongs to the current user
        const store = await db.store.findUnique({
            where: { url: storeURL },
        })

        if (!store || store.userId !== user.id) {
            throw new Error(
                'You do not have permission to access coupons for this store.'
            )
        }

        // Delete coupon from the database
        const response = await db.coupon.delete({
            where: {
                id: couponId,
                storeId: store.id,
            },
        })

        return response === null ? false : true // Return true if the coupon was deleted successfully, false otherwise.
    } catch (error: any) {
        console.log(error)

        throw new Error(
            `Error occurred while trying to delete coupon: ${error.message}`
        )
    }
}

/**
 * @Function applyCoupon
 * @Description Applies a coupon to a. cart for items belonging to the coupon's store
 * @Parameters
 *  - couponCode: The coupon code to apply.
 *  - cartId: The ID of the cart to apply the coupon to.
 * @Return A message indicating whether the coupon was applied successfully. along with the updated cart
 */

export const applyCoupon = async (
    couponCode: string,
    cartId: string
): Promise<{ message: string; cart: CartWithCartItemsType }> => {
    try {
        // Step 1: Fetch the coupon details
        const coupon = await db.coupon.findUnique({
            where: {
                code: couponCode,
            },
            include: {
                store: true,
            },
        })

        if (!coupon) {
            throw new Error('Coupon not found.')
        }

        // Step 2: Validate the coupon's date range
        const currentDate = new Date()
        const startDate = new Date(coupon.startDate)
        const endDate = new Date(coupon.endDate)
        if (currentDate < startDate || currentDate > endDate) {
            throw new Error('Coupon is not valid for this date.')
        }

        // Step 3: Fetch the cart and validate its existence
        const cart = await db.cart.findUnique({
            where: {
                id: cartId,
            },
            include: {
                cartItems: true,
                coupon: true,
            },
        })

        if (!cart) {
            throw new Error('Cart not found')
        }

        // Step 4: Ensure no coupon is already applied to the cart
        if (cart.couponId) {
            throw new Error('Coupon is already applied to this cart.')
        }

        // Step 5: Filter items from the store associated with the coupon
        const storeId = coupon.storeId

        const storeItems = cart.cartItems.filter(
            (item) => item.storeId === storeId
        )

        if (storeItems.length === 0) {
            throw new Error(
                'No items in the cart belong to the store associated with this coupon.'
            )
        }

        // Step 6: Calculate the discount on the store's items
        const storeSubTotal = storeItems.reduce(
            (acc, item) => acc + item.price * item.quantity,
            0
        )

        const storeShippingTotal = storeItems.reduce(
            (acc, item) => acc + item.shippingFee,
            0
        )

        const storeTotal = storeSubTotal + storeShippingTotal

        const discountedAmount = (storeTotal * coupon.discount) / 100

        const newTotal = cart.total - discountedAmount

        // Step 7: Update the cart with the applied coupon details and new total
        const updatedCart = await db.cart.update({
            where: {
                id: cartId,
            },
            data: {
                couponId: coupon.id,
                total: newTotal,
            },
            include: {
                cartItems: true,
                coupon: true,
            },
        })

        return {
            message: `Coupon applied successfully. Discount: ${discountedAmount.toFixed(2)} applied to items from ${coupon.store.name}`,
            cart: updatedCart,
        }
    } catch (error: any) {
        console.log(error)
        throw new Error(
            `Error occurred while applying coupon: ${error.message}`
        )
    }
}
