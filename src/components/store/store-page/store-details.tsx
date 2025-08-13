"use client"
import { StoreDetailsType } from "@/lib/types";
import { CircleCheckBig } from "lucide-react";
import Image from "next/image";
import ReactStars from "react-rating-stars-component";

export default function StoreDetails({
    details,
}: {
    details: StoreDetailsType;
}) {
    const { averageRating, cover, description, logo, name, numReviews } =
        details;
    const numOfReviews = new Intl.NumberFormat().format(numReviews);
    
    return (
        <div className="relative w-full pb-28">
            <div className="relative">
                <Image
                    src={cover}
                    alt={name}
                    width={2000}
                    height={500}
                    className="h-96 w-full object-cover"
                />
                <div className="absolute bottom-[-100px] left-11 flex items-end">
                    <Image
                        src={logo}
                        alt={name}
                        width={200}
                        height={200}
                        className="size-44 rounded-full object-cover shadow-2xl"
                    />
                    <div className="mb-5 pl-1">
                        <div className="flex items-center gap-x-1">
                            <h1 className="text-2xl font-bold capitalize leading-5">
                                {name.toLowerCase()}
                            </h1>
                            <CircleCheckBig className="mt-0.5 stroke-green-400" />
                        </div>
                        <div className="flex items-center gap-x-1">
                            <ReactStars
                                count={5}
                                size={24}
                                color="#e2dfdf"
                                activeColor="#FFD804"
                                isHalf
                                edit={false}
                                value={averageRating}
                            />
                            <p className="text-xs text-main-secondary">
                                ({numOfReviews} reviews)
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
