"use client";

import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendMessageSchema } from "@/lib/schemas";
import { ConversationWithLatest, MessageType } from "@/lib/types";
import { sendMessage } from "@/queries/message";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

// composer は content のみ管理する（conversationId は prop で注入）
const ComposerSchema = SendMessageSchema.pick({ content: true });
type ComposerValues = z.infer<typeof ComposerSchema>;

/**
 * 会話スレッド表示 + メッセージ送信フォーム。
 *
 * メッセージは `senderId === conversation.userId`（購入者）で左右振り分けする。
 * このコンポーネントは販売者側 UI（Phase 4）でも流用するため、購入者/販売者を
 * 区別せず「会話の購入者発か否か」だけで描画する（design.md §4.3 / 判断2）。
 *
 * 送信は useRef リエントランシーガードで多重実行を防止し、成功後に onSent で
 * 親へ再フェッチを促す（楽観的追加ではなくポーリングと一貫した再取得・design.md §4.3）。
 *
 * @param props.conversation - 選択中の会話（発話者判定に userId を使用）。未選択時は null
 * @param props.messages - スレッド内メッセージ（createdAt 昇順）
 * @param props.onSent - 送信成功後に親へ通知（再フェッチ用）
 */
export default function ConversationThread({
    conversation,
    messages,
    onSent,
}: {
    conversation: ConversationWithLatest | null;
    messages: MessageType[];
    onSent: () => void;
}) {
    const isSendingRef = useRef(false);

    const form = useForm<ComposerValues>({
        mode: "onChange",
        resolver: zodResolver(ComposerSchema),
        defaultValues: { content: "" },
    });

    const { errors, isSubmitting } = form.formState;

    if (!conversation) {
        return (
            <div className="flex h-full min-h-72 items-center justify-center text-sm text-[#999]">
                Select a conversation to view messages.
            </div>
        );
    }

    const handleSubmit = async (values: ComposerValues) => {
        if (isSendingRef.current) return; // リエントランシーガード（多重送信防止）
        isSendingRef.current = true;
        try {
            await sendMessage(conversation.id, values.content);
            form.reset({ content: "" });
            onSent(); // 親で再フェッチ（ポーリングと一貫）
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error(
                    "[ConversationThread:handleSubmit] Failed to send message",
                    error.message,
                    error.stack
                );
            } else {
                console.error(
                    "[ConversationThread:handleSubmit] Unknown error",
                    error
                );
            }
            toast.error("メッセージの送信に失敗しました。");
        } finally {
            isSendingRef.current = false;
        }
    };

    return (
        <div className="flex h-full flex-col">
            {/* メッセージバブル一覧 */}
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {messages.length === 0 ? (
                    <div className="py-8 text-center text-sm text-[#999]">
                        No messages yet. Say hello!
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isBuyer = msg.senderId === conversation.userId;
                        return (
                            <div
                                key={msg.id}
                                className={cn("flex", {
                                    "justify-end": isBuyer,
                                    "justify-start": !isBuyer,
                                })}
                            >
                                <div
                                    className={cn(
                                        "max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
                                        {
                                            "bg-blue-primary text-white":
                                                isBuyer,
                                            "bg-[#f5f5f5] text-main-primary":
                                                !isBuyer,
                                        }
                                    )}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* composer */}
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(handleSubmit)}
                    className="border-t p-3"
                >
                    <FormField
                        control={form.control}
                        name="content"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Textarea
                                        placeholder="Type a message..."
                                        className="min-h-[60px] resize-none"
                                        {...field}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    {errors.content && (
                        <FormMessage className="mt-1 text-xs">
                            {errors.content.message}
                        </FormMessage>
                    )}
                    <div className="mt-2 flex justify-end">
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-24"
                        >
                            Send
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}
