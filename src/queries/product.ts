"use server";
// DB
import { db } from "@/lib/db";
// Types
import {
	ProductPageType,
	ProductWithVariantType,
	VariantImageType,
	VariantSimplified,
} from "@/lib/types";
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
			questions: {
				create: product.questions.map((question) => ({
					question: question.question,
					answer: question.answer,
				})),
			},
			specs: {
				create: product.product_specs.map((spec) => ({
					name: spec.name,
					value: spec.value,
				})),
			},
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
			saleEndDate: product.isSale ? product.saleEndDate : "",
			sku: product.sku,
			keywords: product.keywords.join(","),
			specs: {
				create: product.variant_specs.map((spec) => ({
					name: spec.name,
					value: spec.value,
				})),
			},
			images: {
				create: product.images.map((image) => ({
					url: image.url,
					alt: image.url.split("/").pop() || "",
				})),
			},
			variantImage: product.variantImage,
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

// Function: getAllStoreProducts
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

// Function: deleteProduct
// Description: Deletes a product and its associated variants from the database
// Access Level: Seller only
// Parameters:
// - productId: ID of the product to be deleted.
// Returns: True if the product and its variants are successfully deleted, false otherwise.

export const deleteProduct = async (productId: string) => {
	try {
		// Retrieve current user
		const user = await currentUser();
		// Check if user is authenticated
		if (!user) throw new Error("Unauthenticated.");
		// Ensure user has seller privileges
		if (user.privateMetadata.role !== "SELLER")
			throw new Error(
				"Only sellers and administrators can perform this action."
			);
		// Ensure product data is provided
		if (!productId) throw new Error("Please provide product ID.");

		// Delete the product and its variants
		const response = await db.product.delete({
			where: { id: productId },
		});
		return response;
	} catch (error) {
		console.log(error);
		throw error;
	}
};

// Function: getProducts
// Description: Retrieves filtered products based on specified criteria. Supports pagination.
// Access Level: Public
// Parameters:
// - filters: Object containing filter criteria (e.g., category, subCategory, offerTag, minPrice, maxPrice, keywords).
// - sortBy: Sorting criteria (e.g., Most popular, New Arrival, Top Rated...).
// - page: Page number for pagination. (default = 1)
// - pageSize: Number of products per page. (default = 10)
// Returns: Array of filtered products, including category, subcategory, variants, and pagination metadata (totalPages, currentPage, pageSize, totalCount).

export const getProducts = async (
	filters = {},
	sortBy = "",
	page: number = 1,
	pageSize: number = 10
) => {
	// Default values for page and pageSize
	const currentPage = page;
	const limit = pageSize;
	const skip = (currentPage - 1) * limit;

	// Construct the base query
	const whereClause: any = {
		AND: [],
	};

	// Get all filtered, sorted products
	const products = await db.product.findMany({
		where: whereClause,
		take: limit, // Limit to page size
		skip: skip, // Skip the products of previous pages
		include: {
			variants: {
				include: {
					sizes: true,
					images: true,
					colors: true,
				},
			},
		},
	});

	// Transform the products with filtered variants into ProductCardType structure
	const productsWithFilteredVariants = products.map((product) => {
		// Filter the variants based on the filters
		const filteredVariants = product.variants;

		// Transform the filtered variants into the VariantSimplified structure
		const variants: VariantSimplified[] = filteredVariants.map(
			(variant) => ({
				variantId: variant.id,
				variantSlug: variant.slug,
				variantName: variant.variantName,
				images: variant.images,
				sizes: variant.sizes,
			})
		);

		// Extract variant images for the product
		const variantImages: VariantImageType[] = filteredVariants.map(
			(variant) => ({
				url: `/product/${product.slug}/${variant.slug}`,
				image: variant.variantImage
					? variant.variantImage
					: variant.images[0].url,
			})
		);
		// Return the product in the ProductCardType structure
		return {
			id: product.id,
			slug: product.slug,
			name: product.name,
			rating: product.rating,
			sales: product.sales,
			variants,
			variantImages,
		};
	});

	// Retrieve products matching the filters
	// const totalCount = await db.product.count({
	// 	where: whereClause,
	// });
	const totalCount = products.length;

	// Calculate total pages
	const totalPages = Math.ceil(totalCount / pageSize);

	// Return the filtered products, pagination metadata, and total count
	return {
		products: productsWithFilteredVariants,
		totalPages,
		currentPage,
		pageSize,
		totalCount,
	};
};

// Function: getProductPageData
// Description: Retrieves product data (including product and variant details) for a specific product page
// Access Level: Public
// Parameters:
// - productId: The slug of the product to which the variant belongs.
// - variantId: The ID of the variant for which to retrieve data.
// Returns: Product data (including product and variant details) or null if the product or variant is not found.

export const getProductPageData = async (
	productSlug: string,
	variantSlug: string
) => {
	// Retrieve product and variant details from the database
	const product = await retrieveProductDetails(productSlug, variantSlug);
	if (!product) return;

	return formatProductResponse(product);
};

// Helper functions
export const retrieveProductDetails = async (
	productSlug: string,
	variantSlug: string
) => {
	const product = await db.product.findUnique({
		where: {
			slug: productSlug,
		},
		include: {
			category: true,
			subCategory: true,
			offerTag: true,
			store: true,
			specs: true,
			questions: true,
			variants: {
				where: {
					slug: variantSlug,
				},
				include: {
					images: true,
					colors: true,
					sizes: true,
					specs: true,
				},
			},
		},
	});

	if (!product) return null;
	// Get variant images
	const variantImages = await db.productVariant.findMany({
		where: {
			productId: product.id,
		},
		select: {
			slug: true,
			variantImage: true,
		},
	});

	console.log("variantImages", variantImages);

	return {
		...product,
		variantImages: variantImages.map((v) => ({
			url: `/product/${productSlug}/${v.slug}`,
			img: v.variantImage,
			slug: v.slug,
		})),
	};
};

const formatProductResponse = (product: ProductPageType) => {
	if (!product) return;
	const variant = product.variants[0];
	const { store, category, subCategory, offerTag, questions } = product;
	const { images, colors, sizes } = variant;

	return {
		productId: product.id,
		variantId: variant.id,
		productSlug: product.slug,
		variantSlug: variant.slug,
		name: product.name,
		description: product.description,
		variantName: variant.variantName,
		variantDescription: variant.variantDescription,
		images,
		category,
		subCategory,
		offerTag,
		isSale: variant.isSale,
		saleEndDate: variant.saleEndDate,
		brand: product.brand,
		sku: variant.sku,
		store: {
			id: store.id,
			url: store.url,
			name: store.name,
			logo: store.logo,
			followersCount: 10,
			isUserFollowingStore: true,
		},
		colors,
		sizes,
		specs: {
			product: product.specs,
			variant: variant.specs,
		},
		questions,
		rating: product.rating,
		reviews: [],
		numReviews: 122,
		reviewsStatistics: {
			ratingStatistics: [],
			reviewWithImagesCount: 5,
		},
		shippingDetails: {},
		relatedProducts: [],
		variantImages: product.variantImages,
	};
};
