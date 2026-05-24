/**
 * src/lib/auth-guards.ts
 * Server Actions (`src/queries/*`) の認可ガード共通ヘルパー。
 *
 * 採用エラーメッセージ:
 *   - 未認証                    : "Unauthenticated."
 *   - ADMIN ロール不一致        : "Only admins can perform this action."
 *   - SELLER ロール不一致       : "Only sellers can perform this action."
 *   - storeUrl 未指定           : "Please provide store URL."
 *   - 店舗が存在しない / 非所有 : "Forbidden: store not owned by current user."
 *
 * `src/config/test-helpers.ts` の AssertionHelpers.expectAuthError /
 * expectRoleError と整合する文字列を用いる。
 *
 * 関連 ADR: docs/architecture/decisions/001-csrf-policy.md
 */

import { currentUser } from "@clerk/nextjs/server";
import type { User } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import type { Store } from "@prisma/client";

/**
 * Server Action 内で認証ユーザーを取得する。
 * 未認証なら "Unauthenticated." を throw する。
 */
export async function requireUser(): Promise<User> {
    const user = await currentUser();
    if (!user) throw new Error("Unauthenticated.");
    return user;
}

/**
 * ADMIN ロール必須の Server Action で使用する。
 * 未認証 → "Unauthenticated."
 * ロール不一致 → "Only admins can perform this action."
 */
export async function requireAdmin(): Promise<User> {
    const user = await requireUser();
    if (user.privateMetadata?.role !== "ADMIN") {
        throw new Error("Only admins can perform this action.");
    }
    return user;
}

/**
 * SELLER ロール必須の Server Action で使用する。
 * 未認証 → "Unauthenticated."
 * ロール不一致 → "Only sellers can perform this action."
 */
export async function requireSeller(): Promise<User> {
    const user = await requireUser();
    if (user.privateMetadata?.role !== "SELLER") {
        throw new Error("Only sellers can perform this action.");
    }
    return user;
}

/**
 * SELLER かつ指定された store URL の所有者であることを保証する。
 * IDOR 対策の中心ヘルパー: url + userId の複合 where 句で DB を検索する。
 *
 * @param storeUrl 検証対象の店舗 URL
 * @returns { user, store } 認証ユーザーと所有店舗レコード
 *
 * Throws:
 *  - "Unauthenticated."  (未認証)
 *  - "Only sellers can perform this action."  (SELLER 以外)
 *  - "Please provide store URL."  (storeUrl が空)
 *  - "Forbidden: store not owned by current user."  (店舗が存在しない or 所有者でない)
 */
export async function requireStoreOwner(
    storeUrl: string
): Promise<{ user: User; store: Store }> {
    const user = await requireSeller();
    if (!storeUrl) throw new Error("Please provide store URL.");

    const store = await db.store.findUnique({
        where: { url: storeUrl, userId: user.id },
    });

    if (!store) {
        throw new Error("Forbidden: store not owned by current user.");
    }
    return { user, store };
}
