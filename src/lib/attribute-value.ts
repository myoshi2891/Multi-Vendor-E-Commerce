import type { AttributeType, Prisma } from "@prisma/client";

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

export function toAttributeValueRows(
    _def: AttributeValueDef,
    _input: unknown
): ToAttributeValueRowsResult {
    throw new Error("not implemented");
}

export function fromAttributeValueRows(
    _def: AttributeValueDef,
    _rows: readonly AttributeValueRow[]
): AttributeInputValue {
    throw new Error("not implemented");
}

export function isEmptyAttributeInput(_input: unknown): boolean {
    throw new Error("not implemented");
}
