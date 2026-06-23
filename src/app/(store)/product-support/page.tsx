import type { Metadata } from "next";
import StaticPageLayout from "@/components/store/static/static-page-layout";
import { PRODUCT_SUPPORT_SECTIONS } from "@/components/store/static/content/product-support";

export const metadata: Metadata = {
    title: "Product support | Marketplace",
    description: "購入後の技術サポートとトラブルシューティング。",
};

/**
 * Renders the product support page.
 */
export default function ProductSupportPage() {
    return (
        <StaticPageLayout
            title="Product support"
            sections={PRODUCT_SUPPORT_SECTIONS}
        />
    );
}
