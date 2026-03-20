import { expect, test } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";

// Use a shared Prisma client for DB assertions/updates
const prisma = new PrismaClient();

const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const clerk = clerkSecretKey ? createClerkClient({ secretKey: clerkSecretKey }) : null;

test.describe.serial("Seller オンボーディング", () => {
  let userEmail: string;
  let storeName: string;
  let storeUrl: string;
  let clerkUserId: string;
  let userPassword: string;

  test.setTimeout(120000); // Allow Next.js compiler more time in dev

  test.beforeAll(async () => {
    // Generate unique credentials for this test run
    const uniqueId = Date.now();
    userEmail = `new-seller-${uniqueId}+clerk_test@example.com`;
    storeName = `Test Store ${uniqueId}`;
    storeUrl = `test-store-${uniqueId}`;
    userPassword = `TestP@ssw0rd!${uniqueId}`;

    if (clerk) {
        // Create user in Clerk
        try {
            const user = await clerk.users.createUser({
                emailAddress: [userEmail],
                username: `newseller${uniqueId}`,
                password: userPassword,
                skipPasswordChecks: true,
            });
            clerkUserId = user.id;

            // Create user in Prisma so they exist in DB
            await prisma.user.upsert({
                where: { id: clerkUserId },
                update: { email: userEmail, name: "New E2E Seller", picture: "/assets/images/default-user.jpg" },
                create: { id: clerkUserId, email: userEmail, name: "New E2E Seller", picture: "/assets/images/default-user.jpg" }
            });
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error("Setup failed:", error.message, error.stack);
            } else {
                console.error("Setup failed with non-error object:", error);
            }
            if (clerkUserId) {
                await clerk.users.deleteUser(clerkUserId).catch(() => {});
            }
            throw error;
        }
    } else {
        throw new Error("CLERK_SECRET_KEY is not set. Cannot run this test.");
    }
  });

  test.afterAll(async () => {
    // Cleanup the created user from Clerk and Prisma to avoid clutter
    if (clerk && clerkUserId) {
      await clerk.users.deleteUser(clerkUserId).catch(() => {});
    }
    if (clerkUserId) {
      await prisma.store.deleteMany({ where: { userId: clerkUserId } }).catch(() => {});
      await prisma.user.delete({ where: { id: clerkUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  test("申請フォーム 4 ステップを順に完了できる & Pending 状態の確認", async ({ page }) => {
    await setupClerkTestingToken({ page });

    // Setup: Instead of UI Sign up, just go to Sign In!
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(userEmail);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("Password", { exact: true }).fill(userPassword);
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // Wait for navigation after sign in - looking for the user menu button or home page redirect
    await expect(page.getByRole("button", { name: "Sign in" })).toBeHidden({ timeout: 20000 });
    
    // Ensure we are redirecting away from sign-in
    await page.waitForURL((url) => !url.pathname.includes('/sign-in'), { timeout: 15000 }).catch(() => {});
    // Explicitly wait for home page or next destination
    await page.waitForURL((url) => url.pathname === "/", { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState("networkidle");

    // Start Onboarding - retry if interrupted
    await expect(async () => {
        await page.goto("/seller/apply");
        expect(page.url()).toContain("/seller/apply");
    }).toPass({ timeout: 15000 });

    // Step 1: Click Next
    await expect(page.getByText("Please sign in (Or sign up if you are new) to start")).toBeHidden();
    await page.getByRole("button", { name: "Next" }).click();

    // Step 2: Store Information
    await expect(page.getByPlaceholder("Store Name")).toBeVisible();
    await page.getByPlaceholder("Store Name").fill(storeName);
    await page.getByPlaceholder("Store Description").fill("This is a detailed description of the test store for E2E purposes containing enough characters.");
    await page.getByPlaceholder("Store Url").fill(storeUrl);
    await page.getByPlaceholder("Store Email").fill(userEmail);
    await page.getByPlaceholder("Store Phone").fill("1234567890");

    // Fill mock image inputs (the hidden inputs we added to ImageUpload)
    await page.getByTestId("n-mock-input-profile").fill("https://res.cloudinary.com/test/image/upload/logo.png", { force: true });
    await page.getByTestId("n-mock-input-cover").fill("https://res.cloudinary.com/test/image/upload/cover.png", { force: true });

    await page.getByRole("button", { name: "Next" }).click();

    // Step 3: Default Shipping Info (Optional, can just Submit)
    await expect(page.getByPlaceholder("Shipping Service")).toBeVisible();
    await page.getByRole("button", { name: "Submit" }).click();

    // Step 4: Success
    await expect(page.getByText(/Your store has been created/i)).toBeVisible();

    // Verify Pending Status in DB
    const store = await prisma.store.findFirst({
      where: { email: userEmail },
    });
    expect(store).not.toBeNull();
    expect(store?.status).toBe("PENDING");
    
    // As a PENDING seller, they shouldn't be able to access the seller dashboard
    await expect(async () => {
        await page.goto("/dashboard/seller");
        // Should be redirected to home since role is not SELLER yet
        await page.waitForURL((url) => url.pathname === "/", { timeout: 15000 });
        expect(new URL(page.url()).pathname).toBe("/");
    }).toPass({ timeout: 15000 });
  });

  test("管理者が店舗を ACTIVE に変更＆販売者がダッシュボードにアクセス", async ({ page }) => {
    if (clerk) {
       const store = await prisma.store.findFirst({ where: { email: userEmail } });
       expect(store).not.toBeNull();

       if (store) {
           try {
               await prisma.store.update({
                   where: { id: store.id },
                   data: { status: "ACTIVE" }
               });
               await prisma.user.update({
                   where: { id: store.userId },
                   data: { role: "SELLER" }
               });
               await clerk.users.updateUserMetadata(store.userId, {
                   privateMetadata: { role: "SELLER" }
               });
           } catch (error: unknown) {
               if (error instanceof Error) {
                   console.error("Admin approval failed:", error.message, error.stack);
               }
               // Rollback DB logic
               await prisma.store.update({ where: { id: store.id }, data: { status: "PENDING" } }).catch(() => {});
               await prisma.user.update({ where: { id: store.userId }, data: { role: "USER" } }).catch(() => {});
               await clerk.users.updateUserMetadata(store.userId, { privateMetadata: { role: "USER" } }).catch(() => {});
               throw error;
           }
       }
    } else {
       console.warn("CLERK_SECRET_KEY not found, skipping Clerk role update. The dashboard access test might fail.");
    }

    await setupClerkTestingToken({ page });
    
    // Login as the user again
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(userEmail);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("Password", { exact: true }).fill(userPassword);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.includes("/sign-in"), { timeout: 15000 });
    // Explicitly wait for home page or next destination
    await page.waitForURL((url) => url.pathname === "/", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Now they should have access to the seller dashboard because their role is SELLER
    await expect(async () => {
        await page.goto("/dashboard/seller");
        expect(page.url()).toContain("/dashboard/seller");
    }).toPass({ timeout: 15000 });

    // Verify they can view the new product page
    await expect(async () => {
        await page.goto(`/dashboard/seller/stores/${storeUrl}/products/new`);
        await expect(page.getByText(/Create a new Product Information/i)).toBeVisible({ timeout: 10000 });
    }).toPass({ timeout: 15000 });
  });
});
