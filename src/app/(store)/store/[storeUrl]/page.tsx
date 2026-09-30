import ProductFilters from "@/components/store/browse-page/filters";
import FilterPanel from "@/components/store/browse-page/filter-panel";
import StoreDetails from "@/components/store/store-page/store-details";
import StoreProducts from "@/components/store/store-page/store-products";
import { FiltersQueryType } from "@/lib/types";
import { getStorePageDetails } from "@/queries/store";
import catalog from "../../browse/browse.module.css";
import styles from "@/components/store/store-page/store-page.module.css";

export const dynamic = "force-dynamic";

export default async function StorePage({ params, searchParams }: {
    params: Promise<{ storeUrl: string }>;
    searchParams: Promise<FiltersQueryType>;
}) {
    const { storeUrl } = await params;
    const query = await searchParams;
    const store = await getStorePageDetails(storeUrl);
    return (
        <main className={catalog.browse}>
            <StoreDetails details={store} />
            <div id="collection" className={catalog.catalog}>
                <div className={catalog.catalogIntro}>
                    <div>
                        <p className={catalog.eyebrow}>THE STORE EDIT</p>
                        <h2>A collection to <em>discover.</em></h2>
                    </div>
                    <a href="#store-about" className={styles.aboutLink}>About the store ↗</a>
                </div>
                <div className={catalog.catalogLayout}>
                    <section className={catalog.filters} aria-label="Refine the store collection">
                        <p className={catalog.sectionLabel}>REFINE YOUR SEARCH</p>
                        <FilterPanel>
                            <ProductFilters queries={query} storeUrl={storeUrl} />
                        </FilterPanel>
                    </section>
                    <section className={catalog.results} aria-label="Store collection results">
                        <StoreProducts searchParams={query} store={storeUrl} />
                    </section>
                </div>
            </div>
        </main>
    );
}
