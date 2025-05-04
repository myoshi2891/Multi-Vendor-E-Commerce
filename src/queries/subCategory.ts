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
						OR: [{ name: subCategory.name }, { url: subCategory.url }],
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
				errorMessage = "A subCategory with the same name already exists";
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

// Function: getAllCategories
// Description: Retrieves all categories from the database.
// Permission Level: Public
// Returns: Array of categories sorted by updatedAt date in descending order.

export const getAllCategories = async () => {
	try {
		// Retrieve all categories from the database
		const categories = await db.category.findMany({
			orderBy: { updatedAt: "desc" },
		});
		return categories;
	} catch (error) {
		// Log and re-throw any errors
		console.log(error);
		throw error;
	}
};

// Function: getCategory
// Description: Retrieves a category from the database by its ID.
// Permission Level: Public
// Parameters:
// - categoryId: ID of the category to retrieve.
// Returns: Category details if found, otherwise undefined.

export const getCategory = async (categoryId: string) => {
	try {
		if (!categoryId) throw new Error("Please provide a category ID.");

		// Retrieve category from the database
		const category = await db.category.findUnique({
			where: {
				id: categoryId,
			},
		});
		return category;
	} catch (error) {
		// Log and re-throw any errors
		console.log(error);
		throw error;
	}
};

// Function: deleteCategory
// Description: Deletes a category from the database by its ID.
// Permission Level: Admin only
// Parameters:
// - categoryId: ID of the category to delete.
// Returns: Boolean indicating whether the category was deleted successfully.

export const deleteCategory = async (categoryId: string) => {
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

		if (!categoryId) throw new Error("Please provide a category ID.");

		// Delete category from the database
		const response = await db.category.delete({
			where: {
				id: categoryId,
			},
		});
		return response;
	} catch (error) {
		// Log and re-throw any errors
		console.log(error);
		throw error;
	}
};
