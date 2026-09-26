/**
 * 商品保存時の属性値の検証と同期（サーバー専用・plan 069 Step 8 の保存契約）。
 *
 * `AttributeValueInput` は payload の**形**しか保証しない。id が呼び出し元のものである
 * ことは何も保証しないため（型は認可ではない）、書き込み前に次を検証する:
 *
 *   1. VARIANT の `variantId` が編集対象の商品に属する
 *   2. 商品がその店舗に属する
 *   3. `definitionId` が選択カテゴリで有効（祖先パス上・アクティブ・同一 key の解決で勝った
 *      定義・scope 一致）
 *   4. `optionId` がその定義に属し、アクティブである（例外: そのレコードの現在値である
 *      アーカイブ済み選択肢の無編集保存 —— A-11）
 *
 * 検証は 2 回走る。外側（`precheckAttributeValues`）は早期拒否と観測のため、
 * tx 内（`syncAttributeValues`）は**掴んだ行の値で**再確認して書くため。
 * ロック順序は Category（選択ノード + 祖先、id 昇順）→ Product → ProductVariant →
 * AttributeDefinition（id 昇順）→ AttributeOption（id 昇順）に固定する。
 * Category を先頭に置くのは `assertLeafCategoryNode` / `acquireCategoryTreeLocks` と
 * 同じクラス内 id 昇順に揃え、カテゴリ付け替えと直列化させるため。
 *
 * **同期の範囲（カバレッジ）**: スコープが「同期対象」になるのは、その所有先を
 * この要求で作成したとき、または 1 件以上の入力が送られたとき。同期対象のスコープでは
 * 有効な定義のうち送られなかったものも削除して送信状態に揃える（削除はアクティブな
 * 定義・その所有先に限る）。同期対象外のスコープには触れない（新バリアント画面の
 * 商品属性など）。必須属性は同期対象のスコープで hard に要求する（design.md Q5）。
 */
import {
    Prisma,
    type AttributeScope,
    type AttributeType,
} from "@prisma/client";
import * as z from "zod";
import type { db } from "@/lib/db";
import {
    ancestorPathsOf,
    resolveEffectiveDefinitions,
    type AttributeValueInput,
} from "@/lib/attribute-definitions";
import {
    ATTRIBUTE_VALUE_COLUMNS_SELECT,
    toAttributeValueRows,
    type AttributeValueRow,
} from "@/lib/attribute-value";

type SyncClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];
type ReadClient = typeof db | SyncClient;

/** 受信した payload の形の検証（型が付いていても実行時は信用しない）。 */
const AttributeFormValueSchema = z.union([
    z.string(),
    z.boolean(),
    z.array(z.string()),
    z.null(),
]);

export const AttributeValueInputListSchema = z.array(
    z.discriminatedUnion("scope", [
        z.object({
            scope: z.literal("PRODUCT"),
            definitionId: z.string().min(1),
            value: AttributeFormValueSchema,
        }),
        z.object({
            scope: z.literal("VARIANT"),
            definitionId: z.string().min(1),
            variantId: z.string().min(1),
            value: AttributeFormValueSchema,
        }),
    ])
);

export interface AttributeSyncContext {
    storeId: string;
    productId: string;
    /** 商品を紐づけるカテゴリノード（Phase B では subCategoryId と同一）。 */
    categoryNodeId: string;
    /** この要求で商品を作成するか（PRODUCT スコープが同期対象になる）。 */
    createsProduct: boolean;
    /** この要求で作成するバリアント（そのバリアントの VARIANT スコープが同期対象になる）。 */
    createdVariantId: string | null;
}

export class AttributeSyncError extends Error {}

interface CategoryRow {
    id: string;
    path: string;
}

interface DefinitionRow {
    id: string;
    categoryId: string;
    key: string;
    name: string;
    type: AttributeType;
    scope: AttributeScope;
    required: boolean;
    multiValued: boolean;
    archivedAt: Date | null;
    path: string;
}

interface OptionRow {
    id: string;
    definitionId: string;
    archivedAt: Date | null;
}

interface Snapshot {
    effective: Map<string, DefinitionRow>;
    product: { id: string; storeId: string } | null;
    variants: Map<string, { id: string; productId: string }>;
    options: Map<string, OptionRow>;
    /** 所有先ごとの既存値（`p:<productId>` / `v:<variantId>` → definitionId → 行）。 */
    existing: Map<string, Map<string, AttributeValueRow[]>>;
}

const MAX_CATEGORY_LOCK_ATTEMPTS = 3;

const lockClause = (lock: boolean) =>
    lock ? Prisma.sql`FOR UPDATE` : Prisma.empty;

/**
 * 選択ノードと祖先の Category 行を取得する（lock 時は id 昇順で FOR UPDATE）。
 * 掴んだ後に選択ノードの path を読み直し、祖先集合が変わっていたら掴み直す
 * （待っている間に付け替えが commit しうる）。
 */
