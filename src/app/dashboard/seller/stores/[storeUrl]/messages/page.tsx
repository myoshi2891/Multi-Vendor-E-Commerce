import SellerMessagesContainer from "@/components/dashboard/seller/seller-messages-container";
import { getStoreConversations } from "@/queries/message";

export const dynamic = "force-dynamic";

/**
 * Renders the seller messages page for a specified store.
 *
 * @param params - Promise resolving to an object containing `storeUrl`, identifying the store whose conversations to display
 * @returns JSX element displaying the conversation list and message threads
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
