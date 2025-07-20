"use client";
import { FiltersQueryType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getFilteredSizes } from "@/queries/size";
import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import SizeLink from "./size-link";

export default function SizeFilter({ queries }: { queries: FiltersQueryType }) {
    const { category, subcategory, offer, search } = queries;
    const [show, setShow] = useState<boolean>(false);
    const [sizes, setSizes] = useState<{ size: string }[]>([]);
    const [total, setTotal] = useState<number>(10);
    const [take, setTake] = useState<number>(10);

    useEffect(() => {
        handleGetSizes();
    }, [category, subcategory, offer, take]);

    const handleGetSizes = async () => {
        const sizes = await getFilteredSizes(
            { category, subcategory, offer },
            take
        );
        setSizes(sizes.sizes);
        setTotal(sizes.count);
    };

    return (
        <div className="pb-4 pt-5">
            {/* Header */}
            <div
                className="relative flex cursor-pointer select-none items-center justify-between"
                onClick={() => setShow((prev) => !prev)}
            >
                <h3 className="line-clamp-1 text-ellipsis text-sm font-bold capitalize text-main-primary">
                    Size
                </h3>
                <span className="absolute right-0">
                    {show ? (
                        <Minus className="w-3" />
                    ) : (
                        <Plus className="w-3" />
                    )}
                </span>
            </div>
            {/* Filter */}
            <div
                className={cn("mt-2.5 space-y-2", {
                    hidden: !show,
                })}
            >
                {sizes.map((size) => (
                    <SizeLink key={size.size} size={size.size} />
                ))}
            </div>
        </div>
    );
}
