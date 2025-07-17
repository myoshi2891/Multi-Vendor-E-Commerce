import { FiltersQueryType } from "@/lib/types";
import { getAllCategories } from "@/queries/category";
import { getAllOfferTags } from "@/queries/offer-tag";
import CategoryFilter from "./filters/category/category-filter";

export default async function ProductFilters({
    queries,
}: {
    queries: FiltersQueryType;
}) {
    const { category, subcategory, offer } = queries; // Extract the search query parameters from the queries object
    const categories = await getAllCategories(); // Fetch all categories from the database
    const offers = await getAllOfferTags(); // Fetch all offer tags from the database
    return (
        <div className="scrollbar sticky top-0 h-[840px] flex-none basis-[196px] overflow-auto overflow-x-hidden pb-2.5 pr-6 transition-transform">
            {/* Headers */}
            {/* Filters */}
            <div className="w-44 border-t">
                <CategoryFilter categories={categories} />
                {/* Offer Filter */}
                {/* Size Filter */}
            </div>
        </div>
    );
}
