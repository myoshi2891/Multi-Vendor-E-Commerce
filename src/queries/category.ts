"use server";

// 認可ガード (src/lib/auth-guards.ts) を経由してロール検証を集約する
import { requireAdmin } from "@/lib/auth-guards";

// DB
import { db } from "@/lib/db";

// Prisma model
import { Category } from "@prisma/client";

// カテゴリツリー Phase A（plan 066）の列を呼び出し側から隠すための入力型。
// Prisma のモデル型は DB default の有無に関わらず全スカラーを必須プロパティにするため、
// `Category` をそのまま引数にすると列を 1 つ足すたびにフォーム側のリテラルが壊れる。
// ツリーの内部表現（path / depth / parentId 等）は UI が知るべき情報ではないので、
// ここで落として書き込み時に補う。ツリー編集 UI の導入は plan 067 / 068 の担当。
type CategoryUpsertInput = Omit<
    Category,
    "parentId" | "path" | "depth" | "sortOrder" | "childCount"
>;

// ツリー管理列。admin フォームからは書かせず、移行 SQL / plan 067・068 のツリー編集
// だけが触れる。
const TREE_MANAGED_FIELDS = [
    "parentId",
    "path",
    "depth",
    "sortOrder",
    "childCount",
] as const;

/**
 * ツリー管理列を実行時に落とす。
 *
 * `CategoryUpsertInput` の `Omit` はコンパイル時にしか効かない —— 余剰プロパティ検査は
 * オブジェクトリテラルにしか働かないため、DB から読み戻した `Category` をそのまま渡す
 * 経路は型検査を通過し、`path` / `depth` / `childCount` が Prisma まで素通りしてツリーの
 * 不変条件を壊す。境界で実際に捨てておく。
 */
const stripTreeManagedFields = (
    category: CategoryUpsertInput
): CategoryUpsertInput => {
    const sanitized: Record<string, unknown> = { ...category };
    for (const field of TREE_MANAGED_FIELDS) {
        delete sanitized[field];
    }
    return sanitized as CategoryUpsertInput;
};

// Function: upsertCategory
// Description: Upserts a category into the database, updating if it exists or creating a new one if not.
// Permission Level: Admin only
// Parameters:
//   - category: Category object containing details of the category to be upserted.
// Returns: Updated or newly created category details.

export const upsertCategory = async (category: CategoryUpsertInput) => {
    try {
        // 認証 + ADMIN 権限を集約検証 (auth-guards に統一)
        await requireAdmin();

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

        // ツリー管理列は create / update のどちらへも渡さない（実行時に落とす）
        const safeCategory = stripTreeManagedFields(category);

        // Upsert category into the database
        const categoryDetails = await db.category.upsert({
            where: {
                id: category.id,
            },
            update: safeCategory,
            // Phase A では admin から作れるのはルートのみ。移行 SQL の A-1 と同じ規則
            // （ルート ⇒ path = url / depth = 0）を満たすように補い、
            // 移行済みの行と新規作成行で不変条件がズレないようにする。
            create: { ...safeCategory, path: safeCategory.url, depth: 0 },
        });
        return categoryDetails;
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error in upsertCategory:", error.message, error.stack);
        } else {
            console.error("Error in upsertCategory:", error);
        }
        throw error;
    }
};


// Function: getAllCategories
// Description: Retrieves all categories from the database, optionally filtered by store URL. If a store URL is provided, only returns categories that have products in that specific store.
// Permission Level: Public
// Parameters:
//   - storeUrl (optional): URL of the store to filter categories by. If provided, only categories with products in this store will be returned.
// Returns: Array of categories with their subcategories, sorted by updatedAt date in descending order. Returns empty array if store URL is provided but store is not found.

export const getAllCategories = async (storeUrl?: string) => {
    try {
        let storeId: string | undefined;

        if (storeUrl) {
            // Retrieve the storeId based on the storeUrl
            const store = await db.store.findUnique({
                where: { url: storeUrl },
            });

            // if no store is found, return an empty array or handle as needed
            if (!store) {
                return [];
            }

            storeId = store.id;
        }
        // Retrieve all categories from the database
        //
        // Phase A（plan 066）: 移行 SQL の A-3 が SubCategory を Category の子行として
        // 取り込んだため、絞り込まないと**サブカテゴリがトップレベルのカテゴリとして
        // 混ざって返る**（`subCategories` に加えて本体も列挙され、カテゴリメニュー・
        // browse フィルタ・admin 一覧が二重になる）。Phase A の読み取りは旧 FK のまま
        // という境界を守るため、ここではルート（parentId = null）だけを返す。
        // ツリーを返すのは plan 067 / 068 の担当。
        const categories = await db.category.findMany({
            where: storeId
                ? {
                      parentId: null,
                      products: {
                          some: {
                              storeId,
                          },
                      },
                  }
                : { parentId: null },
            include: { subCategories: true },
            orderBy: { updatedAt: "desc" },
        });
        return categories;
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error in getAllCategories:", error.message, error.stack);
        } else {
            console.error("Error in getAllCategories:", error);
        }
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
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error in getAllSubCategoriesFotCategory:", error.message, error.stack);
        } else {
            console.error("Error in getAllSubCategoriesFotCategory:", error);
        }
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
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error in getCategory:", error.message, error.stack);
        } else {
            console.error("Error in getCategory:", error);
        }
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
        // 認証 + ADMIN 権限を集約検証 (auth-guards に統一)
        await requireAdmin();

        if (!categoryId) throw new Error("Please provide a category ID.");

        // Delete category from the database
        const response = await db.category.delete({
            where: {
                id: categoryId,
            },
        });
        return response;
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error in deleteCategory:", error.message, error.stack);
        } else {
            console.error("Error in deleteCategory:", error);
        }
        throw error;
    }
};
