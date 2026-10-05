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
    const conversations = await getSellerConversations(storeUrl).catch(
        () => null
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
