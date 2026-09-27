"use server";

import { randomUUID } from "node:crypto";
import { AttributeScope, AttributeType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
// 認可ガード (src/lib/auth-guards.ts) 経由でロール検証を集約する
import { requireAdmin } from "@/lib/auth-guards";
import {
    AttributeDefinitionFormSchema,
    AttributeOptionFormSchema,
} from "@/lib/schemas";
import type { AttributeDefinitionDTO } from "@/lib/attribute-definitions";
import {
    findEffectiveDefinitionsByPath,
    type AttributeTransactionClient,
} from "@/lib/attribute-repository";
import {
    ATTRIBUTE_VALUE_COLUMNS_SELECT,
    fromAttributeValueRows,
    toAttributeValueRows,
    type AttributeValueRow,
} from "@/lib/attribute-value";

/**
 * 利用者へそのまま返してよい業務エラー。catch 側はこれだけを素通しし、
 * それ以外（Prisma / ネットワーク）は構造化ログへ落として汎用メッセージに畳む。
 */
class AttributeActionError extends Error {}

const fail = (message: string): never => {
    throw new AttributeActionError(message);
};

/** 一意制約違反（Prisma API: P2002 / raw SQL: P2010 + SQLSTATE 23505）。 */
const isUniqueViolation = (error: unknown): boolean =>
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" ||
        (error.code === "P2010" && error.meta?.code === "23505"));

/** 外部キー違反（Prisma API: P2003 / raw SQL: P2010 + SQLSTATE 23503）。 */
const isForeignKeyViolation = (error: unknown): boolean =>
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2003" ||
        (error.code === "P2010" && error.meta?.code === "23503"));

/** 更新対象の行が無い（Prisma API: P2025）。 */
const isRecordNotFound = (error: unknown): boolean =>
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025";

/**
 * catch 節の共通処理。業務エラーと既知の制約違反は意味のあるメッセージで、
 * それ以外は構造化ログ + 汎用メッセージで再送出する。
 */
const rethrow = (
    tag: string,
    fallback: string,
    error: unknown,
    messages: { unique?: string; foreignKey?: string; notFound?: string } = {}
): never => {
    if (error instanceof AttributeActionError) throw new Error(error.message);
    if (messages.notFound && isRecordNotFound(error)) {
        throw new Error(messages.notFound);
    }
    if (messages.unique && isUniqueViolation(error)) {
        throw new Error(messages.unique);
    }
    if (messages.foreignKey && isForeignKeyViolation(error)) {
        throw new Error(messages.foreignKey);
    }
    if (error instanceof Error) {
        console.error(`[Attribute:${tag}] ${fallback}`, {
            error: error.message,
            stack: error.stack,
        });
    } else {
        console.error(`[Attribute:${tag}] Unknown error`, { error });
    }
    throw new Error(fallback);
};

const parseOrFail = <T>(
    result:
        | { success: true; data: T }
        | { success: false; error: { issues: { message: string }[] } }
): T => {
    if (result.success) return result.data;
    return fail(result.error.issues.map((issue) => issue.message).join(" "));
};

const DUPLICATE_KEY_MESSAGE =
    "An active attribute with the same key already exists in this category.";

interface LockedDefinition {
    id: string;
    categoryId: string;
    key: string;
    name: string;
    type: AttributeType;
    scope: AttributeScope;
    unit: string | null;
    required: boolean;
    facetable: boolean;
    multiValued: boolean;
    sortOrder: number;
    archivedAt: Date | null;
}

const lockDefinition = async (
    tx: AttributeTransactionClient,
    definitionId: string
): Promise<LockedDefinition> => {
    // Prisma の fluent API はロック句を表現できないため $queryRaw を使う（値はパラメータ化）
    const rows = await tx.$queryRaw<LockedDefinition[]>`
        SELECT "id", "categoryId", "key", "name", "type", "scope", "unit", "required",
               "facetable", "multiValued", "sortOrder", "archivedAt"
        FROM "AttributeDefinition" WHERE "id" = ${definitionId} FOR UPDATE
    `;
    return rows[0] ?? fail("Attribute not found.");
};

