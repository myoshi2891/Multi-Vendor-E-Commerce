import type { Metadata } from "next";
import StaticPageLayout from "@/components/store/static/static-page-layout";
import { ABOUT_SECTIONS } from "@/components/store/static/content/about";

export const metadata: Metadata = {
    title: "About | Marketplace",
    description: "運営会社情報とプラットフォームの紹介。",
};

/** 運営会社情報・プラットフォーム紹介の静的ページ。DB 非依存のため force-dynamic 不要。 */
export default function AboutPage() {
    return <StaticPageLayout title="About" sections={ABOUT_SECTIONS} />;
}
