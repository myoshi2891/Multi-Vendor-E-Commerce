/**
 * カテゴリ別属性の DB 読み取り（サーバー専用・plan 069）。
 *
 * `"use server"` ファイルは async 関数を export すると公開エンドポイントになるため、
 * トランザクションクライアントを受け取る内部ヘルパーはここに置く
 * （`src/queries/attribute.ts` と `src/queries/product.ts` の両方が使う）。
 */
import type { Prisma } from "@prisma/client";
import type { db } from "@/lib/db";
import {
    ancestorPathsOf,
    resolveEffectiveDefinitions,
    type AttributeDefinitionDTO,
} from "@/lib/attribute-definitions";
import {
    ATTRIBUTE_VALUE_COLUMNS_SELECT,
    fromAttributeValueRows,
    type AttributeValueRow,
} from "@/lib/attribute-value";

/**
 * db.$transaction のコールバックが受け取る tx の型（Accelerate 拡張済みクライアント）。
 * 素の Prisma.TransactionClient とは非互換のため $transaction から導出する
 * （`product.ts` の ProductTransactionClient と同じ理由・同じ形）。
 */
export type AttributeTransactionClient = Parameters<
    Parameters<typeof db.$transaction>[0]
>[0];

/** `db` とトランザクションクライアントの共通部分。 */
export type AttributeReadClient = Pick<
    AttributeTransactionClient,
    "attributeDefinition"
>;

const effectiveDefinitionInclude = {
    category: { select: { path: true } },
    // 候補は archivedAt: null に絞る（廃止値は新規選択させない・design.md Q7）
    options: {
        where: { archivedAt: null },
        select: { id: true, value: true, label: true },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    },
} satisfies Prisma.AttributeDefinitionInclude;

type EffectiveDefinitionRow = Prisma.AttributeDefinitionGetPayload<{
    include: typeof effectiveDefinitionInclude;
}>;

const toDefinitionDTO = (
    def: EffectiveDefinitionRow
): AttributeDefinitionDTO => ({
    id: def.id,
    key: def.key,
    name: def.name,
    type: def.type,
    scope: def.scope,
    unit: def.unit,
    required: def.required,
    multiValued: def.multiValued,
    options: def.options,
});

/**
 * カテゴリノードの `path` に効く属性定義（祖先から継承・同一 key は最深が勝つ）を返す。
 *
 * @param client - `db` または書き込みと同じトランザクション
 * @param path - 選択ノードの `Category.path`
 */