const loadCategoryPath = async (
    client: ReadClient,
    categoryNodeId: string,
    lock: boolean
): Promise<{ node: CategoryRow; ancestors: CategoryRow[] }> => {
    for (let attempt = 0; attempt < MAX_CATEGORY_LOCK_ATTEMPTS; attempt++) {
        const nodeRows = await client.$queryRaw<CategoryRow[]>`
            SELECT "id", "path" FROM "Category" WHERE "id" = ${categoryNodeId}
        `;
        const node = nodeRows[0];
        if (!node) throw new AttributeSyncError("Category not found.");

        const paths = ancestorPathsOf(node.path);
        const rows = await client.$queryRaw<CategoryRow[]>`
            SELECT "id", "path" FROM "Category"
            WHERE "id" = ${categoryNodeId} OR "path" IN (${Prisma.join(paths)})
            ORDER BY "id" ${lockClause(lock)}
        `;
        const lockedNode = rows.find((row) => row.id === categoryNodeId);
        if (!lockedNode) throw new AttributeSyncError("Category not found.");
        const expected = ancestorPathsOf(lockedNode.path);
        const ancestors = expected
            .map((path) => rows.find((row) => row.path === path))
            .filter((row): row is CategoryRow => row !== undefined);
        if (ancestors.length === expected.length)
            return { node: lockedNode, ancestors };
    }
    throw new AttributeSyncError(
        "Category changed while saving. Please try again."
    );
};

const ownerKey = (scope: AttributeScope, ownerId: string) =>
    `${scope === "PRODUCT" ? "p" : "v"}:${ownerId}`;

const loadSnapshot = async (
    client: ReadClient,
    ctx: AttributeSyncContext,
    inputs: readonly AttributeValueInput[],
    variantIds: readonly string[],
    lock: boolean
): Promise<Snapshot> => {
    const { ancestors } = await loadCategoryPath(
        client,
        ctx.categoryNodeId,
        lock
    );

    const productRows = await client.$queryRaw<
        { id: string; storeId: string }[]
    >`
        SELECT "id", "storeId" FROM "Product" WHERE "id" = ${ctx.productId} ${lockClause(lock)}
    `;

    const variantRows =
        variantIds.length === 0
            ? []
            : await client.$queryRaw<{ id: string; productId: string }[]>`
                  SELECT "id", "productId" FROM "ProductVariant"
                  WHERE "id" IN (${Prisma.join(variantIds)})
                  ORDER BY "id" ${lockClause(lock)}
              `;

    // 祖先ノード上の定義をすべて（アーカイブ済みを含めて）掴む。有効集合は掴んだ行から導出する。
    const definitionRows = await client.$queryRaw<DefinitionRow[]>`
        SELECT d."id", d."categoryId", d."key", d."name", d."type", d."scope", d."required",
               d."multiValued", d."archivedAt", c."path"
        FROM "AttributeDefinition" d
        JOIN "Category" c ON c."id" = d."categoryId"
        WHERE d."categoryId" IN (${Prisma.join(ancestors.map((row) => row.id))})
        ORDER BY d."id" ${lock ? Prisma.sql`FOR UPDATE OF d` : Prisma.empty}
    `;
    const active = definitionRows
        .filter((row) => row.archivedAt === null)
        .map((row) => ({ ...row, category: { path: row.path } }));
    const effective = new Map(
        resolveEffectiveDefinitions(active).map((row) => [row.id, row] as const)
    );

    const optionIds = [
        ...new Set(
            inputs.flatMap((input) =>
                typeof input.value === "string"
                    ? [input.value]
                    : Array.isArray(input.value)
                      ? input.value
                      : []
            )
        ),
    ];
    const optionRows =
        optionIds.length === 0
            ? []
            : await client.$queryRaw<OptionRow[]>`
                  SELECT "id", "definitionId", "archivedAt" FROM "AttributeOption"
                  WHERE "id" IN (${Prisma.join(optionIds)})
                  ORDER BY "id" ${lockClause(lock)}
              `;

    const effectiveIds = [...effective.keys()];
    const existing = new Map<string, Map<string, AttributeValueRow[]>>();
    const push = (
        key: string,
        row: AttributeValueRow & { definitionId: string }
    ) => {
        const byDefinition =
            existing.get(key) ?? new Map<string, AttributeValueRow[]>();
        byDefinition.set(row.definitionId, [
            ...(byDefinition.get(row.definitionId) ?? []),
            row,
        ]);
        existing.set(key, byDefinition);
    };
    if (effectiveIds.length > 0) {
        const productValues = await client.productAttributeValue.findMany({
            where: {
                productId: ctx.productId,
                definitionId: { in: effectiveIds },
            },
            select: ATTRIBUTE_VALUE_COLUMNS_SELECT,
        });
        for (const row of productValues)
            push(ownerKey("PRODUCT", ctx.productId), row);
        if (variantIds.length > 0) {
            const variantValues = await client.variantAttributeValue.findMany({
                where: {
                    variantId: { in: [...variantIds] },
                    definitionId: { in: effectiveIds },
                },
                select: { variantId: true, ...ATTRIBUTE_VALUE_COLUMNS_SELECT },
            });
            for (const { variantId, ...row } of variantValues) {
                push(ownerKey("VARIANT", variantId), row);
            }
        }
    }

    return {
        effective,
        product: productRows[0] ?? null,
        variants: new Map(variantRows.map((row) => [row.id, row] as const)),
        options: new Map(optionRows.map((row) => [row.id, row] as const)),
        existing,
    };
};

