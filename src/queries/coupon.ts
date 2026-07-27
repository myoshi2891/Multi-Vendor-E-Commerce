'use server'

import { db } from '@/lib/db'
import { logError } from '@/lib/log'
import { SerializedCartType } from '@/lib/types'
import { serializeCart } from '@/lib/serialize-cart'
// 認可ガード経由で SELLER + store 所有権チェックを集約 (IDOR 防御)
import { requireUser, requireStoreOwner, requireAdmin } from '@/lib/auth-guards'
// フォーム契約のサーバー側強制 (SECURITY-14: 直接呼び出しによる discount>99 等の回避防止)
import { CouponFormSchema, AdminCouponFormSchema } from '@/lib/schemas'
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
 * ドメインエラー（入力検証・業務ルール由来の意図的な throw）かを判定する。
 *
 * これらは try の内側で throw されるため、素通しにしないと catch の
 * `Error occurred while ... : ${message}` に上書きされ、フォームへ
 * 「クーポンの入力値が不正です。」を返せなくなる。認可ガードを try/catch の外へ
 * 出しているのと同じ原則（tech.md「認可エラーを汎用 DB エラーメッセージで
 * 上書きしない」）を、DB 読み取りの後段に位置して try 外へ出せない検証にも適用する。
 *
 * ユーザー起因のため logError にも載せない（運用ログのノイズになる）。
 */
