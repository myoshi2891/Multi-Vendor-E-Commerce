import type { StoreProductType } from "./types";
import type { upsertProduct, deleteProduct } from "@/queries/product";
import type { getEffectiveAttributeDefinitions } from "@/queries/attribute";
import { toNumberSafe } from "./utils";
export type StoreProductRow = {
    id: string;
    name: string;
    brand: string;
    store: { url: string };
    category: { name: string } | null;
    subCategory: { name: string } | null;
    offerTag: { name: string } | null;
    variants: {
        id: string;
        variantName: string;
        images: { url: string }[];
        colors: { name: string }[];
        sizes: { id: string; size: string; quantity: number; price: number }[];
    }[];
};
export type ProductFormActions = {
    upsertProductAction: typeof upsertProduct;
    getAttributeDefinitionsAction: typeof getEffectiveAttributeDefinitions;
};
export type ProductListActions = ProductFormActions & {
    deleteProductAction: typeof deleteProduct;
};
/** Display serialization only; no price calculation or database mutation. */
export function serializeStoreProducts(
    products: StoreProductType[]
): StoreProductRow[] {
    return products.map((product) => ({
        id: product.id,
        name: product.name,
        brand: product.brand,
        store: { url: product.store.url },
        category: product.category ? { name: product.category.name } : null,
        subCategory: product.subCategory
            ? { name: product.subCategory.name }
            : null,
        offerTag: product.offerTag ? { name: product.offerTag.name } : null,
        variants: product.variants.map((variant) => ({
            id: variant.id,
            variantName: variant.variantName,
            images: variant.images.map((image) => ({ url: image.url })),
            colors: variant.colors.map((color) => ({ name: color.name })),
            sizes: variant.sizes.map((size) => ({
                id: size.id,
                size: size.size,
                quantity: size.quantity,
                price: toNumberSafe(size.price),
            })),
        })),
    }));
}
