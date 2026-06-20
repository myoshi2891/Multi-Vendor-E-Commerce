import SellerMessagesContainer from "@/components/dashboard/seller/seller-messages-container";
import { getStoreConversations } from "@/queries/message";

export const dynamic = "force-dynamic";

/**
 * 販売者ダッシュボードのメッセージページ。
 *
 * `storeUrl` の店舗が受け取った会話一覧を取得し、{@link SellerMessagesContainer} に
 * 渡す。取得失敗時はエラーをログし、空一覧でレンダリングする（既存 seller ページと同型）。
 *
 * @param params - `storeUrl`（会話一覧のスコープとなる店舗 URL）を解決する Promise
 * @returns 会話一覧 + スレッドを描画する販売者メッセージページ
 */
export default async function SellerMessagesPage({
    params,
}: {
    params: Promise<{ storeUrl: string }>;
}) {
    const { storeUrl } = await params;

    let conversations: Awaited<ReturnType<typeof getStoreConversations>> = [];
    try {
        conversations = await getStoreConversations(storeUrl);
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[SellerMessages] Failed to fetch conversations",
                error.message,
                error.stack
            );
        } else {
            console.error("[SellerMessages] Unknown error", error);
        }
    }

    return (
        <div className="p-6">
            <h1 className="mb-4 text-xl font-semibold">Messages</h1>
            <SellerMessagesContainer initialConversations={conversations} />
        </div>
    );
}
