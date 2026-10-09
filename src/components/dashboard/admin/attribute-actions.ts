import type {
    upsertAttributeDefinition,
    archiveAttributeDefinition,
    restoreAttributeDefinition,
    changeAttributeTypeToNumber,
    upsertAttributeOption,
    archiveAttributeOption,
    restoreAttributeOption,
} from "@/queries/attribute";
export type AttributeActions = {
    saveAction: typeof upsertAttributeDefinition;
    archiveAction: typeof archiveAttributeDefinition;
    restoreAction: typeof restoreAttributeDefinition;
    convertAction: typeof changeAttributeTypeToNumber;
};
export type AttributeOptionActions = {
    saveAction: typeof upsertAttributeOption;
    archiveAction: typeof archiveAttributeOption;
    restoreAction: typeof restoreAttributeOption;
};
