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

/**
 * Clerk の sign-in ウィジェット経由でパスワードサインインする共有関数。
 *
 * **ラベル文言でグローバルに探さないこと。** `/sign-in` は共通ヘッダー/フッター付きで、
 * フッター Newsletter が `<label class="sr-only">Email address</label>` を持つ
 * （`src/components/store/layout/footer/newsletter.tsx`）。Clerk ウィジェットは
 * client-only なのでハイドレーション前は Newsletter 欄だけが存在し、
 * `page.getByLabel("Email address")` はそちらへ解決してしまう（plan 042 の根本原因）。
 * そのため **Clerk ルートへスコープしてから `input[name=...]` で特定する**。
 *
 * **1 段 / 2 段 UI の実行時分岐は持たない。** UI 形式は Clerk 側の設定で決まる静的な
 * 性質であり、`isVisible()` や短い timeout 付き `waitFor` が測っているのは「時間」で
 * あって「UI 形式」ではない。遅い環境では 1 段 UI なのに 2 段へ誤分岐し、閾値付近でのみ
 * 再現する最悪のフレークになる。現行の 1 段（識別子 + パスワード同一画面）を
 * `expect(passwordInput).toBeVisible()` で assert し、将来 2 段へ変わったら
 * ここが明確なメッセージで失敗するのに任せる。
 */
export async function signInWithPassword(
    page: Page,
    email: string,
    password: string
): Promise<void> {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in");

    // Clerk ウィジェットのハイドレーション完了を待つ（フッターへの誤爆防止）
    const clerkRoot = page.locator(".cl-signIn-root");
    await clerkRoot.waitFor({ state: "visible", timeout: 15000 });

    // 識別子の name 属性はラベル文言（現行 "Email address or username"）より安定
    await clerkRoot.locator('input[name="identifier"]').fill(email);

    // `exact: true` は必須。Google ソーシャルボタンのアクセシブル名が
    // "Sign in with Google Continue with Google" のため、部分一致だと
    // strict mode violation か OAuth 遷移になる。
    const continueButton = clerkRoot.getByRole("button", {
        name: "Continue",
        exact: true,
    });

    const passwordInput = clerkRoot.locator('input[name="password"]');
    await expect(passwordInput).toBeVisible({ timeout: 15000 });

    await passwordInput.fill(password);
    await continueButton.click();

    // サインイン成立 = Clerk フォームが DOM から消える
    await expect(clerkRoot).toBeHidden({ timeout: 20000 });

    // フォームの消滅は「Clerk が受理した」ことしか意味せず、リダイレクト完了は
    // 保証しない。ここで待ち切らないと呼び出し側の最初の goto/click が
    // リダイレクト途中に割り込み、/sign-in へ差し戻されるレースが残る。
    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), {
        timeout: 20000,
    });
    await page.waitForLoadState("domcontentloaded");
}

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
            await signInWithPassword(page, session.email, session.password);
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
