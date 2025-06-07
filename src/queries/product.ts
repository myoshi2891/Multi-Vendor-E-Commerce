'use server'
// DB
import { db } from '@/lib/db'
// Types
import {
    FreeShippingWithCountriesType,
    ProductPageType,
    ProductShippingDetailsType,
    ProductWithVariantType,
    RatingStatisticsType,
    SortOrder,
    VariantImageType,
    VariantSimplified,
} from '@/lib/types'

// Clerk
import { currentUser } from '@clerk/nextjs/server'

// Slugify
import slugify from 'slugify'
import { generateUniqueSlug } from '@/lib/utils'

// Cookies
import { getCookie } from 'cookies-next'
import { cookies } from 'next/headers'

// Prisma
import { FreeShipping, Store } from '@prisma/client'
import { sub } from 'date-fns'

// Function: upsertProduct
// Description: Upserts a Product into the database, updating if it exists or creating a new one if not.
// Permission Level: Seller only
// Parameters:
//   - Product: ProductWithVariant object containing details of the product and  the product to be upserted.
//   - storeUrl: URL of the store to which the product belongs.
// Returns: Updated or newly created Product with variant details.

export const upsertProduct = async (
    product: ProductWithVariantType,
    storeUrl: string
) => {
    try {
        // Retrieve current user
        const user = await currentUser()
        // Check if user is authenticated
        if (!user) throw new Error('Unauthenticated.')
        // Ensure user has seller privileges
        if (user.privateMetadata.role !== 'SELLER')
            throw new Error('Only sellers can perform this action.')
        // Ensure product data is provided
        if (!product) throw new Error('Please provide product data.')
        // Find the store by URL
        const store = await db.store.findUnique({
            where: { url: storeUrl, userId: user.id },
        })
        if (!store) throw new Error(`Store with URL "${storeUrl}" not found.`)

        // Check if the product already exist
        const existingProduct = await db.product.findUnique({
            where: { id: product.productId },
        })

        // Check if the variant already exist
        const existingVariant = await db.productVariant.findUnique({
            where: { id: product.variantId },
        })

        if (existingProduct) {
            if (existingVariant) {
                // Update existing variant and product
            } else {
                // Create new variant
            }
        } else {
            // Create new product and variant
            await handleProductCreate(product, store.id)
        }
    } catch (error) {
        console.log(error)
        throw error
    }
}

const handleProductCreate = async (
    product: ProductWithVariantType,
    storeId: string
) => {
    // Generate unique slugs for product and variant
    const productSlug = await generateUniqueSlug(
        slugify(product.name, {
            replacement: '-',
            lower: true,
            trim: true,
        }),
        'product'
    )

    const variantSlug = await generateUniqueSlug(
        slugify(product.variantName, {
            replacement: '-',
            lower: true,
            trim: true,
        }),
        'productVariant'
    )

    const productData = {
        id: product.productId,
        name: product.name,
        description: product.description,
        slug: productSlug,
        store: { connect: { id: storeId } },
        category: { connect: { id: product.categoryId } },
        subCategory: { connect: { id: product.subCategoryId } },
        offerTag: product.offerTagId
            ? { connect: { id: product.offerTagId } }
            : undefined,
        brand: product.brand,
        specs: {
            create: product.product_specs.map((spec) => ({
                name: spec.name,
                value: spec.value,
            })),
        },
        questions: {
            create: product.questions.map((q) => ({
                question: q.question,
                answer: q.answer,
            })),
        },
        variants: {
            create: [
                {
                    id: product.variantId,
                    variantName: product.variantName,
                    variantDescription: product.variantDescription,
                    slug: variantSlug,
                    variantImage: product.variantImage,
                    sku: product.sku,
                    weight: product.weight,
                    keywords: product.keywords.join(','),
                    isSale: product.isSale,
                    saleEndDate: product.saleEndDate,
                    images: {
                        create: product.images.map((image) => ({
                            url: image.url,
                        })),
                    },
                    colors: {
                        create: product.colors.map((color) => ({
                            name: color.color,
                        })),
                    },
                    sizes: {
                        create: product.sizes.map((size) => ({
                            size: size.size,
                            quantity: size.quantity,
                            price: size.price,
                            discount: size.discount,
                        })),
                    },
                    specs: {
                        create: product.variant_specs.map((spec) => ({
                            name: spec.name,
                            value: spec.value,
                        })),
                    },
                    createdAt: product.createdAt,
                    updatedAt: product.updatedAt,
                },
            ],
        },
        shippingFeeMethod: product.shippingFeeMethod,
        freeShippingForAllCountries: product.freeShippingForAllCountries,
        freeShipping: product.freeShippingForAllCountries
            ? undefined
            : product.freeShippingCountriesIds &&
                product.freeShippingCountriesIds.length > 0
              ? {
                    create: {
                        eligibleCountries: {
                            create: product.freeShippingCountriesIds.map(
                                (country) => ({
                                    country: { connect: { id: country.value } },
                                })
                            ),
                        },
                    },
                }
              : undefined,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
    }

    const new_product = await db.product.create({ data: productData })
    return new_product
}

