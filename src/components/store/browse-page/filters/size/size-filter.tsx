"use client";
import { FiltersQueryType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getFilteredSizes } from "@/queries/size";
import { Minus, Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import SizeLink from "./size-link";

export default function SizeFilter({
    queries,
    storeUrl,
}: {
    queries: FiltersQueryType;
    storeUrl?: string;
}) {
    const { category, subCategory, offer, search } = queries;
    const [show, setShow] = useState<boolean>(true);
    const panelId = useId();
    const [sizes, setSizes] = useState<{ size: string }[]>([]);
    const [total, setTotal] = useState<number>(10);
    const [take, setTake] = useState<number>(10);

    useEffect(() => {
        let cancelled = false;

        const handleGetSizes = async () => {
            try {
                const sizes = await getFilteredSizes(
                    { category, subCategory, offer, storeUrl },
                    take
                );

                if (!cancelled) {
                    setSizes(sizes.sizes);
                    setTotal(sizes.count);
                }
            } catch {
                if (!cancelled) {
                    setSizes([]);
                    setTotal(0);
                }
            }
        };
        void handleGetSizes();

        return () => {
            cancelled = true;
        };
    }, [category, subCategory, offer, take, storeUrl]);

    return (
        <div className="pb-4 pt-5">
            {/* Header */}
            <h3>
                <button type="button" aria-expanded={show} aria-controls={panelId}
                    className="flex min-h-9 w-full cursor-pointer items-center justify-between text-left text-sm font-bold text-main-primary"
                    onClick={() => setShow((prev) => !prev)}>
                    Size
                    {show ? <Minus className="w-3" aria-hidden="true" /> : <Plus className="w-3" aria-hidden="true" />}
                </button>
            </h3>
            {/* Filter */}
            <div
                id={panelId}
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