const isDomainError = (error: unknown): error is Error => {
    if (!(error instanceof Error)) return false;
    const domainMessages = [
        'クーポンの入力値が不正です。',
        'このクーポンコードは既に使用されています',
        'Please provide coupon data.',
        'Please provide a valid store ID.'
    ];
    return domainMessages.includes(error.message);
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
    // 認証 + SELLER + 店舗所有権を集約検証 (IDOR 防御)
    // - 旧実装は url のみで store を検索しており、他人の店舗 URL を知れば
    //   その店舗にクーポンを作成できる潜在的 IDOR があった。
    //   requireStoreOwner は { url, userId } の複合 where で検索する。
    // - 認可ガードは try/catch の外に置く（認可エラーを汎用 DB エラーで上書きしないため）
    const { store } = await requireStoreOwner(storeURL)

    // Ensure coupon data is provided (storeURL は requireStoreOwner 側で検証)
    // coupon.id を参照する所有権検証より前に置く必要があるため try の外へ。
    if (!coupon) throw new Error('Please provide coupon data.')

    // 既存クーポンの所有権検証 (cross-store / PLATFORM hijack 防御)
    // - upsert の where は id 単独のため、他店舗・PLATFORM クーポンの id を渡すと
    //   update 分岐が storeId を自店舗へ書き換えて乗っ取れてしまう。
    //   対象行を事前取得し、自店舗所有でなければ拒否する。
    // - DB 読み取りエラーのみ try/catch で包み、認可 throw (Forbidden) はその外に置く
    //   （認可エラーを汎用 DB エラーメッセージで上書きしないため。tech.md 準拠）。
    let existingById: Coupon | null = null
    try {
        existingById = await db.coupon.findUnique({ where: { id: coupon.id } })
    } catch (error: unknown) {
        logError('[Coupon:upsertCoupon] failed to verify coupon ownership', error)
        throw new Error('Error occurred while verifying coupon ownership.')
    }
    // storeId !== store.id は他店舗、PLATFORM(storeId=null) も含めて拒否する
    if (existingById && existingById.storeId !== store.id) {
        throw new Error('Forbidden: coupon not owned by current store.')
    }

    try {
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
            throw new Error('このクーポンコードは既に使用されています')
        }

        // フォーム契約をサーバー側でも強制する（直接呼び出しで discount>99 等を回避させない）。
        // z.object は未知キーを除去するため、Coupon 全体を渡して 4 フォームフィールドのみ検証される。
        const parsed = CouponFormSchema.safeParse(coupon)
        if (!parsed.success) {
            throw new Error('クーポンの入力値が不正です。')
        }

        // Upsert coupon into the database
        // クライアント入力のスプレッドは行わず、検証済みフィールドを明示マッピングする。
        // scope / storeId はクライアント入力を信用せずサーバー強制（SELLER による PLATFORM クーポン作成を防ぐ）
        const couponDetails = await db.coupon.upsert({
            where: { id: coupon.id },
            update: {
                code: parsed.data.code,
                startDate: parsed.data.startDate,
                endDate: parsed.data.endDate,
                discount: parsed.data.discount,
                storeId: store.id,
                scope: 'STORE',
            },
            create: {
                // id はフォーム側で常にクライアント生成される (data?.id ?? v4())
                id: coupon.id,
                code: parsed.data.code,
                startDate: parsed.data.startDate,
                endDate: parsed.data.endDate,
                discount: parsed.data.discount,
                storeId: store.id,
                scope: 'STORE',
            },
        })

        return couponDetails
    } catch (error: unknown) {
        // 入力検証・重複コードの意図的 throw は素通しする（ラップもログもしない）
        if (isDomainError(error)) throw error

        logError('[Coupon:upsertCoupon] failed to upsert coupon', error)

        // P2002: ユニーク制約違反（findFirst の事前チェックをすり抜けた競合時のフォールバック）
        if (
            typeof (error as Record<string, unknown>).code === 'string' &&
            (error as Record<string, unknown>).code === 'P2002'
        ) {
            throw new Error('このクーポンコードは既に使用されています')
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
    // 認証 + SELLER + 店舗所有権を集約検証 (IDOR 防御)
    // 認可ガードは try/catch の外に置く（認可エラーを汎用 DB エラーで上書きしないため）
    const { store } = await requireStoreOwner(storeURL)

    try {
        // Fetch all coupons associated with the store
        const coupons = await db.coupon.findMany({
            where: { storeId: store.id },
        })

        return coupons
    } catch (error: unknown) {
        logError('[Coupon:getStoreCoupons] failed to fetch store coupons', error)
        throw new Error(
            `Error occurred while trying to fetch store coupons: ${error instanceof Error ? error.message : String(error)}`
        )
    }
}

/**
 * @Function getCoupon
 * @Description Retrieves a coupon owned by the given store. Seller-only.
 * @PermissionLevel Seller (must own storeURL)
 * @Parameters
 *  - couponId: ID of the coupon to be retrieved.
 *  - storeURL: String representing the URL of the store, used to verify ownership.
 * @Return Coupon details if found and owned by the store, otherwise null.
 */

export const getCoupon = async (couponId: string, storeURL: string) => {
    // 認可 + 店舗所有権を集約検証 (IDOR 防御)。認可ガードは try/catch の外。
    const { store } = await requireStoreOwner(storeURL)

    try {
        // Ensure couponId is provided
        if (!couponId) throw new Error('Please provide coupon ID.')

        // Retrieve coupon from the database
        // findUnique は unique フィールドのみ where に取れるため、
        // storeId との複合スコープには findFirst を使う。
        const coupon = await db.coupon.findFirst({
            where: { id: couponId, storeId: store.id },
        })

        return coupon
    } catch (error: unknown) {
        logError('[Coupon:getCoupon] failed to fetch coupon', error)

        throw new Error(
            `Error occurred while trying to fetch coupon: ${error instanceof Error ? error.message : String(error)}`
        )
    }
}

/**
 * @Function getCouponAsAdmin
 * @Description Retrieves any coupon (incl. PLATFORM coupons with storeId = null). Admin-only.
 * @PermissionLevel Admin only
 * @Parameters
 *  - couponId: ID of the coupon to be retrieved.
 * @Return Coupon details if found, otherwise null.
 */

export const getCouponAsAdmin = async (couponId: string) => {
    // 認可ガードは try/catch の外。
    await requireAdmin()

    try {
        // Ensure couponId is provided
        if (!couponId) throw new Error('Please provide coupon ID.')

        // PLATFORM クーポン (storeId = null) を含む全クーポンが対象のため非スコープ
        const coupon = await db.coupon.findUnique({
            where: { id: couponId },
        })

        return coupon
    } catch (error: unknown) {
        logError('[Coupon:getCouponAsAdmin] failed to fetch coupon', error)

        throw new Error(
            `Error occurred while trying to fetch coupon: ${error instanceof Error ? error.message : String(error)}`
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
    // 認証 + SELLER + 店舗所有権を集約検証 (IDOR 防御)
    // 認可ガードは try/catch の外に置く（認可エラーを汎用 DB エラーで上書きしないため）
    const { store } = await requireStoreOwner(storeURL)

    try {
        // Ensure couponId is provided (storeURL は requireStoreOwner 側で検証)
        if (!couponId) throw new Error('Please provide coupon ID.')

        // Delete coupon from the database
        const response = await db.coupon.delete({
            where: {
                id: couponId,
                storeId: store.id,
            },
        })

        return response === null ? false : true // Return true if the coupon was deleted successfully, false otherwise.
    } catch (error: unknown) {
        logError('[Coupon:deleteCoupon] failed to delete coupon', error)

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
): Promise<{ message: string; cart: SerializedCartType }> => {
    const user = await requireUser()
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

        // Step 3: Fetch the cart and validate its existence（userId で所有権も確認）
        const cart = await db.cart.findFirst({
            where: {
                id: cartId,
                userId: user.id,
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

        const newTotal = cart.total.sub(discountedAmount)

        // Step 7: 競合を防ぐため couponId=null を条件に含めた条件付き更新（CAS）。
        // Step 4 のチェックと書き込みの間に別リクエストがクーポンを適用する TOCTOU を
        // DB レベルのアトミックな更新で排除する。
        const updated = await db.cart.updateMany({
            where: { id: cartId, userId: user.id, couponId: null },
            data: {
                couponId: coupon.id,
                total: newTotal,
            },
        })
        if (updated.count === 0) {
            // 並行リクエストが先にクーポンを適用済み
            throw new Error('Coupon is already applied to this cart.')
        }
        const updatedCart = await db.cart.findFirstOrThrow({
            where: { id: cartId, userId: user.id },
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

        const serializedCart = serializeCart(updatedCart)

        return {
            message: `Coupon applied successfully. Discount: -$${discountedAmount.toFixed(2)} applied to items from ${scopeLabel}`,
            cart: serializedCart,
        }
    } catch (error: unknown) {
        logError('[Coupon:applyCoupon] failed to apply coupon', error)
        throw new Error(
            `Error occurred while applying coupon: ${error instanceof Error ? error.message : String(error)}`
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

        // フォーム契約をサーバー側でも強制する (SECURITY-14)。superRefine が
        // STORE ⇒ storeId 必須 / PLATFORM ⇒ storeId 空 の不変条件も検証する。
        const parsed = AdminCouponFormSchema.safeParse(coupon)
        if (!parsed.success) {
            throw new Error('クーポンの入力値が不正です。')
        }

        const isPlatform = coupon.scope === 'PLATFORM'

        // safeParse 通過後の defense-in-depth として残置（通常は superRefine が先に検出）
        let normalizedStoreId: string | null
        if (isPlatform) {
            normalizedStoreId = null
        } else {
            const trimmed = coupon.storeId?.trim()
            if (!trimmed) throw new Error('Please provide a valid store ID.')
            normalizedStoreId = trimmed
        }

        // クライアント入力のスプレッドは行わず、検証済みフィールドを明示マッピングする
        const couponDetails = await db.coupon.upsert({
            where: { id: coupon.id },
            update: {
                code: parsed.data.code,
                startDate: parsed.data.startDate,
                endDate: parsed.data.endDate,
                discount: parsed.data.discount,
                isActive: parsed.data.isActive,
                scope: parsed.data.scope,
                storeId: normalizedStoreId,
            },
            create: {
                // id はフォーム側で常にクライアント生成される (data?.id ?? v4())
                id: coupon.id,
                code: parsed.data.code,
                startDate: parsed.data.startDate,
                endDate: parsed.data.endDate,
                discount: parsed.data.discount,
                isActive: parsed.data.isActive,
                scope: parsed.data.scope,
                storeId: normalizedStoreId,
            },
        })
        return couponDetails
    } catch (error: unknown) {
        // 入力検証・storeId 不正の意図的 throw は素通しする（ラップもログもしない）
        if (isDomainError(error)) throw error

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
