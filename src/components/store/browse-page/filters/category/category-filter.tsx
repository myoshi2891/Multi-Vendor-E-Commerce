'use client'
import { CategoryWithSubsType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";

export default function CategoryFilter({
    categories,
}: {
    categories: CategoryWithSubsType[];
    }) {
    const [show, setShow] = useState<boolean>(false);
    return (
        <div className="pb-4 pt-5">
            {/* Header */}
            <div className="relative flex cursor-pointer select-none items-center justify-between"
            onClick={() => setShow(prev => !prev)}>
                <h3 className="line-clamp-1 text-ellipsis text-sm font-bold capitalize text-main-primary">
                    Category
                </h3>
                <span className="absolute right-0">
                    {show ? <Minus className="w-3"/> : <Plus className="w-3"/>}
                </span>
            </div>
            {/* Filter */}
            <div className={cn("mt-2.5", {
                hidden: !show
            })}>
                {categories.map((category) => (
                    <div key={category.id}>{ category.name}</div>
                ))}
            </div>
        </div>
    );
}