const countDefinitionValues = async (
    tx: AttributeTransactionClient,
    definitionId: string
): Promise<number> => {
    const [productCount, variantCount] = await Promise.all([
        tx.productAttributeValue.count({ where: { definitionId } }),
        tx.variantAttributeValue.count({ where: { definitionId } }),
    ]);
    return productCount + variantCount;
};

// Function: upsertAttributeDefinition
// Description: 属性定義を作成・更新する。作成は (categoryId, key) のアクティブ行に対する
//              INSERT ... ON CONFLICT（design.md Q7「経路 2 と一意制約」）でアトミックに行う。
//              更新では key を変えられず、値が存在する間は type / scope / multiValued も変えられない。
// Permission Level: Admin only
// Parameters:
//   - input: フォーム値。id があれば既存定義の更新、無ければ作成（同 key のアクティブ定義があれば更新）
// Returns: 保存後の定義

export const upsertAttributeDefinition = async (input: unknown) => {
    // 認可ガードは try の外（認可エラーを汎用メッセージで上書きしない・tech.md）
    await requireAdmin();

    const id =
        typeof input === "object" && input !== null && "id" in input
            ? input.id
            : undefined;
    if (id !== undefined && id !== null && typeof id !== "string") {
        throw new Error("Invalid attribute id.");
    }

    try {
        const data = parseOrFail(
            AttributeDefinitionFormSchema.safeParse(input)
        );
        const unit = data.unit === "" ? null : data.unit;

        return await db.$transaction(async (tx) => {
            if (id) {
                const current = await lockDefinition(tx, id);
                if (current.archivedAt) {
                    fail("Restore the attribute before editing it.");
                }
                if (current.key !== data.key) {
                    fail("Attribute key cannot be changed.");
                }
                const shapeChanged =
                    current.type !== data.type ||
                    current.scope !== data.scope ||
                    current.multiValued !== data.multiValued;
                if (shapeChanged && (await countDefinitionValues(tx, id)) > 0) {
                    fail(
                        "Type, scope and multi-valued cannot be changed while values exist."
                    );
                }
                return tx.attributeDefinition.update({
                    where: { id },
                    data: { ...data, unit },
                });
            }

            const rows = await tx.$queryRaw<
                {
                    id: string;
                    type: AttributeType;
                    scope: AttributeScope;
                    multiValued: boolean;
                }[]
            >`
                INSERT INTO "AttributeDefinition"
                    ("id", "categoryId", "key", "name", "type", "scope", "unit",
                     "required", "facetable", "multiValued", "sortOrder", "updatedAt")
                VALUES
                    (${randomUUID()}, ${data.categoryId}, ${data.key}, ${data.name},
                     ${data.type}::"AttributeType", ${data.scope}::"AttributeScope", ${unit},
                     ${data.required}, ${data.facetable}, ${data.multiValued}, ${data.sortOrder}, NOW())
                ON CONFLICT ("categoryId", "key") WHERE "archivedAt" IS NULL
                DO UPDATE SET
                    "name" = EXCLUDED."name",
                    "unit" = EXCLUDED."unit",
                    "required" = EXCLUDED."required",
                    "facetable" = EXCLUDED."facetable",
                    "sortOrder" = EXCLUDED."sortOrder",
                    "updatedAt" = NOW()
                RETURNING "id", "type", "scope", "multiValued"
            `;
            const saved = rows[0] ?? fail("Failed to save attribute.");
            // 既存のアクティブ定義に衝突した場合、形（type / scope / multiValued）は
            // 上書きしない。食い違えば tx ごと巻き戻して利用者に知らせる。
            if (
                saved.type !== data.type ||
                saved.scope !== data.scope ||
                saved.multiValued !== data.multiValued
            ) {
                fail(
                    "An active attribute with the same key already exists with a different type, scope or multi-valued setting."
                );
            }
            return tx.attributeDefinition.findUniqueOrThrow({
                where: { id: saved.id },
            });
        });
    } catch (error: unknown) {
        return rethrow(
            "upsertAttributeDefinition",
            "Error saving attribute.",
            error,
            {
                unique: DUPLICATE_KEY_MESSAGE,
                foreignKey: "Category not found.",
            }
        );
    }
};

