import { Prisma } from '@prisma/client'
import { CartWithCartItemsType } from '@/lib/types'

type CartWithRelations = Prisma.CartGetPayload<{
    include: { cartItems: true; coupon: { include: { store: true } } }
}>

/**
 * Server → Client のRSCシリアライズで Prisma.Decimal インスタンスが
 * プレーンオブジェクトに化けてメソッドを失うため、number に変換してから返す。
 */
export function serializeCart(cart: CartWithRelations): CartWithCartItemsType {
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
    } as unknown as CartWithCartItemsType
}
