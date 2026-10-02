import MessagesContainer from "@/components/store/profile/messages/messages-container";
import {
    getProfileConversations,
    getProfileConversationMessages,
    sendMessage,
    markConversationRead,
} from "@/queries/message";
export const dynamic = "force-dynamic";
export default async function ProfileMessagesPage() {
    let conversations: Awaited<ReturnType<typeof getProfileConversations>> = [];
    let initialError = false;
    try {
        conversations = await getProfileConversations();
    } catch {
        initialError = true;
    }
    return (
        <MessagesContainer
            initialConversations={conversations}
            initialError={initialError}
            loadConversationsAction={getProfileConversations}
            loadMessagesAction={getProfileConversationMessages}
            sendMessageAction={sendMessage}
            markReadAction={markConversationRead}
        />
    );
}
