"use client";
import type { SearchResult } from "@/lib/types";
import { SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import SearchSuggestions from "./suggestions";
import styles from "../panels.module.css";

type SearchState = "idle" | "pending" | "ready" | "error";
export default function Search() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const params = new URLSearchParams(searchParams);
    const { push, replace } = useRouter();
    const [searchQuery, setSearchQuery] = useState(params.get("search") || "");
    const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
    const [state, setState] = useState<SearchState>("idle");
    const abortRef = useRef<AbortController | null>(null);
    useEffect(() => () => abortRef.current?.abort(), []);
    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (pathname !== "/browse")
            push(`/browse?search=${encodeURIComponent(searchQuery)}`);
        else {
            if (searchQuery) params.set("search", searchQuery);
            else params.delete("search");
            replace(`${pathname}?${params.toString()}`);
        }
    };
    const handleInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setSearchQuery(value);
        abortRef.current?.abort();
        setSuggestions([]);
        const trimmed = value.trim();
        if (trimmed.length < 2) {
            setState("idle");
            return;
        }
        const controller = new AbortController();
        abortRef.current = controller;
        setState("pending");
        try {
            const response = await fetch(
                `/api/search-products?q=${encodeURIComponent(trimmed)}`,
                { signal: controller.signal }
            );
            if (!response.ok) throw new Error("Search unavailable");
            const data = await response.json();
            if (controller.signal.aborted) return;
            const items: unknown = Array.isArray(data)
                ? data
                : (data?.products ?? data?.results ?? data?.items ?? []);
            const validItems = Array.isArray(items)
                ? items.filter(
                      (item): item is SearchResult =>
                          item &&
                          typeof item.link === "string" &&
                          typeof item.name === "string" &&
                          typeof item.image === "string" &&
                          item.link &&
                          item.name &&
                          item.image
                  )
                : [];
            setSuggestions(validItems);
            setState("ready");
        } catch {
            if (!controller.signal.aborted) {
                setSuggestions([]);
                setState("error");
            }
        }
    };
    return (
        <div className={`${styles.theme} ${styles.search}`}>
            <form onSubmit={handleSubmit} className={styles.form} role="search">
                <input
                    type="text"
                    placeholder="Search the collection…"
                    aria-label="Search products"
                    value={searchQuery}
                    onChange={handleInputChange}
                />
                <button type="submit" aria-label="Search">
                    <SearchIcon aria-hidden="true" />
                </button>
            </form>
            <p role="status" className={styles.feedback}>
                {state === "pending"
                    ? "Searching the collection…"
                    : state === "ready"
                      ? suggestions.length
                          ? `${suggestions.length} suggestions found.`
                          : "No pieces found. Try another search."
                      : ""}
            </p>
            {state === "error" && (
                <p role="alert" className={styles.error}>
                    Search suggestions are unavailable. Submit your search or
                    try again.
                </p>
            )}
            {suggestions.length > 0 && (
                <SearchSuggestions
                    suggestions={suggestions}
                    query={searchQuery}
                />
            )}
        </div>
    );
}
