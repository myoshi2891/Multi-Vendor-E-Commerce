import { expect, test } from "@playwright/test";
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";
import { signInWithPassword } from "./helpers/auth";

/**
 * 返品 RMA 往復 E2E（plan 088 Step 6）。
 *
 * フロー: 顧客が `/order/[orderId]` で返品を申請 → 販売者が
 * `/dashboard/seller/stores/[storeUrl]/returns` で承認 → 受け取り → 解決 →
 * 顧客の注文詳細に「Resolved」と表示される。
 *
 * 注文は Clerk の動的ユーザーが所有している必要があるため、`seed:e2e` ではなく
 * `beforeAll` で Prisma に直接起票する（`messages.spec.ts` の会話起票と同型）。
 * Product / Variant / Size は作らない。OrderItem の productId / sizeId は FK の無い
 * スナップショット列で、実商品を作ると seed カテゴリの件数・在庫を前提にする他 spec を
 * 並列実行で汚すため。在庫の戻しは統合テスト（returns-rma.test.ts）が担保する。
 */

const prisma = new PrismaClient();

const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const clerk = clerkSecretKey
    ? createClerkClient({ secretKey: clerkSecretKey })
    : null;

// CLERK_SECRET_KEY 未設定環境（CI 等）ではスキップする
test.describe.serial("返品 RMA 往復（申請 → 承認 → 受け取り → 解決）", () => {
    const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const buyerEmail = `e2e-rma-buyer-${uniqueId}+clerk_test@example.com`;
    const buyerPassword = `TestP@ssw0rd!buyer-${uniqueId}`;

    const sellerEmail = `e2e-rma-seller-${uniqueId}+clerk_test@example.com`;
    const sellerPassword = `TestP@ssw0rd!seller-${uniqueId}`;

    const storeUrl = `e2e-rma-store-${uniqueId}`;
    const itemName = `E2E RMA Item ${uniqueId}`;
    const itemSize = "M";
    const itemLabel = `${itemName} (${itemSize})`;

    let buyerClerkId: string | undefined;
    let sellerClerkId: string | undefined;
    let storeId: string | undefined;
    let orderId: string | undefined;
    let shippingAddressId: string | undefined;

    test.setTimeout(180000); // 2 コンテキスト sign-in + 4 回の状態遷移を考慮

    test.beforeAll(async () => {
        if (!clerk) {
            // create() を呼ばずスキップ条件（test 側で test.skip 判定）
            return;
        }

        // 購入者（USER）
        const buyer = await clerk.users.createUser({
            emailAddress: [buyerEmail],
            username: `e2ermabuyer${uniqueId}`.replace(/[^a-z0-9]/gi, ""),
            password: buyerPassword,
            skipPasswordChecks: true,
        });
        buyerClerkId = buyer.id;
        await prisma.user.upsert({
            where: { id: buyer.id },
            update: {
                email: buyerEmail,
                name: `E2E RMA Buyer ${uniqueId}`,
                picture: "/assets/images/default-user.jpg",
                role: "USER",
            },
            create: {
                id: buyer.id,
                email: buyerEmail,
                name: `E2E RMA Buyer ${uniqueId}`,
                picture: "/assets/images/default-user.jpg",
                role: "USER",
            },
        });

        // 販売者（SELLER）— ダッシュボードアクセスに Clerk metadata role が必要
        const seller = await clerk.users.createUser({
            emailAddress: [sellerEmail],
            username: `e2ermaseller${uniqueId}`.replace(/[^a-z0-9]/gi, ""),
            password: sellerPassword,
            skipPasswordChecks: true,
        });
        sellerClerkId = seller.id;
        await prisma.user.upsert({
            where: { id: seller.id },
            update: {
                email: sellerEmail,
                name: `E2E RMA Seller ${uniqueId}`,
                picture: "/assets/images/default-user.jpg",
                role: "SELLER",
            },
            create: {
                id: seller.id,
                email: sellerEmail,
                name: `E2E RMA Seller ${uniqueId}`,
                picture: "/assets/images/default-user.jpg",
                role: "SELLER",
            },
        });
        await clerk.users.updateUserMetadata(seller.id, {
            privateMetadata: { role: "SELLER" },
        });

        // 販売者所有の ACTIVE 店舗（acceptsReturns = true / returnWindowDays = 既定の 30 日）
        const store = await prisma.store.create({
            data: {
                name: `E2E RMA Store ${uniqueId}`,
                description: "E2E returns RMA round-trip store for Playwright.",
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

        // 国は seed:e2e が投入済みの行を使う（新規に作ると国選択の一覧を汚す）
        const country = await prisma.country.findFirst({
            orderBy: { code: "asc" },
        });
        if (!country) {
            throw new Error(
                "Country が 0 件です。先に `bun run seed:e2e` を実行してください。"
            );
        }
        const address = await prisma.shippingAddress.create({
            data: {
                firstName: "E2E",
                lastName: "Buyer",
                phone: "0000000000",
                address1: "1 E2E Street",
                state: "E2E",
                city: "E2E City",
                zip_code: "00000",
                userId: buyer.id,
                countryId: country.id,
            },
        });
        shippingAddressId = address.id;

        // 配達済み・支払い済みの注文（店舗 1 グループ・明細 1 件・数量 2）
        const order = await prisma.order.create({
            data: {
                subTotal: "40.00",
                total: "40.00",
                orderStatus: "Delivered",
                paymentStatus: "Paid",
                shippingAddressId: address.id,
                userId: buyer.id,
                groups: {
                    create: {
                        status: "Delivered",
                        shippingService: "International Delivery",
                        shippingDeliveryMin: 3,
                        shippingDeliveryMax: 7,
                        shippingFees: "0.00",
                        subTotal: "40.00",
                        total: "40.00",
                        storeId: store.id,
                        items: {
                            create: {
                                productId: `e2e-rma-product-${uniqueId}`,
                                variantId: `e2e-rma-variant-${uniqueId}`,
                                sizeId: `e2e-rma-size-${uniqueId}`,
                                productSlug: `e2e-rma-product-${uniqueId}`,
                                variantSlug: `e2e-rma-variant-${uniqueId}`,
                                sku: `E2E-RMA-${uniqueId}`,
                                name: itemName,
                                image: "/assets/images/no_image.png",
                                size: itemSize,
                                quantity: 2,
                                price: "20.00",
                                totalPrice: "40.00",
                                status: "Delivered",
                            },
                        },
                    },
                },
            },
        });
        orderId = order.id;
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
            // ReturnRequest は Order / Store / User を onDelete: Restrict で拘束するので最初に消す
            // （明細は Cascade）。順序を誤ると以降の削除がすべて FK 違反になる。
            if (storeId) {
                await prisma.returnRequest
                    .deleteMany({ where: { storeId } })
                    .catch(
                        logCleanup(
                            "[returns-rma.afterAll] return delete failed"
                        )
                    );
            }
            // Order 削除で OrderGroup → OrderItem が Cascade 削除される
            if (orderId) {
                await prisma.order
                    .delete({ where: { id: orderId } })
                    .catch(
                        logCleanup("[returns-rma.afterAll] order delete failed")
                    );
            }
            if (shippingAddressId) {
                await prisma.shippingAddress
                    .delete({ where: { id: shippingAddressId } })
                    .catch(
                        logCleanup(
                            "[returns-rma.afterAll] address delete failed"
                        )
                    );
            }
            if (storeId) {
                await prisma.store
                    .delete({ where: { id: storeId } })
                    .catch(
                        logCleanup("[returns-rma.afterAll] store delete failed")
                    );
            }
            if (clerk && buyerClerkId) {
                await clerk.users
                    .deleteUser(buyerClerkId)
                    .catch(
                        logCleanup(
                            "[returns-rma.afterAll] buyer clerk delete failed"
                        )
                    );
            }
            if (clerk && sellerClerkId) {
                await clerk.users
                    .deleteUser(sellerClerkId)
                    .catch(
                        logCleanup(
                            "[returns-rma.afterAll] seller clerk delete failed"
                        )
                    );
            }
            // User 削除で Notification が Cascade 削除される
            if (buyerClerkId) {
                await prisma.user
                    .delete({ where: { id: buyerClerkId } })
                    .catch(
                        logCleanup(
                            "[returns-rma.afterAll] buyer user delete failed"
                        )
                    );
            }
            if (sellerClerkId) {
                await prisma.user
                    .delete({ where: { id: sellerClerkId } })
                    .catch(
                        logCleanup(
                            "[returns-rma.afterAll] seller user delete failed"
                        )
                    );
            }
        } finally {
            await prisma.$disconnect();
        }
    });

    test("顧客申請 → 販売者 承認・受け取り・解決 → 顧客に Resolved 表示", async ({
        browser,
    }) => {
        test.skip(
            !clerk,
            "CLERK_SECRET_KEY is not set. Skipping returns RMA round-trip E2E."
        );

        // 保存系は storageState を使い回さず、コンテキストごとにサインインする
        // （Clerk の短命トークンが期限切れになり、保存後の refresh で表示を失うため）
        const buyerContext = await browser.newContext();
        const sellerContext = await browser.newContext();
        const buyerPage = await buyerContext.newPage();
        const sellerPage = await sellerContext.newPage();
        const orderPath = `/order/${orderId}`;
        const returnsPath = `/dashboard/seller/stores/${storeUrl}/returns`;

        try {
            // --- 顧客: サインイン → 返品を申請 ---
            await signInWithPassword(buyerPage, buyerEmail, buyerPassword);
            await expect(async () => {
                await buyerPage.goto(orderPath);
                expect(buyerPage.url()).toContain(orderPath);
            }).toPass({ timeout: 15000 });

            await buyerPage
                .getByRole("button", { name: "Request a return" })
                .click({ timeout: 15000 });
            await buyerPage
                .getByLabel(`Quantity to return: ${itemLabel}`)
                .selectOption("1");
            await buyerPage
                .getByRole("button", { name: "Submit return request" })
                .click();

            await expect(
                buyerPage.getByText("Return request submitted.")
            ).toBeVisible({ timeout: 15000 });
            const buyerCard = buyerPage.getByRole("article", {
                name: /^Return request from /,
            });
            await expect(buyerCard).toContainText("Requested", {
                timeout: 15000,
            });

            // --- 販売者: サインイン → 承認 → 受け取り（Damaged）→ 解決 ---
            await signInWithPassword(sellerPage, sellerEmail, sellerPassword);
            await expect(async () => {
                await sellerPage.goto(returnsPath);
                expect(sellerPage.url()).toContain(returnsPath);
            }).toPass({ timeout: 15000 });

            // カード本文は常に「Requested <日付>」を含むので、状態は data-return-state で判定する
            const sellerCard = sellerPage.getByRole("article", {
                name: /^Return /,
            });
            await expect(sellerCard).toHaveAttribute(
                "data-return-state",
                "REQUESTED",
                { timeout: 15000 }
            );

            await sellerCard.getByRole("button", { name: "Approve" }).click();
            await expect(sellerCard).toHaveAttribute(
                "data-return-state",
                "APPROVED",
                { timeout: 15000 }
            );

            // 在庫の戻し先（Size）を作っていないので、戻さない Damaged を選ぶ
            await sellerCard
                .getByLabel(`Condition: ${itemLabel}`)
                .selectOption("DAMAGED");
            await sellerCard
                .getByRole("button", { name: "Mark as received" })
                .click();
            await expect(sellerCard).toHaveAttribute(
                "data-return-state",
                "RECEIVED",
                { timeout: 15000 }
            );

            await sellerCard
                .getByRole("button", { name: "Resolve return" })
                .click();
            await expect(sellerCard).toHaveAttribute(
                "data-return-state",
                "RESOLVED",
                { timeout: 15000 }
            );

            // --- 顧客: 再読み込みで解決済みと返金見込みが表示される ---
            await buyerPage.reload();
            await expect(buyerCard).toContainText("Resolved", {
                timeout: 15000,
            });
            await expect(buyerCard).toContainText("Refund estimate: $");

            // --- DB: 遷移の時刻がすべて記録されている ---
            const request = await prisma.returnRequest.findFirstOrThrow({
                where: { storeId },
                include: { items: true },
            });
            expect(request.status).toBe("RESOLVED");
            expect(request.approvedAt).not.toBeNull();
            expect(request.receivedAt).not.toBeNull();
            expect(request.resolvedAt).not.toBeNull();
            expect(request.items).toHaveLength(1);
            expect(request.items[0].quantity).toBe(1);
            expect(request.items[0].condition).toBe("DAMAGED");
            expect(request.items[0].restockedQuantity).toBe(0);
        } finally {
            await buyerContext.close();
            await sellerContext.close();
        }
    });
});
