'use server'

import { db } from '@/lib/db'
import { CartItem, Country as CountryDB } from '@prisma/client'
import { CartProductType, CartWithCartItemsType, Country } from '@/lib/types'
import { currentUser } from '@clerk/nextjs/server'
import { getCookie } from 'cookies-next'
import { cookies } from 'next/headers'
import {
    getDeliveryDetailsForStoreByCountry,
    getShippingDetails,
} from './product'
import { ShippingAddress } from '@prisma/client'
import { Delete } from 'lucide-react'

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
 * @Description Places orders for a specific user.
 * @PermissionLevel User who owns the addresses
 * @Parameters - shippingAddress: ShippingAddress object containing details of the shipping address for the order.
 *  - cartId: ID of the cart to place the order for.
 * @Return Updated or newly created order details.
 */

export const placeOrder = async (
    shippingAddress: ShippingAddress,
    cartId: string
): Promise<{ orderId: string }> => {
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

    // Define the type for grouped items by store
    type GroupedItems = { [storeId: string]: typeof validatedCartItems }

    // Group validated items by store
    const groupedItems = validatedCartItems.reduce<GroupedItems>(
        (acc, item) => {
            if (!acc[item.storeId]) acc[item.storeId] = []
            acc[item.storeId].push(item)
            return acc
        },
        {} as GroupedItems
    )

    // console.log('groupedItems', groupedItems)

    // Create the order
    const order = await db.order.create({
        data: {
            userId,
            shippingAddressId: shippingAddress.id,
            orderStatus: 'Pending',
            paymentStatus: 'Pending',
            shippingFees: 0, // Will calculate below
            subTotal: 0, // Will calculate below
            total: 0, // Will calculate below
        },
    })

    // Iterate over each store's items and create OrderGroup and OrderItems
    let orderTotalPrice = 0
    let orderShippingFee = 0

    for (const [storeId, items] of Object.entries(groupedItems)) {
        // Calculate store-specific totals
        const groupedTotalPrice = items.reduce(
            (acc, item) => acc + item.totalPrice,
            0
        )

        const groupShippingFee = items.reduce(
            (acc, item) => acc + item.shippingFee,
            0
        )

        const { shippingService, deliveryTimeMax, deliveryTimeMin } =
            await getDeliveryDetailsForStoreByCountry(
                storeId,
                shippingAddress.countryId
            )
        // Create an OrderGroup for this store
        const orderGroup = await db.orderGroup.create({
            data: {
                orderId: order.id,
                storeId,
                status: 'Pending',
                subtotal: groupedTotalPrice - groupShippingFee,
                shippingFees: groupShippingFee,
                total: groupedTotalPrice,
                shippingService: shippingService || 'International Delivery',
                shippingDeliveryMin: deliveryTimeMin || 7,
                shippingDeliveryMax: deliveryTimeMax || 30,
            },
        })

        // Create OrderItems for this OrderGroup
        for (const item of items) {
            await db.orderItem.create({
                data: {
                    orderGroupId: orderGroup.id,
                    productId: item.productId,
                    variantId: item.variantId,
                    sizeId: item.sizeId,
                    productSlug: item.productSlug,
                    variantSlug: item.variantSlug,
                    sku: item.sku,
                    name: item.name,
                    image: item.image,
                    size: item.size,
                    quantity: item.quantity,
                    price: item.quantity,
                    shippingFee: item.shippingFee,
                    totalPrice: item.totalPrice,
                },
            })
        }

        // Update order totals
        orderTotalPrice += groupedTotalPrice
        orderShippingFee += groupShippingFee
    }

    // Update the main order with the final totals
    await db.order.update({
        where: {
            id: order.id,
        },
        data: {
            subTotal: orderTotalPrice - orderShippingFee,
            shippingFees: orderShippingFee,
            total: orderTotalPrice,
        },
    })

    // Delete the cart
    // await db.cart.delete({
    //     where: {
    //         id: cartId,
    //     },
    // })

    return { orderId: order.id }
}

export const emptyUserCart = async () => {
    try {
        // Ensure the user is authenticated
        const user = await currentUser()
        if (!user) throw new Error('Unauthenticated.')

        const userId = user.id

        const res = await db.cart.delete({
            where: {
                userId,
            },
        })

        if (res) return true
    } catch (error) {
        console.error(error)
        throw error
    }
}

