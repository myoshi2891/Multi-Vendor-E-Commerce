"use client";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import styles from "./sort.module.css";

const sortArray = [
    { name: "Most Popular", query: "most-popular" },
    { name: "New Arrivals", query: "new-arrivals" },
    { name: "Top Rated", query: "top-rated" },
    { name: "Price low to high", query: "price-low-to-high" },
    { name: "Price High to low", query: "price-high-to-low" },
];

const DEFAULT_SORT = sortArray[0];

export default function ProductSort() {
    const searchParams = useSearchParams();
    const params = new URLSearchParams(searchParams);
    const pathname = usePathname();
    const { replace } = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const activeSort =
        sortArray.find((option) => option.query === params.get("sort")) ??
        DEFAULT_SORT;

    const handleSort = (sort: string) => {
        params.set("sort", sort);
        replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    return (
        <div className={styles.sort}>
            <DropdownMenu
                modal={false}
                open={isMenuOpen}
                onOpenChange={setIsMenuOpen}
            >
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className={styles.trigger}
                        aria-label={`Sort by ${activeSort.name}`}
                    >
                        <span data-sort-label className={styles.label}>
                            Sort by
                        </span>
                        <span data-sort-value className={styles.value}>
                            {activeSort.name}
                        </span>
                        <ChevronDown
                            className={cn(
                                styles.chevron,
                                isMenuOpen && styles.chevronOpen
                            )}
                            size={14}
                            aria-hidden="true"
                        />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="end"
                    sideOffset={6}
                    className={styles.menu}
                >
                    <DropdownMenuRadioGroup
                        value={activeSort.query}
                        onValueChange={handleSort}
                    >
                        {sortArray.map((option) => (
                            <DropdownMenuRadioItem
                                key={option.query}
                                value={option.query}
                                className={styles.option}
                            >
                                <span
                                    className={cn(
                                        option.query === activeSort.query &&
                                            "font-bold"
                                    )}
                                >
                                    {option.name}
                                </span>
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
