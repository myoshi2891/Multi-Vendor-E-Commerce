import { createHash } from "node:crypto";
import type { NotificationType } from "./mapping";

/** Notification.dedupeKey の上限（これを超えたらハッシュ化する） */
const MAX_KEY_LENGTH = 256;

export type DedupeKeyInput = {
    type: NotificationType;
    recipientUserId: string;
    source: { type: string; id: string };
    /** 遷移の識別子（"Shipped" や "PENDING->ACTIVE"） */
    transition: string;
};

/**
 * 通知の冪等性キーを作る（design §2.2。016 / 018 も同じ規則を使う）。
 *
 * 形式: `${type}:${sourceType}:${sourceId}:${transition}:${recipientUserId}`
 *
 * - 要素が空なら throw する。dedupeKey は NOT NULL で、空のキーを許すと
 *   一意制約が実質的に効かなくなるため、キーを作れないイベントは投入前に弾く
 * - 256 文字を超えたら SHA-256 の hex にする（決定論的）
 *
 * 注意: このキーが防ぐのは「行の二重作成」だけで、メールの二重送信は防がない
 * （送信の重複はプロバイダの冪等キーで抑える。design §4.4）。
 */
export const buildDedupeKey = (input: DedupeKeyInput): string => {
    const parts = [
        input.type,
        input.source.type,
        input.source.id,
        input.transition,
        input.recipientUserId,
    ];
    if (parts.some((part) => part.trim() === "")) {
        throw new Error("[Notifications:buildDedupeKey] empty key component");
    }

    const key = parts.join(":");
    if (key.length <= MAX_KEY_LENGTH) return key;
    return createHash("sha256").update(key).digest("hex");
};
