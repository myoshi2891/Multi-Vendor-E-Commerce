"use server";

import { db } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";
import { SupportTicketSchema, type SupportTicketInput } from "@/lib/schemas";

/**
 * サポートチケット（問い合わせ/返品/紛争/問題報告）を作成する。
 * 公開アクション（ゲスト送信可）。ログイン時のみ userId を付与する。
 *
 * @param input - フォーム入力（category を含む）。Zod で検証する。
 * @returns 作成された SupportTicket の id
 * @throws "入力内容を確認してください。" Zod 検証失敗
 * @throws "送信に失敗しました。時間をおいて再度お試しください。" DB エラー
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
