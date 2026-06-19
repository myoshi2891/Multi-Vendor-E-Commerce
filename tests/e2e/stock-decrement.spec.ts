import { expect, test } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";
import { buildE2ESeed } from "./seed/constants";
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

/**
 * F3 (AC-F3-4): 注文確定で対象 Size.quantity が注文数分だけ減ることを
 * 購入フロー全体（カート→チェックアウト→注文確定）で検証する。
 * platform-coupon.spec.ts と同じ認証付き DB バック構成。
 */
test.describe.serial("在庫減算 購入フロー（F3）", () => {
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
        userEmail = `e2e-stock-decrement-${uniqueId}+clerk_test@example.com`;
        userPassword = `TestP@ssw0rd!${uniqueId}`;

        const clerkUser = await clerk.users.createUser({
            emailAddress: [userEmail],
            username: `e2estockdecrement${uniqueId}`,
            password: userPassword,
            skipPasswordChecks: true,
        });
        clerkUserId = clerkUser.id;

        await prisma.user.upsert({
            where: { id: clerkUserId },
            update: {
                email: userEmail,
                name: "E2E Stock Decrement Customer",
                picture: "/assets/images/default-user.jpg",
            },
            create: {
                id: clerkUserId,
                email: userEmail,
                name: "E2E Stock Decrement Customer",
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

    /** 対象バリアントの最初の Size 在庫量を取得する（再実行に強いよう before 値を動的に読む） */
    const readSizeQuantity = async (): Promise<{ id: string; quantity: number }> => {
        // UI が参照する retrieveProductDetails（src/queries/product.ts）は sizes に orderBy を
        // 付けず挿入順で返す。テストも `.first()` がクリックする要素と同じ並びを読むため、
        // ここでも orderBy を付けずに挿入順の先頭 Size を読む（UI と並びを一致させる）。
        const variant = await prisma.productVariant.findUnique({
            where: { slug: seed.variant.slug },
            include: { sizes: true },
        });
        const size = variant?.sizes[0];
        if (!size) {
            throw new Error(
                `Size not seeded for variant ${seed.variant.slug}. Run \`bun run seed:e2e\` first.`
            );
        }
        return { id: size.id, quantity: size.quantity };
    };

    test("注文確定後に対象 Size.quantity が注文数分減る", async ({ page }) => {
        // Arrange: 注文前の在庫を記録
        const before = await readSizeQuantity();

        await setupE2ETestState(page, seed);
        await setupClerkTestingToken({ page });

        // Sign in as the pre-created Clerk test user
        await page.goto("/sign-in");
        await page.getByLabel("Email address").fill(userEmail);
        await page.getByRole("button", { name: "Continue", exact: true }).click();
        await page.getByLabel("Password", { exact: true }).fill(userPassword);
        await page.getByRole("button", { name: "Continue", exact: true }).click();
        // サインイン後のホームへの遅延リダイレクト着地を待ち、後続 goto の割り込みを防ぐ
        await waitForPostSignInSettle(page);

        // Act: 商品をカートに追加（既定 quantity=1）
        // 遅延サインインリダイレクトに割り込まれた場合は再試行する
        await gotoStable(page, `/product/${seed.product.slug}/${seed.variant.slug}`);
        await page.locator('[data-testid^="size-option-"]').first().click();
        await page.waitForURL(/.*\?size=.*/, { timeout: 5000 });
        await page.getByTestId("add-to-cart").click();
        await expect(page.getByText(/Product added to cart/i)).toBeVisible({
            timeout: 5000,
        });
        await waitForCartPersist(page);

        // サイズ選択のソフトナビゲーション着地が遅れると /cart goto に割り込むため
        // gotoStable で再試行する（WebKit で "interrupted by another navigation" 観測）。
        await gotoStable(page, "/cart");
        await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
        await expect(page.getByTestId("cart-item-name")).toHaveCount(1);

        // チェックアウト → 注文確定
        await page.getByTestId("checkout").click();
        await page.waitForURL(/\/checkout/, { timeout: 10000 });
        await page.getByRole("button", { name: "Place order" }).click();
        await page.waitForURL(/\/order\//, { timeout: 15000 });

        // Assert: 在庫が注文数（1）分だけ減っている
        const after = await readSizeQuantity();
        expect(after.id).toBe(before.id);
        expect(after.quantity).toBe(before.quantity - 1);
    });
});
