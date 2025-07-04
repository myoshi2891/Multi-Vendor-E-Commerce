'use client'
import { ShippingFeeMethod } from '@prisma/client'
import { lastDayOfDecade } from 'date-fns'
import { deflate } from 'zlib'
import * as z from 'zod'

// Category form schema
export const CategoryFormSchema = z.object({
    name: z
        .string({
            required_error: 'Category name is required.',
            invalid_type_error: 'Category name must be a string.',
        })
        .min(2, {
            message: 'Category name must be at least 2 characters long.',
        })
        .max(50, { message: 'Category name cannot exceed 50 characters.' })
        .regex(/^[a-zA-Z0-9\s]+$/, {
            message:
                'Only letters, numbers, and spaces are allowed in the category name.',
        }),
    image: z
        .object({
            url: z.string(),
        })
        .array()
        .length(1, 'Choose a category image.'),
    url: z
        .string({
            required_error: 'Category url is required',
            invalid_type_error: 'Category url must be a string',
        })
        .min(2, { message: 'Category url must be at least 2 characters long.' })
        .max(50, { message: 'Category url cannot exceed 50 characters.' })
        .regex(/^(?!.*(?:[-_ ]){2,})[a-zA-Z0-9_-]+$/, {
            message:
                'Only letters, numbers, hyphen, and underscore are allowed in the category url, and consecutive occurrences of hyphens, underscores, or spaces are not permitted.',
        }),
    featured: z.boolean().default(false),
})

//SubCategory form schema
export const SubCategoryFormSchema = z.object({
    name: z
        .string({
            required_error: 'SubCategory name is required.',
            invalid_type_error: 'SubCategory name must be a string.',
        })
        .min(2, {
            message: 'SubCategory name must be at least 2 characters long.',
        })
        .max(50, { message: 'SubCategory name cannot exceed 50 characters.' })
        .regex(/^[a-zA-Z0-9\s]+$/, {
            message:
                'Only letters, numbers, and spaces are allowed in the Subcategory name.',
        }),
    image: z
        .object({
            url: z.string(),
        })
        .array()
        .length(1, 'Choose a Subcategory image.'),
    url: z
        .string({
            required_error: 'SubCategory url is required',
            invalid_type_error: 'SubCategory url must be a string',
        })
        .min(2, {
            message: 'SubCategory url must be at least 2 characters long.',
        })
        .max(50, { message: 'SubCategory url cannot exceed 50 characters.' })
        .regex(/^(?!.*(?:[-_ ]){2,})[a-zA-Z0-9_-]+$/, {
            message:
                'Only letters, numbers, hyphen, and underscore are allowed in the Subcategory url, and consecutive occurrences of hyphens, underscores, or spaces are not permitted.',
        }),
    featured: z.boolean().default(false),
    categoryId: z.string().uuid(),
})

// Store form schema
export const StoreFormSchema = z.object({
    name: z
        .string({
            required_error: 'Store name is required.',
            invalid_type_error: 'Store name must be a string.',
        })
        .min(2, {
            message: 'Store name must be at least 2 characters long.',
        })
        .max(50, { message: 'Store name cannot exceed 50 characters.' })
        .regex(/^(?!.*(?:[-_ ]){2,})[a-zA-Z0-9_ -]+$/, {
            message:
                'Only letters, numbers, hyphen, underscore and spaces are allowed in the store name.',
        }),
    description: z
        .string({
            required_error: 'Store description is required.',
            invalid_type_error: 'Store description must be a string.',
        })
        .min(30, {
            message: 'Store description must be at least 30 characters long.',
        })
        .max(500, {
            message: 'Store description cannot exceed 500 characters.',
        }),
    email: z
        .string({
            required_error: 'Store email is required',
            invalid_type_error: 'Store email must be a string',
        })
        .email({
            message: 'Invalid email format.',
        }),
    phone: z
        .string({
            required_error: 'Store phone number is required',
            invalid_type_error: 'Store phone number must be a string',
        })
        .regex(/^\+?\d+$/, { message: 'Invalid phone number format.' }),
    logo: z
        .object({
            url: z.string(),
        })
        .array()
        .length(1, 'Choose a logo image.'),
    cover: z
        .object({
            url: z.string(),
        })
        .array()
        .length(1, 'Choose a cover image.'),
    url: z
        .string({
            required_error: 'Store url is required',
            invalid_type_error: 'Store url must be a string',
        })
        .min(2, { message: 'Store url must be at least 2 characters long.' })
        .max(50, { message: 'Store url cannot exceed 50 characters.' })
        .regex(/^(?!.*(?:[-_ ]){2,})[a-zA-Z0-9_-]+$/, {
            message:
                'Only letters, numbers, hyphen, underscore and spaces are allowed in the store url.',
        }),
    featured: z.boolean().default(false).optional(),
    status: z.string().default('PENDING').optional(),
})

