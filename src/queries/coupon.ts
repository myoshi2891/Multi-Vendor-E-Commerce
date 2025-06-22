'use server'

import { db } from '@/lib/db'
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
