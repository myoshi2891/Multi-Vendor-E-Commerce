"use server";

import { db } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";
import { SupportTicketSchema, type SupportTicketInput } from "@/lib/schemas";

/**
 * Creates a support ticket for inquiries, returns, disputes, or problem reports.
 *
 * Accepts guest submissions. If a user is authenticated, their ID is automatically included.
 *
 * @returns An object containing the `id` of the created ticket
 * @throws "入力内容を確認してください。" if input validation fails
 * @throws "送信に失敗しました。時間をおいて再度お試しください。" if the database operation fails
 */
export async function createSupportTicket(
    input: SupportTicketInput
): Promise<{ id: string }> {
    // 入力検証は try/catch の外（検証エラーを汎用 DB エラーで上書きしない）。
    const parsed = SupportTicketSchema.safeParse(input);
    if (!parsed.success) {
        throw new Error("入力内容を確認してください。");
    }
    const data = parsed.data;

    // ログイン時のみ userId を付与。未ログイン/取得失敗はゲスト送信として続行。
    let userId: string | undefined;
    try {
        const user = await currentUser();
        userId = user?.id;
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("[Support:createSupportTicket] currentUser failed", {
                error: error.message,
                stack: error.stack,
            });
        } else {
            console.error(
                "[Support:createSupportTicket] currentUser failed (unknown)",
                {
                    error,
                }
            );
        }
        // userId 未設定のまま続行（ゲスト扱い）。
    }

    try {
        const ticket = await db.supportTicket.create({
            data: {
                category: data.category,
                name: data.name,
                email: data.email,
                subject: data.subject,
                message: data.message,
                orderId: data.orderId,
                userId,
            },
            select: { id: true },
        });
        return ticket;
    } catch (error: unknown) {
        if (error instanceof Error) {
            // PII（message 本文）はログしない。最小限のメタのみ。
            console.error("[Support:createSupportTicket] create failed", {
                error: error.message,
                stack: error.stack,
            });
        } else {
            console.error(
                "[Support:createSupportTicket] create failed (unknown)",
                {
                    error,
                }
            );
        }
        throw new Error("送信に失敗しました。時間をおいて再度お試しください。");
    }
}
