import * as z from "zod";
import { ProductFormSchema } from "@/lib/schemas";
import type {
    ArchivedCurrentOptions,
    AttributeDefinitionDTO,
    AttributeFormValue,
    AttributeFormValues,
    AttributeValueInput,
} from "@/lib/attribute-definitions";

export interface MakeProductSchemaOptions {
    includeProductScope: boolean;
    archivedCurrent?: ArchivedCurrentOptions;
}

type AttributeShape = Record<string, z.ZodType<AttributeFormValue>>;

const notImplemented = (): never => {
    throw new Error("not implemented");
};

export const makeProductSchema = (
    _defs: readonly AttributeDefinitionDTO[],
    _options: MakeProductSchemaOptions
) =>
    ProductFormSchema.extend({
        productAttributes: z.object(notImplemented() as AttributeShape),
        variantAttributes: z.object(notImplemented() as AttributeShape),
    });

export type ProductFormWithAttributes = z.infer<
    ReturnType<typeof makeProductSchema>
>;

export const emptyAttributeValues = (
    _defs: readonly AttributeDefinitionDTO[],
    _scope: "PRODUCT" | "VARIANT",
    _current: AttributeFormValues = {}
): AttributeFormValues => notImplemented();

export const toAttributePayload = (
    _defs: readonly AttributeDefinitionDTO[],
    _values: {
        productAttributes: AttributeFormValues;
        variantAttributes: AttributeFormValues;
    },
    _options: { variantId: string; includeProductScope: boolean }
): AttributeValueInput[] => notImplemented();
