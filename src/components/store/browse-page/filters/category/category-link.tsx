"use client";
import { CategoryWithSubsType } from "@/lib/types";
import { Minus, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function CategoryLink({
    category,
}: {
    category: CategoryWithSubsType;
}) {
    const searchParams = useSearchParams();
    const params = new URLSearchParams(searchParams);
    const pathname = usePathname();

    const { replace } = useRouter();

    // Params
    const categoryQuery = searchParams.get("category");
    const subCategoryQuery = searchParams.get("subCategory");

    const [expand, setExpand] = useState<boolean>(false);
    const handleCategoryChange = (category: string) => {
        if (category === categoryQuery) return;
        params.delete("subCategory");
        params.set("category", category);
        replaceParams();
    };

    const handleSubCategoryChange = (sub: string) => {
        if (category.url !== categoryQuery)
            params.set("category", category.url);
        if (sub === subCategoryQuery) {
            params.delete("subCategory");
        } else {
            params.set("subCategory", sub);
        }
        replaceParams();
    };

    const replaceParams = () => {
        replace(`${pathname}?${params.toString()}`);
        setExpand(true);
    };

    return (
        <div>
            <section>
                <div className="relative mt-2 flex w-full items-center justify-between leading-5">
                    <label
                        htmlFor={category.id}
                        className="flex cursor-pointer select-none items-center whitespace-nowrap text-left"
                        onClick={() => handleCategoryChange(category.url)}
                    >
                        <span className="relative mr-2 grid size-3 place-items-center rounded-full border border-[#ccc]">
                            {category.url === categoryQuery && (
                                <div className="inline-block size-1.5 rounded-full bg-black"></div>
                            )}
                        </span>
                        <div className="inline-block flex-1 overflow-visible text-clip whitespace-normal text-xs">
                            {category.name}
                        </div>
                    </label>
                    <span
                        className="cursor-pointer"
                        onClick={() => setExpand((prev) => !prev)}
                    >
                        {expand ? (
                            <Minus className="w-3" />
                        ) : (
                            <Plus className="w-3" />
                        )}
                    </span>
                </div>
                {expand && (
                    <>
                        {category.subCategories.map((sub) => (
                            <section
                                key={sub.id}
                                className="relative mt-2 pl-5 leading-5"
                            >
                                <label
                                    htmlFor={sub.id}
                                    className="flex w-full cursor-pointer select-none items-center whitespace-nowrap text-left"
                                    onClick={() =>
                                        handleSubCategoryChange(sub.url)
                                    }
                                >
                                    <span className="relative mr-2 grid size-3 place-items-center rounded-full border border-[#ccc]">
                                        {sub.url === subCategoryQuery && (
                                            <div className="inline-block size-1.5 rounded-full bg-black"></div>
                                        )}
                                    </span>
                                    <div className="inline-block flex-1 overflow-visible text-clip whitespace-normal text-xs">
                                        {sub.name}
                                    </div>
                                </label>
                            </section>
                        ))}
                    </>
                )}
            </section>
        </div>
    );
}
