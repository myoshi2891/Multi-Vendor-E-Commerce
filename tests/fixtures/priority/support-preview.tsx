import React from "react";
import TrackOrderPage from "@/app/(store)/track-order/page";
import CustomerServicePage from "@/app/(store)/customer-service/page";
import ReturnsPage from "@/app/(store)/returns-exchange/page";
import DisputePage from "@/app/(store)/dispute/page";
import ProblemPage from "@/app/(store)/report-problem/page";
import OffersPage from "@/app/(store)/offers/page";
import OffersLoading from "@/app/(store)/offers/loading";
import DesignPage from "@/components/store/shared/design-page/design-page";
import styles from "@/components/store/shared/design-page/design-page.module.css";

/** Production page bodies; every action/query below is adapted by the shared fixture server. */
export async function supportPreview(scenario: string) {
    if (scenario === "support-frame") return <DesignPage {...{appearance: "purchase" as const}} title="Support" eyebrow="Care" description="Help"><section className={styles.support}>Existing content</section></DesignPage>;
    if (scenario === "support-frame-default") return <DesignPage title="Legal" eyebrow="Policies" description="Information"><section className={styles.support}>Existing content</section></DesignPage>;
    if (scenario.startsWith("support-track")) return <TrackOrderPage />;
    if (scenario === "support-hub") return <CustomerServicePage />;
    if (scenario.startsWith("support-returns")) return <ReturnsPage />;
    if (scenario.startsWith("support-dispute")) return <DisputePage />;
    if (scenario.startsWith("support-problem")) return <ProblemPage />;
    if (scenario === "support-offers-loading") return <OffersLoading />;
    return OffersPage();
}
