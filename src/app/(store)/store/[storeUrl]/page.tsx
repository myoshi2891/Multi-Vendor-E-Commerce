import CategoriesHeader from "@/components/store/layout/categories-header/categories-header";
import StoreHeader from "@/components/store/layout/header/header";
import StoreDetails from "@/components/store/store-page/store-details";
import { FiltersQueryType } from "@/lib/types";
import { getStorePageDetails } from "@/queries/store";

export default async function StorePage({
    params,
    searchParams,
}: {
    params: { storeUrl: string };
    searchParams: FiltersQueryType;
    }) {
    const store = await getStorePageDetails(params.storeUrl);
    return <>
        <StoreHeader />
        <CategoriesHeader />
        <StoreDetails details={store}/>
    </>;
}
