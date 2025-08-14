"use server";
// DB
import { db } from "@/lib/db";
import {
    CountryWithShippingRatesType,
    StoreDefaultShippingType,
    StoreStatus,
    StoreType,
} from "@/lib/types";

// Clerk
import { currentUser } from "@clerk/nextjs/server";

// Prisma models
import { ShippingRate, Store } from "@prisma/client";

// Function: upsertStore
// Description: Upsert store details into the database, ensuring uniqueness of name, url. email, and phone.
// Access Level: Seller Only
// Parameters:
// - store: Store object containing details of the store to be upserted.
// Returns: Updated or newly created store details.
export const upsertStore = async (store: Partial<Store>) => {
    try {
        // Get current user
        const user = await currentUser();

        // Ensure user is authenticated
        if (!user) throw new Error("Unauthenticated.");

        // Verify seller permission
        if (user.privateMetadata.role !== "SELLER")
            throw new Error("Only sellers can perform this action.");

        // Ensure store data is provided
        if (!store) throw new Error("Please provide store data.");

        let storeDetails;

        if (store?.id) {
            // 更新処理 - まずストアが存在し、現在のユーザーに属しているかチェック
            const existingStore = await db.store.findFirst({
                where: {
                    id: store.id,
                    userId: user.id, // 重要：現在のユーザーのストアかチェック
                },
            });

            if (!existingStore) {
                throw new Error(
                    "Store not found or you don't have permission to update this store."
                );
            }

            // 重複チェック（現在のストアを除外）
            const duplicateStore = await db.store.findFirst({
                where: {
                    AND: [
                        {
                            OR: [
                                { name: store.name },
                                { url: store.url },
                                { email: store.email },
                                { phone: store.phone },
                            ],
                        },
                        {
                            NOT: {
                                id: store.id,
                            },
                        },
                    ],
                },
            });

            if (duplicateStore) {
                let errorMessage = "";
                if (duplicateStore.name === store.name) {
                    errorMessage = "A store with the same name already exists.";
                } else if (duplicateStore.url === store.url) {
                    errorMessage = "A store with the same URL already exists.";
                } else if (duplicateStore.email === store.email) {
                    errorMessage =
                        "A store with the same email already exists.";
                } else if (duplicateStore.phone === store.phone) {
                    errorMessage =
                        "A store with the same phone number already exists.";
                }
                throw new Error(errorMessage);
            }

            // id と userId を除外して更新
            const { id, userId, ...storeDataToUpdate } = store;

            storeDetails = await db.store.update({
                where: { id: String(id) },
                data: storeDataToUpdate,
            });
        } else {
            // 作成処理 - 重複チェック
            const existingStore = await db.store.findFirst({
                where: {
                    OR: [
                        { name: store.name },
                        { url: store.url },
                        { email: store.email },
                        { phone: store.phone },
                    ],
                },
            });

            if (existingStore) {
                let errorMessage = "";
                if (existingStore.name === store.name) {
                    errorMessage = "A store with the same name already exists.";
                } else if (existingStore.url === store.url) {
                    errorMessage = "A store with the same URL already exists.";
                } else if (existingStore.email === store.email) {
                    errorMessage =
                        "A store with the same email already exists.";
                } else if (existingStore.phone === store.phone) {
                    errorMessage =
                        "A store with the same phone number already exists.";
                }
                throw new Error(errorMessage);
            }

            const { userId, ...storeWithoutUserId } = store;

            const createData = {
                ...storeWithoutUserId,
                name: store.name!,
                email: store.email!,
                url: store.url!,
                description: store.description || "",
                phone: store.phone || "",
                logo: store.logo || "",
                cover: store.cover || "",
                featured: store.featured ?? false,
                status: store.status ?? "PENDING",
                defaultShippingService:
                    store.defaultShippingService || "International Delivery",
                returnPolicy: store.returnPolicy || "Return in 30 days.",
                userId: user.id,
            };

            storeDetails = await db.store.create({ data: createData });
        }

        return storeDetails;
    } catch (error) {
        console.log(error);
        throw error;
    }
};

// Function: getStoreDefaultShippingDetails
// Description: Fetches the default shipping details for a store based on the store URL.
// Parameters:
// - storeUrl: URL of the store to fetch default shipping details for.
// Returns: Default shipping details, including shipping service, fees, delivery times and return policy.

