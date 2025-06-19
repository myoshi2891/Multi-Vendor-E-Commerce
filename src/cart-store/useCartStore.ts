import { CartProductType } from '@/lib/types'
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
    setCart: (newCart: CartProductType[]) => void // Added setCart method
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
                // const cartItem = cart.findIndex(
                //     (item) =>
                //         item.productId === product.productId &&
                //         item.variantId === product.variantId &&
                //         item.sizeId === product.sizeId
                // )

                // if (cartItem) {
                //     const updatedCart = cart.map((item) =>
                //         item.productId === product.productId &&
                //         item.variantId === product.variantId &&
                //         item.sizeId === product.sizeId
                //             ? {
                //                   ...item,
                //                   quantity: item.quantity + product.quantity,
                //               }
                //             : item
                //     )
                //     set((state) => ({
                //         cart: updatedCart,
                //         totalPrice:
                //             state.totalPrice + product.price * product.quantity,
                //     }))
                // } else {
                //     const updatedCart = [...cart, { ...product }]
                //     set((state) => ({
                //         cart: updatedCart,
                //         totalItems: state.totalItems + 1,
                //         totalPrice:
                //             state.totalPrice + product.price * product.quantity,
                //     }))
                // }
                const cartItemIndex = cart.findIndex(
                    (item) =>
                        item.productId === product.productId &&
                        item.variantId === product.variantId &&
                        item.sizeId === product.sizeId
                )

                const stock = product.stock

                if (cartItemIndex !== -1) {
                    const currentQty = cart[cartItemIndex].quantity
                    const newQty = Math.min(
                        currentQty + product.quantity,
                        stock
                    )
                    const addedQty = newQty - currentQty

                    if (addedQty <= 0) return // もうこれ以上追加できない

                    // update existing
                    const updatedCart = cart.map((item, index) =>
                        index === cartItemIndex
                            ? {
                                  ...item,
                                  quantity: newQty,
                              }
                            : item
                    )
                    set((state) => ({
                        cart: updatedCart,
                        totalPrice: state.totalPrice + product.price * addedQty,
                    }))
                } else {
                    // add new
                    const validQty = Math.min(product.quantity, stock)
                    if (validQty <= 0) return // ストックが0のため追加不可

                    const updatedCart = [
                        ...cart,
                        { ...product, quantity: validQty },
                    ]
                    set((state) => ({
                        cart: updatedCart,
                        totalItems: state.totalItems + 1,
                        totalPrice: state.totalPrice + product.price * validQty,
                    }))
                }
            },
            updateProductQuantity: (
                product: CartProductType,
                quantity: number
            ) => {
                const cart = get().cart
                const maxQty = product.stock
                const validQty = Math.min(quantity, maxQty)

                if (validQty <= 0) {
                    get().removeFromCart(product)
                    return
                }

                const updatedCart = cart.map((item) =>
                    item.productId === product.productId &&
                    item.variantId === product.variantId &&
                    item.sizeId === product.sizeId
                        ? { ...item, quantity: validQty }
                        : item
                )

                const totalItems = updatedCart.length
                const totalPrice = updatedCart.reduce(
                    (sum, item) => sum + item.price * item.quantity,
                    0
                )
                set(() => ({
                    cart: updatedCart,
                    totalItems,
                    totalPrice,
                }))
            },

            // updateProductQuantity: (
            //     product: CartProductType,
            //     quantity: number
            // ) => {
            //     const cart = get().cart

            //     // If quantity is 0 or less, remove the item
            //     if (quantity <= 0) {
            //         get().removeFromCart(product)
            //         return
            //     }

            //     const updatedCart = cart.map((item) =>
            //         item.productId === product.productId &&
            //         item.variantId === product.variantId &&
            //         item.sizeId === product.sizeId
            //             ? { ...item, quantity }
            //             : item
            //     )

            //     const totalItems = updatedCart.length
            //     const totalPrice = updatedCart.reduce(
            //         (sum, item) => sum + item.price * item.quantity,
            //         0
            //     )
            //     set(() => ({
            //         cart: updatedCart,
            //         totalItems,
            //         totalPrice,
            //     }))
            // },
            removeFromCart: (product: CartProductType) => {
                const cart = get().cart
                const updatedCart = cart.filter(
                    (item) =>
                        !(
                            item.productId === product.productId &&
                            item.variantId === product.variantId &&
                            item.sizeId === product.sizeId
                        )
                )
                const totalItems = updatedCart.length
                const totalPrice = updatedCart.reduce(
                    (sum, item) => sum + item.price * item.quantity,
                    0
                )
                set(() => ({
                    cart: updatedCart,
                    totalItems,
                    totalPrice,
                }))

                // Manually sync with localStorage after removal
                localStorage.setItem('cart', JSON.stringify(updatedCart))
            },
            removeMultipleFromCart: (products: CartProductType[]) => {
                const cart = get().cart
                const updatedCart = cart.filter(
                    (item) =>
                        !products.some(
                            (product) =>
                                product.productId === item.productId &&
                                product.variantId === item.variantId &&
                                product.sizeId === item.sizeId
                        )
                )
                const totalItems = updatedCart.length
                const totalPrice = updatedCart.reduce(
                    (sum, item) => sum + item.price * item.quantity,
                    0
                )
                set(() => ({
                    cart: updatedCart,
                    totalItems,
                    totalPrice,
                }))

                // Manually sync with localStorage after removal
                localStorage.setItem('cart', JSON.stringify(updatedCart))
            },
            emptyCart: () => {
                set(() => ({
                    cart: [],
                    totalItems: 0,
                    totalPrice: 0,
                }))
                // Explicitly clear the cart localStorage as well
                localStorage.removeItem('cart')
            },
            setCart: (newCart: CartProductType[]) => {
                const totalItems = newCart.length
                const totalPrice = newCart.reduce(
                    (sum, item) => sum + item.price * item.quantity,
                    0
                )
                set(() => ({
                    cart: newCart,
                    totalItems,
                    totalPrice,
                }))
            },
        }),

        { name: 'cart' }
    )
)
