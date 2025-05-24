"use server";

// Clerk
import { currentUser } from "@clerk/nextjs/server";

// DB
import { db } from "@/lib/db";

// Prisma model
import { Category, SubCategory } from "@prisma/client";

// Function: upsertSubCategory
// Description: Upserts a SubCategory into the database, updating if it exists or creating a new one if not.
// Permission Level: Admin only
// Parameters:
//   - SubCategory: SubCategory object containing details of the SubCategory to be upserted.
// Returns: Updated or newly created SubCategory details.

export const upsertSubCategory = async (subCategory: SubCategory) => {
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

		// Ensure sybCategory data is provided
		if (!subCategory) throw new Error("Please provide subCategory data.");

		// Throw error if category with same name or URL already exists
		const existingSubCategory = await db.subCategory.findFirst({
			where: {
				AND: [
					{
						OR: [
							{ name: subCategory.name },
							{ url: subCategory.url },
						],
					},
					{
						NOT: {
							id: subCategory.id,
						},
					},
				],
			},
		});

		// Throw error if subCategory with same name or URL already exists
		if (existingSubCategory) {
			let errorMessage = "";
			if (existingSubCategory.name === subCategory.name) {
				errorMessage =
					"A subCategory with the same name already exists";
			} else if (existingSubCategory.url === subCategory.url) {
				errorMessage = "A subCategory with the same URL already exists";
			}
			throw new Error(errorMessage);
		}

		// Upsert category into the database
		const subCategoryDetails = await db.subCategory.upsert({
			where: {
				id: subCategory.id,
			},
			update: subCategory,
			create: subCategory,
		});
		return subCategoryDetails;
	} catch (error) {
		// Log and re-throw any errors
		console.log(error);
		throw error;
	}
};

// Function: getAllSubCategories
// Description: Retrieves all subCategories from the database.
// Permission Level: Public
// Returns: Array of subCategories sorted by updatedAt date in descending order.

export const getAllSubCategories = async () => {
	try {
		// Retrieve all subCategories from the database
		const subCategories = await db.subCategory.findMany({
			include: {
				category: true,
			},
			orderBy: { updatedAt: "desc" },
		});
		return subCategories;
	} catch (error) {
		// Log and re-throw any errors
		console.log(error);
		throw error;
	}
};

// Function: getSubCategory
// Description: Retrieves a subCategory from the database by its ID.
// Permission Level: Public
// Parameters:
// - subCategoryId: ID of the subCategory to retrieve.
// Returns: subCategory details if found, otherwise undefined.
export const getSubCategory = async (subCategoryId: string) => {
	try {
		if (!subCategoryId) throw new Error("Please provide a subCategory ID.");

		// Retrieve subCategory from the database
		const subCategory = await db.subCategory.findUnique({
			where: {
				id: subCategoryId,
			},
		});
		return subCategory;
	} catch (error) {
		// Log and re-throw any errors
		console.log(error);
		throw error;
	}
};

// Function: deleteSubCategory
// Description: Deletes a subCategory from the database by its ID.
// Permission Level: Admin only
// Parameters:
// - subCategoryId: ID of the subCategory to delete.
// Returns: Boolean indicating whether the subCategory was deleted successfully.
export const deleteSubCategory = async (subCategoryId: string) => {
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

		if (!subCategoryId) throw new Error("Please provide a subCategory ID.");

		// Delete subCategory from the database
		const response = await db.subCategory.delete({
			where: {
				id: subCategoryId,
			},
		});
		return response;
	} catch (error) {
		// Log and re-throw any errors
		console.log(error);
		throw error;
	}
};

// Function: getSubcategories
// Description: Retrieves subcategories from the database, with options for limiting results and random selection.
// Permission Level: Public
// Parameters:
// - limit: Number indicating the maximum number of subcategories to retrieve.
// - random: Boolean indicating whether to randomly select subcategories.
// Returns: List of subcategories based on the provided options.
export const getSubcategories = async (
	limit: number | null = null,
	random: boolean = false
): Promise<SubCategory[]> => {
	// Define SortOrder enum
	enum SortOrder {
		asc = "asc",
		desc = "desc",
	}
	try {
		// Define query options
		const queryOptions = {
			take: limit || undefined, // Use the provided limit or undefined for no limit
			orderBy: random ? { createdAt: SortOrder.desc } : undefined,
		};

		// If random selection is required, use a raw query to randomize
		if (random) {
			const subcategories = await db.$queryRaw<SubCategory[]>`
			SELECT * FROM SubCategory ORDER BY RAND() LIMIT ${limit || 10};
			`;
			return subcategories;
		} else {
			// Otherwise, fetch subcategories based on the defined query options
			const subcategories = await db.subCategory.findMany(queryOptions);
			return subcategories;
		}
	} catch (error) {
		// Log and re-throw any errors
		console.log("Error fetching subcategories", error);
		throw error;
	}
};
