import { FeaturedCategoryType } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";

export default function CategoryCard({
    category,
}: {
    category: FeaturedCategoryType;
}) {
    return (
        <div className="size-full rounded-[10px] bg-white">
            <Link href={`/browse?category=${category.url}`}>
                <div className="flex items-center justify-between px-5 pt-4">
                    <span className="line-clamp-1 flex-1 overflow-hidden text-[20px] font-extrabold text-[#222]">
                        {category.name}
                    </span>
                    <span className="mr-2.5 block text-[14px] text-[#222] hover:underline">
                        View more
                    </span>
                </div>
            </Link>
            <div className="flex gap-x-2 p-4">
                {category.subCategories.map((sub) => (
                    <Link
                        href={`/browse?subCategory=${sub.url}`}
                        key={sub.id}
                        className="cursor-pointer overflow-hidden rounded-[10px]"
                    >
                        <Image
                            src={sub.image}
                            alt={sub.name}
                            width={180}
                            height={195}
                            className="h-[150px] w-[180px] rounded-md object-cover hover:opacity-80"
                            priority
                        />
                    </Link>
                ))}
            </div>
        </div>
    );
}
