import { redirect } from "next/navigation";
import { ReturnRequestStatus } from "@prisma/client";
import SellerReturns from "@/components/dashboard/seller/seller-returns";
import SellerPage from "@/components/dashboard/design/seller-page";
import { LookupFailure } from "@/components/dashboard/design/seller-error";
import { requireStoreOwner } from "@/lib/auth-guards";
import { serializeReturnRequests } from "@/lib/returns-view";
import { normalizePageParam } from "@/lib/utils";
import {
    approveReturnRequest,
    getStoreReturnRequests,
    receiveReturnRequest,
    rejectReturnRequest,
    resolveReturnRequest,
} from "@/queries/returns";
export const dynamic = "force-dynamic";

/** URL の status を状態へ絞る。未知の値・配列は絞り込みなし（全件）として扱う */
const toStatus = (raw: unknown): ReturnRequestStatus | undefined =>
    typeof raw === "string" &&
    (Object.values(ReturnRequestStatus) as string[]).includes(raw)
        ? (raw as ReturnRequestStatus)
        : undefined;

/**
 * 店舗の返品キュー（plan 088 Step 5・DS-PAGE-068）。
 * 1 ページ分だけ取得し、状態別件数はサーバーで集計したものを渡す（全履歴を直列化しない）。
 * 認可ガードは catch の外に置き、認可エラーを「取得失敗」の表示に畳まない（tech.md）。
 */
export default async function SellerReturnsPage({
    params,
    searchParams,
}: Readonly<{
    params: Promise<{ storeUrl: string }>;
    searchParams: Promise<{
        status?: string | string[];
        page?: string | string[];
    }>;
}>) {
    const { storeUrl } = await params;
    await requireStoreOwner(storeUrl);
    const sp = await searchParams;
    const status = toStatus(sp.status);
    const page = normalizePageParam(sp.page);
    const result = await getStoreReturnRequests(storeUrl, {
        status,
        page,
    }).catch(() => null);
    if (!result)
        return (
            <SellerPage id="store-returns" title="Returns">
                <LookupFailure />
            </SellerPage>
        );
    const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
    // 範囲外のページは最終ページの正準 URL へ寄せる（tech.md「URL 数値パラメータの正規化」）
    if (page > totalPages) {
        const query = new URLSearchParams();
        if (status) query.set("status", status);
        query.set("page", String(totalPages));
        redirect(
            `/dashboard/seller/stores/${encodeURIComponent(storeUrl)}/returns?${query}`
        );
    }
    return (
        <SellerReturns
            storeUrl={storeUrl}
            requests={serializeReturnRequests(result.requests)}
            counts={result.counts}
            status={status ?? null}
            page={page}
            totalPages={totalPages}
            actions={{
                approveAction: approveReturnRequest,
                rejectAction: rejectReturnRequest,
                receiveAction: receiveReturnRequest,
                resolveAction: resolveReturnRequest,
            }}
        />
    );
}
