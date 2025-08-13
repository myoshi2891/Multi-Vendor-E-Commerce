"use client";
import { FiltersQueryType, ProductType } from "@/lib/types";
import { getProducts } from "@/queries/product";
import { useEffect, useState } from "react";
import ProductCard from "../cards/product/product-card";
import { off } from "process";

export default function StoreProducts({
    searchParams,
    store,
}: {
    searchParams: FiltersQueryType;
    store: string;
}) {
    const [data, setData] = useState<ProductType[]>([]);
    const { category, offer, search, size, sort, subCategory } = searchParams;

    useEffect(() => {
        const getFilteredProducts = async () => {
            const { products } = await getProducts(
                {
                    category,
                    offer,
                    search,
                    size: Array.isArray(size)
                        ? size
                        : size
                          ? [size] // Convert string to array if it's not already an array
                            : undefined, // Default to undefined if size is not provided
                    subCategory,
                    store
                },
                sort,
                1,
                100
            );
            setData(products);
        };
        getFilteredProducts();
    }, [searchParams]);
    return (
        <div className="flex flex-wrap justify-center rounded-md bg-white p-2 pb-16 md:justify-center">
            {data.map(product => (
                <ProductCard key={product.slug} product={product} />
            ))}
        </div>
    );
}
