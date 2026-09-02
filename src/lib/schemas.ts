import { ShippingFeeMethod } from "@prisma/client";
import { OrderStatus, PaymentStatus } from "@/lib/types";
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
        // slug は Category.path のセグメントになる（materialized path / ADR-006）。
        // 区切り文字 `/` と LIKE のメタ文字（`%` `_`）を文字集合で排除することで、
        // `subtreeOf` の startsWith に渡す値のエスケープが不要になる
        // （design.md §2-Q1）。**この制約を緩めないこと。**
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            message:
                "Category url must be lowercase alphanumeric segments separated by single hyphens (e.g. electronics-camera).",
        }),
    featured: z.boolean().default(false),
    // ツリー編集（plan 068）。null はルートを意味する。
    // `path` / `depth` / `childCount` は **親と url から一意に決まる導出値**なので
    // フォームには載せない —— `upsertCategory` がサーバー側で計算する。
    parentId: z.string().nullable().default(null),
    // 同一階層内の並び順。`getAllCategories` の orderBy が
    // `[depth, sortOrder, name]` なので、この値が admin の並べ替え手段になる。
    // RHF の `<input type="number">` は文字列を渡すため coerce が要る。
    sortOrder: z.coerce
        .number({ invalid_type_error: "Sort order must be a number." })
        .int({ message: "Sort order must be an integer." })
        .min(0, { message: "Sort order cannot be negative." })
        .default(0),
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
        // Category と同じ制約（Phase C で SubCategory は Category へ統合されるため、
        // Phase B の間も両者の slug 規則を揃えておく）。design.md §2-Q1 を参照。
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            message:
                "SubCategory url must be lowercase alphanumeric segments separated by single hyphens (e.g. lux-women-dresses).",
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
    offerTagId: z
        .string({
            required_error: "Product offer tag ID is mandatory.",
            invalid_type_error: "Product offer tag ID must be a valid UUID.",
        })
        .uuid()
        .optional(),
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
    weight: z.number().min(0.01, {
        message: "Product weight must be greater than or equal to 0.01.",
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
        // .min(1, "Product must have at least one product question.")
        .refine(
            (questions) =>
                questions.every(
                    (q) => q.question.length > 0 && q.answer.length > 0
                ),
            {
                message:
                    "All product question inputs must be filled correctly.",
            }
        )
        .optional(),

    isSale: z.boolean().default(false),
    saleEndDate: z.string().datetime({ offset: true }).nullish(),
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
            "Each country must have a label and value."
        )
        .default([]),
    shippingFeeMethod: z.nativeEnum(ShippingFeeMethod),
});

// OfferTag form schema
export const OfferTagFormSchema = z.object({
    name: z
        .string({
            required_error: "Category name is required.",
            invalid_type_error: "Category nale must be a string.",
        })
        .min(2, {
            message: "Category name must be at least 2 characters long.",
        })
        .max(50, { message: "Category name cannot exceed 50 characters." })
        .regex(/^[a-zA-Z0-9\s&$.%,']+$/, {
            message:
                "Only letters, numbers, and spaces are allowed in the category name.",
        }),
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
});

// Store shipping details
export const StoreShippingFormSchema = z.object({
    defaultShippingService: z
        .string({
            required_error: "Shipping service name is required",
            // invalid_type_error: "Default shipping service must be a string",
        })
        .min(2, "Shipping service name must be at least 2 characters long.")
        .max(50, {
            message: "Shipping service name cannot exceed 50 characters.",
        }),
    defaultShippingFeePerItem: z.number(),
    defaultShippingFeeForAdditionalItem: z.number(),
    defaultShippingFeePerKg: z.number(),
    defaultShippingFeeFixed: z.number(),
    defaultDeliveryTimeMin: z.number(),
    defaultDeliveryTimeMax: z.number(),
    returnPolicy: z.string(),
});