// Function: getProductMainInfo
// Description: Retrieves product main information (including product and variant details)
// Access Level: Public
// Parameters:
// - productId: ID of the product to retrieve.
// Returns: Product main information (including product and variant details) or null if the product is not  found.

export const getProductMainInfo = async (productId: string) => {
    // Retrieve product and variant details
    const product = await db.product.findUnique({
        where: { id: productId },
    })
    if (!product) return null

    // Return the main information of the product
    return {
        productId: product.id,
        name: product.name,
        description: product.description,
        brand: product.brand,
        categoryId: product.categoryId,
        subCategoryId: product.subCategoryId,
        storeId: product.storeId,
    }
}

// Function: getAllStoreProducts
// Description: Retrieves all products associated with a specific store based on the store URL
// Access Level: Public
// Parameters:
// - storeUrl: URL of the store to retrieve products from.
// Returns: Array of products associated with the store, including category, subcategory, and variant details or an empty array if no products are found.

export const getAllStoreProducts = async (storeUrl: string) => {
    // Retrieve store details from the database using the store URL
    const store = await db.store.findUnique({
        where: { url: storeUrl },
    })

    if (!store) throw new Error(`Store with URL "${storeUrl}" not found.`)

    // Retrieve products associated with the store using the store ID
    const products = await db.product.findMany({
        where: {
            storeId: store.id,
        },
        include: {
            category: true,
            subCategory: true,
            variants: {
                include: {
                    images: true,
                    colors: true,
                    sizes: true,
                },
            },
            store: {
                select: {
                    id: true,
                    url: true,
                },
            },
        },
    })
    return products
}

// Function: deleteProduct
// Description: Deletes a product and its associated variants from the database
// Access Level: Seller only
// Parameters:
// - productId: ID of the product to be deleted.
// Returns: True if the product and its variants are successfully deleted, false otherwise.

export const deleteProduct = async (productId: string) => {
    try {
        // Retrieve current user
        const user = await currentUser()
        // Check if user is authenticated
        if (!user) throw new Error('Unauthenticated.')
        // Ensure user has seller privileges
        if (user.privateMetadata.role !== 'SELLER')
            throw new Error(
                'Only sellers and administrators can perform this action.'
            )
        // Ensure product data is provided
        if (!productId) throw new Error('Please provide product ID.')

        // Delete the product and its variants
        const response = await db.product.delete({
            where: { id: productId },
        })
        return response
    } catch (error) {
        console.log(error)
        throw error
    }
}

// Function: getProducts
// Description: Retrieves filtered products based on specified criteria. Supports pagination.
// Access Level: Public
// Parameters:
// - filters: Object containing filter criteria (e.g., category, subCategory, offerTag, minPrice, maxPrice, keywords).
// - sortBy: Sorting criteria (e.g., Most popular, New Arrival, Top Rated...).
// - page: Page number for pagination. (default = 1)
// - pageSize: Number of products per page. (default = 10)
// Returns: Array of filtered products, including category, subcategory, variants, and pagination metadata (totalPages, currentPage, pageSize, totalCount).

