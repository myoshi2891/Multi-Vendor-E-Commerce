import { SearchResult } from "@/lib/types";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FC } from "react";

interface Props {
    suggestions: SearchResult[];
    query: string;
}

const SearchSuggestions: FC<Props> = ({ suggestions, query }) => {
    const router = useRouter();
    const highlightText = (text: string, query: string) => {
        if (!query) return text; // If no query, return the original text
        const regex = new RegExp(`(${query})`, "gi"); // Create a regex pattern to match the query (case-insensitive)
        const parts = text.split(regex); // Split the text by the query

        return parts.map((part, index) =>
            part.toLowerCase() === query.toLowerCase() ? (
                <strong key={index} className="text-orange-background">
                    {part}
                </strong>
            ) : (
                part
            )
        );
    };

    const handlePush = (link: string) => {
        router.push(link);
    };

    return (
        <div className="absolute top-11 z-[60] w-full overflow-hidden rounded-3xl bg-white text-main-primary shadow-2xl">
            <div className="py-2">
                <ul>
                    {suggestions.map((suggestion) => (
                        <li
                            key={suggestion.name}
                            className="flex h-20 w-full cursor-pointer items-center gap-x-2 px-6 hover:bg-[#f5f5f5]"
                            onClick={() => handlePush(suggestion.link)}
                        >
                            <Image
                                src={suggestion.image}
                                alt={suggestion.name}
                                width={100}
                                height={100}
                                className="size-16 rounded-md object-cover"
                            />
                            <div>
                                <span className="my-1.5 text-sm leading-6">
                                    {highlightText(suggestion.name, query)}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default SearchSuggestions;
