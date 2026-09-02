"use server";

// 認可ガード (src/lib/auth-guards.ts) を経由してロール検証を集約する
import { requireAdmin } from "@/lib/auth-guards";

// DB
import { db } from "@/lib/db";

// Prisma model
import { Category, Prisma } from "@prisma/client";

// カテゴリツリー（materialized path）の共通ヘルパー
import {
    buildCategoryTree,
    depthOfPath,
    isWithinSubtree,
    rebasePath,
    MAX_CATEGORY_DEPTH,
} from "@/lib/category-tree";

// カテゴリツリー（plan 066–068）の入力型。
// Prisma のモデル型は DB default の有無に関わらず全スカラーを必須プロパティにするため、
// `Category` をそのまま引数にすると列を 1 つ足すたびにフォーム側のリテラルが壊れる。
//
// `path` / `depth` / `childCount` は**ツリーから導出される値**なので入力から受け取らない
// （親と url が決まれば一意に決まり、外から与えられると不変条件が壊れる）。
// 逆に `parentId` / `sortOrder` は **admin が編集する列**なので受け取る（plan 068）。
// 既存の呼び出し側を壊さないよう、この 2 つは任意プロパティにしてある。
type CategoryUpsertInput = Omit<
    Category,
    "parentId" | "path" | "depth" | "sortOrder" | "childCount"
> & {
    parentId?: string | null;
    sortOrder?: number;
};

// ツリーから導出される列。admin フォームからは書かせず、ここで計算して補う。
const DERIVED_TREE_FIELDS = ["path", "depth", "childCount"] as const;

// db.$transaction のコールバックが受け取る tx の型（Accelerate 拡張済みクライアント）。
// 素の Prisma.TransactionClient とは非互換のため、$transaction から導出する
// （`order.ts` の OrderTransactionClient と同じ理由・同じ形）。
type CategoryTransactionClient = Parameters<
    Parameters<typeof db.$transaction>[0]
>[0];

/** `SELECT … FOR UPDATE` で読むノードの最小形。 */
interface LockedCategoryNode {
    id: string;
    path: string;
    depth: number;
}

/**
 * 導出列を実行時に落とす。
 *
 * `CategoryUpsertInput` の `Omit` はコンパイル時にしか効かない —— 余剰プロパティ検査は
 * オブジェクトリテラルにしか働かないため、DB から読み戻した `Category` をそのまま渡す
 * 経路は型検査を通過し、`path` / `depth` / `childCount` が Prisma まで素通りしてツリーの
 * 不変条件を壊す。境界で実際に捨てておく。
 */
const stripDerivedTreeFields = (
    category: CategoryUpsertInput
): CategoryUpsertInput => {
    const sanitized: Record<string, unknown> = { ...category };
    for (const field of DERIVED_TREE_FIELDS) {
        delete sanitized[field];
    }
    return sanitized as CategoryUpsertInput;
};

/**
 * 指定した親ノードの `childCount` を実数から再計算する。
 *
 * **片側だけ増減させないこと。** 再親子化は旧親と新親の両方を動かすため、片方だけ
 * 更新すると「子がいないのに `childCount > 0`」が残り、リーフ強制（V-5）が正当な
 * リーフへの商品紐づけを拒否しはじめる。
 */
const recomputeChildCounts = async (
    tx: CategoryTransactionClient,
    parentIds: readonly (string | null)[]
): Promise<void> => {
    const targets = [...new Set(parentIds.filter((id): id is string => !!id))];
    for (const id of targets) {
        const childCount = await tx.category.count({ where: { parentId: id } });
        await tx.category.update({ where: { id }, data: { childCount } });
    }
};

