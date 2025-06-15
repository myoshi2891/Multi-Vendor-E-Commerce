'use server'

import { db } from '@/lib/db'
import { CartProductType, Country } from '@/lib/types'
import { currentUser } from '@clerk/nextjs/server'
import { getCookie } from 'cookies-next'
import { cookies } from 'next/headers'
import { getShippingDetails } from './product'
import { ShippingAddress } from '@prisma/client'

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
                    freeShipping: {
                        include: {
                            eligibleCountries: true,
                        },
                    },
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

            // Calculate shipping details
            const countryCookie = getCookie('userCountry', { cookies })

            let details = {
                shippingFee: 0,
                extraShippingFee: 0,
                isFreeShipping: false,
            }

            if (countryCookie) {
                const country = JSON.parse(countryCookie)
                const temp_details = await getShippingDetails(
                    product.shippingFeeMethod,
                    country,
                    product.store,
                    product.freeShipping
                )
                if (typeof temp_details !== 'boolean') {
                    details = temp_details
                }
            }

            let shippingFee = 0
            const { shippingFeeMethod } = product

            if (shippingFeeMethod === 'ITEM') {
                shippingFee =
                    quantity === 1
                        ? details.shippingFee
                        : details.shippingFee +
                          details.extraShippingFee * (quantity - 1)
            } else if (shippingFeeMethod === 'WEIGHT') {
                shippingFee = details.shippingFee * variant.weight * quantity
            } else if (shippingFeeMethod === 'FIXED') {
                shippingFee = details.shippingFee
            }

            const totalPrice = price * validQuantity + shippingFee

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
                shippingFee,
                totalPrice,
            }
        })
    )

    // Recalculate the cart's total price and shipping fees
    const subTotal = validatedCartItems.reduce(
        (acc, item) => acc + item.price * item.quantity,
        0
    )

    const shippingFee = validatedCartItems.reduce(
        (acc, item) => acc + item.shippingFee,
        0
    )

    const total = subTotal + shippingFee

    // Save the validated items to the cart in the database
    const cart = await db.cart.create({
        data: {
            cartItems: {
                create: validatedCartItems.map((item) => ({
                    productId: item.productId,
                    variantId: item.variantId,
                    sizeId: item.sizeId,
                    storeId: item.storeId,
                    sku: item.sku,
                    productSlug: item.productSlug,
                    variantSlug: item.variantSlug,
                    name: item.name,
                    image: item.image,
                    quantity: item.quantity,
                    size: item.size,
                    price: item.price,
                    shippingFee: item.shippingFee,
                    totalPrice: item.totalPrice,
                })),
            },
            shippingFees: shippingFee,
            subTotal,
            total,
            userId,
        },
    })

    if (cart) return true
    return false
}

/**
 * @Function getUserShippingAddresses
 * @Description Retrieves all shipping addresses from a specific user.
 * @PermissionLevel User who owns the addresses
 * @Parameters None
 * @Returns List of shipping addresses associated with the user.
 */

export const getUserShippingAddresses = async () => {
    try {
        // Get current user
        const user = await currentUser()

        // Ensure user is authenticated
        if (!user) throw new Error('Unauthenticated.')

        // Fetch shipping addresses from the database
        const shippingAddresses = await db.shippingAddress.findMany({
            where: {
                userId: user.id,
            },
            include: {
                user: true,
                country: true,
            },
        })

        return shippingAddresses
    } catch (error) {
        console.error('Error fetching shipping addresses:', error)
        throw error
    }
}

/**
 * @Function upsertShippingAddress
 * @Description Upserts a shipping address for a specific user.
 * @PermissionLevel User who owns the addresses
 * @Parameters - address: ShippingAddress object containing details of the shipping address to be upserted.
 * @Returns Updated or newly created shipping address details.
 */

export const upsertShippingAddress = async (address: ShippingAddress) => {
    try {
        // Get current user
        const user = await currentUser()

        // Ensure user is authenticated
        if (!user) throw new Error('Unauthenticated.')

        // Ensure address data is provide
        if (!address) throw new Error('Please provide shipping address data.')

        // Handle making the rest of address default false when we are adding a new default
        if (address.default) {
            const addressDB = await db.shippingAddress.findUnique({
                where: {
                    id: address.id,
                },
            })
            if (addressDB) {
                try {
                    await db.shippingAddress.updateMany({
                        where: {
                            userId: user.id,
                            default: true,
                        },
                        data: {
                            default: false,
                        },
                    })
                } catch (error) {
                    console.error('Error updating default addresses:', error)
                    throw new Error('Error making the default address.')
                }
            }
        }

        // Upsert shipping addresses into the database
        const upsertedAddresses = await db.shippingAddress.upsert({
            where: {
                id: address.id,
            },
            update: {
                ...address,
                userId: user.id,
            },
            create: {
                ...address,
                userId: user.id,
            },
        })

        return upsertedAddresses
    } catch (error) {
        console.error('Error upserting shipping addresses:', error)
        throw error
    }
}

/**
 * @Function placeOrder
 * @Description
 * @PermissionLevel
 * @Parameters
 * @Returns
 */

export const placeOrder = async (
    shippingAddress: ShippingAddress,
    cartId: string
) => {
    // Ensure the user is authenticated
    const user = await currentUser()
    if (!user) throw new Error('Unauthenticated.')

    const userId = user.id

    // Fetch user's cart will all items
    const cart = await db.cart.findUnique({
        where: { id: cartId },
        include: {
            cartItems: true,
        },
    })

    if (!cart) throw new Error('Cart not found.')

    const cartItems = cart.cartItems

    // Fetch product, variant, and size data from the database for validation
    const validatedCartItems = await Promise.all(
        cartItems.map(async (cartProduct) => {
            const { productId, variantId, sizeId, quantity } = cartProduct

            // Fetch the product, variant, and size from the database
            const product = await db.product.findUnique({
                where: {
                    id: productId,
                },
                include: {
                    store: true,
                    freeShipping: {
                        include: {
                            eligibleCountries: true,
                        },
                    },
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

            // Calculate shipping details
            const countryId = shippingAddress.countryId

            const temp_country = await db.country.findUnique({
                where: {
                    id: countryId,
                },
            })

            if (!temp_country) {
                throw new Error(`Failed to get Shipping details for order.`)
            }

            const country = {
                name: temp_country.name,
                code: temp_country.code,
                city: '',
                region: '',
            }

            let details = {
                shippingFee: 0,
                extraShippingFee: 0,
                isFreeShipping: false,
            }

            if (country) {
                const temp_details = await getShippingDetails(
                    product.shippingFeeMethod,
                    country,
                    product.store,
                    product.freeShipping
                )
                if (typeof temp_details !== 'boolean') {
                    details = temp_details
                }
            }

            let shippingFee = 0
            const { shippingFeeMethod } = product

            if (shippingFeeMethod === 'ITEM') {
                shippingFee =
                    quantity === 1
                        ? details.shippingFee
                        : details.shippingFee +
                          details.extraShippingFee * (quantity - 1)
            } else if (shippingFeeMethod === 'WEIGHT') {
                shippingFee = details.shippingFee * variant.weight * quantity
            } else if (shippingFeeMethod === 'FIXED') {
                shippingFee = details.shippingFee
            }

            const totalPrice = price * validQuantity + shippingFee

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
                shippingFee,
                totalPrice,
            }
        })
    )

    // console.log('validatedCartItems', validatedCartItems)
}