// Function: archiveAttributeDefinition / restoreAttributeDefinition
// Description: 論理削除（archivedAt）と復元。物理削除は値の Restrict で阻止されるため提供しない（ADR-007 D-4）。
//              アーカイブ済み定義の値は保持され、継承クエリ（archivedAt: null）から外れる。
// Permission Level: Admin only

export const archiveAttributeDefinition = async (definitionId: string) => {
    await requireAdmin();
    try {
        // アクティブな行だけを対象にし、再アーカイブで元の archivedAt（監査時刻）を上書きしない
        return await db.attributeDefinition.update({
            where: { id: definitionId, archivedAt: null },
            data: { archivedAt: new Date() },
        });
    } catch (error: unknown) {
        return rethrow(
            "archiveAttributeDefinition",
            "Error archiving attribute.",
            error,
            {
                notFound: "Attribute not found or already archived.",
            }
        );
    }
};

export const restoreAttributeDefinition = async (definitionId: string) => {
    await requireAdmin();
    try {
        return await db.attributeDefinition.update({
            where: { id: definitionId },
            data: { archivedAt: null },
        });
    } catch (error: unknown) {
        return rethrow(
            "restoreAttributeDefinition",
            "Error restoring attribute.",
            error,
            {
                unique: DUPLICATE_KEY_MESSAGE,
            }
        );
    }
};

// Function: getAllAttributeDefinitions
// Description: admin 一覧用。アーカイブ済みも含め、所属カテゴリと許容値の件数を添えて返す。
// Permission Level: Admin only

export const getAllAttributeDefinitions = async () => {
    await requireAdmin();
    try {
        return await db.attributeDefinition.findMany({
            include: {
                category: { select: { name: true, path: true } },
                _count: { select: { options: true } },
            },
            orderBy: [
                { category: { path: "asc" } },
                { sortOrder: "asc" },
                { name: "asc" },
            ],
        });
    } catch (error: unknown) {
        return rethrow(
            "getAllAttributeDefinitions",
            "Error fetching attributes.",
            error
        );
    }
};

// Function: getAttributeDefinition
// Description: admin 編集用。許容値（アーカイブ済みを含む）を並び順で添えて返す。
// Permission Level: Admin only

export const getAttributeDefinition = async (definitionId: string) => {
    await requireAdmin();
    try {
        return await db.attributeDefinition.findUnique({
            where: { id: definitionId },
            include: {
                category: { select: { name: true, path: true } },
                options: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] },
            },
        });
    } catch (error: unknown) {
        return rethrow(
            "getAttributeDefinition",
            "Error fetching attribute.",
            error
        );
    }
};

// Function: upsertAttributeOption
// Description: ENUM 定義の許容値を作成・更新する（design.md Q6）。value（機械値）は不変で、
//              label の改名は FK で参照する既存商品の表示へ自動追随する（A-4）。
// Permission Level: Admin only
// Parameters:
//   - definitionId: 親の ENUM 定義
//   - input: フォーム値。id があれば更新