// Product form schema
export const ProductFormSchema = z.object({
    name: z
        .string({
            required_error: 'Product name is required.',
            invalid_type_error: 'Product name must be a string.',
        })
        .min(2, {
            message: 'Product name must be at least 2 characters long.',
        })
        .max(200, { message: 'Product name cannot exceed 200 characters.' })
        .regex(/^(?!.*(?:[-_ ]){2,})[a-zA-Z0-9_ -]+$/, {
            message:
                'Only letters, numbers, and spaces are allowed in the product name.',
        }),
    description: z
        .string({
            required_error: 'Product description is required.',
            invalid_type_error: 'Product description must be a string.',
        })
        .min(200, {
            message:
                'Product description must be at least 200 characters long.',
        }),
    variantName: z
        .string({
            required_error: 'Product variant name is required.',
            invalid_type_error: 'Product variant name must be a string.',
        })
        .min(2, {
            message: 'Product variant name must be at least 2 characters long.',
        })
        .max(100, {
            message: 'Product variant name cannot exceed 100 characters.',
        })
        .regex(/^(?!.*(?:[-_ ]){2,})[a-zA-Z0-9_ -]+$/, {
            message:
                'Only letters, numbers, and spaces are allowed in the product variant name.',
        }),
    variantDescription: z
        .string({
            required_error: 'Product variant description is required.',
            invalid_type_error: 'Product variant description must be a string.',
        })
        .optional(),
    images: z
        .object({
            url: z.string(),
        })
        .array()
        .min(3, 'Please upload at least 3 images for the product')
        .max(6, 'Please upload a maximum of 6 images for the product'),
    variantImage: z
        .object({
            url: z.string(),
        })
        .array()
        .length(1, 'Choose a variant image.'),
    categoryId: z
        .string({
            required_error: 'Product category is required',
            invalid_type_error: 'Product category must be a string',
        })
        .uuid(),
    subCategoryId: z
        .string({
            required_error: 'Product subcategory is required',
            invalid_type_error: 'Product subcategory must be a string',
        })
        .uuid(),
    offerTagId: z
        .string({
            required_error: 'Product offer tag ID is mandatory.',
            invalid_type_error: 'Product offer tag ID must be a valid UUID.',
        })
        .uuid()
        .optional(),
    brand: z
        .string({
            required_error: 'Product brand is required',
            invalid_type_error: 'Product brand must be a string',
        })
        .min(2, {
            message: 'Product brand must be at least 2 characters long.',
        })
        .max(50, {
            message: 'Product brand cannot exceed 50 characters.',
        }),
    sku: z
        .string({
            required_error: 'Product SKU is required',
            invalid_type_error: 'Product SKU must be a string',
        })
        .min(6, {
            message: 'Product SKU must be at least 6 characters long.',
        })
        .max(50, {
            message: 'Product SKU cannot exceed 50 characters.',
        }),
    weight: z.number().min(0.01, {
        message: 'Product weight must be greater than or equal to 0.01.',
    }),
    keywords: z
        .string({
            required_error: 'Product keywords are required',
            invalid_type_error: 'Product keywords must be a string',
        })
        .array()
        .min(5, {
            message: 'Product keywords must contain at least 5 keywords.',
        })
        .max(10, {
            message: 'Product keywords cannot exceed 10 keywords.',
        }),
    colors: z
        .object({
            color: z.string(),
        })
        .array()
        .min(1, 'Product must have at least one color.')
        .refine((colors) => colors.every((c) => c.color.length > 0), {
            message: 'Color name cannot be empty.',
        }),
    sizes: z
        .object({
            size: z.string(),
            quantity: z
                .number()
                .min(1, 'Product variant must have at least one size.'),
            price: z
                .number()
                .min(0.01, 'Product price must be greater than 0.'),
            discount: z.number().min(0).default(0),
        })
        .array()
        .min(1, 'Product must have at least one size.')
        .refine(
            (sizes) =>
                sizes.every(
                    (s) => s.size.length > 0 && s.quantity > 0 && s.price > 0
                ),
            {
                message:
                    'Size name, quantity, and price cannot be empty or less than 1.',
            }
        ),
    product_specs: z
        .object({
            name: z.string(),
            value: z.string(),
        })
        .array()
        .min(1, 'Product must have at least one product spec.')
        .refine(
            (product_specs) =>
                product_specs.every(
                    (s) => s.name.length > 0 && s.value.length > 0
                ),
            {
                message: 'All product specs must have a name and value.',
            }
        ),
    variant_specs: z
        .object({
            name: z.string(),
            value: z.string(),
        })
        .array()
        .min(1, 'Product must have at least one product variant spec.')
        .refine(
            (product_specs) =>
                product_specs.every(
                    (s) => s.name.length > 0 && s.value.length > 0
                ),
            {
                message:
                    'All product variant specs must have a name and value.',
            }
        ),
    questions: z
        .object({
            question: z.string(),
            answer: z.string(),
        })
        .array()
        // .min(1, "Product must have at least one product question.")
        .refine(
            (questions) =>
                questions.every(
                    (q) => q.question.length > 0 && q.answer.length > 0
                ),
            {
                message:
                    'All product question inputs must be filled correctly.',
            }
        )
        .optional(),

    isSale: z.boolean().default(false),
    saleEndDate: z.string().optional(),
    freeShippingForAllCountries: z.boolean().default(false),
    freeShippingCountriesIds: z
        .object({
            id: z.string().optional(),
            label: z.string(),
            value: z.string(),
        })
        .array()
        .optional()
        .refine(
            (ids) => ids?.every((item) => item.label && item.value),
            'Each country must have a label and value.'
        )
        .default([]),
    shippingFeeMethod: z.nativeEnum(ShippingFeeMethod),
})

