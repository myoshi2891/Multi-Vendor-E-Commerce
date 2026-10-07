import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { logError } from "@/lib/log";
import { dispatchPendingDeliveries } from "@/lib/notifications/dispatch";

export const dynamic = "force-dynamic";

/** 1 回の実行で送る上限（maxDuration に収める） */
const DISPATCH_LIMIT = 50;
/** 既読の通知を残す期間（design §2.1）。未読は削除しない */
const READ_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

/** Bearer トークンを定数時間で比較する（長さが違えば先に弾く。timingSafeEqual は同じ長さが前提） */
const isAuthorized = (header: string | null, secret: string): boolean => {
    if (!header?.startsWith("Bearer ")) return false;
    const given = Buffer.from(header.slice("Bearer ".length));
    const expected = Buffer.from(secret);
    return given.length === expected.length && timingSafeEqual(given, expected);
};

/**
 * 通知の sweeper（design §4.2 / §5）。`after()` で送れなかった配信を拾い直し、
 * 期限切れの既読通知を削除する。
 *
 * スケジュールの設定（Vercel Cron / 常駐スケジューラ / 外部スケジューラ）はデプロイ先で行う。
 * `CRON_SECRET` が未設定なら 503 —— 設定漏れのまま、誰でも叩ける状態で公開しないため。
 */
export async function GET(req: Request): Promise<Response> {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret) {
        return new Response("Cron is not configured.", { status: 503 });
    }
    if (!isAuthorized(req.headers.get("authorization"), secret)) {
        return new Response("Unauthorized.", { status: 401 });
    }

    try {
        const dispatch = await dispatchPendingDeliveries({
            limit: DISPATCH_LIMIT,
        });
        const purged = await db.notification.deleteMany({
            where: {
                isRead: true,
                createdAt: { lt: new Date(Date.now() - READ_RETENTION_MS) },
            },
        });
        return Response.json({ dispatch, purged: purged.count });
    } catch (error: unknown) {
        logError("[Cron:notifications] Sweep failed", error);
        return new Response("Sweep failed.", { status: 500 });
    }
}