export const getStoreDefaultShippingDetails = async (storeUrl: string) => {
    try {
        // Ensure store data is provided and not just whitespace
        if (!storeUrl || !storeUrl.trim())
            throw new Error("Please provide store URL.");

        // Retrieve store details from the database using the store URL
        const store = await db.store.findUnique({
            where: { url: storeUrl },
            select: {
                defaultShippingService: true,
                defaultShippingFeePerItem: true,
                defaultShippingFeeForAdditionalItem: true,
                defaultShippingFeePerKg: true,
                defaultShippingFeeFixed: true,
                defaultDeliveryTimeMin: true,
                defaultDeliveryTimeMax: true,
                returnPolicy: true,
            },
        });

        // If store not found, throw an error
        if (!store) {
            throw new Error(`Store with URL "${storeUrl}" not found.`);
        }

        return store;
    } catch (error) {
        console.log(error);
        throw error;
    }
};

// Function: updateStoreDefaultShippingDetails
// Description: Updates the default shipping details for a store based on the store URL.
// Parameters:
// - storeUrl: URL of the store to update.
// - details: An object containing the new shipping details. (shipping service, fees, delivery times and return policy).
// Returns: Updated store object with the new default shipping details.
export const updateStoreDefaultShippingDetails = async (
    storeUrl: string,
    details: StoreDefaultShippingType
) => {
    try {
        // Get current user
        const user = await currentUser();

        // Ensure user is authenticated
        if (!user) throw new Error("Unauthenticated.");

        // Verify seller permission
        if (user.privateMetadata.role !== "SELLER")
            throw new Error("Only sellers can perform this action.");

        // Ensure store URL is provided
        if (!storeUrl) throw new Error("Please provide store URL.");

        // Ensure details are provided
        if (!details) throw new Error("Please provide shipping details.");

        // Make sure seller is updating their own store
        const check_ownership = await db.store.findUnique({
            where: { url: storeUrl, userId: user.id },
        });

        if (!check_ownership)
            throw new Error("You are not authorized to update this store.");

        // Find and update the store based on storeUrl
        const updatedStore = await db.store.update({
            where: { url: storeUrl, userId: user.id },
            data: details,
        });

        return updatedStore;
    } catch (error) {
        console.log(error);
        throw error;
    }
};

// Function: getStoreShippingRates
// Description: Retrieves all countries and their shipping rates for a specific store. If a country does not have shipping rates, it is still included in the
// Permission Level: Public
// Returns: Array of countries and their shipping rates, including shipping service, fees, delivery times and return policy.
export const getStoreShippingRates = async (storeUrl: string) => {
    try {
        // Get current user
        const user = await currentUser();

        // Ensure user is authenticated
        if (!user) throw new Error("Unauthenticated.");

        // Verify seller permission
        if (user.privateMetadata.role !== "SELLER")
            throw new Error("Only sellers can perform this action.");

        // Ensure store URL is provided
        if (!storeUrl) throw new Error("Please provide store URL.");

        // Make sure seller is updating their own store
        const check_ownership = await db.store.findUnique({
            where: { url: storeUrl, userId: user.id },
        });

        if (!check_ownership)
            throw new Error("You are not authorized to update this store.");

        // Retrieve store shipping rates from the database using the store URL
        const store = await db.store.findUnique({
            where: { url: storeUrl, userId: user.id },
        });

        if (!store) throw new Error("Store could not be found.");

        // Retrieve all countries
        const countries = await db.country.findMany({
            orderBy: {
                name: "asc",
            },
        });

        // Retrieve shipping rates for the specified store
        const shippingRates = await db.shippingRate.findMany({
            where: {
                storeId: store.id,
            },
        });

        // Create a map for quick lookup of shipping rates by country ID
        const rateMap = new Map();
        shippingRates.forEach((rate) => {
            rateMap.set(rate.countryId, rate);
        });

        // Map countries to their shipping rates
        const result = countries.map((country) => ({
            countryId: country.id,
            countryName: country.name,
            shippingRate: rateMap.get(country.id) || null,
        }));

        return result;
    } catch (error) {
        console.log(error);
        throw error;
    }
};

