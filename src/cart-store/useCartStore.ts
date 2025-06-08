import { CartProductType } from '@/lib/types'
import { Action } from 'sonner'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Define the interface of the Cart state
interface State {
    cart: CartProductType[]
    totalItems: number
    totalPrice: number
}

// Define the interface of the actions that can be performed in the cart
interface Actions {
    addToCart: (Item: CartProductType) => void
    updateProductQuantity: (Item: CartProductType, quantity: number) => void // New product quantity update
    removeMultipleFromCart: (Items: CartProductType[]) => void // Multiple products removal
    removeFromCart: (Item: CartProductType) => void // Single product removal
    emptyCart: () => void // Empty the cart
}

// Initialize a default state
const INITIAL_STATE: State = {
    cart: [],
    totalItems: 0,
    totalPrice: 0,
}

// Create the store with Zustand, combining the status interface and actions
export const useCartStore = create(
    persist<State & Actions>(
        (set, get) => ({
            cart: INITIAL_STATE.cart,
            totalItems: INITIAL_STATE.totalItems,
            totalPrice: INITIAL_STATE.totalPrice,
            addToCart: (product: CartProductType) => {
                if (!product) return
                const cart = get().cart
                // If product already exists in cart
                const cartItem = cart.findIndex(
                    (item) =>
                        item.productId === product.productId &&
                        item.variantId === product.variantId &&
                        item.sizeId === product.sizeId
                )

                if (cartItem) {
                    const updatedCart = cart.map((item) =>
                        item.productId === product.productId &&
                        item.variantId === product.variantId &&
                        item.sizeId === product.sizeId
                            ? {
                                  ...item,
                                  quantity: item.quantity + product.quantity,
                              }
                            : item
                    )
                    set((state) => ({
                        cart: updatedCart,
                        totalPrice:
                            state.totalPrice + product.price * product.quantity,
                    }))
                } else {
                    const updatedCart = [...cart, { ...product }]
                    set((state) => ({
                        cart: updatedCart,
                        totalItems: state.totalItems + 1,
                        totalPrice:
                            state.totalPrice + product.price * product.quantity,
                    }))
                }
            },
            updateProductQuantity: () => {},
            removeMultipleFromCart: () => {},
            removeFromCart: () => {},
            emptyCart: () => {},
        }),
        { name: 'cart' }
    )
)
