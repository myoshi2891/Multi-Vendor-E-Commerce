import {
    OrderTableDateFilter,
    OrderTableFilter,
    PaymentTableDateFilter,
    PaymentTableFilter,
    ReviewDateFilter,
    ReviewFilter,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Dispatch, FC, SetStateAction, useEffect, useState } from "react";
import { DeleteIcon, SearchIcon } from "../../icons";

interface Props {
    filter: ReviewFilter;
    setFilter: Dispatch<SetStateAction<ReviewFilter>>;
    period: ReviewDateFilter;
    setPeriod: Dispatch<SetStateAction<ReviewDateFilter>>;
    search: string;
    setSearch: Dispatch<SetStateAction<string>>;
}
const ReviewsHeader: FC<Props> = ({
    filter,
    setFilter,
    search,
    setSearch,
    period,
    setPeriod,
}) => {
    const router = useRouter();

    // Handle debounced search input
    const [debouncedSearch, setDebouncedSearch] = useState<string>(search);

    // Update parent search state when the debounced search changes
    useEffect(() => {
        const handler = setTimeout(() => {
            if (debouncedSearch.length >= 3) {
                // Start searching after 3 characters
                setSearch(debouncedSearch);
            }
        }, 3000); // Debounce time, adjust as needed

        return () => clearTimeout(handler);
    }, [debouncedSearch, setSearch]);

    return (
        <div className="bg-white pt-4">
            <div className="flex items-center justify-between">
                <div className="-ml-3 text-sm text-main-primary">
                    <div className="relative overflow-x-hidden">
                        <div className="relative inline-flex items-center justify-center bg-white py-4">
                            {filters.map((f, i) => (
                                <div
                                    key={f.filter}
                                    className={cn(
                                        "relative cursor-pointer whitespace-nowrap px-4 leading-6 text-main-primary",
                                        {
                                            "user-orders-table-tr font-bold":
                                                f.filter === filter,
                                        }
                                    )}
                                    onClick={() => {
                                        if (f.filter === "") {
                                            router.refresh();
                                            setFilter(f.filter);
                                        } else {
                                            setFilter(f.filter as ReviewFilter);
                                        }
                                    }}
                                >
                                    {f.title}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div
                    className="mt-0.5 cursor-pointer text-xs"
                    onClick={() => {
                        setFilter("");
                        setDebouncedSearch("");
                        setSearch("");
                    }}
                >
                    <span className="mx-1.5 inline-block translate-y-0.5">
                        <DeleteIcon />
                    </span>
                    Remove all filters
                </div>
            </div>
            {/* Search form - Date filter */}
            <div className="mt-3 flex items-center justify-between">
                <div className="relative flex w-[500px] text-sm leading-6 text-main-primary">
                    {/* Select */}
                    <div className="relative mb-4 w-fit">
                        <select
                            name=""
                            id=""
                            className="h-8 w-24 cursor-pointer appearance-none rounded-l-md border px-4 outline-none hover:border hover:border-black"
                        >
                            <option value="">
                                <div className="flex h-8 overflow-hidden text-left text-sm">
                                    <span className="flex-1 whitespace-nowrap">
                                        Order
                                    </span>
                                </div>
                            </option>
                        </select>
                        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                            <svg
                                viewBox="0 0 1024 1024"
                                width="1em"
                                height="1em"
                                fill="currentColor"
                                aria-hidden="false"
                                focusable="false"
                            >
                                <path d="M97.6 308.032a35.925333 35.925333 0 0 0-4.128 49.813333l1.408 1.632 355.232 371.914667a85.333333 85.333333 0 0 0 123.381333 0.032l355.626667-371.946667a35.936 35.936 0 0 0-2.730667-51.445333 37.674667 37.674667 0 0 0-50.944 1.130667l-1.504 1.546666L527.253333 674.986667a21.333333 21.333333 0 0 1-30.922666 0L150.058667 310.698667a37.653333 37.653333 0 0 0-52.448-2.666667z" />
                            </svg>
                        </span>
                    </div>
                    {/* Input */}
                    <input
                        type="text"
                        placeholder="Order ID, product or store name"
                        className="relative inline-block h-8 w-full border bg-white py-[3px] text-sm leading-6 text-main-primary transition-all duration-75 placeholder:text-xs"
                        value={debouncedSearch}
                        onChange={(e) => setDebouncedSearch(e.target.value)}
                    />
                    {/* Search icon */}
                    <span className="relative -ml-px rounded-r-md bg-white text-center">
                        <button className="grid h-8 min-w-[52px] cursor-pointer place-items-center rounded-r-md bg-[linear-gradient(90deg,_#ff640e,_#ff3000)] text-white">
                            <span className="inline-block text-2xl">
                                <SearchIcon />
                            </span>
                        </button>
                    </span>
                </div>
                {/* Filter by date */}
                <div className="flex items-center">
                    {/* Select */}
                    <div className="relative mb-4 w-fit">
                        <select
                            className="h-8 w-40 cursor-pointer appearance-none rounded-md border px-4 outline-none hover:border hover:border-black"
                            value={period}
                            onChange={(e) =>
                                setPeriod(
                                    e.target.value as PaymentTableDateFilter
                                )
                            }
                        >
                            {date_filters.map((filter) => (
                                <option
                                    key={filter.value}
                                    value={filter.value}
                                    className="flex h-8 overflow-hidden text-left text-sm"
                                >
                                    <span className="flex-1 whitespace-nowrap">
                                        {filter.title}
                                    </span>
                                </option>
                            ))}
                        </select>
                        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                            <svg
                                viewBox="0 0 1024 1024"
                                width="1em"
                                height="1em"
                                fill="currentColor"
                                aria-hidden="false"
                                focusable="false"
                            >
                                <path d="M97.6 308.032a35.925333 35.925333 0 0 0-4.128 49.813333l1.408 1.632 355.232 371.914667a85.333333 85.333333 0 0 0 123.381333 0.032l355.626667-371.946667a35.936 35.936 0 0 0-2.730667-51.445333 37.674667 37.674667 0 0 0-50.944 1.130667l-1.504 1.546666L527.253333 674.986667a21.333333 21.333333 0 0 1-30.922666 0L150.058667 310.698667a37.653333 37.653333 0 0 0-52.448-2.666667z" />
                            </svg>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReviewsHeader;

const filters = [
    {
        title: "View all",
        filter: "",
    },
    {
        title: "5 stars",
        filter: "5",
    },
    {
        title: "4 stars",
        filter: "4",
    },
    {
        title: "3 stars",
        filter: "3",
    },
    {
        title: "2 stars",
        filter: "2",
    },
    {
        title: "1 star",
        filter: "1",
    },
];

const date_filters = [
    {
        title: "All time",
        value: "",
    },
    {
        title: "last 6 months",
        value: "last-6-months",
    },
    {
        title: "last 1 year",
        value: "last-1-year",
    },
    {
        title: "last 2 years",
        value: "last-2-years",
    },
];
