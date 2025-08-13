"use server";

import { db } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";
import { OfferTag } from "@prisma/client";

// Function: upsertOfferTag
// Description: Upserts a OfferTag into the database, updating if it exists or creating a new one if not.
// Permission Level: Admin only
// Parameters:
//  - offerTag: OfferTag object containing details of the OfferTag to be upserted.
// Returns: Updated or newly created OfferTag details.

export const upsertOfferTag = async (offerTag: OfferTag) => {
	try {
		// Get current user
		const user = await currentUser();

		// Ensure user is authenticated
		if (!user) throw new Error("Unauthenticated.");

		// Verify admin permission
		if (user.privateMetadata.role !== "ADMIN")
			throw new Error(
				"Unauthorized Access: Admin Privileges Required for Entry."
			);

		// Ensure OfferTag data is provided
		if (!offerTag) throw new Error("Please provide OfferTag data.");

		// Throw error if OfferTag with same name already exists
		const existingOfferTag = await db.offerTag.findFirst({
			where: {
				AND: [
					{
						OR: [{ name: offerTag.name }, { url: offerTag.url }],
					},
					{
						NOT: {
							id: offerTag.id,
						},
					},
				],
			},
		});

		// Throw error if OfferTag with same name or URL already exists (ignoring case)

		if (existingOfferTag) {
			let errorMessage = "";
			if (
				existingOfferTag.name.toLowerCase() ===
				offerTag.name.toLowerCase()
			) {
				errorMessage = "OfferTag with the same name already exists.";
			} else if (
				existingOfferTag.url.toLowerCase() ===
				offerTag.url.toLowerCase()
			) {
				errorMessage = "OfferTag with the same URL already exists.";
			}
			throw new Error(errorMessage);
		}
		// Upsert OfferTag into the database

		const offerTagDetails = await db.offerTag.upsert({
			where: { id: offerTag.id },
			create: offerTag,
			update: offerTag,
		});
		return offerTagDetails;
	} catch (error) {
		console.error("Error upserting OfferTag", error);
		throw new Error("Error upserting OfferTag");
	}
};

// Function: getAllOfferTags
// Description: Retrieves all OfferTags from the database, optionally filtered by store URL. 
//              OfferTags are ordered by the count of associated products in descending order.
// Permission Level: Public
// Parameters:
// - storeUrl (optional): URL of the store to filter OfferTags by associated products.
// Returns: Array of OfferTag objects with product associations, or empty array if none found.

export const getAllOfferTags = async (storeUrl?: string) => {
    try {
        let storeId: string | undefined;
        if (storeUrl) {
            // Retrieve store details from the database using the store URL
            const store = await db.store.findUnique({
                where: { url: storeUrl },
            });
            // If store not found, return an empty array or handle as needed
            if (!store) {
                return [];
            }
            storeId = store?.id;
        }

        // Retrieve all OfferTags from the database
        const offerTags = await db.offerTag.findMany({
            where: storeId
                ? {
                      products: {
                          some: {
                              storeId: storeId,
                          },
                      },
                  }
                : {},
            include: {
                products: {
                    select: {
                        id: true,
                    },
                },
            },
            orderBy: {
                products: {
                    _count: "desc", // Order by the count of associated products in descending order
                },
            },
        });

        if (offerTags.length === 0) {
            // ここで初期表示メッセージを出す、何かを作成する、などの対応が可能
            return [];
        }
        return offerTags;
    } catch (error) {
        console.error("Error retrieving OfferTags", error);
        throw new Error("Error retrieving OfferTags");
    }
};

// Function: getOfferTag
// Description: Retrieves a specific OfferTag from the database.
// Permission Level: Public
// Parameters:
// - offerTagId: ID of the OfferTag to retrieve.
// Returns: OfferTag details if found, otherwise undefined.
export const getOfferTag = async (offerTagId: string) => {
	// Ensure OfferTag ID is provided
	if (!offerTagId) throw new Error("Please provide OfferTag ID.");

	try {
		// Retrieve OfferTag from the database
		const offerTag = await db.offerTag.findUnique({
			where: { id: offerTagId },
		});
		return offerTag;
	} catch (error) {
		console.error("Error retrieving OfferTag", error);
		throw new Error("Error retrieving OfferTag");
	}
};

// Function: deleteOfferTag
// Description: Deletes a specific OfferTag from the database.
// Permission Level: Admin only
// Parameters:
// - offerTagId: ID of the OfferTag to delete.
// A success message if the OfferTag is deleted, otherwise an error message.
export const deleteOfferTag = async (offerTagId: string) => {
	// Ensure OfferTag ID is provided
	if (!offerTagId) throw new Error("Please provide OfferTag ID.");

	try {
		// Get current user
		const user = await currentUser();

		// Ensure user is authenticated
		if (!user) throw new Error("Unauthenticated.");

		// Verify admin permission
		if (user.privateMetadata.role !== "ADMIN")
			throw new Error(
				"Unauthorized Access: Admin Privileges Required for Entry."
			);

		// Ensure the offerTagId is provided
		if (!offerTagId) throw new Error("Please provide OfferTag ID.");

		// Delete OfferTag from the database
		const response = await db.offerTag.delete({
			where: { id: offerTagId },
		});
		return response;
	} catch (error) {
		console.error("Error deleting OfferTag", error);
		throw new Error("Error deleting OfferTag");
	}
};

