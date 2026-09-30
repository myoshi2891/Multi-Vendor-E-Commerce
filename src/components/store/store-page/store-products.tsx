import { FiltersQueryType } from "@/lib/types";
import { getProducts } from "@/queries/product";
import Link from "next/link";
import ProductList from "../shared/product-list";
import ProductSort from "../browse-page/sort";
import styles from "./store-page.module.css";

export default async function StoreProducts({ searchParams, store }: { searchParams: FiltersQueryType; store: string }) {
    const { category, offer, search, size, sort, subCategory } = searchParams;
    const { products } = await getProducts(
        { category, offer, search, size: Array.isArray(size) ? size : size ? [size] : undefined, subCategory, store },
        sort, 1, 100
    );
    return (
        <>
            <div className={styles.resultsBar}>
                <span>THE COLLECTION <span className={styles.resultCount}>/ {products.length} {products.length === 1 ? "PIECE" : "PIECES"}</span></span>
                <ProductSort />
            </div>
            {products.length > 0 ? <ProductList products={products} variant="editorial" /> : (
                <div className={styles.empty}>
                    <p role="status">No pieces match these filters.</p>
                    <p>Try another filter or explore the store’s full collection.</p>
                    <Link href={`/store/${store}#collection`}>Clear filters ↗</Link>
                </div>
            )}
        </>
    );
}
