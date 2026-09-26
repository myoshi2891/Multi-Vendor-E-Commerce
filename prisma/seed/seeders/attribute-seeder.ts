/**
 * カテゴリ別属性定義 Seeder（plan 069 Step 10）
 * AttributeDefinition / AttributeOption をパイロット 3 部門へ投入する
 */

import { PrismaClient, Prisma } from "@prisma/client";
import {
    SEED_ATTRIBUTE_DEFINITIONS,
    SEED_ATTRIBUTE_VALUES,
} from "../constants/attributes";
import { ALL_SEED_PRODUCTS } from "../constants/products";
import { findCategoryNode } from "../category-tree";
import type { SeedAttributeDefinition } from "../types";
// 型 → 列の決定点はアプリと同じものを使う（ADR-007 D-6: 書き込み経路を散らさない）
import { toAttributeValueRows } from "../../../src/lib/attribute-value";

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

/**
 * 商品のカテゴリ（リーフ）から `key` の定義を解決する。祖先から継承し、
 * 同じ `key` が複数の深さにあれば**最も深いノードの定義が勝つ**（design.md §3 と同じ規則）。
 *
 * @param categoryUrl - 商品が紐づくノードの url
 * @param key - 属性の機械キー
 * @returns 解決した定義。祖先パス上に無ければ undefined
 */
export function resolveSeedAttributeDefinition(
    categoryUrl: string,
    key: string
): SeedAttributeDefinition | undefined {
    let url: string | undefined = categoryUrl;
    while (url) {
        const current: string = url;
        const def = SEED_ATTRIBUTE_DEFINITIONS.find(
            (d) => d.categoryUrl === current && d.key === key
        );
        if (def) return def;
        url = findCategoryNode(current).parentUrl;
    }
    return undefined;
}

type ValueColumns = {
    definitionId: string;
    type: SeedAttributeDefinition["type"];
    multiValued: boolean;
    valueText: string | null;
    valueNumber: Prisma.Decimal | null;
    valueBool: boolean | null;
    optionId: string | null;
};

/**
 * 属性値を投入する（`SEED_ATTRIBUTE_VALUES`）。商品・バリアント・属性定義の投入後に呼ぶ。
 *
 * - **収束させる**: 全シード商品の既存値を所有先単位で消してから作り直す（Spec 等と同じ
 *   「削除 + 再作成」方針）。定数から消した値が DB に残らない
 * - 型 → 列の変換はアプリの `toAttributeValueRows` を通す（D-6 の CHECK と同じ規則）
 * - ENUM は選択肢の `value` から id を引く。見つからなければ throw（黙って落とさない）
 *
 * @param prisma - seed 用 PrismaClient
 * @param maps - 定義（`${categoryUrl}:${key}` → id）・商品 slug → id・バリアント slug → id
 * @returns 作成した行数
 * @throws 商品・バリアント・定義・選択肢が解決できない / 値が型に合わない場合
 */
export async function seedAttributeValues(
    prisma: PrismaClient,
    maps: {
        definitions: Map<string, string>;
        products: Map<string, string>;
        variants: Map<string, string>;
    }
): Promise<{ productValues: number; variantValues: number }> {
    const lookup = <T>(map: Map<string, T>, key: string, what: string): T => {
        const value = map.get(key);
        if (value === undefined)
            throw new Error(`${what}が見つかりません: ${key}`);
        return value;
    };

    // 1. 収束: 全シード商品・バリアントの既存値を消す
    await prisma.productAttributeValue.deleteMany({
        where: {
            productId: {
                in: ALL_SEED_PRODUCTS.map((p) =>
                    lookup(maps.products, p.slug, "商品")
                ),
            },
        },
    });
    await prisma.variantAttributeValue.deleteMany({
        where: {
            variantId: {
                in: ALL_SEED_PRODUCTS.flatMap((p) =>
                    p.variants.map((v) =>
                        lookup(maps.variants, v.slug, "バリアント")
                    )
                ),
            },
        },
    });

    // 2. 変換
    const optionCache = new Map<string, Map<string, string>>();
    const optionIdOf = async (definitionId: string, value: string) => {
        let options = optionCache.get(definitionId);
        if (!options) {
            const rows = await prisma.attributeOption.findMany({
                where: { definitionId },
                select: { id: true, value: true },
            });
            options = new Map(rows.map((row) => [row.value, row.id]));
            optionCache.set(definitionId, options);
        }
        return lookup(options, value, "選択肢");
    };

    const productRows: (ValueColumns & {
        productId: string;
        scope: "PRODUCT";
    })[] = [];
    const variantRows: (ValueColumns & {
        variantId: string;
        scope: "VARIANT";
    })[] = [];

    for (const entry of SEED_ATTRIBUTE_VALUES) {
        const product = ALL_SEED_PRODUCTS.find(
            (p) => p.slug === entry.productSlug
        );
        if (!product)
            throw new Error(`商品が見つかりません: ${entry.productSlug}`);
        const def = resolveSeedAttributeDefinition(
            product.categoryUrl,
            entry.key
        );
        if (!def) {
            throw new Error(
                `属性定義が見つかりません: ${product.categoryUrl}:${entry.key}`
            );
        }
        if ((def.scope === "VARIANT") !== (entry.variantSlug !== undefined)) {
            throw new Error(
                `属性 ${entry.key} の scope（${def.scope}）と所有先が一致しません: ${entry.productSlug}`
            );
        }
        const definitionId = lookup(
            maps.definitions,
            `${def.categoryUrl}:${def.key}`,
            "属性定義"
        );

        let input: unknown = entry.value;
        if (def.type === "ENUM") {
            const values = Array.isArray(entry.value)
                ? entry.value
                : [entry.value];
            const ids: string[] = [];
            for (const value of values) {
                ids.push(await optionIdOf(definitionId, String(value)));
            }
            input = def.multiValued ? ids : ids[0];
        }
        const converted = toAttributeValueRows(def, input);
        if (!converted.ok) {
            throw new Error(
                `属性 ${entry.key} の値が不正です（${entry.productSlug}）: ${converted.error}`
            );
        }

        for (const row of converted.rows) {
            const columns: ValueColumns = { ...row, definitionId };
            if (entry.variantSlug === undefined) {
                productRows.push({
                    ...columns,
                    productId: lookup(maps.products, entry.productSlug, "商品"),
                    scope: "PRODUCT",
                });
            } else {
                if (
                    !product.variants.some((v) => v.slug === entry.variantSlug)
                ) {
                    throw new Error(
                        `バリアント ${entry.variantSlug} は商品 ${entry.productSlug} に属していません`
                    );
                }
                variantRows.push({
                    ...columns,
                    variantId: lookup(
                        maps.variants,
                        entry.variantSlug,
                        "バリアント"
                    ),
                    scope: "VARIANT",
                });
            }
        }
    }

    // 3. 作成
    if (productRows.length > 0) {
        await prisma.productAttributeValue.createMany({ data: productRows });
    }
    if (variantRows.length > 0) {
        await prisma.variantAttributeValue.createMany({ data: variantRows });
    }
    return {
        productValues: productRows.length,
        variantValues: variantRows.length,
    };
}
