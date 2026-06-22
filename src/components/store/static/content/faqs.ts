import type { StaticSection } from "../static-page-layout";

/**
 * FAQ 本文。Q&A を { heading: question, body: answer } にマップし、
 * 共有レイアウトでそのまま描画する。文章はプレースホルダ（運営が後日差替）。
 */
export const FAQ_SECTIONS: StaticSection[] = [
    {
        heading: "注文をキャンセルできますか？",
        body: "（プレースホルダ）発送前であればキャンセルできる場合があります。詳細は各販売者のポリシーをご確認ください。",
    },
    {
        heading: "配送状況はどこで確認できますか？",
        body: "（プレースホルダ）Track your order ページからご注文の配送状況を確認できます。",
    },
    {
        heading: "支払い方法には何が使えますか？",
        body: "（プレースホルダ）クレジットカード（Stripe）および PayPal がご利用いただけます。",
    },
    {
        heading: "返品・交換はできますか？",
        body: "（プレースホルダ）Returns & Exchange ページの手順に従ってお手続きください。",
    },
];
