"use server";
// DB
import { db } from "@/lib/db";
// Types
import { ProductWithVariantType } from "@/lib/types";
import { generateUniqueSlug } from "@/lib/utils";
// Clerk
import { currentUser } from "@clerk/nextjs/server";
// Slugify
import slugify from "slugify";

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
		const user = await currentUser();
		// Check if user is authenticated
		if (!user) throw new Error("Unauthenticated.");
		// Ensure user has seller privileges
		if (user.privateMetadata.role !== "SELLER")
			throw new Error("Only sellers can perform this action.");
		// Ensure product data is provided
		if (!product) throw new Error("Please provide product data.");
		// Ensure store data is provided
		// if (!storeUrl) throw new Error("Please provide store URL.");
		// Check if the product already exist
		const existingProduct = await db.product.findUnique({
			where: { id: product.productId },
		});

		// Find the store by URL
		const store = await db.store.findUnique({
			where: { url: storeUrl },
		});
		if (!store) throw new Error(`Store with URL "${storeUrl}" not found.`);

		// Generate unique slugs for product and variant
		const productSlug = generateUniqueSlug(
			slugify(product.name, {
				replacement: "-",
				lower: true,
				trim: true,
			}),
			"product"
		);

		const variantSlug = generateUniqueSlug(
			slugify(product.variantName, {
				replacement: "-",
				lower: true,
				trim: true,
			}),
			"productVariant"
		);
	} catch (error) {
		console.log(error);
		throw error;
	}
};
