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
