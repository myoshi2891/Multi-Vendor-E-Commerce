import { expect, Page, test } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";

/**
 * 購入者 ↔ 販売者 メッセージング往復 E2E（AC-M8）。
 *
 * フロー: 購入者が `/profile/messages` で送信 → 販売者が
 * `/dashboard/seller/stores/[storeUrl]/messages` で受信・返信 →
 * 購入者ページの 5 秒ポーリングが返信を自動受信する（往復閉鎖）。
 *
 * 買い手/売り手の同時セッションを維持してポーリング受信を検証するため、
 * `browser.newContext()` で 2 つの独立コンテキストを使う。
 *
 * 認証は Clerk テストモード（`+clerk_test@` メール）+ Clerk Admin API で
 * 動的にユーザーを作成する（`seller-onboarding.spec.ts` / `helpers/auth.ts` と同型）。
 * 購入者ページは既存会話のみ描画し問い合わせ起点 UI は未実装のため、
 * 会話は `beforeAll` で Prisma に直接起票する。
 */

const prisma = new PrismaClient();

const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const clerk = clerkSecretKey
    ? createClerkClient({ secretKey: clerkSecretKey })
    : null;

// CLERK_SECRET_KEY 未設定環境（CI 等）ではスキップする
test.describe.serial("購入者↔販売者 メッセージング往復", () => {
    const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const buyerEmail = `e2e-msg-buyer-${uniqueId}+clerk_test@example.com`;
    const buyerPassword = `TestP@ssw0rd!buyer-${uniqueId}`;
    const buyerName = `E2E Buyer ${uniqueId}`;

    const sellerEmail = `e2e-msg-seller-${uniqueId}+clerk_test@example.com`;
    const sellerPassword = `TestP@ssw0rd!seller-${uniqueId}`;

    const storeName = `E2E Msg Store ${uniqueId}`;
    const storeUrl = `e2e-msg-store-${uniqueId}`;

    const buyerMessage = `Hello from buyer ${uniqueId}`;
    const sellerMessage = `Hello from seller ${uniqueId}`;

    let buyerClerkId: string | undefined;
    let sellerClerkId: string | undefined;
    let storeId: string | undefined;

    test.setTimeout(180000); // 2 コンテキスト sign-in + ポーリング待ちを考慮

    /**
     * 指定ページに Clerk テストトークンを注入し、UI 経由でサインインする。
     * `helpers/auth.ts` の signIn と同じ待機手順（HMR で networkidle に到達しないため
     * domcontentloaded を使用）。
     */
    const signIn = async (page: Page, email: string, password: string) => {
        await setupClerkTestingToken({ page });
        await page.goto("/sign-in");
        await page.getByLabel("Email address").fill(email);
        await page
            .getByRole("button", { name: "Continue", exact: true })
            .click();
        await page.getByLabel("Password", { exact: true }).fill(password);
        await page
            .getByRole("button", { name: "Continue", exact: true })
            .click();
        await expect(page.getByRole("button", { name: "Sign in" })).toBeHidden({
            timeout: 20000,
        });
        await page.waitForURL((url) => !url.pathname.includes("/sign-in"), {
            timeout: 15000,
        });
        await page.waitForLoadState("domcontentloaded");
    };

    test.beforeAll(async () => {
        if (!clerk) {
            // create() を呼ばずスキップ条件（各 test 側で test.skip 判定）
            return;
        }

        // 購入者（USER）
        const buyer = await clerk.users.createUser({
            emailAddress: [buyerEmail],
            username: `e2emsgbuyer${uniqueId}`.replace(/[^a-z0-9]/gi, ""),
            password: buyerPassword,
            skipPasswordChecks: true,
        });
        buyerClerkId = buyer.id;
        await prisma.user.upsert({
            where: { id: buyer.id },
            update: {
                email: buyerEmail,
                name: buyerName,
                picture: "/assets/images/default-user.jpg",
                role: "USER",
            },
            create: {
                id: buyer.id,
                email: buyerEmail,
                name: buyerName,
                picture: "/assets/images/default-user.jpg",
                role: "USER",
            },
        });

        // 販売者（SELLER）— ダッシュボードアクセスに Clerk metadata role が必要
        const seller = await clerk.users.createUser({
            emailAddress: [sellerEmail],
            username: `e2emsgseller${uniqueId}`.replace(/[^a-z0-9]/gi, ""),
            password: sellerPassword,
            skipPasswordChecks: true,
        });
        sellerClerkId = seller.id;
        await prisma.user.upsert({
            where: { id: seller.id },
            update: {
                email: sellerEmail,
                name: `E2E Seller ${uniqueId}`,
                picture: "/assets/images/default-user.jpg",
                role: "SELLER",
            },
            create: {
                id: seller.id,
                email: sellerEmail,
                name: `E2E Seller ${uniqueId}`,
                picture: "/assets/images/default-user.jpg",
                role: "SELLER",
            },
        });
        await clerk.users.updateUserMetadata(seller.id, {
            privateMetadata: { role: "SELLER" },
        });

        // 販売者所有の ACTIVE 店舗
        const store = await prisma.store.create({
            data: {
                name: storeName,
                description:
                    "E2E messaging round-trip store for Playwright tests.",
                email: `${storeUrl}@example.com`,
                phone: "0000000000",
                url: storeUrl,
                logo: "/assets/images/no_image.png",
                cover: "/assets/images/home-wallpaper.webp",
                status: "ACTIVE",
                userId: seller.id,
            },
        });
        storeId = store.id;

        // 購入者↔店舗 の会話を事前起票（起点 UI は未実装のため直接挿入）
        await prisma.conversation.create({
            data: { userId: buyer.id, storeId: store.id },
        });
    });

    // クリーンアップは best-effort（rethrow しない）だが、失敗を握りつぶさず
    // 構造化ログに残してリソースリークの診断を可能にする。
    const logCleanup = (ctx: string) => (error: unknown) => {
        if (error instanceof Error) {
            console.error(ctx, error.message, error.stack);
        } else {
            console.error(ctx, error);
        }
    };

    test.afterAll(async () => {
        try {
            // store 削除で conversation → message が Cascade 削除される
            if (storeId) {
                await prisma.store
                    .delete({ where: { id: storeId } })
                    .catch(
                        logCleanup("[messages.afterAll] store delete failed")
                    );
            }
            if (clerk && buyerClerkId) {
                await clerk.users
                    .deleteUser(buyerClerkId)
                    .catch(
                        logCleanup(
                            "[messages.afterAll] buyer clerk delete failed"
                        )
                    );
            }
            if (clerk && sellerClerkId) {
                await clerk.users
                    .deleteUser(sellerClerkId)
                    .catch(
                        logCleanup(
                            "[messages.afterAll] seller clerk delete failed"
                        )
                    );
            }
            if (buyerClerkId) {
                await prisma.user
                    .delete({ where: { id: buyerClerkId } })
                    .catch(
                        logCleanup(
                            "[messages.afterAll] buyer user delete failed"
                        )
                    );
            }
            if (sellerClerkId) {
                await prisma.user
                    .delete({ where: { id: sellerClerkId } })
                    .catch(
                        logCleanup(
                            "[messages.afterAll] seller user delete failed"
                        )
                    );
            }
        } finally {
            await prisma.$disconnect();
        }
    });

    test("購入者送信 → 販売者返信 → 購入者ポーリング受信（往復）", async ({
        browser,
    }) => {
        test.skip(
            !clerk,
            "CLERK_SECRET_KEY is not set. Skipping messaging round-trip E2E."
        );

        // 同時セッション維持のため買い手/売り手を別コンテキストに分離
        const buyerContext = await browser.newContext();
        const sellerContext = await browser.newContext();
        const buyerPage = await buyerContext.newPage();
        const sellerPage = await sellerContext.newPage();

        try {
            // --- 購入者: サインイン → 送信 ---
            await signIn(buyerPage, buyerEmail, buyerPassword);
            await expect(async () => {
                await buyerPage.goto("/profile/messages");
                expect(buyerPage.url()).toContain("/profile/messages");
            }).toPass({ timeout: 15000 });

            // 左ペインで会話を選択（店舗名で識別）
            await buyerPage
                .getByRole("button", { name: storeName })
                .click({ timeout: 15000 });

            // composer に入力して送信
            await buyerPage
                .getByPlaceholder("Type a message...")
                .fill(buyerMessage);
            await buyerPage.getByRole("button", { name: "Send" }).click();

            // 送信後の即時再フェッチで自分の発言が表示される
            await expect(buyerPage.getByText(buyerMessage)).toBeVisible({
                timeout: 15000,
            });

            // --- 販売者: サインイン → 受信確認 → 返信 ---
            await signIn(sellerPage, sellerEmail, sellerPassword);
            await expect(async () => {
                await sellerPage.goto(
                    `/dashboard/seller/stores/${storeUrl}/messages`
                );
                expect(sellerPage.url()).toContain(
                    `/dashboard/seller/stores/${storeUrl}/messages`
                );
            }).toPass({ timeout: 15000 });

            // 左ペインで会話を選択（購入者名で識別）
            await sellerPage
                .getByRole("button", { name: buyerName })
                .click({ timeout: 15000 });

            // 購入者の発言を販売者側で受信できている
            await expect(sellerPage.getByText(buyerMessage)).toBeVisible({
                timeout: 15000,
            });

            // 販売者が返信
            await sellerPage
                .getByPlaceholder("Type a message...")
                .fill(sellerMessage);
            await sellerPage.getByRole("button", { name: "Send" }).click();
            await expect(sellerPage.getByText(sellerMessage)).toBeVisible({
                timeout: 15000,
            });

            // --- 購入者: ポーリング（5秒間隔）で返信を自動受信（AC-M8 の核心）---
            await expect(buyerPage.getByText(sellerMessage)).toBeVisible({
                timeout: 15000,
            });
        } finally {
            await buyerContext.close();
            await sellerContext.close();
        }
    });
});