export const ShippingRateFormSchema = z.object({
    shippingService: z
        .string({
            required_error: "Shipping service name is required",
            invalid_type_error: "Shipping service must be a string",
        })
        .min(2, "Shipping service name must be at least 2 characters long.")
        .max(50, {
            message: "Shipping service name cannot exceed 50 characters.",
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
        .min(1, "Return policy must be at least 1 character long."),
});

export const AddReviewSchema = z.object({
    variantName: z.string().min(1, "Variant name is required"),
    rating: z.number().min(1, "Rating must be at least 1."),
    size: z.string().min(1, "Size is required"),
    review: z
        .string()
        .min(10, "Review is required and must be at least 10 characters long."),
    quantity: z.string().default("1"),
    images: z
        .object({ url: z.string() })
        .array()
        .max(3, "You can upload a maximum of 3 images for the review."),
    color: z.string({ required_error: "Color is required" }),
});

export const ShippingAddressSchema = z.object({
    countryId: z
        .string({
            required_error: "Country is required",
            invalid_type_error: "Country must be a string",
        })
        .uuid(),
    firstName: z
        .string({
            required_error: "First name is required",
            invalid_type_error: "First name must be a string",
        })
        .min(2, "First name must be at least 2 characters long")
        .max(50, "First name cannot exceed 50 characters")
        .regex(/^[a-zA-Z]+$/, {
            message: "First name can only contain letters.",
        }),
    lastName: z
        .string({
            required_error: "Last name is required",
            invalid_type_error: "Last name must be a string",
        })
        .min(2, "Last name must be at least 2 characters long")
        .max(50, "Last name cannot exceed 50 characters")
        .regex(/^[a-zA-Z]+$/, {
            message: "Last name can only contain letters.",
        }),
    phone: z
        .string({
            required_error: "Phone number is required",
            invalid_type_error: "Phone number must be a string",
        })
        .regex(/^\+?\d{1,15}$/, { message: "Invalid phone number format." }),
    address1: z
        .string({
            required_error: "Address 1 is required",
            invalid_type_error: "Address 1 must be a string",
        })
        .min(5, "Address 1 must be at least 5 characters long")
        .max(100, "Address 1 cannot exceed 100 characters"),
    address2: z
        .string({
            invalid_type_error: "Address 2 must be a string",
        })
        .max(100, "Address 2 cannot exceed 100 characters")
        .optional(),
    state: z
        .string({
            invalid_type_error: "State must be a string",
            required_error: "State is required",
        })
        .min(2, { message: "State must be at least 2 characters long" })
        .max(50, { message: "State cannot exceed 50 characters" }),

    city: z
        .string({
            required_error: "City is required",
            invalid_type_error: "City must be a string",
        })
        .min(2, { message: "City must be at least 2 characters long" })
        .max(50, { message: "City cannot exceed 50 characters" }),

    zip_code: z
        .string({
            required_error: "Zip code is required",
            invalid_type_error: "Zip code must be a string",
        })
        .min(2, { message: "Zip code must be at least 2 characters long" })
        .max(10, { message: "Zip code cannot exceed 10 characters" }),
    // .regex(/^\d{5}(-\s{4})?$/, { message: 'Invalid zip code format.' }),

    default: z.boolean().default(false),
});

export const CouponFormSchema = z.object({
    code: z
        .string({
            required_error: "Coupon code is required",
            invalid_type_error: "Coupon code must be a string",
        })
        .min(2, "Coupon code must be at least 2 characters long")
        .max(50, "Coupon code cannot exceed 50 characters")
        .regex(/^[A-Za-z0-9]+$/, {
            message: "Coupon code can only contain letters and numbers.",
        }),
    startDate: z.string({
        required_error: "Start date is required",
        invalid_type_error: "Start date must be a valid date",
    }),
    endDate: z.string({
        required_error: "End date is required",
        invalid_type_error: "End date must be a valid date",
    }),
    discount: z
        .number({
            required_error: "Discount percentage is required",
            invalid_type_error: "Discount percentage must be a number",
        })
        // Coupon.discount は Prisma 上 Int。範囲チェックと格納型の検証を同じ境界で行い、
        // 小数が safeParse を通過して Prisma 境界まで運ばれるのを防ぐ
        .int("Discount percentage must be a whole number")
        .min(1, "Discount percentage must be at least 1%")
        .max(99, "Discount percentage cannot exceed 99%"),
});

export const CouponScopeEnum = z.enum(["STORE", "PLATFORM"]);

export const AdminCouponFormSchema = CouponFormSchema.extend({
    isActive: z.boolean().default(true),
    scope: CouponScopeEnum.default("STORE"),
    storeId: z.string().nullable().optional(),
}).superRefine((val, ctx) => {
    // F3-10: STORE なら storeId 必須、PLATFORM なら null/空
    if (val.scope === "STORE" && (!val.storeId || val.storeId.trim() === "")) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["storeId"],
            message: "店舗クーポンには店舗の指定が必要です",
        });
    }
    if (val.scope === "PLATFORM" && val.storeId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["storeId"],
            message: "プラットフォームクーポンに店舗は指定できません",
        });
    }
});

export const ApplyCouponFormSchema = z.object({
    coupon: z
        .string({
            required_error: "Coupon code is required",
            invalid_type_error: "Coupon code must be a string",
        })
        .min(2, "Coupon code must be at least 2 characters long"),
});

export const StoreShippingSchema = z.object({
    returnPolicy: z
        .string({
            required_error: "Return policy is required",
            invalid_type_error: "Return policy must be a string",
        })
        .default("Return inn 30 days"),
    defaultShippingService: z
        .string({
            required_error: "Default shipping service is required",
            invalid_type_error: "Default shipping service must be a string",
        })
        .default("International Delivery"),
    defaultShippingFeePerItem: z
        .number({
            required_error: "Default shipping fee per item is required",
            invalid_type_error:
                "Default shipping fee per item must be a number",
        })
        .default(0),
    defaultShippingFeeForAdditionalItem: z
        .number({
            required_error:
                "Default shipping fee for additional item is required",
            invalid_type_error:
                "Default shipping fee for additional item must be a number",
        })
        .default(0),
    defaultShippingFeePerKg: z
        .number({
            required_error: "Default shipping fee per kg is required",
            invalid_type_error: "Default shipping fee per kg must be a number",
        })
        .default(0),
    defaultShippingFeeFixed: z
        .number({
            required_error: "Default shipping fixed fee is required",
            invalid_type_error: "Default shipping fixed fee must be a number",
        })
        .default(0),
    defaultDeliveryTimeMin: z
        .number({
            required_error: "Default minimum delivery time is required",
            invalid_type_error:
                "Default minimum delivery time must be a number",
        })
        .int()
        .default(7),
    defaultDeliveryTimeMax: z
        .number({
            required_error: "Default maximum delivery time is required",
            invalid_type_error:
                "Default maximum delivery time must be a number",
        })
        .int()
        .default(31),
});

