/**
 * カテゴリ別属性値の「型 → 列」対応の唯一の決定点（plan 069 Step 5 / ADR-007 D-6）。
 *
 * `valueText` / `valueNumber` / `valueBool` / `optionId` のどれを埋めるかを決めるのは
 * このモジュールだけにする。書き込み経路が散ると「NUMBER 定義の下に valueText だけの行」を
 * アプリ層で検出できなくなる（DB の CHECK が最終防衛線だが、ここで先に弾いて
 * ユーザー向けのエラーを返す）。Done criteria の grep はこの集約を機械的に確認する。
 *
 * 空入力は「行を作らない」で表す（全列 NULL の行は D-6 の CHECK が拒否する）。
 * とくに NUMBER の空文字を `Number("")` で 0 に化かさないこと（A-9）。
 */
import { Prisma, type AttributeType } from "@prisma/client";

/** フォーム / DTO 上の属性値。NUMBER は精度を保つため文字列で持つ。 */
export type AttributeInputValue = string | number | boolean | string[] | null;

export interface AttributeValueDef {
    type: AttributeType;
    multiValued: boolean;
}

export interface AttributeValueRow {
    type: AttributeType;
    multiValued: boolean;
    valueText: string | null;
    valueNumber: Prisma.Decimal | null;
    valueBool: boolean | null;
    optionId: string | null;
}

export type ToAttributeValueRowsResult =
    | { ok: true; rows: AttributeValueRow[] }
    | { ok: false; error: string };

/** 値テーブルから値列を読むときの select。列名を他ファイルへ漏らさないために使う。 */
export const ATTRIBUTE_VALUE_COLUMNS_SELECT = {
    definitionId: true,
    type: true,
    multiValued: true,
    valueText: true,
    valueNumber: true,
    valueBool: true,
    optionId: true,
} as const;

/** `Decimal(18, 6)` に収まる範囲（整数部 12 桁・小数部 6 桁）。 */
const NUMBER_INTEGER_LIMIT = new Prisma.Decimal("1e12");
const NUMBER_SCALE = 6;
const NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/;

const emptyRow = (def: AttributeValueDef): AttributeValueRow => ({
    type: def.type,
    multiValued: def.multiValued,
    valueText: null,
    valueNumber: null,
    valueBool: null,
    optionId: null,
});

/** 未入力（null / undefined / 空白のみの文字列 / 空配列）か。0 と false は値である。 */
export function isEmptyAttributeInput(input: unknown): boolean {
    if (input === null || input === undefined) return true;
    if (typeof input === "string") return input.trim() === "";
    if (Array.isArray(input)) return input.length === 0;
    return false;
}

const parseNumber = (input: unknown): Prisma.Decimal | null => {
    let decimal: Prisma.Decimal;
    if (typeof input === "number") {
        if (!Number.isFinite(input)) return null;
        decimal = new Prisma.Decimal(input);
    } else if (typeof input === "string") {
        const trimmed = input.trim();
        if (!NUMERIC_PATTERN.test(trimmed)) return null;
        decimal = new Prisma.Decimal(trimmed);
    } else {
        return null;
    }
    if (decimal.abs().gte(NUMBER_INTEGER_LIMIT)) return null;
    if (decimal.decimalPlaces() > NUMBER_SCALE) return null;
    return decimal;
};

/**
 * 入力値を値テーブルの行（値列部分）へ変換する。
 *
 * @returns 空入力は `rows: []`（行を作らない）。多値 ENUM は選択肢ごとに 1 行（重複は畳む）。
 */
export function toAttributeValueRows(
    def: AttributeValueDef,
    input: unknown
): ToAttributeValueRowsResult {
    if (def.multiValued && def.type !== "ENUM") {
        return { ok: false, error: "Multi-valued attributes must be ENUM." };
    }
    if (isEmptyAttributeInput(input)) return { ok: true, rows: [] };

    switch (def.type) {
        case "TEXT": {
            if (typeof input !== "string") {
                return { ok: false, error: "Expected a text value." };
            }
            return {
                ok: true,
                rows: [{ ...emptyRow(def), valueText: input.trim() }],
            };
        }
        case "NUMBER": {
            const valueNumber = parseNumber(input);
            if (!valueNumber) {
                return { ok: false, error: "Expected a number within range." };
            }
            return { ok: true, rows: [{ ...emptyRow(def), valueNumber }] };
        }
        case "BOOLEAN": {
            if (typeof input !== "boolean") {
                return { ok: false, error: "Expected a boolean value." };
            }
            return { ok: true, rows: [{ ...emptyRow(def), valueBool: input }] };
        }
        case "ENUM": {
            if (!def.multiValued) {
                if (typeof input !== "string") {
                    return { ok: false, error: "Expected a single option." };
                }
                return {
                    ok: true,
                    rows: [{ ...emptyRow(def), optionId: input }],
                };
            }
            if (!Array.isArray(input)) {
                return { ok: false, error: "Expected a list of options." };
            }
            const optionIds: string[] = [];
            for (const item of input) {
                if (typeof item !== "string" || item.trim() === "") {
                    return { ok: false, error: "Expected a list of options." };
                }
                if (!optionIds.includes(item)) optionIds.push(item);
            }
            return {
                ok: true,
                rows: optionIds.map((optionId) => ({
                    ...emptyRow(def),
                    optionId,
                })),
            };
        }
    }
}

/**
 * 値テーブルの行をフォーム / DTO 用の値へ戻す。
 *
 * @returns 行が無ければ単値は `null`、多値は `[]`（未入力）。NUMBER は文字列。
 */
export function fromAttributeValueRows(
    def: AttributeValueDef,
    rows: readonly AttributeValueRow[]
): AttributeInputValue {
    if (def.multiValued) {
        return rows.flatMap((r) => (r.optionId === null ? [] : [r.optionId]));
    }
    const [first] = rows;
    if (!first) return null;

    switch (def.type) {
        case "TEXT":
            return first.valueText;
        case "NUMBER":
            return first.valueNumber === null
                ? null
                : first.valueNumber.toString();
        case "BOOLEAN":
            return first.valueBool;
        case "ENUM":
            return first.optionId;
    }
}
