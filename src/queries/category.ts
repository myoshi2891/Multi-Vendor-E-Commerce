"use server";

// Clerk
import { currentUser } from "@clerk/nextjs/server";

// DB
import { db } from "@/lib/db";

// Prisma model
import { Category } from "@prisma/client";

// Function: upsertCategory
// Description: Upserts a category into the database, updating if it exists or creating a new one if not.
// Permission Level: Admin only
// Parameters:
//   - category: Category object containing details of the category to be upserted.
// Returns: Updated or newly created category details.

export const upsertCategory = async (category: Category) => {
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

        // Ensure category data is provided
        if (!category) throw new Error("Please provide category data.");

        // Throw error if category with same name or URL already exists
        const existingCategory = await db.category.findFirst({
            where: {
                AND: [
                    {
                        OR: [{ name: category.name }, { url: category.url }],
                    },
                    {
                        NOT: {
                            id: category.id,
                        },
                    },
                ],
            },
        });

        // Throw error if category with same name or URL already exists
        if (existingCategory) {
            let errorMessage = "";
            if (existingCategory.name === category.name) {
                errorMessage = "A category with the same name already exists";
            } else if (existingCategory.url === category.url) {
                errorMessage = "A category with the same URL already exists";
            }
            throw new Error(errorMessage);
        }

        // Upsert category into the database
        const categoryDetails = await db.category.upsert({
            where: {
                id: category.id,
            },
            update: category,
            create: category,
        });
        return categoryDetails;
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
            include: { subCategories: true },
            orderBy: { updatedAt: "desc" },
        });
        return categories;
    } catch (error) {
        // Log and re-throw any errors
        console.log(error);
        throw error;
    }
};

// Function: getAllSubCategoriesFotCategory
// Description: Retrieves all SubCategories for a category from the database.
// Permission Level: Public
// Returns: Array of SubCategories of Category sorted by updatedAt date in descending order.

export const getAllSubCategoriesFotCategory = async (categoryId: string) => {
    try {
        // Retrieve all subCategories of Category from the database
        const subCategories = await db.subCategory.findMany({
            where: { categoryId },
            orderBy: { updatedAt: "desc" },
        });
        return subCategories;
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
