"use server";

import { db } from "@/lib/db";

/**
 * Retrieves filtered sizes based on category, subcategory, offer, and store filters.
 * 
 * This function queries the database to find all unique sizes available for products
 * that match the provided filters. It handles store URL to ID conversion, applies
 * dynamic filtering based on available parameters, removes duplicates, and sorts
 * sizes in a custom order (XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL) with alphabetical
 * fallback for non-standard sizes.
 * 
 * @param filters - Object containing optional filter parameters
 * @param filters.category - Category URL to filter by
 * @param filters.subCategory - Sub-category URL to filter by  
 * @param filters.offer - Offer tag URL to filter by
 * @param filters.storeUrl - Store URL to filter by (converted to store ID internally)
 * @param take - Maximum number of size records to retrieve (default: 10)
 * 
 * @returns Promise resolving to an object containing:
 *   - sizes: Array of unique size objects in custom sorted order
 *   - count: Total count of size records matching the filters
 * 
 * @throws Error if database query fails or other unexpected errors occur
 */
export const getFilteredSizes = async (
    filters: {
        category?: string;
        subCategory?: string;
        offer?: string;
        storeUrl?: string;
    },
    take = 10
) => {
    try {
        const { category, subCategory, offer, storeUrl } = filters;

        let storeId: string | undefined;

        if (storeUrl) {
            // Retrieve the storeId based on the storeUrl
            const store = await db.store.findUnique({
                where: { url: storeUrl },
            });

            // if no store is found, return an empty array or handle as needed
            if (!store) {
                return { sizes: [], count: 0 };
            }

            storeId = store.id;
        }

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
                            subCategory
                                ? { category: { url: subCategory } }
                                : {},
                            offer ? { offerTag: { url: offer } } : {},
                            storeId ? { store: { id: storeId } } : {},
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
    } catch (error) {
        console.error("Error getting filtered sizes:", error);
        throw new Error("Failed to get filtered sizes");
    }
};
