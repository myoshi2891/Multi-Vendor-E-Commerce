"use client"

import { ProductType } from "@/lib/types";
import { getProducts } from "@/queries/product";
import { FC, useEffect, useState } from "react";
import ProductList from "../shared/product-list";

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
            } catch (error) {
                if (error instanceof Error) {
                    console.error("Error fetching store products:", error.message);
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

    return <div className="relative mt-6">
        <ProductList products={products} title={`Recommended from ${storeName}`} arrow />
    </div>
}

export default StoreProducts;