"use server";
// DB
import { db } from "@/lib/db";
import {
	CountryWithShippingRatesType,
	StoreDefaultShippingType,
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
					{
						NOT: {
							id: store.id,
						},
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

		// Upsert store details into the database
		const storeDetails = await db.store.upsert({
			where: {
				id: store.id,
			},
			update: store,
			create: {
				...store,
				user: {
					connect: {
						id: user.id,
					},
				},
			},
		});

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
		// Ensure store data is provided
		if (!storeUrl) throw new Error("Please provide store URL.");

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
        if (user.privateMetadata.role!== "SELLER")
            throw new Error("Only sellers can perform this action.");

		// Get store id using url
		const store = await db.store.findUnique({
			where: {
				url: storeUrl
			}
		})

		// Ensure store existence
		if (!store) throw new Error("Store not found.");

		// Verify ownership
		if (user.id !== store.userId) {
			throw new Error("You are not authorized to view this store's orders.");
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

		return orders
	} catch (error) {
		console.log(error);
        throw error;
	}
}