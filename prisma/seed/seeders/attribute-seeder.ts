/**
 * カテゴリ別属性定義 Seeder（plan 069 Step 10）
 * AttributeDefinition / AttributeOption をパイロット 3 部門へ投入する
 */

import { PrismaClient } from "@prisma/client";
import { SEED_ATTRIBUTE_DEFINITIONS } from "../constants/attributes";

export type AttributeSeedResult = {
    /** `${categoryUrl}:${key}` -> definition id */
    definitions: Map<string, string>;
    /** 投入・更新した選択肢の件数 */
    optionCount: number;
};

/**
 * 属性定義と許容値を冪等に投入する。
 *
 * - 定義の一意性は部分 UNIQUE `(categoryId, key) WHERE archivedAt IS NULL` にしかなく、
 *   Prisma の upsert キーが生成されない。そのためアクティブ行を `findFirst` で引いて
 *   update / create を分ける（seed は単一プロセスなので並行作成は考慮しない）
 * - 既存定義の `type` / `scope` / `multiValued` は**更新しない**。値行が複合 FK
 *   （`onUpdate: Restrict`）で参照しているため、変わっていたら黙って上書きせず throw する
 *   （変更は admin の型変更経路か、新規定義 + 旧定義の archive で行う —— design.md Q7）
 * - 選択肢は `@@unique([definitionId, value])` で upsert。`archivedAt` は触らない
 *   （admin が廃止した選択肢を再実行で復活させない）
 *
 * @param prisma - seed 用 PrismaClient
 * @param categories - category URL -> category id（seedBase の戻り値）
 * @returns 投入した定義の id マップと選択肢件数
 * @throws 定義先カテゴリが存在しない / 既存定義の構造（type・scope・multiValued）が定数と食い違う場合
 */
export async function seedAttributes(
    prisma: PrismaClient,
    categories: Map<string, string>
): Promise<AttributeSeedResult> {
    const definitions = new Map<string, string>();
    let optionCount = 0;

    for (const [index, def] of SEED_ATTRIBUTE_DEFINITIONS.entries()) {
        const categoryId = categories.get(def.categoryUrl);
        if (!categoryId) {
            throw new Error(
                `属性定義 ${def.key} の定義先カテゴリが見つかりません: ${def.categoryUrl}`
            );
        }

        const mutable = {
            name: def.name,
            unit: def.unit,
            required: def.required,
            facetable: def.facetable,
            sortOrder: index,
        };
        const existing = await prisma.attributeDefinition.findFirst({
            where: { categoryId, key: def.key, archivedAt: null },
            select: { id: true, type: true, scope: true, multiValued: true },
        });

        let definitionId: string;
        if (existing) {
            if (
                existing.type !== def.type ||
                existing.scope !== def.scope ||
                existing.multiValued !== def.multiValued
            ) {
                throw new Error(
                    `属性定義 ${def.categoryUrl}:${def.key} の構造が定数と食い違います` +
                        `（DB: ${existing.type}/${existing.scope}/multiValued=${existing.multiValued}）`
                );
            }
            await prisma.attributeDefinition.update({
                where: { id: existing.id },
                data: mutable,
            });
            definitionId = existing.id;
        } else {
            const created = await prisma.attributeDefinition.create({
                data: {
                    ...mutable,
                    categoryId,
                    key: def.key,
                    type: def.type,
                    scope: def.scope,
                    multiValued: def.multiValued,
                },
                select: { id: true },
            });
            definitionId = created.id;
        }
        definitions.set(`${def.categoryUrl}:${def.key}`, definitionId);

        for (const [sortOrder, option] of (def.options ?? []).entries()) {
            await prisma.attributeOption.upsert({
                where: {
                    definitionId_value: { definitionId, value: option.value },
                },
                update: { label: option.label, sortOrder },
                create: {
                    definitionId,
                    value: option.value,
                    label: option.label,
                    sortOrder,
                },
            });
            optionCount++;
        }
    }

    return { definitions, optionCount };
}
