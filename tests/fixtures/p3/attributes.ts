import type { AttributeRow } from "@/app/dashboard/admin/attributes/columns";
import type { AttributeOption } from "@prisma/client";
export const attributeOptions: AttributeOption[] = [
    {
        id: "option-1",
        definitionId: "def-1",
        value: "linen",
        label: "Linen",
        sortOrder: 0,
        archivedAt: null,
        createdAt: new Date("2026-10-01"),
        updatedAt: new Date("2026-10-01"),
    },
];
export const attributeRows: AttributeRow[] = [
    {
        id: "def-1",
        categoryId: "cat-1",
        key: "material",
        name: "Material",
        type: "ENUM",
        scope: "PRODUCT",
        unit: null,
        required: false,
        facetable: true,
        multiValued: false,
        sortOrder: 0,
        archivedAt: null,
        createdAt: new Date("2026-10-01"),
        updatedAt: new Date("2026-10-01"),
        category: { name: "Art", path: "art" },
        _count: { options: 1 },
    },
    {
        id: "def-2",
        categoryId: "cat-1",
        key: "story",
        name: "Story",
        type: "TEXT",
        scope: "PRODUCT",
        unit: null,
        required: false,
        facetable: false,
        multiValued: false,
        sortOrder: 1,
        archivedAt: null,
        createdAt: new Date("2026-10-01"),
        updatedAt: new Date("2026-10-01"),
        category: { name: "Art", path: "art" },
        _count: { options: 0 },
    },
];
let calls = 0;
export async function attributeSave(...args: unknown[]) {
    (window as unknown as { attributePayload: unknown }).attributePayload =
        args;
    await new Promise((resolve) => setTimeout(resolve, 800));
    calls++;
    if (location.search.includes("failure") && calls === 1)
        throw Error("fixture rejected");
    return {
        id: "def-1",
        name: "Material",
        route: 1,
        converted: 2,
        unconvertible: 0,
    };
}
export async function attributeList() {
    if (location.search.includes("fetcherror")) throw Error("private data");
    return location.search.includes("empty") ? [] : attributeRows;
}
export async function attributeDefinition() {
    if (location.search.includes("missing")) return null;
    return {
        ...attributeRows[0],
        archivedAt: location.search.includes("archived")
            ? new Date("2026-10-02")
            : null,
        options: location.search.includes("empty") ? [] : attributeOptions,
    };
}
