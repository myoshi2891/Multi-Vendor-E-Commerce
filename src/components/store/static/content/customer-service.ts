export interface SupportLink {
    title: string;
    description: string;
    href: string;
}

/** Customer service ポータルの導線カード定義（5 窓口）。 */
export const SUPPORT_LINKS: SupportLink[] = [
    {
        title: "Contact us",
        description: "お問い合わせフォーム",
        href: "/contact",
    },
    {
        title: "Returns & Exchange",
        description: "返品・交換のご案内",
        href: "/returns-exchange",
    },
    { title: "FAQs", description: "よくある質問", href: "/faqs" },
    {
        title: "Track your order",
        description: "配送状況の確認",
        href: "/track-order",
    },
    {
        title: "Product support",
        description: "購入後の技術サポート",
        href: "/product-support",
    },
];