// Function: upsertCategory
// Description: Upserts a category into the database, updating if it exists or creating a new one if not.
//              Derives `path` / `depth` from the parent node, rejects cycles and over-deep trees,
//              rebases all descendants when a node is re-parented, and recomputes `childCount`
//              on both the old and the new parent.
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

        // 導出列は create / update のどちらへも渡さない（実行時に落とす）
        const safeCategory = stripDerivedTreeFields(category);
        const nextParentId = safeCategory.parentId ?? null;

        // V-7b: 自己参照。DB を読む前に閉じられる唯一の循環なので先に弾く。
        // **子孫への付け替え（V-7c）とは拒否理由が違う**ので 1 本に畳まない。
        if (nextParentId !== null && nextParentId === safeCategory.id) {
            throw new Error("A category cannot be its own parent.");
        }

        // ツリーの書き換えは 1 本のトランザクションで行う。上限違反や循環で throw した
        // 場合に**部分適用された path を残さない**ことが、ここでの唯一の要件である。
        return await db.$transaction(async (tx) => {
            // 更新の場合のみ現在の姿が取れる（create では null）
            const current = await tx.category.findUnique({
                where: { id: safeCategory.id },
                select: { id: true, parentId: true, path: true, depth: true },
            });

            let parent: LockedCategoryNode | null = null;
            if (nextParentId !== null) {
                // Prisma の fluent API はロック句を表現できないため $queryRaw を使う
                // （値は常にパラメータ化される）。**リーフ強制（upsertProduct の V-5）と
                // 同じ行を掴むことが直列化の条件**である —— 別々の行をロックしたのでは
                // 「商品をリーフ L に紐づける」と「L の子を作る」の競合を検出できない。
                const lockedRows = await tx.$queryRaw<LockedCategoryNode[]>`
                    SELECT "id", "path", "depth" FROM "Category" WHERE "id" = ${nextParentId} FOR UPDATE
                `;
                parent = lockedRows[0] ?? null;
                if (!parent) throw new Error("Parent category not found.");

                // V-7c: 子孫への再親子化。判定は境界文字 `/` を含む前置一致
                // （`isWithinSubtree`）で行う —— 素の startsWith だと
                // `electronics/camera` に対して**兄弟の** `electronics/camera-bags` まで
                // 子孫と誤判定し、正当な付け替えを拒否してしまう。
                if (current && isWithinSubtree(parent.path, current.path)) {
                    throw new Error(
                        "A category cannot be moved under its own descendant."
                    );
                }

                // V-7: 深さ上限
                if (parent.depth + 1 > MAX_CATEGORY_DEPTH) {
                    throw new Error(
                        `Category depth cannot exceed ${MAX_CATEGORY_DEPTH}.`
                    );
                }
            }

            const path = parent
                ? `${parent.path}/${safeCategory.url}`
                : safeCategory.url;
            const depth = parent ? parent.depth + 1 : 0;

            // V-7d: 子孫の追随。**書き込む前に**上限を検証する —— `parent.depth + 1` は
            // 移動するノード自身しか見ておらず、3 段の子を持つノードを深い親へ移すと
            // 子孫が上限を突破する。
            const movedFrom =
                current !== null && current.path !== path ? current.path : null;
            const rebased =
                movedFrom === null
                    ? []
                    : (
                          await tx.category.findMany({
                              where: { path: { startsWith: `${movedFrom}/` } },
                              select: { id: true, path: true },
                          })
                      ).map((descendant) => ({
                          id: descendant.id,
                          path: rebasePath(descendant.path, movedFrom, path),
                      }));

            for (const descendant of rebased) {
                if (depthOfPath(descendant.path) > MAX_CATEGORY_DEPTH) {
                    throw new Error(
                        `Category depth cannot exceed ${MAX_CATEGORY_DEPTH}.`
                    );
                }
            }

            const treeColumns = { path, depth };
            const categoryDetails = await tx.category.upsert({
                where: {
                    id: safeCategory.id,
                },
                update: { ...safeCategory, ...treeColumns },
                create: { ...safeCategory, ...treeColumns },
            });

            for (const descendant of rebased) {
                await tx.category.update({
                    where: { id: descendant.id },
                    data: {
                        path: descendant.path,
                        depth: depthOfPath(descendant.path),
                    },
                });
            }

            await recomputeChildCounts(tx, [
                current?.parentId ?? null,
                nextParentId,
            ]);

            return categoryDetails;
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "Error in upsertCategory:",
                error.message,
                error.stack
            );
        } else {
            console.error("Error in upsertCategory:", error);
        }
        throw error;
    }
};

// Function: getAllCategories
// Description: Retrieves the category tree, optionally filtered by store URL. If a store URL is provided, only branches containing products of that store are returned (ancestors included).
// Permission Level: Public
// Parameters:
//   - storeUrl (optional): URL of the store to filter categories by.
// Returns: Root category nodes, each carrying a recursive `children` array, ordered by depth / sortOrder / name. Returns empty array if store URL is provided but store is not found.

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
        // カテゴリツリー Phase B（plan 067 / design.md §2-Q3）。
        //
        // 並び順は `updatedAt desc`（= 編集のたびに並びが変わる）をやめ、
        // depth → sortOrder → name の決定論的な順序にする。深さ昇順で引いておくと
        // buildCategoryTree が親を先に見るため、1 パスで木に組める。
        const orderBy = [
            { depth: "asc" },
            { sortOrder: "asc" },
            { name: "asc" },
        ] satisfies Prisma.CategoryOrderByWithRelationInput[];

        if (storeId === undefined) {
            return buildCategoryTree(await db.category.findMany({ orderBy }));
        }

        // 店舗スコープ。**祖先を落とさないこと。**
        // `nodeProducts: { some: { storeId } }` は直接のリレーション条件なので、
        // 「商品はリーフにのみ紐づく」と組み合わさると**リーフだけが返り、その
        // 親・祖先は 1 件も返らない**。buildCategoryTree は返された行の中から親を
        // 探すため、祖先が欠けた枝は階層が崩れる（店舗ページのカテゴリメニューが
        // 壊れる形で表面化する）。リーフの path を prefix 展開して祖先まで引く。
        const leaves = await db.category.findMany({
            where: { nodeProducts: { some: { storeId } } },
            select: { path: true },
        });
        if (leaves.length === 0) return [];

        // "a/b/c" → "a" / "a/b" / "a/b/c"
        const paths = new Set<string>();
        for (const { path } of leaves) {
            const segments = path.split("/");
            for (let i = 1; i <= segments.length; i++) {
                paths.add(segments.slice(0, i).join("/"));
            }
        }

        return buildCategoryTree(
            await db.category.findMany({
                where: { path: { in: [...paths] } },
                orderBy,
            })
        );
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "Error in getAllCategories:",
                error.message,
                error.stack
            );
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
            console.error(
                "Error in getAllSubCategoriesFotCategory:",
                error.message,
                error.stack
            );
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
            console.error(
                "Error in deleteCategory:",
                error.message,
                error.stack
            );
        } else {
            console.error("Error in deleteCategory:", error);
        }
        throw error;
    }
};
