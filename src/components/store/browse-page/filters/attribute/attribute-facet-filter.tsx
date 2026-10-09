"use client";
import type { ProductFacet, ProductFacetValue } from "@/lib/types";
import { ATTRIBUTE_PARAM_PREFIX, cn } from "@/lib/utils";
import { Check, Minus, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";

/**
 * ブラウズの属性ファセット（plan 076）。値は `/browse` の Server Component が
 * `getProductFacets` で集計して渡す（この部品は Server Action を呼ばない）。
 *
 * 選択は URL の `?attr.<key>=<value>` で表す（同じ key の値は OR、key 同士は AND）。
 */
export default function AttributeFacetFilter({
    facets,
}: {
    facets: ProductFacet[];
}) {
    if (facets.length === 0) return null;
    return (
        <>
            {facets.map((facet) => (
                <FacetSection key={facet.key} facet={facet} />
            ))}
        </>
    );
}

function FacetSection({ facet }: { facet: ProductFacet }) {
    const [show, setShow] = useState<boolean>(true);
    const headingId = useId();
    const panelId = useId();
    const title = facet.unit ? `${facet.name} (${facet.unit})` : facet.name;

    return (
        <section aria-labelledby={headingId} className="pb-4 pt-5">
            <h3 id={headingId}>
                <button
                    type="button"
                    aria-expanded={show}
                    aria-controls={panelId}
                    className="flex min-h-9 w-full cursor-pointer items-center justify-between text-left text-sm font-bold text-main-primary"
                    onClick={() => setShow((prev) => !prev)}
                >
                    {title}
                    {show ? (
                        <Minus className="w-3" aria-hidden="true" />
                    ) : (
                        <Plus className="w-3" aria-hidden="true" />
                    )}
                </button>
            </h3>
            <div id={panelId} hidden={!show} className="mt-2.5 space-y-2">
                {facet.values.map((value) => (
                    <FacetValueButton
                        key={value.value}
                        facetKey={facet.key}
                        value={value}
                    />
                ))}
            </div>
        </section>
    );
}

function FacetValueButton({
    facetKey,
    value,
}: {
    facetKey: string;
    value: ProductFacetValue;
}) {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { replace } = useRouter();
    const paramName = `${ATTRIBUTE_PARAM_PREFIX}${facetKey}`;

    const handleToggle = () => {
        const params = new URLSearchParams(searchParams);
        const current = params.getAll(paramName);
        params.delete(paramName);
        const next = value.selected
            ? current.filter((v) => v !== value.value)
            : [...current, value.value];
        next.forEach((v) => params.append(paramName, v));
        // 絞り込みが変わると総ページ数も変わるので、1 ページ目へ戻す
        params.delete("page");
        replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    return (
        <button
            type="button"
            aria-pressed={value.selected}
            className="flex min-h-8 w-full cursor-pointer select-none items-center whitespace-nowrap text-left"
            onClick={handleToggle}
        >
            <span
                aria-hidden="true"
                className={cn(
                    "relative mr-2 flex size-3 items-center justify-center rounded-full border border-[#ccc]",
                    { "border-black bg-black text-white": value.selected }
                )}
            >
                {value.selected && <Check className="w-2" />}
            </span>
            <span className="inline-block flex-1 whitespace-normal text-xs">
                {value.label} ({value.count})
            </span>
        </button>
    );
}
