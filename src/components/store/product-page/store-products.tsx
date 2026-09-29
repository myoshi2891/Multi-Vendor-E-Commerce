"use client"

import { ProductType } from "@/lib/types";
import { getProducts } from "@/queries/product";
import { FC, useEffect, useState } from "react";
import EditorialProductGrid from './editorial-product-grid'
import styles from './product.module.css'

interface Props {
    storeUrl: string;
    storeName: string;
	count: number;
}

const StoreProducts: FC<Props> = ({ storeUrl, count, storeName }) => { 
    const [products, setProducts] = useState<ProductType[]>([]);

    useEffect(() => {
        let cancelled = false;

        const getStoreProducts = async () => {
            try {
                const res = await getProducts({ store: storeUrl }, "", 1, count);
                if (!cancelled) {
                    setProducts(res.products);
                }
            } catch (error: unknown) {
                if (!cancelled) {
                    setProducts([]);
                }
                if (error instanceof Error) {
                    console.error("Error fetching store products:", error.message, error.stack);
                } else {
                    console.error("Error fetching store products:", error);
                }
            }
        }

        getStoreProducts();

        return () => {
            cancelled = true;
        };
    }, [storeUrl, count])

    if (products.length === 0) return null
    return <div className={styles.contentSection}><EditorialProductGrid products={products} title={`From ${storeName}`} eyebrow="MORE FROM THIS BOUTIQUE" /></div>
}

export default StoreProducts;