// OfferTag form schema
export const OfferTagFormSchema = z.object({
    name: z
        .string({
            required_error: 'Category name is required.',
            invalid_type_error: 'Category nale must be a string.',
        })
        .min(2, {
            message: 'Category name must be at least 2 characters long.',
        })
        .max(50, { message: 'Category name cannot exceed 50 characters.' })
        .regex(/^[a-zA-Z0-9\s&$.%,']+$/, {
            message:
                'Only letters, numbers, and spaces are allowed in the category name.',
        }),
    url: z
        .string({
            required_error: 'Category url is required',
            invalid_type_error: 'Category url must be a string',
        })
        .min(2, { message: 'Category url must be at least 2 characters long.' })
        .max(50, { message: 'Category url cannot exceed 50 characters.' })
        .regex(/^(?!.*(?:[-_ ]){2,})[a-zA-Z0-9_-]+$/, {
            message:
                'Only letters, numbers, hyphen, and underscore are allowed in the category url, and consecutive occurrences of hyphens, underscores, or spaces are not permitted.',
        }),
})

// Store shipping details
export const StoreShippingFormSchema = z.object({
    defaultShippingService: z
        .string({
            required_error: 'Shipping service name is required',
            // invalid_type_error: "Default shipping service must be a string",
        })
        .min(2, 'Shipping service name must be at least 2 characters long.')
        .max(50, {
            message: 'Shipping service name cannot exceed 50 characters.',
        }),
    defaultShippingFeePerItem: z.number(),
    defaultShippingFeeForAdditionalItem: z.number(),
    defaultShippingFeePerKg: z.number(),
    defaultShippingFeeFixed: z.number(),
    defaultDeliveryTimeMin: z.number(),
    defaultDeliveryTimeMax: z.number(),
    returnPolicy: z.string(),
})

export const ShippingRateFormSchema = z.object({
    shippingService: z
        .string({
            required_error: 'Shipping service name is required',
            invalid_type_error: 'Shipping service must be a string',
        })
        .min(2, 'Shipping service name must be at least 2 characters long.')
        .max(50, {
            message: 'Shipping service name cannot exceed 50 characters.',
        }),
    countryId: z.string().uuid().optional(),
    // freeShipping: z.boolean().default(false),
    countryName: z.string().optional(),
    shippingFeePerItem: z.number(),
    shippingFeeForAdditionalItem: z.number(),
    shippingFeePerKg: z.number(),
    shippingFeeFixed: z.number(),
    deliveryTimeMin: z.number(),
    deliveryTimeMax: z.number(),
    returnPolicy: z
        .string()
        .min(1, 'Return policy must be at least 1 character long.'),
})

