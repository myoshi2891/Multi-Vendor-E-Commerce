'use client'
import { cn } from "@/lib/utils";
import { OfferTag } from "@prisma/client";
import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";
import OfferLink from "./offer-link";

export default function OfferFilter({
    offers,
}: {
    offers: OfferTag[];
}) {
    const [show, setShow] = useState<boolean>(true);
    const panelId = useId();
    return (
        <div className="pb-4 pt-5">
            {/* Header */}
            <h3>
                <button type="button" aria-expanded={show} aria-controls={panelId}
                    className="flex min-h-9 w-full cursor-pointer items-center justify-between text-left text-sm font-bold text-main-primary"
                    onClick={() => setShow((prev) => !prev)}>
                    Offer
                    {show ? <Minus className="w-3" aria-hidden="true" /> : <Plus className="w-3" aria-hidden="true" />}
                </button>
            </h3>
            {/* Filter */}
            <div
                id={panelId}
                className={cn("mt-2.5 flex flex-wrap gap-2", {
                    hidden: !show,
                })}
            >
                {offers.map((offer) => (
                    <OfferLink key={offer.id} offer={offer} />
                ))}
            </div>
        </div>
    );
}