/** 書き込み計画: 所有先ごとに「消す定義」と「作る行」。 */
interface OwnerPlan {
    scope: AttributeScope;
    ownerId: string;
    deleteDefinitionIds: string[];
    rows: (AttributeValueRow & { definitionId: string })[];
}

interface ValidateOptions {
    /** tx 内の最終検証か（外側では未作成の商品・バリアントを許す）。 */
    final: boolean;
}

/**
 * スナップショットに対して payload を検証し、書き込み計画を作る。
 *
 * @throws AttributeSyncError 検証に 1 つでも落ちた場合
 */
const validate = (
    snapshot: Snapshot,
    ctx: AttributeSyncContext,
    inputs: readonly AttributeValueInput[],
    variantIds: readonly string[],
    options: ValidateOptions
): OwnerPlan[] => {
    // 2. 商品がその店舗に属する（外側では作成予定の商品が未存在でよい）
    if (snapshot.product) {
        if (snapshot.product.storeId !== ctx.storeId) {
            throw new AttributeSyncError(
                "Product does not belong to this store."
            );
        }
    } else if (options.final || !ctx.createsProduct) {
        throw new AttributeSyncError("Product not found.");
    }

    // 1. バリアントが編集対象の商品に属する
    for (const variantId of variantIds) {
        const variant = snapshot.variants.get(variantId);
        if (!variant) {
            if (!options.final && variantId === ctx.createdVariantId) continue;
            throw new AttributeSyncError(
                "Variant does not belong to this product."
            );
        }
        if (variant.productId !== ctx.productId) {
            throw new AttributeSyncError(
                "Variant does not belong to this product."
            );
        }
    }

    const plans = new Map<string, OwnerPlan>();
    const planFor = (scope: AttributeScope, ownerId: string): OwnerPlan => {
        const key = ownerKey(scope, ownerId);
        const plan = plans.get(key) ?? {
            scope,
            ownerId,
            deleteDefinitionIds: [],
            rows: [],
        };
        plans.set(key, plan);
        return plan;
    };

    // 同期対象のスコープ（カバレッジ）
    if (ctx.createsProduct) planFor("PRODUCT", ctx.productId);
    if (ctx.createdVariantId) planFor("VARIANT", ctx.createdVariantId);

    const submitted = new Set<string>();
    for (const input of inputs) {
        // 3. 定義が選択カテゴリで有効
        const definition = snapshot.effective.get(input.definitionId);
        if (!definition || definition.scope !== input.scope) {
            throw new AttributeSyncError(
                "Attribute is not available for the selected category."
            );
        }
        const ownerId =
            input.scope === "PRODUCT" ? ctx.productId : input.variantId;
        const key = `${ownerKey(input.scope, ownerId)}#${input.definitionId}`;
        if (submitted.has(key)) {
            throw new AttributeSyncError(
                `${definition.name} was submitted more than once.`
            );
        }
        submitted.add(key);

        const converted = toAttributeValueRows(definition, input.value);
        if (!converted.ok) {
            throw new AttributeSyncError(
                `${definition.name}: ${converted.error}`
            );
        }

        // 4. 選択肢がその定義に属し、アクティブ（または このレコードの現在値）
        const current =
            snapshot.existing
                .get(ownerKey(input.scope, ownerId))
                ?.get(definition.id) ?? [];
        for (const row of converted.rows) {
            if (row.optionId === null) continue;
            const option = snapshot.options.get(row.optionId);
            if (!option || option.definitionId !== definition.id) {
                throw new AttributeSyncError(
                    `Select a valid ${definition.name}.`
                );
            }
            const isCurrentValue = current.some(
                (value) => value.optionId === option.id
            );
            if (option.archivedAt !== null && !isCurrentValue) {
                throw new AttributeSyncError(
                    `Select a valid ${definition.name}.`
                );
            }
        }

        const plan = planFor(input.scope, ownerId);
        plan.deleteDefinitionIds.push(definition.id);
        plan.rows.push(
            ...converted.rows.map((row) => ({
                ...row,
                definitionId: definition.id,
            }))
        );
    }

    // 同期対象スコープの仕上げ: 送られなかった有効定義は削除し、必須を確認する
    for (const plan of plans.values()) {
        for (const definition of snapshot.effective.values()) {
            if (definition.scope !== plan.scope) continue;
            const wasSubmitted = plan.deleteDefinitionIds.includes(
                definition.id
            );
            if (!wasSubmitted) plan.deleteDefinitionIds.push(definition.id);
            if (!definition.required) continue;
            const hasValue = plan.rows.some(
                (row) => row.definitionId === definition.id
            );
            if (!hasValue) {
                throw new AttributeSyncError(`${definition.name} is required.`);
            }
        }
    }

    return [...plans.values()];
};

