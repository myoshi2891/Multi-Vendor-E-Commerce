"use client";

import ConversationThread from "@/components/store/profile/messages/conversation-thread";
import { ConversationWithLatest, MessageType } from "@/lib/types";
import { cn } from "@/lib/utils";
import Image from "next/image";

/** 会話一覧の各行に表示するアバター（画像 + 名前）。コンテナごとに取得元が異なる。 */
type AvatarInfo = { src: string | null; name: string };

/**
 * メッセージ画面の汎用 2 ペインレイアウト（左: 会話一覧 / 右: スレッド）。
 *
 * 購入者・販売者コンテナで共通の骨格を持ち、唯一異なる「会話行のアバター取得元」
 * （購入者 = 店舗 / 販売者 = 購入者）を {@link AvatarInfo} を返す `getAvatar` で
 * 注入する。これにより両コンテナの重複（SonarCloud Duplications）を解消する。
 *
 * 右ペインは購入者/販売者を区別しない {@link ConversationThread} を流用する。
 *
 * @typeParam T - 会話一覧の要素型。`ConversationWithLatest` を満たす上位互換型
 *                （`StoreConversationWithLatest` を含む）を受理する。
 */
export default function MessagesLayout<T extends ConversationWithLatest>({
    conversations,
    selected,
    selectedId,
    getAvatar,
    messages,
    onSelect,
    onSent,
}: Readonly<{
    conversations: T[];
    selected: T | null;
    selectedId: string | null;
    getAvatar: (conv: T) => AvatarInfo;
    messages: MessageType[];
    onSelect: (id: string) => void;
    onSent: () => void;
}>) {
    return (
        <div className="flex h-[520px] gap-3">
            {/* 左ペイン: 会話一覧 */}
            <div className="w-[300px] shrink-0 overflow-y-auto rounded-md border">
                {conversations.length === 0 ? (
                    <div className="p-4 text-sm text-slate-500">
                        No conversations yet.
                    </div>
                ) : (
                    conversations.map((conv) => {
                        const latest = conv.messages[0];
                        const avatar = getAvatar(conv);
                        return (
                            <button
                                key={conv.id}
                                type="button"
                                onClick={() => onSelect(conv.id)}
                                className={cn(
                                    "flex w-full items-center gap-2 border-b px-3 py-2 text-left hover:bg-slate-100",
                                    {
                                        "bg-slate-100": conv.id === selectedId,
                                    }
                                )}
                            >
                                {avatar.src && (
                                    <Image
                                        src={avatar.src}
                                        alt={avatar.name}
                                        width={32}
                                        height={32}
                                        className="size-8 shrink-0 rounded-full object-cover"
                                    />
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-semibold">
                                        {avatar.name}
                                    </div>
                                    <div className="truncate text-xs text-slate-500">
                                        {latest?.content ?? "No messages"}
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>

            {/* 右ペイン: スレッド */}
            <div className="flex-1 rounded-md border">
                <ConversationThread
                    conversation={selected}
                    messages={messages}
                    onSent={onSent}
                />
            </div>
        </div>
    );
}