export const upsertAttributeOption = async (
    definitionId: string,
    input: unknown
) => {
    await requireAdmin();

    const id =
        typeof input === "object" && input !== null && "id" in input
            ? input.id
            : undefined;
    if (id !== undefined && id !== null && typeof id !== "string") {
        throw new Error("Invalid option id.");
    }

    try {
        const data = parseOrFail(AttributeOptionFormSchema.safeParse(input));

        // 定義行を FOR UPDATE で掴んでから type / archivedAt を確認し、同じ tx で書く。
        // 型変更・定義更新と直列化し、確認と書き込みの間に定義が変わる窓を閉じる。
        return await db.$transaction(async (tx) => {
            const definition = await lockDefinition(tx, definitionId);
            if (definition.type !== AttributeType.ENUM) {
                fail("Options can only be added to ENUM attributes.");
            }
            if (definition.archivedAt)
                fail("Restore the attribute before editing it.");

            if (id) {
                const current = await tx.attributeOption.findFirst({
                    where: { id, definitionId },
                    select: { value: true },
                });
                if (!current) fail("Option not found.");
                if (current?.value !== data.value)
                    fail("Option value cannot be changed.");
                return tx.attributeOption.update({
                    where: { id },
                    data: { label: data.label, sortOrder: data.sortOrder },
                });
            }
            return tx.attributeOption.create({
                data: { ...data, definitionId },
            });
        });
    } catch (error: unknown) {
        return rethrow("upsertAttributeOption", "Error saving option.", error, {
            unique: "An option with the same value already exists.",
        });
    }
};

// Function: archiveAttributeOption / restoreAttributeOption
// Description: 許容値の論理削除と復元。参照中の許容値は物理削除できない（A-5・Restrict）。
// Permission Level: Admin only

export const archiveAttributeOption = async (optionId: string) => {
    await requireAdmin();
    try {
        // アクティブな行だけを対象にし、再アーカイブで元の archivedAt（監査時刻）を上書きしない
        return await db.attributeOption.update({
            where: { id: optionId, archivedAt: null },
            data: { archivedAt: new Date() },
        });
    } catch (error: unknown) {
        return rethrow(
            "archiveAttributeOption",
            "Error archiving option.",
            error,
            {
                notFound: "Option not found or already archived.",
            }
        );
    }
};

export const restoreAttributeOption = async (optionId: string) => {
    await requireAdmin();
    try {
        return await db.attributeOption.update({
            where: { id: optionId },
            data: { archivedAt: null },
        });
    } catch (error: unknown) {
        return rethrow(
            "restoreAttributeOption",
            "Error restoring option.",
            error
        );
    }
};

type ValueRowWithOwner = AttributeValueRow & { id: string; ownerId: string };

// Function: changeAttributeTypeToNumber
// Description: TEXT → NUMBER の型変更（design.md Q7「型変更の 2 経路」・A-7）。
//   - 経路 1（全行変換可能）: 値行を NUMBER として作り直し、定義の type を変える
//   - 経路 2（変換不能な行が 1 行でもある）: 旧定義を TEXT のまま archive し、
//     同じ key の NUMBER 定義を作って変換可能な値だけを移す。変換不能な値は旧定義に残す
//   複合 FK が ON UPDATE RESTRICT のため、値行を残したまま定義の type は書き換えられない。
//   経路 1 は「値行を削除 → type 変更 → 再作成」を 1 トランザクションで行う。
// Permission Level: Admin only
// Returns: { route, definitionId（NUMBER 側）, converted, unconvertible }

