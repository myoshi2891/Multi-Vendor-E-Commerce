'use server'

import { db } from '@/lib/db'
import { CartWithCartItemsType } from '@/lib/types'
// 認可ガード経由で SELLER + store 所有権チェックを集約 (IDOR 防御)
import { requireStoreOwner, requireAdmin } from '@/lib/auth-guards'
import { Coupon, Prisma } from '@prisma/client'

const isGuardError = (error: unknown): error is Error => {
    if (!(error instanceof Error)) return false;
    const guardMessages = [
        'Unauthenticated.',
        'Only sellers can perform this action.',
        'Forbidden: store not owned by current user.',
        'Please provide store URL.',
        'Only admins can perform this action.'
    ];
    return guardMessages.includes(error.message);
};

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
        // Ensure coupon data is provided (storeURL は requireStoreOwner 側で検証)
        if (!coupon) throw new Error('Please provide coupon data.')

        // 認証 + SELLER + 店舗所有権を集約検証 (IDOR 防御)
        // - 旧実装は url のみで store を検索しており、他人の店舗 URL を知れば
        //   その店舗にクーポンを作成できる潜在的 IDOR があった。
        //   requireStoreOwner は { url, userId } の複合 where で検索する。
        const { store } = await requireStoreOwner(storeURL)

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
    } catch (error: unknown) {
        console.error(error)

        if (isGuardError(error)) {
            throw error
        }

        throw new Error(
            `Error occurred while trying to upsert coupon: ${error instanceof Error ? error.message : String(error)}`
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
        // 認証 + SELLER + 店舗所有権を集約検証 (IDOR 防御)
        const { store } = await requireStoreOwner(storeURL)

        // Fetch all coupons associated with the store
        const coupons = await db.coupon.findMany({
            where: { storeId: store.id },
        })

        return coupons
    } catch (error: unknown) {
        console.error(error)
        if (isGuardError(error)) {
            throw error
        }
        throw new Error(
            `Error occurred while trying to fetch store coupons: ${error instanceof Error ? error.message : String(error)}`
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
        console.error(error)

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
        // Ensure couponId is provided (storeURL は requireStoreOwner 側で検証)
        if (!couponId) throw new Error('Please provide coupon ID.')

        // 認証 + SELLER + 店舗所有権を集約検証 (IDOR 防御)
        const { store } = await requireStoreOwner(storeURL)

        // Delete coupon from the database
        const response = await db.coupon.delete({
            where: {
                id: couponId,
                storeId: store.id,
            },
        })

        return response === null ? false : true // Return true if the coupon was deleted successfully, false otherwise.
    } catch (error: unknown) {
        console.error(error)

        if (isGuardError(error)) {
            throw error
        }

        throw new Error(
            `Error occurred while trying to delete coupon: ${error instanceof Error ? error.message : String(error)}`
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

        // Step 2.5: isActive フラグの検証（管理者による即時無効化に対応）
        if (!coupon.isActive) {
            throw new Error('This coupon has been deactivated.')
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

        // Step 5: Filter items targeted by the coupon（PLATFORM は全店舗、STORE は対象店舗のみ）
        const isPlatform = coupon.scope === 'PLATFORM'
        const storeId = coupon.storeId

        const targetItems = isPlatform
            ? cart.cartItems
            : cart.cartItems.filter((item) => item.storeId === storeId)

        if (targetItems.length === 0) {
            throw new Error(
                'No items in the cart belong to the store associated with this coupon.'
            )
        }

        // Step 6: Calculate the discount on the target items（Prisma.Decimal で精度を保証）
        const targetSubTotal = targetItems.reduce(
            (acc, item) => acc.add(item.price.mul(item.quantity)),
            new Prisma.Decimal(0)
        )

        const targetShippingTotal = targetItems.reduce(
            (acc, item) => acc.add(item.shippingFee),
            new Prisma.Decimal(0)
        )

        const targetTotal = targetSubTotal.add(targetShippingTotal)

        const discountedAmount = targetTotal.mul(coupon.discount).div(100)

        const newTotal = cart.total.sub(discountedAmount).toNumber()

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
                coupon: {
                    include: {
                        store: true,
                    },
                },
            },
        })

        const scopeLabel = isPlatform ? '全店舗' : (coupon.store?.name ?? '対象店舗')

        return {
            message: `Coupon applied successfully. Discount: -$${discountedAmount.toFixed(2)} applied to items from ${scopeLabel}`,
            cart: updatedCart,
        }
    } catch (error: any) {
        console.error(error)
        throw new Error(
            `Error occurred while applying coupon: ${error.message}`
        )
    }
}

