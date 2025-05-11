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
		const productSlug = await generateUniqueSlug(
			slugify(product.name, {
				replacement: "-",
				lower: true,
				trim: true,
			}),
			"product"
		);

		const variantSlug = await generateUniqueSlug(
			slugify(product.variantName, {
				replacement: "-",
				lower: true,
				trim: true,
			}),
			"productVariant"
		);

		// Common data for product and variant
		const commonProductData = {
			name: product.name,
			description: product.description,
			slug: productSlug,
			brand: product.brand,
			store: { connect: { id: store.id } },
			category: { connect: { id: product.categoryId } },
			subCategory: { connect: { id: product.subCategoryId } },
			createdAt: product.createdAt,
			updatedAt: product.updatedAt,
		};

		const commonVariantData = {
			variantName: product.variantName,
			variantDescription: product.variantDescription,
			slug: variantSlug,
			isSale: product.isSale,
			sku: product.sku,
			keywords: product.keywords.join(","),
			images: {
				create: product.images.map((image) => ({
					url: image.url,
					alt: image.url.split("/").pop() || "",
				})),
			},
			colors: {
				create: product.colors.map((color) => ({ name: color.color })),
			},
			sizes: {
				create: product.sizes.map((size) => ({
					size: size.size,
					quantity: size.quantity,
					price: size.price,
					discount: size.discount,
				})),
			},
			createdAt: product.createdAt,
			updatedAt: product.updatedAt,
		};

		// If product exists, create a variant
		if (existingProduct) {
			const variantData = {
				...commonVariantData,
				product: { connect: { id: product.productId } },
			};
			return await db.productVariant.create({ data: variantData });
		} else {
			// Otherwise, create a new product with variants
			const productData = {
				...commonProductData,
				id: product.productId,
				variants: {
					create: [
						{
							id: product.variantId,
							...commonVariantData,
						},
					],
				},
			};
			return await db.product.create({ data: productData });
		}
	} catch (error) {
		console.log(error);
		throw error;
	}
};

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
	});
	if (!product) return null;

	// Return the main information of the product
	return {
		productId: product.id,
		name: product.name,
		description: product.description,
		brand: product.brand,
		categoryId: product.categoryId,
		subCategoryId: product.subCategoryId,
		storeId: product.storeId,
	};
};

// getAllStoreProducts
// Description: Retrieves all products associated with a specific store based on the store URL
// Access Level: Public
// Parameters:
// - storeUrl: URL of the store to retrieve products from.
// Returns: Array of products associated with the store, including category, subcategory, and variant details or an empty array if no products are found.

export const getAllStoreProducts = async (storeUrl: string) => {
	// Retrieve store details from the database using the store URL
	const store = await db.store.findUnique({
		where: { url: storeUrl },
	});

	if (!store) throw new Error(`Store with URL "${storeUrl}" not found.`);

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
	});
	return products;
};
