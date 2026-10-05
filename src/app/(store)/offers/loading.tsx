import DesignPage from "@/components/store/shared/design-page/design-page";
export default function OffersLoading() {
    return (
        <DesignPage
            title="Discounts & Offers"
            eyebrow="A LITTLE DISCOVERY"
            description="Explore the latest offers from our collection."
        >
            <p role="status">Loading offers…</p>
        </DesignPage>
    );
}
