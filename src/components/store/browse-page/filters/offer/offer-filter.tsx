'use client'
import { cn } from "@/lib/utils";
import { OfferTag } from "@prisma/client";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import OfferLink from "./offer-link";

export default function OfferFilter({
    offers,
}: {
    offers: OfferTag[];
}) {
    const [show, setShow] = useState<boolean>(false);
    return (
        <div className="pb-4 pt-5">
            {/* Header */}
            <div
                className="relative flex cursor-pointer select-none items-center justify-between"
                onClick={() => setShow((prev) => !prev)}
            >
                <h3 className="line-clamp-1 text-ellipsis text-sm font-bold capitalize text-main-primary">
                    Offer
                </h3>
                <span className="absolute right-0">
                    {show ? (
                        <Minus className="w-3" />
                    ) : (
                        <Plus className="w-3" />
                    )}
                </span>
            </div>
            {/* Filter */}
            <div
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
