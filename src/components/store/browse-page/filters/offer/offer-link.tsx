"use client";
import { cn } from "@/lib/utils";
import { OfferTag } from "@prisma/client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function OfferLink({
    offer,
}: {
    offer: OfferTag;
}) {
    const searchParams = useSearchParams();
    const params = new URLSearchParams(searchParams);
    const pathname = usePathname();

    const { replace } = useRouter();

    // Params
    const offerQuery = searchParams.get("offer");

    const handleOfferChange = (offer: string) => {
        if (offer === offerQuery) return;
        params.delete("offer");
        params.set("offer", offer);
        replaceParams();
    };

    const replaceParams = () => {
        replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    return (
        <button
            type="button"
            aria-pressed={offerQuery === offer.url}
            className={cn(
                "min-h-8 w-fit cursor-pointer rounded-lg border px-2 py-1 text-sm hover:border-orange-background",
                {   "bg-[#ffebed] text-orange-background border-orange-background": offerQuery === offer.url, }
            )}
            onClick={() => handleOfferChange(offer.url)}
        >
            {offer.name}
        </button>
    );
}
