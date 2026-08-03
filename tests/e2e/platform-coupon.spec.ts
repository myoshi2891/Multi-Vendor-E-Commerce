import { expect, test } from "@playwright/test";
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";
import { buildE2ESeed } from "./seed/constants";
import { signInWithPassword } from "./helpers/auth";
import {
    gotoStable,
    setupE2ETestState,
    waitForCartPersist,
    waitForPostSignInSettle,
} from "@/config/test-helpers";

const prisma = new PrismaClient();

const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const clerk = clerkSecretKey
    ? createClerkClient({ secretKey: clerkSecretKey })
    : null;

test.describe.serial("PLATFORM クーポン購入フロー", () => {
    let seed: ReturnType<typeof buildE2ESeed>;
    let userEmail: string;
    let userPassword: string;
    let clerkUserId: string;

    test.setTimeout(120000); // Allow Next.js compiler more time in dev

    test.beforeAll(async ({}, testInfo) => {
        if (!clerk) {
            throw new Error("CLERK_SECRET_KEY is not set. Cannot run this test.");
        }

        seed = buildE2ESeed({
            parallelIndex: testInfo.parallelIndex,
            projectName: testInfo.project.name,
        });

        const country = await prisma.country.findUnique({
            where: { code: seed.country.code },
        });
        if (!country) {
            throw new Error(
                `Country not seeded for code ${seed.country.code}. Run \`bun run seed:e2e\` before this test.`
            );
        }

        const uniqueId = Date.now();
        userEmail = `e2e-platform-coupon-${uniqueId}+clerk_test@example.com`;
        userPassword = `TestP@ssw0rd!${uniqueId}`;

        const clerkUser = await clerk.users.createUser({
            emailAddress: [userEmail],
            username: `e2eplatformcoupon${uniqueId}`,
            password: userPassword,
            skipPasswordChecks: true,
        });
        clerkUserId = clerkUser.id;

        await prisma.user.upsert({
            where: { id: clerkUserId },
            update: {
                email: userEmail,
                name: "E2E Platform Coupon Customer",
                picture: "/assets/images/default-user.jpg",
            },
            create: {
                id: clerkUserId,
                email: userEmail,
                name: "E2E Platform Coupon Customer",
                picture: "/assets/images/default-user.jpg",
            },
        });

        // チェックアウトの住所選択 UI は別関心事のため、デフォルト住所は直接 DB に投入する
        await prisma.shippingAddress.create({
            data: {
                firstName: "E2E",
                lastName: "Customer",
                phone: "1234567890",
                address1: "123 Test St",
                state: "CA",
                city: "Test City",
                zip_code: "90210",
                default: true,
                userId: clerkUserId,
                countryId: country.id,
            },
        });
    });

    test.afterAll(async () => {
        if (clerkUserId) {
            // ShippingAddress 削除 → Order/OrderGroup/OrderItem へカスケード
            await prisma.shippingAddress
                .deleteMany({ where: { userId: clerkUserId } })
                .catch(() => {});
            // User 削除 → Cart へカスケード
            await prisma.user.delete({ where: { id: clerkUserId } }).catch(() => {});
        }
        if (clerk && clerkUserId) {
            await clerk.users.deleteUser(clerkUserId).catch(() => {});
        }
        await prisma.$disconnect();
    });

    test("複数ストアの商品を PLATFORM クーポン適用後に注文すると全 OrderGroup に割引が反映される", async ({
        page,
    }) => {
        await setupE2ETestState(page, seed);

        // Sign in as the pre-created Clerk test user
        // （テストトークン注入と Clerk ウィジェット操作は共有ヘルパーが行う）
        await signInWithPassword(page, userEmail, userPassword);
        // サインイン後のホームへの遅延リダイレクト着地を待ち、後続 goto の割り込みを防ぐ
        await waitForPostSignInSettle(page);

        // Store A の商品をカートに追加（遅延リダイレクト割り込み時は再試行）
        await gotoStable(page, `/product/${seed.product.slug}/${seed.variant.slug}`);
        await page.locator('[data-testid^="size-option-"]').first().click();
        await page.waitForURL(/.*\?size=.*/, { timeout: 5000 });
        await page.getByTestId("add-to-cart").click();
        await expect(page.getByText(/Product added to cart/i)).toBeVisible({
            timeout: 5000,
        });
        await waitForCartPersist(page);

        // Store B の商品をカートに追加（別ストア商品で別行になる）
        await page.goto(`/product/${seed.productB.slug}/${seed.variantB.slug}`);
        await page.locator('[data-testid^="size-option-"]').first().click();
        await page.waitForURL(/.*\?size=.*/, { timeout: 5000 });
        await page.getByTestId("add-to-cart").click();
        await expect(page.getByText(/Product added to cart/i)).toBeVisible({
            timeout: 5000,
        });
        await waitForCartPersist(page);

        await page.goto("/cart", { waitUntil: "commit" });
        await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
        await expect(page.getByTestId("cart-item-name")).toHaveCount(2);

        // チェックアウトへ（saveUserCart で DB Cart に同期される）
        await page.getByTestId("checkout").click();
        await page.waitForURL(/\/checkout/, { timeout: 10000 });

        // PLATFORM クーポンを適用
        await page.getByPlaceholder("Coupon code").fill(seed.platformCoupon.code);
        await page.getByRole("button", { name: "Apply" }).click();
        await expect(page.getByText("Coupon applied !")).toBeVisible({
            timeout: 10000,
        });
        await expect(page.locator("p", { hasText: "全店舗" })).toBeVisible();

        // デフォルト住所が自動選択された状態で注文確定
        await page.getByRole("button", { name: "Place order" }).click();
        await page.waitForURL(/\/order\//, { timeout: 15000 });

        // 両ストアの OrderGroup が存在し、それぞれにクーポン割引が反映されていることを確認
        await expect(page.locator("p", { hasText: "Order Id:" })).toHaveCount(2);
        await expect(
            page.locator("p", {
                hasText: `Coupon (${seed.platformCoupon.code})`,
            })
        ).toHaveCount(2);
    });
});
