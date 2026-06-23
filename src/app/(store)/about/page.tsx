import type { Metadata } from "next";
import StaticPageLayout from "@/components/store/static/static-page-layout";
import { ABOUT_SECTIONS } from "@/components/store/static/content/about";

export const metadata: Metadata = {
    title: "About | Marketplace",
    description: "運営会社情報とプラットフォームの紹介。",
};

/**
 * Renders the About page with company information and platform introduction.
 */
export default function AboutPage() {
    return <StaticPageLayout title="About" sections={ABOUT_SECTIONS} />;
}
