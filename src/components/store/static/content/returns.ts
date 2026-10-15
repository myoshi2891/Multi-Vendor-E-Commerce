/** 返品・交換ポリシーの要約（returns-exchange ページ上部に表示）。
 *  Prisma を読まない純粋な関数（force-dynamic 不要）。返品できる日数は呼び出し側が
 *  `resolveReturnWindowDays`（src/lib/returns-policy.ts）から渡し、申請の判定と同じ値で描く
 *  （plan 088・returns-rma design §3 / §6）。 */
export interface ReturnsPolicySummary {
    title: string;
    intro: string;
    points: string[];
}

export function buildReturnsPolicySummary(
    windowDays: number
): ReturnsPolicySummary {
    return {
        title: "返品・交換について",
        intro: `商品の到着予定日から ${windowDays} 日以内であれば、未使用・未開封の商品の返品を承ります。ログイン中の方は、ご注文履歴の注文詳細から店舗ごとに申請できます。`,
        points: [
            `返品期限: 商品の到着予定日から ${windowDays} 日以内`,
            "申請: 注文詳細から、返品する商品・数量・理由を選んで店舗ごとに申請します。店舗の承認後に返送してください",
            "対象: 未使用・未開封の商品（一部の衛生用品・受注生産品、返品を受け付けていない店舗の商品を除く）",
            "返金: 店舗が商品を受け取って確認した後、商品代金を元のお支払い方法へ返金します（送料・クーポン分は含みません）",
            "交換: 現在は返品後の再注文でお受けしています",
        ],
    };
}
