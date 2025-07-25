"use server";

import { db } from "@/lib/db";

/**
 * @function getFilteredSizes
 * @description Retrieves all sizes that exist in a product based on the filters (category, subcategory, offer).
 * @permission Public
 * @parameters
 *   - filter: an object containing category, subcategory, and offer as URLs.
 * @returns Array sizes in the form { id: string, size: string }[].
 */

export const getFilteredSizes = async (
    filters: {
        category?: string;
        subCategory?: string;
        offer?: string;
    },
    take = 10
) => {
    const { category, subCategory, offer } = filters;

    // Construct the query dynamically based on the available filters
    const sizes = await db.size.findMany({
        where: {
            productVariant: {
                product: {
                    AND: [
                        category ? { category: { url: category } } : {},
                        subCategory
                            ? { subCategory: { url: subCategory } }
                            : {},
                        offer ? { offerTag: { url: offer } } : {},
                    ],
                },
            },
        },
        select: {
            size: true,
        },
        take,
    });

    // Get Sizes count
    const count = await db.size.count({
        where: {
            productVariant: {
                product: {
                    AND: [
                        category ? { category: { url: category } } : {},
                        subCategory ? { category: { url: subCategory } } : {},
                        offer ? { offerTag: { url: offer } } : {},
                    ],
                },
            },
        },
    });

    // Remove duplicate sizes
    const uniqueSizesArray = Array.from(
        new Set(sizes.map((size) => size.size))
    );

    // Define a custom order using a Map for fast lookups
    const sizeOrderMap = new Map(
        ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"].map(
            (size, index) => [size, index]
        )
    );

    // Custom sorting by sizeOrderMap, fallback to alphabetical if not found
    uniqueSizesArray.sort((a, b) => {
        return (
            (sizeOrderMap.get(a) ?? Infinity) -
                (sizeOrderMap.get(b) ?? Infinity) || a.localeCompare(b)
        );
    });

    // Return the unique sizes in the desired format
    return { sizes: uniqueSizesArray.map((size) => ({ size })), count };
};
