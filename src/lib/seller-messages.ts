import type {
    ProfileConversation,
    ProfileMessageActions,
} from "@/lib/profile-messages";
export interface SellerConversation extends ProfileConversation {
    unreadLatest?: boolean;
    user: { name: string; picture: string };
}
export type SellerMessageActions = Omit<
    ProfileMessageActions,
    "loadConversationsAction"
> & {
    loadConversationsAction: () => Promise<SellerConversation[]>;
};
