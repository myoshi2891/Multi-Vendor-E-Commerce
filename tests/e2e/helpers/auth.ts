import { expect, Page } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";

/**
 * Auth helpers for authenticated E2E specs.
 *
 * Clerk のテストモード (`+clerk_test@` を含むメール) と Clerk Admin API を用いて
 * 動的にテストユーザーを作成・サインイン・削除する。
 *
 * 使い方:
 * ```ts
 * const auth = createCustomerSession();
 * test.beforeAll(async () => { await auth.create({ role: "USER" }); });
 * test.afterAll(async () => { await auth.cleanup(); });
 * test("/checkout a11y", async ({ page }) => {
 *   await auth.signIn(page);
 *   await page.goto("/checkout");
 * });
 * ```
 */

export type CustomerSessionOptions = {
    role?: "USER" | "SELLER" | "ADMIN";
    /** メール識別子 (`+clerk_test@example.com` が自動付与されます) */
    identifier?: string;
};

export type CustomerSession = {
    email: string;
    password: string;
    clerkUserId: string | undefined;
    create: (opts?: CustomerSessionOptions) => Promise<void>;
    signIn: (page: Page) => Promise<void>;
    cleanup: () => Promise<void>;
};

const clerkSecretKey = process.env.CLERK_SECRET_KEY;

const clerk = clerkSecretKey
    ? createClerkClient({ secretKey: clerkSecretKey })
    : null;

/**
 * Create a per-test-suite session manager.
 * The returned object owns the Clerk + Prisma user lifecycle.
 */
export function createCustomerSession(): CustomerSession {
    const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    let prisma: PrismaClient | undefined;
    const session: CustomerSession = {
        email: "",
        password: "",
        clerkUserId: undefined,
        async create(opts) {
            if (!clerk) {
                throw new Error(
                    "CLERK_SECRET_KEY is not set. Skip the spec instead of calling create()."
                );
            }
            const identifier = opts?.identifier || `e2e-customer-${uniqueId}`;
            session.email = `${identifier}+clerk_test@example.com`;
            session.password = `TestP@ssw0rd!${uniqueId}`;

            const user = await clerk.users.createUser({
                emailAddress: [session.email],
                username: identifier.replace(/[^a-z0-9]/gi, ""),
                password: session.password,
                skipPasswordChecks: true,
            });
            session.clerkUserId = user.id;

            prisma = new PrismaClient();
            await prisma.user.upsert({
                where: { id: user.id },
                update: {
                    email: session.email,
                    name: "E2E Customer",
                    picture: "/assets/images/default-user.jpg",
                    role: opts?.role ?? "USER",
                },
                create: {
                    id: user.id,
                    email: session.email,
                    name: "E2E Customer",
                    picture: "/assets/images/default-user.jpg",
                    role: opts?.role ?? "USER",
                },
            });
        },
        async signIn(page) {
            if (!session.email || !session.password) {
                throw new Error(
                    "Call create() in beforeAll before signIn()."
                );
            }
            await setupClerkTestingToken({ page });
            await page.goto("/sign-in");
            await page.getByLabel("Email address").fill(session.email);
            await page
                .getByRole("button", { name: "Continue", exact: true })
                .click();
            await page
                .getByLabel("Password", { exact: true })
                .fill(session.password);
            await page
                .getByRole("button", { name: "Continue", exact: true })
                .click();
            // サインイン後、Clerk が「Sign in」ボタンを非表示にするのを待つ
            await expect(
                page.getByRole("button", { name: "Sign in" })
            ).toBeHidden({ timeout: 20000 });
            try {
                await page.waitForURL(
                    (url) => !url.pathname.includes("/sign-in"),
                    { timeout: 15000 }
                );
            } catch (err) {
                throw new Error(`Authentication timed out: failed to redirect away from /sign-in within 15 seconds. (Error: ${err instanceof Error ? err.message : String(err)})`);
            }
            await page.waitForLoadState("domcontentloaded");
        },
        async cleanup() {
            try {
                if (clerk && session.clerkUserId) {
                    await clerk.users
                        .deleteUser(session.clerkUserId)
                        .catch(() => {});
                }
                if (prisma && session.clerkUserId) {
                    await prisma.user
                        .delete({ where: { id: session.clerkUserId } })
                        .catch(() => {});
                }
            } finally {
                await prisma?.$disconnect();
            }
        },
    };
    return session;
}

/**
 * Gate value to use in `test.skip(...)` for specs that require Clerk admin access.
 */
export const requiresClerkAdmin = !clerkSecretKey;