// Function: upsertShippingRate
// Description: Upserts a shipping rate for a specific store and country.
// Permission Level: Seller Only
// Parameters:
//  - storeUrl: URL of the store to update.
//  - shippingRate: Shipping rate object containing details of the shipping rate to be upserted.
// Returns: Updated or newly created shipping rate details.
export const upsertShippingRate = async (
    storeUrl: string,
    shippingRate: ShippingRate
) => {
    try {
        // Get current user
        const user = await currentUser();

        // Ensure user is authenticated
        if (!user) throw new Error("Unauthenticated.");

        // Verify seller permission
        if (user.privateMetadata.role !== "SELLER")
            throw new Error("Only sellers can perform this action.");

        // // Ensure store URL is provided
        // if (!storeUrl) throw new Error("Please provide store URL.");

        // Make sure seller is updating their own store
        const check_ownership = await db.store.findUnique({
            where: { url: storeUrl, userId: user.id },
        });

        if (!check_ownership)
            throw new Error("You are not authorized to update this store.");

        // Ensure shipping rate data is provided
        if (!shippingRate)
            throw new Error("Please provide shipping rate data.");

        // Ensure country ID is provided
        if (!shippingRate.countryId)
            throw new Error("Please provide country ID.");

        // Get store id
        const store = await db.store.findUnique({
            where: {
                url: storeUrl,
                userId: user.id,
            },
        });

        if (!store) throw new Error("Store could not be found.");

        // Upsert shipping rate into the database
        const shippingRateDetails = await db.shippingRate.upsert({
            where: {
                id: shippingRate.id,
            },
            update: { ...shippingRate, storeId: store.id },
            create: { ...shippingRate, storeId: store.id },
        });

        return shippingRateDetails;
    } catch (error) {
        console.log(error);
        throw error;
    }
};

/**
 * @function getStoreOrders
 * @description - Retrieves all orders associated with a specific store.
 *              - Returns order that includes items, order details.
 * @permissionLevel Seller Only?
 * @param storeUrl - The url of the store whose order groups are being retrieved.
 * @return {Array} - Array of order groups, including items.
 */

export const getStoreOrders = async (storeUrl: string) => {
    try {
        // Get current user
        const user = await currentUser();

        // Ensure user is authenticated
        if (!user) throw new Error("Unauthenticated.");

        // Verify seller permission
        if (user.privateMetadata.role !== "SELLER")
            throw new Error("Only sellers can perform this action.");

        // Get store id using url
        const store = await db.store.findUnique({
            where: {
                url: storeUrl,
            },
        });

        // Ensure store existence
        if (!store) throw new Error("Store not found.");

        // Verify ownership
        if (user.id !== store.userId) {
            throw new Error(
                "You are not authorized to view this store's orders."
            );
        }

        // Retrieve order groups for the specified store and user
        const orders = await db.orderGroup.findMany({
            where: {
                storeId: store.id,
            },
            include: {
                items: true,
                coupon: true,
                order: {
                    select: {
                        paymentStatus: true,
                        shippingAddress: {
                            include: {
                                country: true,
                                user: {
                                    select: {
                                        email: true,
                                    },
                                },
                            },
                        },
                        paymentDetails: true,
                    },
                },
            },
            orderBy: {
                updatedAt: "desc",
            },
        });

        return orders;
    } catch (error) {
        console.log(error);
        throw error;
    }
};

/**
 * @function applySeller
 * @description Creates a new store in the database when a user applies to become a seller.
 *              Validates store data uniqueness (name, url, email, phone) and sets default
 *              shipping service and return policy if not provided.
 * @permissionLevel Public (any authenticated user can apply to become a seller)
 * @param {StoreType} store - Store object containing details of the store to be created
 * @returns {Promise<Store>} - Newly created store details from the database
 * @throws {Error} - When user is unauthenticated, store data is missing, or store with same details already exists
 */
export const applySeller = async (store: StoreType) => {
    try {
        // Get current user
        const user = await currentUser();

        // Ensure user is authenticated
        if (!user) throw new Error("Unauthenticated.");

        // Ensure store data is provided
        if (!store) throw new Error("Please provide store data.");

        // Check for uniqueness of name, url, email, and phone
        const existingStore = await db.store.findFirst({
            where: {
                AND: [
                    {
                        OR: [
                            { name: store.name },
                            { url: store.url },
                            { email: store.email },
                            { phone: store.phone },
                        ],
                    },
                ],
            },
        });

        if (existingStore) {
            let errorMessage = "";
            if (existingStore.name === store.name) {
                errorMessage = "A store with the same name already exists.";
            } else if (existingStore.url === store.url) {
                errorMessage = "A store with the same URL already exists.";
            } else if (existingStore.email === store.email) {
                errorMessage = "A store with the same email already exists.";
            } else if (existingStore.phone === store.phone) {
                errorMessage =
                    "A store with the same phone number already exists.";
            }
            throw new Error(errorMessage);
        }

        console.log("store details", store);

        // Create store details into the database
        const storeDetails = await db.store.create({
            data: {
                ...store,
                defaultShippingService:
                    store.defaultShippingService || "International Delivery",
                returnPolicy: store.returnPolicy || "Return in 30 days.",
                userId: user.id,
            },
        });

        return storeDetails;
    } catch (error) {
        console.log(error);
        throw error;
    }
};

