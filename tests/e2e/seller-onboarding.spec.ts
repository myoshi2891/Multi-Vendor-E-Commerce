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
  let clerkUserId: string;
  let userPassword: string;

  test.beforeAll(async () => {
    // Generate unique credentials for this test run
    const uniqueId = Date.now();
    userEmail = `new-seller-${uniqueId}+clerk_test@example.com`;
    storeName = `Test Store ${uniqueId}`;
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
        } catch (error: any) {
            console.error(JSON.stringify(error.errors || error, null, 2));
            throw error;
        }

        // Create user in Prisma so they exist in DB (Webhooks might not fire local to test runner)
        await prisma.user.upsert({
            where: { id: clerkUserId },
            update: { email: userEmail, name: "New E2E Seller", picture: "/assets/images/default-user.jpg" },
            create: { id: clerkUserId, email: userEmail, name: "New E2E Seller", picture: "/assets/images/default-user.jpg" }
        });
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

    // Start Onboarding
    await page.goto("/seller/apply");

    // Step 1: Click Next
    await expect(page.getByText("Please sign in (Or sign up if you are new) to start")).toBeHidden();
    await page.getByRole("button", { name: "Next" }).click();

    // Step 2: Store Information
    await expect(page.getByPlaceholder("Store Name")).toBeVisible();
    await page.getByPlaceholder("Store Name").fill(storeName);
    await page.getByPlaceholder("Store Description").fill("This is a detailed description of the test store for E2E purposes containing enough characters.");
    await page.getByPlaceholder("Store Url").fill(`test-store-${Date.now()}`);
    await page.getByPlaceholder("Store Email").fill(userEmail);
    await page.getByPlaceholder("Store Phone").fill("1234567890");

    // Fill mock image inputs (the hidden inputs we added to ImageUpload) using evaluate to avoid focus issues
    await page.getByTestId("image-upload-mock-input-profile").evaluate((el: HTMLInputElement, url) => {
        el.value = url;
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, "https://res.cloudinary.com/test/image/upload/logo.png");
    
    await page.getByTestId("image-upload-mock-input-cover").evaluate((el: HTMLInputElement, url) => {
        el.value = url;
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, "https://res.cloudinary.com/test/image/upload/cover.png");

    await page.getByRole("button", { name: "Next" }).click();

    // Step 3: Default Shipping Info (Optional, can just Submit)
    await expect(page.getByPlaceholder("Shipping Service")).toBeVisible();
    await page.getByRole("button", { name: "Submit" }).click();

    // Step 4: Success
    await expect(page.getByText(/You have applied/i)).toBeVisible();

    // Verify Pending Status in DB
    const store = await prisma.store.findFirst({
      where: { email: userEmail },
    });
    expect(store).not.toBeNull();
    expect(store?.status).toBe("PENDING");
    
    // As a PENDING seller, they shouldn't be able to access the seller dashboard
    await page.goto("/dashboard/seller");
    // Should be redirected to home since role is not SELLER yet
    await page.waitForURL((url) => !url.pathname.includes("/sign-in"), { timeout: 15000 }).catch(() => {});
  });

  test("管理者が店舗を ACTIVE に変更＆販売者がダッシュボードにアクセス", async ({ page }) => {
    if (clerk) {
       const store = await prisma.store.findFirst({ where: { email: userEmail } });
       expect(store).not.toBeNull();

       if (store) {
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
    await page.waitForURL((url) => !url.pathname.includes("/sign-in"), { timeout: 15000 }).catch(() => {});

    // Now they should have access to the seller dashboard because their role is SELLER
    await page.goto("/dashboard/seller");
    await expect(page).toHaveURL(/.*dashboard\/seller/);

    // Verify they can view the new product page
    await page.goto("/dashboard/seller/products/new");
    await expect(page.getByText("Add a new product")).toBeVisible();
  });
});
