import MessagesContainer from "@/components/store/profile/messages/messages-container";
import { getUserConversations } from "@/queries/message";

export const dynamic = "force-dynamic";

export default async function ProfileMessagesPage() {
    const conversations = await getUserConversations();
    return (
        <div className="bg-white px-6 py-4">
            <h1 className="mb-3 text-lg font-bold">Messages</h1>
            <MessagesContainer initialConversations={conversations} />
        </div>
    );
}
