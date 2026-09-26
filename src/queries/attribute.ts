"use server";

import type { AttributeDefinitionDTO } from "@/lib/attribute-definitions";

const notImplemented = (): never => {
    throw new Error("not implemented");
};

export const upsertAttributeDefinition = async (_input: unknown) =>
    notImplemented();
export const archiveAttributeDefinition = async (_definitionId: string) =>
    notImplemented();
export const restoreAttributeDefinition = async (_definitionId: string) =>
    notImplemented();
export const getAllAttributeDefinitions = async () => notImplemented();
export const getAttributeDefinition = async (_definitionId: string) =>
    notImplemented();
export const upsertAttributeOption = async (
    _definitionId: string,
    _input: unknown
) => notImplemented();
export const archiveAttributeOption = async (_optionId: string) =>
    notImplemented();
export const restoreAttributeOption = async (_optionId: string) =>
    notImplemented();
export const changeAttributeTypeToNumber = async (
    _definitionId: string
): Promise<{
    route: number;
    definitionId: string;
    converted: number;
    unconvertible: number;
}> => notImplemented();
export const getEffectiveAttributeDefinitions = async (
    _categoryId: string
): Promise<AttributeDefinitionDTO[]> => notImplemented();
