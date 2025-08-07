import { FeaturedCategoryType } from "@/lib/types";
import CategoryCard from "./category-card";

export default function FeaturedCategories({
    categories,
}: {
    categories: FeaturedCategoryType[];
}) {
    return (
        <div className="mx-auto w-full">
            {/* Header */}
            <div className="flex h-8 justify-center text-center text-[24px] font-extrabold leading-8 text-[#222]">
                <div className="mx-[14px] my-4 h-px flex-1 border-t-2 border-t-[hsla(0,0%,59.2%,.3)]" />
                <span>Featured Categories</span>
                <div className="mx-[14px] my-4 h-px flex-1 border-t-2 border-t-[hsla(0,0%,59.2%,.3)]" />
            </div>
            {/* List */}
            <div className="mt-7 grid w-full gap-4 min-[770px]:grid-cols-2 min-[1120px]:grid-cols-3">
                {
                    categories.map((category => (
                        <CategoryCard key={category.id} category={category} />
                    )))
                }
            </div>
        </div>
    );
}
