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
 * Retrieve the authenticated user for Server Actions.
 *
 * @returns The authenticated `User`.
 * @throws Error if fetching the current user fails (message is prefixed with `requireUser: failed to fetch currentUser - <original>`).
 * @throws Error with message `"Unauthenticated."` if no user is authenticated.
 */
export async function requireUser(): Promise<User> {
    let user: User | null = null;
    try {
        user = await currentUser();
    } catch (error: unknown) {
        const message = `requireUser: failed to fetch currentUser - ${error instanceof Error ? error.message : String(error)}`;
        const newError = new Error(message);
        if (error instanceof Error) {
            newError.stack = error.stack;
        }
        throw newError;
    }
    if (!user) throw new Error("Unauthenticated.");
    return user;
}

/**
 * Ensures the current user has the ADMIN role.
 *
 * @returns The authenticated user whose `privateMetadata.role` is `"ADMIN"`.
 * @throws Error with message "Unauthenticated." if there is no authenticated user.
 * @throws Error with message "Only admins can perform this action." if the user's role is not `"ADMIN"`.
 */
export async function requireAdmin(): Promise<User> {
    const user = await requireUser();
    if (user.privateMetadata?.role !== "ADMIN") {
        throw new Error("Only admins can perform this action.");
    }
    return user;
}

/**
 * Ensures the authenticated user has the SELLER role.
 *
 * Throws if the current user is not authorized to act as a seller.
 *
 * @returns The authenticated `User` when the user has the SELLER role.
 * @throws `Error` with message "Only sellers can perform this action." if the user's role is not `SELLER`.
 */
export async function requireSeller(): Promise<User> {
    const user = await requireUser();
    if (user.privateMetadata?.role !== "SELLER") {
        throw new Error("Only sellers can perform this action.");
    }
    return user;
}

/**
 * Ensures the caller has the SELLER role and owns the store identified by `storeUrl`.
 *
 * @param storeUrl - The store URL to verify ownership for
 * @returns The authenticated `user` and the owned `store` record
 * @throws "Unauthenticated." if there is no authenticated user
 * @throws "Only sellers can perform this action." if the authenticated user is not a seller
 * @throws "Please provide store URL." if `storeUrl` is falsy or empty
 * @throws "Forbidden: store not owned by current user." if no store matching the `storeUrl` is owned by the authenticated user
 */
export async function requireStoreOwner(
    storeUrl: string
): Promise<{ user: User; store: Store }> {
    const user = await requireSeller();
    if (!storeUrl) throw new Error("Please provide store URL.");

    let store: Store | null = null;
    try {
        store = await db.store.findUnique({
            where: { url: storeUrl, userId: user.id },
        });
    } catch (error: unknown) {
        const message = `requireStoreOwner: failed to query store - ${error instanceof Error ? error.message : String(error)}`;
        const newError = new Error(message);
        if (error instanceof Error) {
            newError.stack = error.stack;
        }
        throw newError;
    }

    if (!store) {
        throw new Error("Forbidden: store not owned by current user.");
    }
    return { user, store };
}