// ==================================================
// Admin-only queries
// ==================================================

/**
 * @Function getAllCoupons
 * @Description 全ストアのクーポン一覧を取得する（管理者専用）
 * @PermissionLevel Admin only
 * @Return クーポン一覧（store 情報付き、最大 100 件）
 */
export const getAllCoupons = async () => {
    await requireAdmin()

    try {
        const coupons = await db.coupon.findMany({
            include: { store: true },
            orderBy: { createdAt: 'desc' },
            take: 100,
        })
        return coupons
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error('[Coupon:getAllCoupons] Failed to fetch coupons', {
                error: error.message,
                stack: error.stack,
            })
        }
        throw new Error('Error occurred while fetching all coupons.')
    }
}

/**
 * @Function upsertCouponAsAdmin
 * @Description 管理者によるクーポン作成・更新。グローバル一意制約違反（P2002）を
 *              日本語メッセージに変換する
 * @PermissionLevel Admin only
 * @Parameters
 *  - coupon: Coupon オブジェクト
 * @Return 作成または更新されたクーポン
 */
export const upsertCouponAsAdmin = async (coupon: Coupon) => {
    await requireAdmin()

    try {
        if (!coupon) throw new Error('Please provide coupon data.')
        const isPlatform = coupon.scope === 'PLATFORM'

        let normalizedStoreId: string | null
        if (isPlatform) {
            normalizedStoreId = null
        } else {
            const trimmed = coupon.storeId?.trim()
            if (!trimmed) throw new Error('Please provide a valid store ID.')
            normalizedStoreId = trimmed
        }

        const couponDetails = await db.coupon.upsert({
            where: { id: coupon.id },
            update: { ...coupon, storeId: normalizedStoreId },
            create: { ...coupon, storeId: normalizedStoreId },
        })
        return couponDetails
    } catch (error: unknown) {
        // P2002: Unique constraint violation（instanceof チェック不要: code だけで識別）
        if (
            typeof (error as Record<string, unknown>).code === 'string' &&
            (error as Record<string, unknown>).code === 'P2002'
        ) {
            throw new Error('このクーポンコードは既に使用されています')
        }
        if (error instanceof Error) {
            console.error('[Coupon:upsertCouponAsAdmin] Failed to upsert coupon', {
                error: error.message,
                stack: error.stack,
            })
        }
        throw new Error(
            `Error occurred while upserting coupon: ${error instanceof Error ? error.message : String(error)}`
        )
    }
}

/**
 * @Function deleteCouponAsAdmin
 * @Description 管理者によるクーポン削除（店舗所有権チェックなし）
 * @PermissionLevel Admin only
 * @Parameters
 *  - couponId: 削除対象クーポンの ID
 * @Return 削除成功時 true
 */
export const deleteCouponAsAdmin = async (couponId: string) => {
    await requireAdmin()

    try {
        if (!couponId) throw new Error('Please provide coupon ID.')

        const response = await db.coupon.delete({
            where: { id: couponId },
        })
        return response !== null
    } catch (error: unknown) {
        if (isGuardError(error)) throw error

        if (error instanceof Error) {
            console.error('[Coupon:deleteCouponAsAdmin] Failed to delete coupon', {
                error: error.message,
                stack: error.stack,
            })
        }
        throw new Error(
            `Error occurred while deleting coupon: ${error instanceof Error ? error.message : String(error)}`
        )
    }
}

/**
 * @Function toggleCouponActive
 * @Description クーポンの isActive を反転させる（管理者専用）
 * @PermissionLevel Admin only
 * @Parameters
 *  - couponId: 対象クーポンの ID
 * @Return 更新されたクーポン
 */
export const toggleCouponActive = async (couponId: string) => {
    await requireAdmin()

    try {
        if (!couponId) throw new Error('Please provide coupon ID.')

        const coupon = await db.coupon.findUnique({ where: { id: couponId } })
        if (!coupon) throw new Error('Coupon not found.')

        const updated = await db.coupon.update({
            where: { id: couponId },
            data: { isActive: !coupon.isActive },
        })
        return updated
    } catch (error: unknown) {
        if (isGuardError(error)) throw error

        if (error instanceof Error) {
            console.error('[Coupon:toggleCouponActive] Failed to toggle coupon', {
                error: error.message,
                stack: error.stack,
            })
        }
        throw new Error(
            `Error occurred while toggling coupon active state: ${error instanceof Error ? error.message : String(error)}`
        )
    }
}
