"use client";
import * as z from "zod";

// Category form schema
export const CategoryFormSchema = z.object({
	name: z
		.string({
			required_error: "Category name is required.",
			invalid_type_error: "Category name must be a string.",
		})
		.min(2, {
			message: "Category name must be at least 2 characters long.",
		})
		.max(50, { message: "Category name cannot exceed 50 characters." })
		.regex(/^[a-zA-Z0-9\s]+$/, {
			message:
				"Only letters, numbers, and spaces are allowed in the category name.",
		}),
	image: z
		.object({
			url: z.string(),
		})
		.array()
		.length(1, "Choose a category image."),
	url: z
		.string({
			required_error: "Category url is required",
			invalid_type_error: "Category url must be a string",
		})
		.min(2, { message: "Category url must be at least 2 characters long." })
		.max(50, { message: "Category url cannot exceed 50 characters." })
		.regex(/^(?!.*(?:[-_ ]){2,})[a-zA-Z0-9_-]+$/, {
			message:
				"Only letters, numbers, hyphen, and underscore are allowed in the category url, and consecutive occurrences of hyphens, underscores, or spaces are not permitted.",
		}),
	featured: z.boolean().default(false),
});

//SubCategory form schema
export const SubCategoryFormSchema = z.object({
	name: z
		.string({
			required_error: "SubCategory name is required.",
			invalid_type_error: "SubCategory name must be a string.",
		})
		.min(2, {
			message: "SubCategory name must be at least 2 characters long.",
		})
		.max(50, { message: "SubCategory name cannot exceed 50 characters." })
		.regex(/^[a-zA-Z0-9\s]+$/, {
			message:
				"Only letters, numbers, and spaces are allowed in the Subcategory name.",
		}),
	image: z
		.object({
			url: z.string(),
		})
		.array()
		.length(1, "Choose a Subcategory image."),
	url: z
		.string({
			required_error: "SubCategory url is required",
			invalid_type_error: "SubCategory url must be a string",
		})
		.min(2, {
			message: "SubCategory url must be at least 2 characters long.",
		})
		.max(50, { message: "SubCategory url cannot exceed 50 characters." })
		.regex(/^(?!.*(?:[-_ ]){2,})[a-zA-Z0-9_-]+$/, {
			message:
				"Only letters, numbers, hyphen, and underscore are allowed in the Subcategory url, and consecutive occurrences of hyphens, underscores, or spaces are not permitted.",
		}),
	featured: z.boolean().default(false),
	categoryId: z.string().uuid(),
});

// Store form schema
export const StoreFormSchema = z.object({
	name: z
		.string({
			required_error: "Store name is required.",
			invalid_type_error: "Store name must be a string.",
		})
		.min(2, {
			message: "Store name must be at least 2 characters long.",
		})
		.max(50, { message: "Store name cannot exceed 50 characters." })
		.regex(/^(?!.*(?:[-_ ]){2,})[a-zA-Z0-9_ -]+$/, {
			message:
				"Only letters, numbers, hyphen, underscore and spaces are allowed in the store name.",
		}),
	description: z
		.string({
			required_error: "Store description is required.",
			invalid_type_error: "Store description must be a string.",
		})
		.min(30, {
			message: "Store description must be at least 30 characters long.",
		})
		.max(500, {
			message: "Store description cannot exceed 500 characters.",
		}),
	email: z
		.string({
			required_error: "Store email is required",
			invalid_type_error: "Store email must be a string",
		})
		.email({
			message: "Invalid email format.",
		}),
	phone: z
		.string({
			required_error: "Store phone number is required",
			invalid_type_error: "Store phone number must be a string",
		})
		.regex(/^\+?\d+$/, { message: "Invalid phone number format." }),
	logo: z
		.object({
			url: z.string(),
		})
		.array()
		.length(1, "Choose a logo image."),
	cover: z
		.object({
			url: z.string(),
		})
		.array()
		.length(1, "Choose a cover image."),
	url: z
		.string({
			required_error: "Store url is required",
			invalid_type_error: "Store url must be a string",
		})
		.min(2, { message: "Store url must be at least 2 characters long." })
		.max(50, { message: "Store url cannot exceed 50 characters." })
		.regex(/^(?!.*(?:[-_ ]){2,})[a-zA-Z0-9_-]+$/, {
			message:
				"Only letters, numbers, hyphen, underscore and spaces are allowed in the store url.",
		}),
	featured: z.boolean().default(false).optional(),
	status: z.string().default("PENDING").optional(),
});
