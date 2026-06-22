/** 返品・交換ポリシーの要約（returns-exchange ページ上部に表示）。
 *  静的定数のみで自己完結し Prisma を読まない（force-dynamic 不要）。
 *  正式な全文ポリシーは後続の storefront-static-pages 側で拡張する。 */
export interface ReturnsPolicySummary {
    title: string;
    intro: string;
    points: string[];
}

export const RETURNS_POLICY_SUMMARY: ReturnsPolicySummary = {
    title: "返品・交換について",
    intro: "商品到着後 30 日以内であれば、未使用・未開封の商品の返品・交換を承ります。下記フォームより対象の注文番号を添えてお申し込みください。",
    points: [
        "返品期限: 商品到着から 30 日以内",
        "対象: 未使用・未開封の商品（一部の衛生用品・受注生産品を除く）",
        "返金: 検品完了後、元のお支払い方法へ返金します",
        "送料: 初期不良・誤配送の場合は当社負担、お客様都合の場合はお客様負担",
    ],
};
