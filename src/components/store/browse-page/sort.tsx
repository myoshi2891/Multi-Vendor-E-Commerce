"use client";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const sortArray = [
    {
        name: "Most Popular",
        query: "most-popular",
    },
    {
        name: "New Arrivals",
        query: "new-arrivals",
    },
    {
        name: "Top Rated",
        query: "top-rated",
    },
    {
        name: "Price low to high",
        query: "price-low-to-high",
    },
    {
        name: "Price High to low",
        query: "price-high-to-low",
    },
];
export default function ProductSort() {
    const searchParams = useSearchParams();
    const params = new URLSearchParams(searchParams);
    const pathname = usePathname();

    const { replace } = useRouter();

    const sortQuery = params.get("sort") || "most-popular";
    const sort = sortQuery
        ? sortArray.find((s) => s.query === sortQuery)?.name
        : "Most Popular";

    const handleSort = (sort: string) => {
        params.set("sort", sort);
        replace(`${pathname}?${params.toString()}`);
    };

    const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

    return (
        <div className="duration-[30ms] relative w-full transition-all">
            <div className="relative inline-block pr-[50px]">
                <div className="flex">
                    <div className="!float-right h-9 w-[227px]">
                        <div className="!float-left h-9 w-[227px]">
                            <div
                                className="group relative z-20 inline-block h-9 w-[227px] outline-0"
                                onMouseEnter={() => setIsMenuOpen(true)}
                                onMouseLeave={() => setIsMenuOpen(false)}
                            >
                                {/* Trigger */}
                                <div className="h-9 w-[227px]">
                                    <div className="relative inline-flex w-full">
                                        <div className="relative">
                                            <span className="duration-[20ms] absolute top-0 flex h-full w-[70px] items-center justify-center transition-all">
                                                <label htmlFor="">
                                                    Sort by
                                                </label>
                                            </span>
                                        </div>
                                        <input
                                            type="text"
                                            disabled
                                            value={sort}
                                            className="h-9 w-full cursor-pointer border bg-transparent bg-none px-3 pl-[70px] pr-10 align-bottom text-sm font-bold text-main-primary outline-0"
                                        />
                                        <div className="relative">
                                            <span
                                                className="absolute right-0 top-0 box-border flex h-full w-10 items-center justify-center transition-transform duration-200 ease-in-out"
                                                style={{
                                                    transform: isMenuOpen
                                                        ? "rotate(180deg)"
                                                        : "rotate(0deg)",
                                                }}
                                            >
                                                <ChevronDown className="w-3" />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {/* Menu */}
                                <ul
                                    className={cn(
                                        "absolute max-h-72 w-full overflow-auto bg-white py-2 shadow-2xl transition-all duration-300 ease-in-out",
                                        {
                                            "translate-y-0 opacity-100":
                                                isMenuOpen,
                                            "pointer-events-none -translate-y-2 opacity-0":
                                                !isMenuOpen,
                                        }
                                    )}
                                >
                                    {sortArray.map((option) => (
                                        <li
                                            key={option.query}
                                            className="flex h-8 w-full cursor-pointer items-center justify-between bg-white px-4 text-xs hover:bg-gray-100"
                                            onClick={() =>
                                                handleSort(option.query)
                                            }
                                        >
                                            <span
                                                className={cn({
                                                    "font-bold":
                                                        option.query ===
                                                        sortQuery,
                                                })}
                                            >
                                                {option.name}
                                            </span>
                                            {option.query === sortQuery && <Check className="w-3" />}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
