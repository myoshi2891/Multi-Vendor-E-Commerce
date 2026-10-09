"use client";
import { FiltersQueryType } from "@/lib/types";
import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function FiltersHeader({
    queries,
}: {
    queries: FiltersQueryType;
}) {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { replace } = useRouter();

    const queriesArray = Object.entries(queries).filter(
        ([key, value]) => key !== "sort" && value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0)
    );
    const queriesLength = queriesArray.reduce(
        (count, [, queryValue]) => {
            return count + (Array.isArray(queryValue) ? queryValue.length : 1); // Count array lengths or single
        },
        0
    );

    // Handle Clearing all parameters
    const handleClearQueries = () => {
        const params = new URLSearchParams(searchParams);

        params.forEach((_, key) => {
            params.delete(key);
        });

        // Replace the URL with the pathname and no query string
        replace(pathname, { scroll: false });
    };

    // Handle removing specific query values or entire queries
    const handleRemoveQuery = (
        query: string,
        array?: string[],
        specificValue?: string
    ) => {
        const params = new URLSearchParams(searchParams);

        if (specificValue && array) {
            // Remove the specific value from the array and update the params
            const updatedArray = array.filter(
                (value) => value !== specificValue
            );
            params.delete(query); // Remove the query from params
            // Re-add remaining values if any
            updatedArray.forEach((value) => params.append(query, value));
        } else {
            // Remove the entire query
            params.delete(query);
        }

        // Replace the URL with updated params
        replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    return (
        <div className="pb-5 pt-2.5">
            <div className="flex h-4 items-center justify-between leading-5">
                <div className="text-sm font-bold">
                    Filter ({queriesLength})
                </div>
                {queriesLength > 0 && (
                    <button
                        type="button"
                        className="cursor-pointer text-xs text-orange-background hover:underline"
                        onClick={() => handleClearQueries()}
                    >
                        Clear All
                    </button>
                )}
            </div>
            {/* Display filters */}
            <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                {queriesArray.map(([queryKey, queryValue]) => {
                    const isArrayQuery = Array.isArray(queryValue);
                    const queryValues = isArrayQuery
                        ? queryValue
                        : [queryValue];
                    return (
                        <div key={queryKey} className="flex min-w-0 max-w-full flex-wrap gap-2">
                            {queryValues.map((value, index) => (
                                <button
                                    type="button"
                                    key={index}
                                    className="inline-flex min-w-0 max-w-full cursor-pointer items-start gap-1.5 rounded-sm border px-1.5 py-1 text-left text-xs leading-snug"
                                    aria-label={`Remove ${queryKey} ${value}`}
                                    onClick={() => {
                                        isArrayQuery
                                            ? handleRemoveQuery(queryKey, queryValues, value)
                                            : handleRemoveQuery(queryKey);
                                    }}
                                >
                                    <span className="min-w-0 break-all text-main-secondary">
                                        {value}
                                    </span>
                                    <X className="mt-0.5 size-3 shrink-0 text-main-primary" aria-hidden="true" />
                                </button>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
