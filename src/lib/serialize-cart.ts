import { Prisma } from '@prisma/client'
import { SerializedCartType } from '@/lib/types'

type CartWithRelations = Prisma.CartGetPayload<{
    include: { cartItems: true; coupon: { include: { store: true } } }
}>

/**
 * Converts all monetary fields in a cart from Decimal to number.
 *
 * @returns A cart object with all monetary fields converted to JavaScript numbers.
 */
export function serializeCart(cart: CartWithRelations): SerializedCartType {
    return {
        ...cart,
        subTotal: cart.subTotal.toNumber(),
        shippingFees: cart.shippingFees.toNumber(),
        total: cart.total.toNumber(),
        cartItems: cart.cartItems.map((item) => ({
            ...item,
            price: item.price.toNumber(),
            shippingFee: item.shippingFee.toNumber(),
            totalPrice: item.totalPrice.toNumber(),
        })),
        coupon: cart.coupon
            ? {
                  ...cart.coupon,
                  store: cart.coupon.store
                      ? {
                            ...cart.coupon.store,
                            defaultShippingFeePerItem:
                                cart.coupon.store.defaultShippingFeePerItem.toNumber(),
                            defaultShippingFeeForAdditionalItem:
                                cart.coupon.store.defaultShippingFeeForAdditionalItem.toNumber(),
                            defaultShippingFeePerKg:
                                cart.coupon.store.defaultShippingFeePerKg.toNumber(),
                            defaultShippingFeeFixed:
                                cart.coupon.store.defaultShippingFeeFixed.toNumber(),
                        }
                      : null,
              }
            : null,
    }
}
