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

// Product form schema
export const ProductFormSchema = z.object({
	name: z
		.string({
			required_error: "Product name is required.",
			invalid_type_error: "Product name must be a string.",
		})
		.min(2, {
			message: "Product name must be at least 2 characters long.",
		})
		.max(200, { message: "Product name cannot exceed 200 characters." })
		.regex(/^(?!.*(?:[-_ ]){2,})[a-zA-Z0-9_ -]+$/, {
			message:
				"Only letters, numbers, and spaces are allowed in the product name.",
		}),
	description: z
		.string({
			required_error: "Product description is required.",
			invalid_type_error: "Product description must be a string.",
		})
		.min(200, {
			message:
				"Product description must be at least 200 characters long.",
		}),
	variantName: z
		.string({
			required_error: "Product variant name is required.",
			invalid_type_error: "Product variant name must be a string.",
		})
		.min(2, {
			message: "Product variant name must be at least 2 characters long.",
		})
		.max(100, {
			message: "Product variant name cannot exceed 100 characters.",
		})
		.regex(/^(?!.*(?:[-_ ]){2,})[a-zA-Z0-9_ -]+$/, {
			message:
				"Only letters, numbers, and spaces are allowed in the product variant name.",
		}),
	variantDescription: z
		.string({
			required_error: "Product variant description is required.",
			invalid_type_error: "Product variant description must be a string.",
		})
		.optional(),
	images: z
		.object({
			url: z.string(),
		})
		.array()
		.min(3, "Please upload at least 3 images for the product")
		.max(6, "Please upload a maximum of 6 images for the product"),
	variantImage: z
		.object({
			url: z.string(),
		})
		.array()
		.length(1, "Choose a variant image."),
	categoryId: z
		.string({
			required_error: "Product category is required",
			invalid_type_error: "Product category must be a string",
		})
		.uuid(),
	subCategoryId: z
		.string({
			required_error: "Product subcategory is required",
			invalid_type_error: "Product subcategory must be a string",
		})
		.uuid(),
	brand: z
		.string({
			required_error: "Product brand is required",
			invalid_type_error: "Product brand must be a string",
		})
		.min(2, {
			message: "Product brand must be at least 2 characters long.",
		})
		.max(50, {
			message: "Product brand cannot exceed 50 characters.",
		}),
	sku: z
		.string({
			required_error: "Product SKU is required",
			invalid_type_error: "Product SKU must be a string",
		})
		.min(6, {
			message: "Product SKU must be at least 6 characters long.",
		})
		.max(50, {
			message: "Product SKU cannot exceed 50 characters.",
		}),
	keywords: z
		.string({
			required_error: "Product keywords are required",
			invalid_type_error: "Product keywords must be a string",
		})
		.array()
		.min(5, {
			message: "Product keywords must contain at least 5 keywords.",
		})
		.max(10, {
			message: "Product keywords cannot exceed 10 keywords.",
		}),
	colors: z
		.object({
			color: z.string(),
		})
		.array()
		.min(1, "Product must have at least one color.")
		.refine((colors) => colors.every((c) => c.color.length > 0), {
			message: "Color name cannot be empty.",
		}),
	sizes: z
		.object({
			size: z.string(),
			quantity: z
				.number()
				.min(1, "Product variant must have at least one size."),
			price: z
				.number()
				.min(0.01, "Product price must be greater than 0."),
			discount: z.number().min(0).default(0),
		})
		.array()
		.min(1, "Product must have at least one size.")
		.refine(
			(sizes) =>
				sizes.every(
					(s) => s.size.length > 0 && s.quantity > 0 && s.price > 0
				),
			{
				message:
					"Size name, quantity, and price cannot be empty or less than 1.",
			}
		),
	product_specs: z
		.object({
			name: z.string(),
			value: z.string(),
		})
		.array()
		.min(1, "Product must have at least one product spec.")
		.refine(
			(product_specs) =>
				product_specs.every(
					(s) => s.name.length > 0 && s.value.length > 0
				),
			{
				message: "All product specs must have a name and value.",
			}
		),
	variant_specs: z
		.object({
			name: z.string(),
			value: z.string(),
		})
		.array()
		.min(1, "Product must have at least one product variant spec.")
		.refine(
			(product_specs) =>
				product_specs.every(
					(s) => s.name.length > 0 && s.value.length > 0
				),
			{
				message:
					"All product variant specs must have a name and value.",
			}
		),
	questions: z
		.object({
			question: z.string(),
			answer: z.string(),
		})
		.array()
		.min(1, "Product must have at least one product question.")
		.refine(
			(questions) =>
				questions.every(
					(q) => q.question.length > 0 && q.answer.length > 0
				),
			{
				message:
					"All product question inputs must be filled correctly.",
			}
		),

	isSale: z.boolean().default(false),
	saleEndDate: z.string().optional(),
});