/**
 * @Function updateCartWithLatest
 * @Description Updates the cart with the latest product, variant, and size data
 * @PermissionLevel Authenticated
 * @Parameters  cartProducts: CartProductType[]
 *  - productId: The ID of the product to update the cart with.
 * @returns CartProductType[]
 */
export const updateCartWithLatest = async (
    cartProducts: CartProductType[]
): Promise<CartProductType[]> => {
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
                // return cartProduct
                throw new Error(
                    `Product not found or variant or size not found.`
                )
            }
            const variant = product.variants[0]
            const size = variant.sizes[0]

            // Calculate Shipping details
            const countryCookie = getCookie('userCountry', { cookies })

            let details = {
                shippingService: product.store.defaultShippingService,
                shippingFee: 0,
                extraShippingFee: 0,
                isFreeShipping: false,
                deliveryTimeMin: 0,
                deliveryTimeMax: 0,
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

            const price = size.discount
                ? size.price - (size.price * size.discount) / 100
                : size.price

            const validated_qty = Math.min(quantity, size.quantity)

            return {
                productId,
                variantId,
                productSlug: product.slug,
                variantSlug: variant.slug,
                sizeId,
                sku: variant.sku,
                name: product.name,
                variantName: variant.variantName,
                image: variant.images[0].url,
                variantImage: variant.variantImage,
                stock: size.quantity,
                weight: variant.weight,
                shippingMethod: product.shippingFeeMethod,
                size: size.size,
                quantity: validated_qty,
                price,
                shippingService: details.shippingService,
                shippingFee: details.shippingFee,
                extraShippingFee: details.extraShippingFee,
                deliveryTimeMin: details.deliveryTimeMin,
                deliveryTimeMax: details.deliveryTimeMax,
                isFreeShipping: details.isFreeShipping,
            }
        })
    )
    return validatedCartItems
}

/**
 * Add a product to the user's wishlist.
 * @param productId - The ID of the product to add to the wishlist.
 * @param variantId - The ID of the variant of the product.
 * @param sizeId - Optional size ID if applicable.
 * @returns The created wishlist item.
 */
export const addToWishlist = async (
    productId: string,
    variantId: string,
    sizeId?: string
) => {
    try {
        // Ensure the user is authenticated
        const user = await currentUser()
        if (!user) throw new Error('Unauthenticated.')

        const userId = user.id
        // Create the wishlist item
        const existingWishlistItem = await db.wishlist.findFirst({
            where: {
                userId,
                productId,
                variantId,
            },
        })

        if (existingWishlistItem) {
            throw new Error('Product is already in the wishlist.')
        }

        return await db.wishlist.create({
            data: {
                userId,
                productId,
                variantId,
                sizeId,
            },
        })
    } catch (error) {
        console.error(error)
        throw error
    }
}

/**
 * @Function updateCheckoutProductWithLatest
 * @Description Keeps the cart in sync with the latest info (price, quantity, shipping fee, etc.)
 * @PermissionLevel Authenticated
 * @Parameters
 *  - cartProducts: An array of product objects from the frontend cart
 *  - address: Country
 * @Return
 *  - An object containing the updated cart with recalculated total price and validated product data
 */

export const updateCheckoutProductWithLatest = async (
    cartProducts: CartItem[],
    address: CountryDB | undefined
): Promise<CartWithCartItemsType[]> => {
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
                // return cartProduct
                throw new Error(
                    `Product not found or variant or size not found.`
                )
            }

            const variant = product.variants[0]
            const size = variant.sizes[0]

            // Calculate Shipping details
            const countryCookie = getCookie('userCountry', { cookies })

            const country = address
                ? address
                : countryCookie
                  ? JSON.parse(countryCookie)
                  : null

            if (!country) {
                throw new Error("Couldn't retrieve country data.")
            }

            let shippingFee = 0

            const { shippingFeeMethod, freeShipping, store } = product

            const price = size.discount
                ? size.price - (size.price * size.discount) / 100
                : size.price

            const validated_qty = Math.min(quantity, size.quantity)

            const totalPrice = price * validated_qty + shippingFee

            try {
                const newCartItem = await db.cartItem.update({
                    where: {
                        id: cartProduct.id,
                    },
                    data: {
                        name: `${product.name} ・ ${variant.variantName}`,
                        image: variant.images[0].url,
                        price,
                        quantity: validated_qty,
                        shippingFee,
                        totalPrice,
                    },
                })
                return newCartItem
            } catch (error) {
                return cartProduct
            }
        })
    )
    return validatedCartItems
}
