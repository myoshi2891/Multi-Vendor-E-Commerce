/**
 * 商品フォームの動的 Zod スキーマ（plan 069 Step 8 / design.md Q4）。
 *
 * - 合成は `ProductFormSchema.extend()` で行う。`z.intersection` だと RHF のエラーパスが
 *   二重になる（design.md Q4）
 * - 型は `AttributeType` の判別で絞る。`any` と `click-to-add.tsx` の `Detail<T>` は使わない
 * - NUMBER は文字列のまま扱う。`z.coerce.number()` は空文字を 0 に化かす（A-9）
 *
 * `"use client"` のフォームから import されるため `@/lib/db` に依存しないこと。
 */
import * as z from "zod";
import { ProductFormSchema } from "@/lib/schemas";
import { TEXT_MAX_LENGTH } from "@/lib/attribute-value";
import type {
    ArchivedCurrentOptions,
    AttributeDefinitionDTO,
    AttributeFormValue,
    AttributeFormValues,
    AttributeOptionDTO,
    AttributeValueInput,
} from "@/lib/attribute-definitions";

export interface MakeProductSchemaOptions {
    /** PRODUCT スコープを描画・検証するか（新バリアント画面では商品レベルを編集しない）。 */
    includeProductScope: boolean;
    /**
     * このフォームが編集するレコードの現在値に含まれるアーカイブ済み選択肢（definitionId 別）。
     * 候補に足してよいのは**そのレコードの現在値だけ**（A-11: 商品配下で union しない）。
     */
    archivedCurrent?: ArchivedCurrentOptions;
}

type AttributeShape = Record<string, z.ZodType<AttributeFormValue>>;

const NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/;

const requiredMessage = (def: AttributeDefinitionDTO) =>
    `${def.name} is required.`;

/** 選択肢 id の検証。候補が空のときに `z.enum([])` を作らない（型上も実行時も不正）。 */
const optionIdSchema = (ids: readonly string[], message: string) => {
    const [first, ...rest] = ids;
    if (first === undefined) {
        return z
            .string()
            .refine(() => false, { message: "No options are available." });
    }
    return z.enum([first, ...rest], { errorMap: () => ({ message }) });
};

/**
 * 属性定義 1 件分の Zod スキーマを型の判別で組み立てる。
 *
 * @param def - 解決済みの属性定義（同一 key は最深ノードのもの）
 * @param archived - このレコードの現在値であるアーカイブ済み選択肢
 */
export const buildAttributeShape = (
    def: AttributeDefinitionDTO,
    archived: readonly AttributeOptionDTO[] = []
): z.ZodType<AttributeFormValue> => {
    const message = requiredMessage(def);
    switch (def.type) {
        case "TEXT": {
            const text = z
                .string({
                    required_error: message,
                    invalid_type_error: message,
                })
                .trim()
                .max(TEXT_MAX_LENGTH, {
                    message: `${def.name} cannot exceed ${TEXT_MAX_LENGTH} characters.`,
                });
            return def.required ? text.min(1, { message }) : text.nullable();
        }
        case "NUMBER": {
            const number = z
                .string({
                    required_error: message,
                    invalid_type_error: message,
                })
                .trim()
                .refine(
                    (value) => value === "" || NUMERIC_PATTERN.test(value),
                    {
                        message: `${def.name} must be a number.`,
                    }
                );
            return def.required
                ? number.refine((value) => value !== "", { message })
                : number.nullable();
        }
        case "BOOLEAN": {
            const bool = z.boolean({
                required_error: message,
                invalid_type_error: message,
            });
            return def.required ? bool : bool.nullable();
        }
        case "ENUM": {
            const ids = [...def.options, ...archived].map(
                (option) => option.id
            );
            const option = optionIdSchema(ids, `Select a valid ${def.name}.`);
            if (def.multiValued) {
                const list = z.array(option, { invalid_type_error: message });
                return def.required ? list.min(1, { message }) : list;
            }
            if (def.required) {
                return z
                    .string({
                        required_error: message,
                        invalid_type_error: message,
                    })
                    .pipe(option);
            }
            return option.nullable();
        }
    }
};

const shapeFor = (
    defs: readonly AttributeDefinitionDTO[],
    scope: "PRODUCT" | "VARIANT",
    archivedCurrent: ArchivedCurrentOptions
): AttributeShape => {
    const shape: AttributeShape = {};
    for (const def of defs) {
        if (def.scope !== scope) continue;
        shape[def.id] = buildAttributeShape(def, archivedCurrent[def.id]);
    }
    return shape;
};

/**
 * 属性定義から商品フォームのスキーマを作る。キーは definitionId
 * （key は継承チェーン上で重複しうるが、解決後の定義 id は一意）。
 */
export const makeProductSchema = (
    defs: readonly AttributeDefinitionDTO[],
    options: MakeProductSchemaOptions
) => {
    const archivedCurrent = options.archivedCurrent ?? {};
    return ProductFormSchema.extend({
        productAttributes: z.object(
            options.includeProductScope
                ? shapeFor(defs, "PRODUCT", archivedCurrent)
                : {}
        ),
        variantAttributes: z.object(shapeFor(defs, "VARIANT", archivedCurrent)),
    });
};

export type ProductFormWithAttributes = z.infer<
    ReturnType<typeof makeProductSchema>
>;

/** 未入力値: 単値は null、多値は []。 */
const emptyValue = (def: AttributeDefinitionDTO): AttributeFormValue =>
    def.multiValued ? [] : null;

/**
 * スコープ別のフォーム初期値。定義の切り替え（カテゴリ変更）で消えた定義の値は持ち越さない。
 */
export const emptyAttributeValues = (
    defs: readonly AttributeDefinitionDTO[],
    scope: "PRODUCT" | "VARIANT",
    current: AttributeFormValues = {}
): AttributeFormValues => {
    const values: AttributeFormValues = {};
    for (const def of defs) {
        if (def.scope !== scope) continue;
        values[def.id] = current[def.id] ?? emptyValue(def);
    }
    return values;
};

const isEmptyFormValue = (value: AttributeFormValue | undefined): boolean =>
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0);

/**
 * フォーム値を `upsertProduct` の payload へ変換する。
 *
 * 描画した定義はすべて送る（空は `value: null` = 削除対象）。描画していない定義
 * （新バリアント画面の PRODUCT 属性）は送らない（= 同期対象外）。
 */
export const toAttributePayload = (
    defs: readonly AttributeDefinitionDTO[],
    values: {
        productAttributes: AttributeFormValues;
        variantAttributes: AttributeFormValues;
    },
    options: { variantId: string; includeProductScope: boolean }
): AttributeValueInput[] => {
    const payload: AttributeValueInput[] = [];
    for (const def of defs) {
        if (def.scope === "PRODUCT") {
            if (!options.includeProductScope) continue;
            const value = values.productAttributes[def.id];
            payload.push({
                scope: "PRODUCT",
                definitionId: def.id,
                value: isEmptyFormValue(value) ? null : (value ?? null),
            });
        } else {
            const value = values.variantAttributes[def.id];
            payload.push({
                scope: "VARIANT",
                definitionId: def.id,
                variantId: options.variantId,
                value: isEmptyFormValue(value) ? null : (value ?? null),
            });
        }
    }
    return payload;
};