export const getProducts = async (
    filters: any = {},
    sortBy = '',
    page: number = 1,
    pageSize: number = 10
) => {
    // Default values for page and pageSize
    const currentPage = page
    const limit = pageSize
    const skip = (currentPage - 1) * limit

    // Construct the base query
    const whereClause: any = {
        AND: [],
    }

    // Apply store filter (using store URL)
    if (filters.store) {
        const store = await db.store.findUnique({
            where: {
                url: filters.store,
            },
            select: { id: true },
        })
        if (store) {
            whereClause.AND.push({ storeId: store.id })
        }
    }

    // Apply category filter (using category URL)
    if (filters.category) {
        const category = await db.category.findUnique({
            where: {
                url: filters.category,
            },
            select: { id: true },
        })
        if (category) {
            whereClause.AND.push({ categoryId: category.id })
        }
    }

    // Apply suCategory filter (using subCategory URL)
    if (filters.subCategory) {
        const subCategory = await db.subCategory.findUnique({
            where: {
                url: filters.subCategory,
            },
            select: { id: true },
        })
        if (subCategory) {
            whereClause.AND.push({ subCategoryId: subCategory.id })
        }
    }

    // Get all filtered, sorted products
    const products = await db.product.findMany({
        where: whereClause,
        take: limit, // Limit to page size
        skip: skip, // Skip the products of previous pages
        include: {
            variants: {
                include: {
                    sizes: true,
                    images: true,
                    colors: true,
                },
            },
        },
    })

    // Transform the products with filtered variants into ProductCardType structure
    const productsWithFilteredVariants = products.map((product) => {
        // Filter the variants based on the filters
        const filteredVariants = product.variants

        // Transform the filtered variants into the VariantSimplified structure
        const variants: VariantSimplified[] = filteredVariants.map(
            (variant) => ({
                variantId: variant.id,
                variantSlug: variant.slug,
                variantName: variant.variantName,
                images: variant.images,
                sizes: variant.sizes,
            })
        )

        // Extract variant images for the product
        const variantImages: VariantImageType[] = filteredVariants.map(
            (variant) => ({
                url: `/product/${product.slug}/${variant.slug}`,
                image: variant.variantImage
                    ? variant.variantImage
                    : variant.images[0].url,
            })
        )
        // Return the product in the ProductCardType structure
        return {
            id: product.id,
            slug: product.slug,
            name: product.name,
            rating: product.rating,
            sales: product.sales,
            variants,
            variantImages,
        }
    })

    // Retrieve products matching the filters
    // const totalCount = await db.product.count({
    // 	where: whereClause,
    // });
    const totalCount = products.length

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize)

    // Return the filtered products, pagination metadata, and total count
    return {
        products: productsWithFilteredVariants,
        totalPages,
        currentPage,
        pageSize,
        totalCount,
    }
}

// Function: getProductPageData
// Description: Retrieves product data (including product and variant details) for a specific product page
// Access Level: Public
// Parameters:
// - productId: The slug of the product to which the variant belongs.
// - variantId: The ID of the variant for which to retrieve data.
// Returns: Product data (including product and variant details) or null if the product or variant is not found.

export const getProductPageData = async (
    productSlug: string,
    variantSlug: string
) => {
    // Get current user
    const user = await currentUser()

    // Retrieve product and variant details from the database
    const product = await retrieveProductDetails(productSlug, variantSlug)
    if (!product) return

    // Retrieve user country
    const userCountry = getUserCountry()

    // Calculate and retrieve the shipping details
    const productShippingDetails = await getShippingDetails(
        product.shippingFeeMethod,
        userCountry,
        product.store,
        product.freeShipping
    )

    // Fetch store followers count
    const storeFollowersCount = await getStoreFollowersCount(product.storeId)

    // Check if user is following store
    const isUserFollowingStore = await checkIfUserFollowingStore(
        product.storeId,
        user?.id
    )

    const ratingStatistics = await getRatingStatistics(product.id)

    return formatProductResponse(
        product,
        productShippingDetails,
        storeFollowersCount,
        isUserFollowingStore,
        ratingStatistics
    )
}

// Helper functions
export const retrieveProductDetails = async (
    productSlug: string,
    variantSlug: string
) => {
    const product = await db.product.findUnique({
        where: {
            slug: productSlug,
        },
        include: {
            category: true,
            subCategory: true,
            offerTag: true,
            store: true,
            specs: true,
            questions: true,
            reviews: {
                include: {
                    images: true,
                    user: true,
                },
                take: 4,
            },
            freeShipping: {
                include: {
                    eligibleCountries: true,
                },
            },
            variants: {
                where: {
                    slug: variantSlug,
                },
                include: {
                    images: true,
                    colors: true,
                    sizes: true,
                    specs: true,
                },
            },
        },
    })

    if (!product) return null
    // Get variant info
    const variantsInfo = await db.productVariant.findMany({
        where: {
            productId: product.id,
        },
        include: {
            images: true,
            sizes: true,
            colors: true,
            product: {
                select: {
                    slug: true,
                },
            },
        },
    })

    return {
        ...product,
        variantsInfo: variantsInfo.map((variant) => ({
            variantName: variant.variantName,
            variantSlug: variant.slug,
            variantImage: variant.variantImage,
            variantUrl: `/product/${productSlug}/${variant.slug}`,
            images: variant.images,
            sizes: variant.sizes,
            colors: variant.colors,
        })),
    }
}