// 在庫数クイック編集（int ≥ 0・上限は運用上のサニティとして 1,000,000）
export const UpdateSizeStockSchema = z.object({
    sizeId: z.string().min(1),
    quantity: z.number().int().min(0).max(1_000_000),
});

// 店舗の過小在庫しきい値（int ≥ 0）
export const LowStockThresholdSchema = z.object({
    threshold: z.number().int().min(0).max(1_000_000),
});

// メッセージ送信（content は 1〜2000 文字・AC-M4）
export const SendMessageSchema = z.object({
    conversationId: z.string().min(1),
    content: z
        .string()
        .trim() // 先頭・末尾の空白を除去してから長さ検証（空白のみの送信を弾く）
        .min(1, "メッセージを入力してください。")
        .max(2000, "メッセージは2000文字以内です。"),
});

// 会話起票（storeId 必須・orderId は任意の注文起点メタ情報）
export const StartConversationSchema = z.object({
    storeId: z.string().min(1),
    orderId: z.string().min(1).optional(),
});

// サポートチケット（4 フォーム共通）。category により orderId 必須を切替える。
export const SupportTicketCategoryEnum = z.enum([
    "CONTACT",
    "RETURN_REQUEST",
    "DISPUTE",
    "PROBLEM_REPORT",
]);

export const SupportTicketSchema = z
    .object({
        category: SupportTicketCategoryEnum,
        name: z.string().trim().min(1, "お名前を入力してください。").max(120),
        email: z
            .string()
            .trim()
            .email("有効なメールアドレスを入力してください。"),
        subject: z.string().trim().min(1, "件名を入力してください。").max(200),
        message: z
            .string()
            .trim()
            .min(1, "内容を入力してください。")
            .max(5000, "内容は5000文字以内です。"),
        // RETURN_REQUEST / DISPUTE では必須。他カテゴリでは任意。
        // Order.id は uuid（design §0-4）のため uuid 形式を検証し、"abc" 等の不正値を弾く。
        // フォームの controlled input は空欄を "" で渡すため、preprocess で空白→undefined に
        // 正規化してから optional 検証する（"" のまま .min(1) に当てると CONTACT 等が弾かれる）。
        orderId: z.preprocess(
            (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
            z
                .string()
                .trim()
                .min(1)
                .uuid("有効な注文番号を入力してください。")
                .optional()
        ),
    })
    .superRefine((val, ctx) => {
        const needsOrder =
            val.category === "RETURN_REQUEST" || val.category === "DISPUTE";
        if (needsOrder && !val.orderId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["orderId"],
                message: "対象の注文番号を入力してください。",
            });
        }
    });

export type SupportTicketInput = z.infer<typeof SupportTicketSchema>;

// 注文追跡: 注文番号 + メール。両者一致で配送状況を照会する（公開）。
export const TrackOrderSchema = z.object({
    orderId: z.string().trim().min(1, "注文番号を入力してください。"),
    email: z.string().trim().email("有効なメールアドレスを入力してください。"),
});

export type TrackOrderInput = z.infer<typeof TrackOrderSchema>;

/**
 * admin 注文一覧のフィルタ（F2-4/F2-5・判断6-5）。
 * paymentStatus / orderStatus は nativeEnum で入口検証し、下流の as キャストを排除する。
 * limit は上限 100、page は上限 10_000 にキャップして OOM/DoS を防止する。
 */
export const AdminOrderFilterSchema = z.object({
    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
    orderStatus: z.nativeEnum(OrderStatus).optional(),
    search: z.string().optional(),
    // page も limit と同じく throw ではなく clamp（≤10_000）でキャップする。
    // 下流の getAllOrders が skip:(page-1)*limit を算出するため、上限が無いと
    // 巨大 OFFSET による過大な DB スキャンと精度喪失を招く。
    // 上限値は index-products/route.ts の MAX_PAGE と同一根拠・同一値。
    page: z
        .number()
        .default(1)
        .transform((n) => Math.min(Math.max(Math.floor(n), 1), 10_000)),
    // limit は throw ではなく clamp（≤100）でキャップし、極端値を 100 に丸める（AC-F2-3）
    limit: z
        .number()
        .default(20)
        .transform((n) => Math.min(Math.max(Math.floor(n), 1), 100)),
});

export type AdminOrderFilter = z.infer<typeof AdminOrderFilterSchema>;