export const changeAttributeTypeToNumber = async (definitionId: string) => {
    await requireAdmin();
    try {
        return await db.$transaction(async (tx) => {
            const current = await lockDefinition(tx, definitionId);
            if (current.archivedAt)
                fail("Restore the attribute before editing it.");
            if (current.type !== AttributeType.TEXT) {
                fail("Only TEXT attributes can be converted to NUMBER.");
            }

            const isProduct = current.scope === AttributeScope.PRODUCT;
            const rows: ValueRowWithOwner[] = isProduct
                ? (
                      await tx.productAttributeValue.findMany({
                          where: { definitionId },
                          select: {
                              id: true,
                              productId: true,
                              ...ATTRIBUTE_VALUE_COLUMNS_SELECT,
                          },
                      })
                  ).map(({ productId, ...row }) => ({
                      ...row,
                      ownerId: productId,
                  }))
                : (
                      await tx.variantAttributeValue.findMany({
                          where: { definitionId },
                          select: {
                              id: true,
                              variantId: true,
                              ...ATTRIBUTE_VALUE_COLUMNS_SELECT,
                          },
                      })
                  ).map(({ variantId, ...row }) => ({
                      ...row,
                      ownerId: variantId,
                  }));

            const textDef = { type: AttributeType.TEXT, multiValued: false };
            const numberDef = {
                type: AttributeType.NUMBER,
                multiValued: false,
            };
            const converted: {
                row: ValueRowWithOwner;
                next: AttributeValueRow;
            }[] = [];
            let unconvertible = 0;
            for (const row of rows) {
                const result = toAttributeValueRows(
                    numberDef,
                    fromAttributeValueRows(textDef, [row])
                );
                const [next] = result.ok ? result.rows : [];
                if (next) converted.push({ row, next });
                else unconvertible++;
            }

            const route = unconvertible === 0 ? 1 : 2;
            let targetId = definitionId;
            if (route === 1) {
                await deleteValueRows(
                    tx,
                    isProduct,
                    rows.map((r) => r.id)
                );
                await tx.attributeDefinition.update({
                    where: { id: definitionId },
                    data: { type: AttributeType.NUMBER },
                });
            } else {
                // 旧定義を先に archive しないと、同じ (categoryId, key) のアクティブ行が
                // 2 件になり部分 UNIQUE が INSERT を拒否する
                await tx.attributeDefinition.update({
                    where: { id: definitionId },
                    data: { archivedAt: new Date() },
                });
                const created = await tx.attributeDefinition.create({
                    data: {
                        categoryId: current.categoryId,
                        key: current.key,
                        name: current.name,
                        type: AttributeType.NUMBER,
                        scope: current.scope,
                        unit: current.unit,
                        required: current.required,
                        facetable: current.facetable,
                        multiValued: false,
                        sortOrder: current.sortOrder,
                    },
                });
                targetId = created.id;
                await deleteValueRows(
                    tx,
                    isProduct,
                    converted.map((c) => c.row.id)
                );
            }

            if (isProduct) {
                await tx.productAttributeValue.createMany({
                    data: converted.map(({ row, next }) => ({
                        ...next,
                        productId: row.ownerId,
                        definitionId: targetId,
                        scope: AttributeScope.PRODUCT,
                    })),
                });
            } else {
                await tx.variantAttributeValue.createMany({
                    data: converted.map(({ row, next }) => ({
                        ...next,
                        variantId: row.ownerId,
                        definitionId: targetId,
                        scope: AttributeScope.VARIANT,
                    })),
                });
            }

            return {
                route,
                definitionId: targetId,
                converted: converted.length,
                unconvertible,
            };
        });
    } catch (error: unknown) {
        return rethrow(
            "changeAttributeTypeToNumber",
            "Error changing attribute type.",
            error
        );
    }
};

const deleteValueRows = async (
    tx: AttributeTransactionClient,
    isProduct: boolean,
    ids: string[]
): Promise<void> => {
    if (ids.length === 0) return;
    if (isProduct) {
        await tx.productAttributeValue.deleteMany({
            where: { id: { in: ids } },
        });
    } else {
        await tx.variantAttributeValue.deleteMany({
            where: { id: { in: ids } },
        });
    }
};

// Function: getEffectiveAttributeDefinitions
// Description: カテゴリノードに効く属性定義（祖先から継承・同一 key は最深ノードが勝つ）を返す。
//              販売者の商品フォームがカテゴリ選択の変更時に呼ぶ（design.md §3）。
// Permission Level: Public（公開カタログのメタデータのみを返す）
// Parameters:
//   - categoryId: 選択中のカテゴリノード id
// Returns: 属性定義 DTO の配列（ノードが存在しなければ空配列）

export const getEffectiveAttributeDefinitions = async (
    categoryId: string
): Promise<AttributeDefinitionDTO[]> => {
    if (!categoryId) return [];
    try {
        const node = await db.category.findUnique({
            where: { id: categoryId },
            select: { path: true },
        });
        if (!node) return [];
        return await findEffectiveDefinitionsByPath(db, node.path);
    } catch (error: unknown) {
        return rethrow(
            "getEffectiveAttributeDefinitions",
            "Error fetching category attributes.",
            error
        );
    }
};
