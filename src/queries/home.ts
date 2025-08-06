"use server";

import { db } from "@/lib/db";
import {
    ProductSimpleVariantType,
    ProductSize,
    ProductType,
    ProductWithVariants,
    SimpleProduct,
    VariantImageType,
} from "@/lib/types";

type Format = "simple" | "full";

type Param = {
    property: "category" | "subCategory" | "offer";
    value: string;
    type: Format;
};

type PropertyMapping = {
    [key: string]: string;
};

/**
 * Fetches and formats product data dynamically based on provided parameters.
 *
 * @param params - An array of objects containing property, value, and type to filter and format the product data.
 * @returns A promise that resolves to a record where keys are dynamically generated based on the input parameters,
 *          and values are arrays of either SimpleProduct or ProductType, depending on the specified format.
 *
 * @throws Will throw an error if the params array is empty or if an unknown property is provided.
 */
export const getHomeDataDynamic = async (
    params: Param[]
): Promise<Record<string, SimpleProduct[] | ProductType[]>> => {
    if (!Array.isArray(params) || params.length === 0) {
        throw new Error("Invalid input: Params array is empty");
    }

    // Define mapping for property names to database fields
    const propertyMapping: PropertyMapping = {
        category: "category.url",
        subCategory: "subCategory.url",
        offer: "offerTag.url",
    };

    const mapProperty = (property: string): string => {
        if (!propertyMapping[property]) {
            throw new Error(
                `Invalid input: Unknown property '${property}'. Must be one of: category, subCategory, offer`
            );
        }
        return propertyMapping[property];
    };

    // Get Cheapest size
    const getCheapestSize = (
        size: ProductSize[]
    ): { discountedPrice: number } => {
        const sizesWithDiscount = size.map((size) => ({
            ...size,
            discountedPrice: size.price * (1 - size.discount / 100),
        }));

        return sizesWithDiscount.sort(
            (a, b) => a.discountedPrice - b.discountedPrice
        )[0];
    };

    const formatProductData = (
        products: ProductWithVariants[],
        type: Format
    ): SimpleProduct[] | ProductType[] => {
        if (type === "simple") {
            return products.map((product) => {
                const variant = product.variants[0];
                const cheapestSize = getCheapestSize(variant.sizes);
                const image = variant.images[0];
                return {
                    name: product.name,
                    slug: product.slug,
                    variantName: variant.variantName,
                    variantSlug: variant.slug,
                    price: cheapestSize.discountedPrice,
                    image: image.url,
                } as SimpleProduct;
            });
        } else if (type === "full") {
            return products.map((product) => {
                // Transform the filtered variants into the VariantSimplified structure
                const variants: ProductSimpleVariantType[] =
                    product.variants.map((variant) => ({
                        variantId: variant.id,
                        variantSlug: variant.slug,
                        variantName: variant.variantName,
                        variantImage: variant.variantImage,
                        images: variant.images,
                        sizes: variant.sizes,
                    }));
                // Extract variant images for the product
                const variantImages: VariantImageType[] = variants.map(
                    (variant) => ({
                        url: `/product/${product.slug}/${variant.variantSlug}`,
                        image: variant.variantImage
                            ? variant.variantImage
                            : variant.images[0].url,
                    })
                );

                return {
                    id: product.id,
                    slug: product.slug,
                    name: product.name,
                    rating: product.rating,
                    sales: product.sales,
                    numReviews: product.numReviews,
                    variants,
                    variantImages,
                } as ProductType;
            });
        } else {
            throw new Error(
                "Invalid input: Type must be either 'full' or'simple'"
            );
        }
    };

    const results = await Promise.all(
        params.map(async ({ property, value, type }) => {
            const dbField = mapProperty(property);

            // Construct the 'where' clause based on the dbField
            const whereClause =
                dbField === "offerTag.url"
                    ? { offerTag: { url: value } }
                    : dbField === "category.url"
                      ? { category: { url: value } }
                      : dbField === "subCategory.url"
                        ? { subCategory: { url: value } }
                        : {};
            // Query products based on the constructed where clause
            const products = await db.product.findMany({
                where: whereClause,
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    rating: true,
                    sales: true,
                    numReviews: true,
                    variants: {
                        select: {
                            id: true,
                            variantName: true,
                            variantImage: true,
                            slug: true,
                            images: true,
                            sizes: true,
                        },
                    },
                },
            });

            // Format the data based on the input
            const formattedData = formatProductData(products, type);

            // Determine the output key based on the property and value
            const outputKey = `products_${value.replace(/-/g, "_")}`;

            return { [outputKey]: formattedData };
        })
    );

    return results.reduce((acc, result) => ({ ...acc, ...result }), {});
};

/**
 * Retrieves featured categories with their associated subcategories for the home page.
 * 
 * This function fetches categories marked as featured, along with their featured subcategories,
 * ordered by product count in descending order. It's designed to provide the most popular
 * categories and subcategories for display on the home page.
 * 
 * @returns A promise that resolves to an array of featured category objects, each containing:
 *   - id: Category ID
 *   - name: Category name
 *   - image: Category image URL
 *   - productCount: Number of products in the category
 *   - subCategories: Array of up to 3 featured subcategories, each with:
 *     - id: Subcategory ID
 *     - name: Subcategory name
 *     - image: Subcategory image URL
 *     - productCount: Number of products in the subcategory
 * 
 * @throws Will throw an error if the database query fails
 * 
 * @example
 * ```typescript
 * const featuredCategories = await getHomeFeaturedCategories();
 * // Returns up to 6 categories with up to 3 subcategories each
 * ```
 */
export const getHomeFeaturedCategories = async () => {
    const featuredCategories = await db.category.findMany({
        where: {
            featured: true,
        },
        select: {
            id: true,
            name: true,
            image: true,
            subCategories: {
                where: {
                    featured: true,
                },
                select: {
                    id: true,
                    name: true,
                    image: true,
                    _count: {
                        select: {
                            products: true, // Get the count of products in subCategories
                        },
                    },
                },
                orderBy: {
                    products: {
                        _count: "desc", // Order by product count in descending order
                    },
                },
                take: 3, // Limit to 3 subcategories
            },
            _count: {
                select: {
                    products: true, // Get the count of products in categories
                },
            },
        },
        orderBy: {
            products: {
                _count: "desc", // Order by product count in descending order
            },
        },
        take: 6, // Limit to 6 categories
    });

    return featuredCategories.map((category) => ({
        id: category.id,
        name: category.name,
        image: category.image,
        productCount: category._count.products,
        subCategories: category.subCategories.map((subCategory) => ({
            id: subCategory.id,
            name: subCategory.name,
            image: subCategory.image,
            productCount: subCategory._count.products,
        })),
    }));
};