export const findEffectiveDefinitionsByPath = async (
    client: AttributeReadClient,
    path: string
): Promise<AttributeDefinitionDTO[]> => {
    const defs = await client.attributeDefinition.findMany({
        where: {
            category: { path: { in: ancestorPathsOf(path) } },
            archivedAt: null,
        },
        include: effectiveDefinitionInclude,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return resolveEffectiveDefinitions(defs).map(toDefinitionDTO);
};

/** 商品詳細「仕様」セクションの 1 行（表示専用の DTO）。 */
export interface AttributeDisplayItem {
    definitionId: string;
    key: string;
    name: string;
    unit: string | null;
    /** 表示文字列。多値 ENUM は選択肢ごとに 1 要素。 */
    values: string[];
}

/** VARIANT 属性は所有単位（`variantId`）ごとに束ねる（plan 069 Step 9）。 */
export interface ProductAttributeDisplay {
    product: AttributeDisplayItem[];
    variants: Record<string, AttributeDisplayItem[]>;
}

export type AttributeDisplayClient = Pick<
    AttributeTransactionClient,
    "attributeDefinition" | "productAttributeValue" | "variantAttributeValue"
>;

const displayValueSelect = {
    ...ATTRIBUTE_VALUE_COLUMNS_SELECT,
    // ENUM の表示名は FK 先から引く（A-4: label の改名に自動追随する）。
    // 定義 DTO の options はアクティブのみなので、アーカイブ済み選択肢の既存値もここで拾う。
    option: { select: { label: true } },
} as const;

type DisplayValueRow = AttributeValueRow & {
    definitionId: string;
    option: { label: string } | null;
};

const toDisplayStrings = (
    def: AttributeDefinitionDTO,
    rows: readonly DisplayValueRow[]
): string[] => {
    const value = fromAttributeValueRows(def, rows);
    if (value === null) return [];
    if (typeof value === "boolean") return [value ? "Yes" : "No"];
    if (def.type !== "ENUM") {
        return Array.isArray(value) ? value : [String(value)];
    }
    const optionIds = Array.isArray(value) ? value : [String(value)];
    const labels = new Map(
        rows.flatMap((row) =>
            row.optionId !== null && row.option
                ? [[row.optionId, row.option.label] as const]
                : []
        )
    );
    return optionIds.flatMap((id) => {
        const label = labels.get(id);
        return label === undefined ? [] : [label];
    });
};

/**
 * 定義順に並べ、値の無い定義は落とした表示行を作る（純粋関数・テスト用に export）。
 *
 * `defs` に無い定義の値行（アーカイブ済み定義・カテゴリ移動で効かなくなった定義 =
 * 履歴として保持されている値）は表示しない。
 */
export const toAttributeDisplayItems = (
    defs: readonly AttributeDefinitionDTO[],
    rows: readonly DisplayValueRow[]
): AttributeDisplayItem[] =>
    defs.flatMap((def) => {
        const values = toDisplayStrings(
            def,
            rows.filter((row) => row.definitionId === def.id)
        );
        if (values.length === 0) return [];
        return [
            {
                definitionId: def.id,
                key: def.key,
                name: def.name,
                unit: def.unit,
                values,
            },
        ];
    });

/**
 * 商品詳細に出す構造化属性を読む。
 *
 * 表示対象は「商品の現在のカテゴリノードに効く定義（継承・最深 key 勝ち・アクティブのみ）」
 * に限る —— 書き込み検証（`attribute-sync.ts`）と同じ解決規則で読むため、
 * 保存できる集合と表示される集合が一致する。
 *
 * @param categoryPath - 商品の `categoryNode.path`。null（未移行の商品）なら空を返す
 */
export const findProductAttributeDisplay = async (
    client: AttributeDisplayClient,
    params: {
        categoryPath: string | null;
        productId: string;
        variantIds: readonly string[];
    }
): Promise<ProductAttributeDisplay> => {
    const { categoryPath, productId, variantIds } = params;
    const empty: ProductAttributeDisplay = { product: [], variants: {} };
    if (categoryPath === null) return empty;

    const defs = await findEffectiveDefinitionsByPath(client, categoryPath);
    if (defs.length === 0) return empty;

    const productDefs = defs.filter((def) => def.scope === "PRODUCT");
    const variantDefs = defs.filter((def) => def.scope === "VARIANT");
    const definitionIds = { in: defs.map((def) => def.id) };

    const [productRows, variantRows] = await Promise.all([
        productDefs.length === 0
            ? []
            : client.productAttributeValue.findMany({
                  where: { productId, definitionId: definitionIds },
                  select: displayValueSelect,
                  orderBy: { createdAt: "asc" },
              }),
        variantDefs.length === 0 || variantIds.length === 0
            ? []
            : client.variantAttributeValue.findMany({
                  where: {
                      variantId: { in: [...variantIds] },
                      definitionId: definitionIds,
                  },
                  select: { ...displayValueSelect, variantId: true },
                  orderBy: { createdAt: "asc" },
              }),
    ]);

    const variants: Record<string, AttributeDisplayItem[]> = {};
    for (const variantId of variantIds) {
        variants[variantId] = toAttributeDisplayItems(
            variantDefs,
            variantRows.filter((row) => row.variantId === variantId)
        );
    }
    return {
        product: toAttributeDisplayItems(productDefs, productRows),
        variants,
    };
};