export const AddReviewSchema = z.object({
    variantName: z.string().min(1, 'Variant name is required'),
    rating: z.number().min(1, 'Rating must be at least 1.'),
    size: z.string().min(1, 'Size is required'),
    review: z
        .string()
        .min(10, 'Review is required and must be at least 10 characters long.'),
    quantity: z.string().default('1'),
    images: z
        .object({ url: z.string() })
        .array()
        .max(3, 'You can upload a maximum of 3 images for the review.'),
    color: z.string({ required_error: 'Color is required' }),
})

export const ShippingAddressSchema = z.object({
    countryId: z
        .string({
            required_error: 'Country is required',
            invalid_type_error: 'Country must be a string',
        })
        .uuid(),
    firstName: z
        .string({
            required_error: 'First name is required',
            invalid_type_error: 'First name must be a string',
        })
        .min(2, 'First name must be at least 2 characters long')
        .max(50, 'First name cannot exceed 50 characters')
        .regex(/^[a-zA-Z]+$/, {
            message: 'First name can only contain letters.',
        }),
    lastName: z
        .string({
            required_error: 'Last name is required',
            invalid_type_error: 'Last name must be a string',
        })
        .min(2, 'Last name must be at least 2 characters long')
        .max(50, 'Last name cannot exceed 50 characters')
        .regex(/^[a-zA-Z]+$/, {
            message: 'Last name can only contain letters.',
        }),
    phone: z
        .string({
            required_error: 'Phone number is required',
            invalid_type_error: 'Phone number must be a string',
        })
        .regex(/^\+?\d{1,15}$/, { message: 'Invalid phone number format.' }),
    address1: z
        .string({
            required_error: 'Address 1 is required',
            invalid_type_error: 'Address 1 must be a string',
        })
        .min(5, 'Address 1 must be at least 5 characters long')
        .max(100, 'Address 1 cannot exceed 100 characters'),
    address2: z
        .string({
            invalid_type_error: 'Address 2 must be a string',
        })
        .max(100, 'Address 2 cannot exceed 100 characters')
        .optional(),
    state: z
        .string({
            invalid_type_error: 'State must be a string',
            required_error: 'State is required',
        })
        .min(2, { message: 'State must be at least 2 characters long' })
        .max(50, { message: 'State cannot exceed 50 characters' }),

    city: z
        .string({
            required_error: 'City is required',
            invalid_type_error: 'City must be a string',
        })
        .min(2, { message: 'City must be at least 2 characters long' })
        .max(50, { message: 'City cannot exceed 50 characters' }),

    zip_code: z
        .string({
            required_error: 'Zip code is required',
            invalid_type_error: 'Zip code must be a string',
        })
        .min(2, { message: 'Zip code must be at least 2 characters long' })
        .max(10, { message: 'Zip code cannot exceed 10 characters' }),
    // .regex(/^\d{5}(-\s{4})?$/, { message: 'Invalid zip code format.' }),

    default: z.boolean().default(false),
})

export const CouponFormSchema = z.object({
    code: z
        .string({
            required_error: 'Coupon code is required',
            invalid_type_error: 'Coupon code must be a string',
        })
        .min(2, 'Coupon code must be at least 2 characters long')
        .max(50, 'Coupon code cannot exceed 50 characters')
        .regex(/^[A-Za-z0-9]+$/, {
            message: 'Coupon code can only contain letters and numbers.',
        }),
    startDate: z.string({
        required_error: 'Start date is required',
        invalid_type_error: 'Start date must be a valid date',
    }),
    endDate: z.string({
        required_error: 'End date is required',
        invalid_type_error: 'End date must be a valid date',
    }),
    discount: z
        .number({
            required_error: 'Discount percentage is required',
            invalid_type_error: 'Discount percentage must be a number',
        })
        .min(1, 'Discount percentage must be at least 1%')
        .max(99, 'Discount percentage cannot exceed 99%'),
})

export const ApplyCouponFormSchema = z.object({
    coupon: z
        .string({
            required_error: 'Coupon code is required',
            invalid_type_error: 'Coupon code must be a string',
        })
        .min(2, 'Coupon code must be at least 2 characters long'),
})