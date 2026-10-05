import SellerMessagesContainer from "@/components/dashboard/seller/seller-messages-container";
import {
    getSellerConversations,
    getProfileConversationMessages,
    sendMessage,
    markConversationRead,
} from "@/queries/message";
export const dynamic = "force-dynamic";
export default async function SellerMessagesPage({
    params,
}: {
    params: Promise<{ storeUrl: string }>;
}) {
    const { storeUrl } = await params;
    // requireStoreOwner（店舗検索・所有権拒否）は query 側の try の外で throw されるため、ここで記録する。
    // UI には汎用のエラー表示のみを出す
    const conversations = await getSellerConversations(storeUrl).catch(
        (error: unknown) => {
            if (error instanceof Error) {
                console.error(
                    "[SellerMessagesPage] Failed to load conversations",
                    { error: error.message, stack: error.stack }
                );
            } else {
                console.error("[SellerMessagesPage] Unknown error", { error });
            }
            return null;
        }
    );
    return (
        <SellerMessagesContainer
            initialConversations={conversations ?? []}
            initialError={conversations === null}
            loadConversationsAction={getSellerConversations.bind(
                null,
                storeUrl
            )}
            loadMessagesAction={getProfileConversationMessages}
            sendMessageAction={sendMessage}
            markReadAction={markConversationRead}
        />
    );
}
