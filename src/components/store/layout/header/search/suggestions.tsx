import { SearchResult } from "@/lib/types";
import Image from "next/image";
import { FC } from "react";

interface Props {
    suggestions: SearchResult[];
    query: string;
}

const SearchSuggestions: FC<Props> = ({ suggestions, query }) => {
    return (
        <div className="absolute top-11 !z-50 w-full overflow-hidden rounded-3xl bg-white text-main-primary shadow-2xl">
            <div className="py-2">
                <ul>
                    {suggestions.map((suggestion) => (
                        <li
                            key={suggestion.name}
                            className="flex h-20 w-full cursor-pointer items-center gap-x-2 px-6 hover:bg-[#f5f5f5]"
                        >
                            <Image
                                src={suggestion.image}
                                alt={suggestion.name}
                                width={100}
                                height={100}
                                className="size-16 rounded-md object-cover"
                            />
                            <div>
                                <span className="my-1.5 text-sm leading-6">{suggestion.name}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default SearchSuggestions;
