import SellerReturns from "@/components/dashboard/seller/seller-returns";
import SellerPage from "@/components/dashboard/design/seller-page";
import { LookupFailure } from "@/components/dashboard/design/seller-error";
import { serializeReturnRequests } from "@/lib/returns-view";
import {
    approveReturnRequest,
    getStoreReturnRequests,
    receiveReturnRequest,
    rejectReturnRequest,
    resolveReturnRequest,
} from "@/queries/returns";
export const dynamic = "force-dynamic";
/** 店舗の返品キュー（plan 088 Step 5・DS-PAGE-068）。認可は getStoreReturnRequests の requireStoreOwner */
export default async function SellerReturnsPage({
    params,
}: {
    params: Promise<{ storeUrl: string }>;
}) {
    const { storeUrl } = await params;
    const requests = await getStoreReturnRequests(storeUrl).catch(() => null);
    if (!requests)
        return (
            <SellerPage id="store-returns" title="Returns">
                <LookupFailure />
            </SellerPage>
        );
    return (
        <SellerReturns
            storeUrl={storeUrl}
            requests={serializeReturnRequests(requests)}
            actions={{
                approveAction: approveReturnRequest,
                rejectAction: rejectReturnRequest,
                receiveAction: receiveReturnRequest,
                resolveAction: resolveReturnRequest,
            }}
        />
    );
}
