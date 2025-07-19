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
        replace(`${pathname}?${params.toString()}`);
    };

    return (
        <div
            className={cn(
                "w-fit cursor-pointer rounded-lg border px-1.5 py-1 text-sm hover:border-orange-background",
                {   "bg-[#ffebed] text-orange-background border-orange-background": offerQuery === offer.url, }
            )}
            onClick={() => handleOfferChange(offer.url)}
        >
            {offer.name}
        </div>
    );
}
