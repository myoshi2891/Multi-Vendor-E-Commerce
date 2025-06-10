'use server'

import { db } from '@/lib/db'
import { CartProductType } from '@/lib/types'
import { currentUser } from '@clerk/nextjs/server'

/**
 * @name followStore
 * @description - Toggle follow status for a store by the current user.1
 *              - If the user is already following the store, unfollow it.
 *              - If the user is not following the store, follow it.
 * @access User
 * @param storeId - The ID of the store to be followed or unfollowed.
 * @returns {boolean} - Returns true if the follow status was updated successfully, false otherwise.
 */
export const followStore = async (storeId: string): Promise<boolean> => {
    try {
        // Get the current authenticated user
        const user = await currentUser()

        // Ensure user is authenticated
        if (!user) throw new Error('Unauthenticated.')

        // Check if the store exists
        const store = await db.store.findUnique({ where: { id: storeId } })
        if (!store) throw new Error('Store not found.') // Store does not exist, cannot follow or unfollow

        // Check if the user exists
        const userData = await db.user.findUnique({ where: { id: user.id } })
        if (!userData) throw new Error('User not found.') // User does not exist, cannot follow or unfollow

        // Check if the user is already following the store
        const userFollowingStore = await db.user.findFirst({
            where: {
                id: user.id,
                following: {
                    some: {
                        id: storeId,
                    },
                },
            },
        })

        if (userFollowingStore) {
            // Unfollow the store and return false
            await db.store.update({
                where: {
                    id: storeId,
                },
                data: {
                    followers: {
                        disconnect: { id: userData.id },
                    },
                },
            })
            return false
        } else {
            // Follow the store and return true
            await db.store.update({
                where: {
                    id: storeId,
                },
                data: {
                    followers: {
                        connect: { id: userData.id },
                    },
                },
            })
            return true // Follow status updated successfully
        }
    } catch (error) {
        console.error('Error following store', error)
        throw new Error('Error following store')
    }
}

/**
 * @Function saveUserCart
 * @Description Saves the user's cart by validating product data from the database and ensuring no frontend manipulation.
 * @PermissionLevel User who owns the cart
 * @Parameters
 * - cartProducts: An array of product objects from the frontend cart.
 * @Returns {boolean}
 * - An object containing the updated cart with recalculated total price and validated product data.
 */

export const saveUserCart = async (
    cartProducts: CartProductType[]
): Promise<boolean> => {
    // Get current user
    const user = await currentUser()

    // Ensure user is authenticated
    if (!user) throw new Error('Unauthenticated.')

    const userId = user.id

    // Search for existing user cart
    const userCart = await db.cart.findFirst({
        where: {
            userId,
        },
    })

    // Delete any existing user cart
    if (userCart) {
        await db.cart.delete({
            where: {
                userId,
            },
        })
    }

    // Fetch product, variant, and size data from the database for validation
    const validatedCartItems = await Promise.all(
        cartProducts.map(async (cartProduct) => {
            const { productId, variantId, sizeId, quantity } = cartProduct

            // Fetch the product, variant, and size from the database
            const product = await db.product.findUnique({
                where: {
                    id: productId,
                },
                include: {
                    store: true,
                    variants: {
                        where: {
                            id: variantId,
                        },
                        include: {
                            sizes: {
                                where: {
                                    id: sizeId,
                                },
                            },
                            images: true,
                        },
                    },
                },
            })

            if (
                !product ||
                product.variants.length === 0 ||
                product.variants[0].sizes.length === 0
            ) {
                throw new Error(
                    `Invalid product, variant, or size combination for productId ${productId}, variantId ${variantId}, sizeId ${sizeId}`
                )
            }

            const variant = product.variants[0]
            const size = variant.sizes[0]

            // Validate stock and price
            const validQuantity = Math.min(quantity, size.quantity)
            const price = size.discount
                ? size.price - size.price * (size.discount / 100)
                : size.price

            return {
                productId,
                variantId,
                productSlug: product.slug,
                variantSlug: variant.slug,
                sizeId,
                storeId: product.storeId,
                sku: variant.sku,
                name: `${product.name} ・ ${variant.variantName}`,
                image: variant.images[0].url,
                size: size.size,
                quantity: validQuantity,
                price,
                shippingFee: 0,
                totalPrice: 0,
            }
        })
    )
}
