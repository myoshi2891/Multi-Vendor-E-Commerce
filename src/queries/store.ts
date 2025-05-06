"use server";
// DB
import { db } from "@/lib/db";

// Clerk
import { currentUser } from "@clerk/nextjs/server";

// Prisma models
import { Store } from "@prisma/client";

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
                errorMessage = "A store with the same phone number already exists.";
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
                }
            },
        })

        return storeDetails
    } catch (error) {
        console.log(error);
        throw error
    }
};
