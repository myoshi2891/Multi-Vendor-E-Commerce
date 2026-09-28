import { cache } from "react";
import { getAllCategories } from "@/queries/category";
import type { CollectionLink } from "./types";

/** Use live canonical category slugs; share this lookup across the streamed sections. */
export const getBrandCategories = cache(async (): Promise<CollectionLink[]> => {
    try {
        const tree = await getAllCategories();
        const preferred = ["jewelry", "watches", "bags"];
        const rank = (name: string) => {
            const index = preferred.indexOf(name.toLowerCase());
            return index < 0 ? 99 : index;
        };
        return [...tree]
            .sort((a, b) => rank(a.name) - rank(b.name))
            .slice(0, 3)
            .map(({ id, name, url }) => ({ id, name, url }));
    } catch (error: unknown) {
        console.error("[Home] Categories unavailable", {
            error: error instanceof Error ? error.message : "Unknown error",
        });
        return [];
    }
});