/**
 * @function getAllStores
 * @description - Retrieves all stores from the database.
 * @permissionLevel Admin Only
 * @params None
 * @return {Array} - Array of store objects.
 * */
export const getAllStores = async () => {
    try {
        // Ensure user is authenticated
        const user = await currentUser();
        if (!user) throw new Error("Unauthenticated.");

        // Verify admin permission
        if (user.privateMetadata.role !== "ADMIN")
            throw new Error(
                "Unauthorized Access: Admin Privileges Required to View Stores."
            );

        // Fetch all stores
        const stores = await db.store.findMany({
            include: {
                user: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return stores;
    } catch (error) {
        console.log(error);
        throw error;
    }
};

/**
 * @function updateStoreStatus
 * @description Updates the status of a store (e.g., from PENDING to ACTIVE) and automatically
 *              promotes the store owner to SELLER role when their store is approved.
 *              This function is typically used by admins to approve or reject store applications.
 * @permissionLevel Admin Only
 * @param {string} storeId - The unique identifier of the store to update
 * @param {StoreStatus} status - The new status to set for the store (PENDING, ACTIVE, INACTIVE, etc.)
 * @returns {Promise<StoreStatus>} - The updated status of the store
 * @throws {Error} - When user is unauthenticated, lacks admin privileges, or store is not found
 */
export const updateStoreStatus = async (
    storeId: string,
    status: StoreStatus
) => {
    // Retrieve the current user
    const user = await currentUser();

    // Ensure user is authenticated
    if (!user) throw new Error("Unauthenticated.");

    // Ensure user has admin privileges
    if (user.privateMetadata.role !== "ADMIN")
        throw new Error("Only admins can perform this action.");

    // Ensure the user is a seller of the specified store
    const store = await db.store.findUnique({
        where: {
            id: storeId,
        },
    });

    // Verify ownership of the store
    if (!store) {
        throw new Error("Store not found.");
    }

    // Retrieve the order to be updated
    const updatedStore = await db.store.update({
        where: {
            id: storeId,
        },
        data: {
            status,
        },
    });

    // Update the user role
    if (store.status === "PENDING" && updatedStore.status === "ACTIVE") {
        await db.user.update({
            where: {
                id: updatedStore.userId,
            },
            data: {
                role: "SELLER",
            },
        });
    }

    return updatedStore.status;
};

/**
 * @function deleteStore
 * @description Performs a soft delete on a store by marking it as deleted instead of permanently
 *              removing it from the database. Sets the isDeleted flag to true and records
 *              the deletion timestamp. This preserves data integrity and allows for potential
 *              recovery while hiding the store from normal operations.
 * @permissionLevel Admin Only
 * @param {string} storeId - The unique identifier of the store to be soft deleted
 * @returns {Promise<Store>} - The updated store object with deletion flags set
 * @throws {Error} - When user is unauthenticated, lacks admin privileges, or store ID is not provided
 */
export const deleteStore = async (storeId: string) => {
    try {
        const user = await currentUser();

        if (!user) throw new Error("Unauthenticated.");
        if (user.privateMetadata.role !== "ADMIN")
            throw new Error("Only admins can perform this action.");
        if (!storeId) throw new Error("Please provide store ID.");

        // Soft delete - mark as deleted instead of removing
        const response = await db.store.update({
            where: {
                id: storeId,
            },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
            },
        });

        return response;
    } catch (error) {
        console.log(error);
        throw error;
    }
};

/**
 * @function getStorePageDetails
 * @description Retrieves essential store information for displaying on a public store page.
 *              Fetches only active stores and returns basic details including store identity,
 *              branding assets, and review metrics for public consumption.
 * @permissionLevel Public (no authentication required)
 * @param {string} storeUrl - The unique URL identifier of the store to retrieve details for
 * @returns {Promise<Object>} - Store object containing id, name, description, logo, cover, averageRating, and numReviews
 * @throws {Error} - When store URL is not provided or store with the specified URL is not found or not active
 */
export const getStorePageDetails = async (storeUrl: string) => {
    try {
        // Fetch store details and associated data
        const store = await db.store.findFirst({
            where: {
                url: storeUrl,
                status: "ACTIVE",
            },
            select: {
                id: true,
                name: true,
                description: true,
                logo: true,
                cover: true,
                averageRating: true,
                numReviews: true,
            },
        });

        // Handle case where store is not found
        if (!store) throw new Error(`Store with URL ${storeUrl} not found.`);

        return store;
    } catch (error) {
        console.log(error);
        throw error;
    }
};