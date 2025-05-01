import * as z from "zod";

// Category form schema
export const CategoryFormSchema = z.object({
	name: z
		.string({
			required_error: "Category name is required",
			invalid_type_error: "Category name must be a string",
		})
		.min(2, { message: "Category name must be at least 2 characters long" })
		.max(50, {
			message: "Category name must be no more than 50 characters long",
		})
		.regex(/^[a-zA-Z0-9\s]+$/, {
			message:
				"Category name can only contain alphanumeric characters and spaces",
		}),
	image: z
		.object({
			url: z.string(),
		})
		.array()
		.length(1, "Choose only one image for the category"),
	url: z
		.string({
			required_error: "Category URL is required",
			invalid_type_error: "Category URL must be a string",
		})
		.min(2, { message: "Category URL must be at least 5 characters long" })
		.max(50, {
			message: "Category URL must be no more than 50 characters long",
		})
		.regex(/^(?!.*(?:[-_ ]){2,})[a-zA-Z0-9_-]+$/, {
			message:
				"Category URL can only contain alphanumeric characters, underscores, and hyphens",
        }),
    featured: z.boolean().default(false),
});