const variantIdsOf = (
    ctx: AttributeSyncContext,
    inputs: readonly AttributeValueInput[]
) =>
    [
        ...new Set([
            ...(ctx.createdVariantId ? [ctx.createdVariantId] : []),
            ...inputs.flatMap((input) =>
                input.scope === "VARIANT" ? [input.variantId] : []
            ),
        ]),
    ].sort();

/**
 * payload の形を検証して型付きの入力へ変換する。`undefined` は「属性を送っていない」。
 *
 * @throws AttributeSyncError 形が不正な場合
 */
export const parseAttributeInputs = (raw: unknown): AttributeValueInput[] => {
    if (raw === undefined) return [];
    const parsed = AttributeValueInputListSchema.safeParse(raw);
    if (!parsed.success)
        throw new AttributeSyncError("Invalid attribute values.");
    return parsed.data;
};

/**
 * 外側の検証（ロックなし）。早期拒否と観測のために置く —— ここを通っても tx 内で再検証する。
 */
export const precheckAttributeValues = async (
    client: ReadClient,
    ctx: AttributeSyncContext,
    inputs: readonly AttributeValueInput[]
): Promise<void> => {
    if (!ctx.createsProduct && !ctx.createdVariantId && inputs.length === 0)
        return;
    const variantIds = variantIdsOf(ctx, inputs);
    const snapshot = await loadSnapshot(client, ctx, inputs, variantIds, false);
    validate(snapshot, ctx, inputs, variantIds, { final: false });
};

/**
 * tx 内で行を掴んで再検証し、属性値を同期する。商品・バリアントを書いた**後**に
 * 同じ tx から呼ぶこと（作成した行もロック対象に入る）。
 *
 * カテゴリ行は tx の先頭で `lockAttributeCategoryPath` により掴んでおくこと
 * （ここで改めて掴むのは同じ行なので再入で待たない）。
 */
export const syncAttributeValues = async (
    tx: SyncClient,
    ctx: AttributeSyncContext,
    inputs: readonly AttributeValueInput[]
): Promise<void> => {
    if (!ctx.createsProduct && !ctx.createdVariantId && inputs.length === 0)
        return;
    const variantIds = variantIdsOf(ctx, inputs);
    const snapshot = await loadSnapshot(tx, ctx, inputs, variantIds, true);
    const plans = validate(snapshot, ctx, inputs, variantIds, { final: true });

    for (const plan of plans) {
        if (plan.scope === "PRODUCT") {
            if (plan.deleteDefinitionIds.length > 0) {
                await tx.productAttributeValue.deleteMany({
                    where: {
                        productId: plan.ownerId,
                        definitionId: { in: plan.deleteDefinitionIds },
                    },
                });
            }
            if (plan.rows.length > 0) {
                await tx.productAttributeValue.createMany({
                    data: plan.rows.map((row) => ({
                        ...row,
                        productId: plan.ownerId,
                        scope: "PRODUCT" as const,
                    })),
                });
            }
        } else {
            if (plan.deleteDefinitionIds.length > 0) {
                await tx.variantAttributeValue.deleteMany({
                    where: {
                        variantId: plan.ownerId,
                        definitionId: { in: plan.deleteDefinitionIds },
                    },
                });
            }
            if (plan.rows.length > 0) {
                await tx.variantAttributeValue.createMany({
                    data: plan.rows.map((row) => ({
                        ...row,
                        variantId: plan.ownerId,
                        scope: "VARIANT" as const,
                    })),
                });
            }
        }
    }
};

/**
 * tx の先頭で選択ノード + 祖先の Category 行を id 昇順で掴む。
 * `assertLeafCategoryNode` より**前**に呼ぶこと —— リーフだけを先に掴んでから祖先を
 * 掴むと、id 昇順で掴むカテゴリ更新（`acquireCategoryTreeLocks`）と逆順になりうる。
 */
export const lockAttributeCategoryPath = async (
    tx: SyncClient,
    categoryNodeId: string
): Promise<void> => {
    await loadCategoryPath(tx, categoryNodeId, true);
};
