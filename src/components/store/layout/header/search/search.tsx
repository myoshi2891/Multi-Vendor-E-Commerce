"use client";
import { SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function Search() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const params = new URLSearchParams(searchParams);
    const { push, replace } = useRouter();

    const [searchQuery, setSearchQuery] = useState<string>("");

    const handleSubmit = (e: any) => {
        e.preventDefault();
        if (pathname !== "/browse") {
            // We are not on the browse page, so we push to the browse page with the search query
            push(`/browse?search=${searchQuery}`);
        } else {
            // We are on the browse page, so we replace the current browse page with the search query
            if (!searchQuery) {
                // If the search query is empty, we remove the search query from the search parameters
                params.delete("search");
            } else {
                // We update the search query in the search parameters
                params.set("search", searchQuery);
            }
            replace(`${pathname}?${params.toString()}`);
        }
    };

    return (
        <div className="relative flex-1 lg:w-full">
            <form
                onSubmit={handleSubmit}
                className="relative flex h-10 rounded-3xl border-none bg-white"
            >
                <input
                    type="text"
                    placeholder="Search..."
                    className="m-2.5 flex-1 border-none bg-white pl-2.5 text-black outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                    type="submit"
                    className="mb-0 ml-0 mr-1 mt-1 grid h-8 w-[56px] cursor-pointer place-items-center rounded-[20px] border bg-gradient-to-r from-slate-500 to-slate-600"
                >
                    <SearchIcon />
                </button>
            </form>
        </div>
    );
}
