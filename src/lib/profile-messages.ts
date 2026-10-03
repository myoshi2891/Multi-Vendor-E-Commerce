export interface ProfileConversation {
    id: string;
    userId: string;
    updatedAt: string | Date;
    store: { name: string; logo: string | null };
    messages: { content: string }[];
}
export interface ProfileMessage {
    id: string;
    senderId: string;
    content: string;
    createdAt: string | Date;
}
export interface ProfileMessageActions {
    loadConversationsAction: () => Promise<ProfileConversation[]>;
    loadMessagesAction: (id: string) => Promise<ProfileMessage[]>;
    markReadAction: (id: string) => Promise<{ count: number }>;
    sendMessageAction: (id: string, content: string) => Promise<{ id: string }>;
}
