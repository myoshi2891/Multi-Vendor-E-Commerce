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
        getStoreProducts()
    }, [])

    const getStoreProducts = async () => {
        const res = await getProducts({ store: storeUrl }, "", 1, count)
        setProducts(res.products)
    }

    return <div className="relative mt-6">
        <ProductList products={products} title={`Recommended from ${storeName}`} arrow />
    </div>
}

export default StoreProducts;