const getUserCountry = () => {
    const userCountryCookie = getCookie('userCountry', { cookies }) || ''
    const defaultCountry = { name: 'United States', code: 'US' }

    try {
        const parsedCountry = JSON.parse(userCountryCookie)
        if (
            parsedCountry &&
            typeof parsedCountry === 'object' &&
            'name' in parsedCountry &&
            'code' in parsedCountry
        ) {
            return parsedCountry
        }
        return defaultCountry
    } catch (error) {
        // Handle error
        console.error('Error retrieving user country:', error)
    }
}
const formatProductResponse = (
    product: ProductPageType,
    shippingDetails: ProductShippingDetailsType,
    storeFollowersCount: number,
    isUserFollowingStore: boolean,
    ratingStatistics: RatingStatisticsType
) => {
    if (!product) return
    const variant = product.variants[0]
    const { store, category, subCategory, offerTag, questions, reviews } =
        product
    const { images, colors, sizes } = variant

    return {
        productId: product.id,
        variantId: variant.id,
        productSlug: product.slug,
        variantSlug: variant.slug,
        name: product.name,
        description: product.description,
        variantName: variant.variantName,
        variantDescription: variant.variantDescription,
        images,
        category,
        subCategory,
        offerTag,
        isSale: variant.isSale,
        saleEndDate: variant.saleEndDate,
        brand: product.brand,
        sku: variant.sku,
        weight: variant.weight,
        variantImage: variant.variantImage,
        store: {
            id: store.id,
            url: store.url,
            name: store.name,
            logo: store.logo,
            followersCount: storeFollowersCount,
            isUserFollowingStore,
        },
        colors,
        sizes,
        specs: {
            product: product.specs,
            variant: variant.specs,
        },
        questions,
        rating: product.rating,
        reviews,
        reviewsStatistics: ratingStatistics,
        shippingDetails,
        relatedProducts: [],
        variantInfo: product.variantsInfo,
    }
}

const getStoreFollowersCount = async (storeId: string) => {
    const storeFollowersCount = await db.store.findUnique({
        where: {
            id: storeId,
        },
        select: {
            _count: {
                select: {
                    followers: true,
                },
            },
        },
    })
    return storeFollowersCount?._count.followers || 0
}

const checkIfUserFollowingStore = async (
    storeId: string,
    userId: string | undefined
) => {
    let isUserFollowingStore = false
    if (userId) {
        const storeFollowersInfo = await db.store.findUnique({
            where: {
                id: storeId,
            },
            select: {
                followers: {
                    where: {
                        id: userId, // Check if this user is following the store
                    },
                    select: { id: true }, // Select the user id if following
                },
            },
        })
        if (storeFollowersInfo && storeFollowersInfo.followers.length > 0) {
            isUserFollowingStore = true
        }
    }

    return isUserFollowingStore
}

export const getRatingStatistics = async (productId: string) => {
    const ratingStats = await db.review.groupBy({
        by: ['rating'],
        where: { productId },
        _count: {
            rating: true,
        },
    })

    const totalReviews = ratingStats.reduce(
        (sum, stat) => sum + stat._count.rating,
        0
    )

    const ratingCounts = Array(5).fill(0)

    ratingStats.forEach((stat) => {
        let rating = Math.floor(stat.rating)
        if (rating >= 1 && rating <= 5) {
            ratingCounts[rating - 1] = stat._count.rating
        }
    })

    return {
        ratingStatistics: ratingCounts.map((count, index) => ({
            rating: index + 1,
            numReviews: count,
            percentage: totalReviews > 0 ? (count / totalReviews) * 100 : 0,
        })),
        reviewsWithImagesCount: await db.review.count({
            where: {
                productId,
                images: { some: {} },
            },
        }),
        totalReviews,
    }
}

