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
            throw new Error("Unauthorized Access: Admin Privileges Required for Entry.");

        // Ensure OfferTag data is provided
        if (!offerTag) throw new Error("Please provide OfferTag data.");

        // Throw error if OfferTag with same name already exists
        const existingOfferTag = await db.offerTag.findFirst({
            where: {
                AND: [
                    {
                        OR: [{ name: offerTag.name }, {url: offerTag.url  }],
                    },
                    {
                        NOT: {
                            id: offerTag.id,
                        },
                    }
                ]
            },
        });

        // Throw error if OfferTag with same name or URL already exists (ignoring case)

        if (existingOfferTag) {
            let errorMessage = "";
            if (existingOfferTag.name.toLowerCase() === offerTag.name.toLowerCase()) {
                errorMessage = "OfferTag with the same name already exists.";
            } else if (existingOfferTag.url.toLowerCase() === offerTag.url.toLowerCase()) {
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