// Function: getShippingDetails
// Description: Retrieves and calculates shipping details based on the product's shipping fee method and user's country
// Access Level: Public
// Parameters:
// - shippingFeeMethod: The shipping fee method of the product.
// - userCountry: The parsed user country object from cookies.
// - store: store details
// Returns: The calculated shipping details.
export const getShippingDetails = async (
    shippingFeeMethod: string,
    userCountry: { name: string; code: string; city: string },
    store: Store,
    freeShipping: FreeShippingWithCountriesType | null
) => {
    let shippingDetails = {
        shippingFeeMethod,
        shippingService: '',
        shippingFee: 0,
        extraShippingFee: 0,
        deliveryTimeMin: 0,
        deliveryTimeMax: 0,
        returnPolicy: '',
        countryCode: userCountry.code,
        countryName: userCountry.name,
        city: userCountry.city,
        isFreeShipping: false,
    }

    const country = await db.country.findUnique({
        where: {
            name: userCountry.name,
            code: userCountry.code,
        },
    })

    if (country) {
        // Retrieve shipping rate for the country
        const shippingRate = await db.shippingRate.findFirst({
            where: {
                countryId: country.id,
                storeId: store.id,
            },
        })

        const returnPolicy = shippingRate?.returnPolicy || store.returnPolicy
        const shippingService =
            shippingRate?.shippingService || store.defaultShippingService
        const shippingFeePerItem =
            shippingRate?.shippingFeePerItem || store.defaultShippingFeePerItem
        const shippingFeeForAdditionalItem =
            shippingRate?.shippingFeeForAdditionalItem ||
            store.defaultShippingFeeForAdditionalItem
        const shippingFeePerKg =
            shippingRate?.shippingFeePerKg || store.defaultShippingFeePerKg
        const shippingFeeFixed =
            shippingRate?.shippingFeeFixed || store.defaultShippingFeeFixed
        const deliveryTimeMin =
            shippingRate?.deliveryTimeMin || store.defaultDeliveryTimeMin
        const deliveryTimeMax =
            shippingRate?.deliveryTimeMax || store.defaultDeliveryTimeMax

        // Check for free shipping
        if (freeShipping) {
            const free_shipping_countries = freeShipping.eligibleCountries
            const check_free_shipping = free_shipping_countries.find(
                (c) => c.countryId === country.id
            )
            if (check_free_shipping) {
                shippingDetails.isFreeShipping = true
            }
        }

        shippingDetails = {
            shippingFeeMethod,
            shippingService: shippingService,
            shippingFee: 0,
            extraShippingFee: 0,
            deliveryTimeMin,
            deliveryTimeMax,
            returnPolicy,
            countryCode: userCountry.code,
            countryName: userCountry.name,
            city: userCountry.city,
            isFreeShipping: shippingDetails.isFreeShipping,
        }

        const { isFreeShipping } = shippingDetails
        switch (shippingFeeMethod) {
            case 'ITEM':
                shippingDetails.shippingFee = isFreeShipping
                    ? 0
                    : shippingFeePerItem
                shippingDetails.extraShippingFee = isFreeShipping
                    ? 0
                    : shippingFeeForAdditionalItem
                break

            case 'WEIGHT':
                shippingDetails.shippingFee = isFreeShipping
                    ? 0
                    : shippingFeePerKg
                break

            case 'FIXED':
                shippingDetails.shippingFee = isFreeShipping
                    ? 0
                    : shippingFeeFixed
                break

            default:
                break
        }
        return shippingDetails
    }

    return false
}

// Function: getProductFilteredReviews
// Description: Retrieves filtered and sorted reviews for a product from the database,
// Access Level: Public
// Parameters:
// - productId: The ID of the product for which reviews are being fetched.
// - filters: An object containing filter options such as rating, and whether review
// - sort: An object defining sort order, such as latest, oldest, or highest rating.
// - page: The page number for pagination. (1-based index)
// - pageSize: The Number of reviews to retrieve per page.
// Returns: A paginated list of reviews that match the filter and sort criteria.
export const getProductFilteredReviews = async (
    productId: string,
    filters: {
        rating?: number
        hasImages?: boolean
    },
    sort: { orderBy: 'latest' | 'oldest' | 'highest' } | undefined,
    page: number = 1,
    pageSize: number = 4
) => {
    const reviewFilter: any = {
        productId,
    }

    // Apply rating filter if provided
    if (filters.rating) {
        const rating = filters.rating
        reviewFilter.rating = {
            in: [rating, rating + 0.5],
        }
    }

    // Apply image filter if provided
    if (filters.hasImages) {
        reviewFilter.images = {
            some: {},
        }
    }

    // Set sorting order using local SortOrder type
    const sortOption: { createdAt?: SortOrder; rating?: SortOrder } =
        sort && sort.orderBy === 'latest'
            ? { createdAt: 'desc' }
            : sort && sort.orderBy === 'oldest'
              ? { createdAt: 'asc' }
              : { rating: 'desc' }

    // Calculate pagination parameters
    const skip = (page - 1) * pageSize
    const take = pageSize

    // Fetch reviews from the database
    const reviews = await db.review.findMany({
        where: reviewFilter,
        include: {
            images: true,
            user: true,
        },
        orderBy: sortOption,
        skip, // Skip records for pagination
        take, // Take records for pagination
    })

    return reviews
}
