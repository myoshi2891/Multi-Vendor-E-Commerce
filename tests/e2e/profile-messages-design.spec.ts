import { expect, test, type Page, type Route } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import AxeBuilder from "@axe-core/playwright";
import { createCustomerSession, requiresClerkAdmin } from "./helpers/auth";
const conversations = [
    {
        id: "conv-one",
        userId: "buyer",
        updatedAt: "2026-10-01T00:00:00Z",
        store: { name: "Acme " + "LongStoreName".repeat(7), logo: "" },
        messages: [{ content: "Latest from the store" }],
    },
    {
        id: "conv-two",
        userId: "buyer",
        updatedAt: "2026-10-01T00:00:00Z",
        store: { name: "Beta Store", logo: "" },
        messages: [],
    },
];
const messages = [
    {
        id: "m-one",
        senderId: "seller",
        content: "Hello from the store " + "LongMessage".repeat(30),
        createdAt: "2026-10-01T00:00:00Z",
    },
    {
        id: "m-two",
        senderId: "buyer",
        content: "Hello from you",
        createdAt: "2026-10-01T01:00:00Z",
    },
];
async function fulfill(route: Route, value: unknown) {
    await route.fulfill({
        contentType: "text/x-component",
        body: `0:{"a":"$@1","f":"","b":"development"}\n1:${JSON.stringify(value)}\n`,
    });
}
async function accessible(page: Page) {
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
        )
    ).toBe(true);
    expect(
        (
            await new AxeBuilder({ page })
                .include("[data-messages]")
                .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                .analyze()
        ).violations
    ).toEqual([]);
}
test.describe("Profile messages design system", () => {
    test.skip(() => requiresClerkAdmin, "Requires Clerk credentials");
    const session = createCustomerSession();
    test.beforeAll(async () => {
        await session.create({ role: "USER" });
    });
    test.afterAll(async () => {
        await session.cleanup();
    });
    test.beforeEach(async ({ page }) => {
        await setupClerkTestingToken({ page });
        await page.goto("/sign-in", { waitUntil: "commit" });
        await clerk.signIn({ page, emailAddress: session.email });
        await page.goto("/profile/messages", { waitUntil: "networkidle" });
    });
    for (const width of [1440, 390, 768])
        test(`empty and conversation at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 1000 });
            await expect(
                page.getByRole("heading", { name: "My messages", level: 1 })
            ).toHaveCSS("font-family", /Georgia/);
            await expect(
                page.getByRole("heading", { name: "No conversations yet" })
            ).toBeVisible();
            await accessible(page);
            await page.route("**/profile/messages", async (route) => {
                if (!route.request().headers()["next-action"])
                    return route.continue();
                const args = JSON.parse(route.request().postData() || "[]");
                await fulfill(
                    route,
                    args.length === 0 ? conversations : messages
                );
            });
            await page
                .getByRole("button", { name: "Refresh conversations" })
                .click();
            const select = page.getByRole("button", {
                name: `Open conversation with ${conversations[0].store.name}`,
                exact: true,
            });
            await expect(select).toBeVisible();
            await page.keyboard.press("Tab");
            await select.focus();
            await expect(select).toHaveCSS("outline-style", "solid");
            await page.keyboard.press("Enter");
            await expect(
                page.getByText(messages[0].content, { exact: true })
            ).toBeVisible();
            await expect(select).toHaveAttribute("aria-pressed", "true");
            await expect(page.getByText("You", { exact: true })).toBeVisible();
            await expect(
                page.getByRole("textbox", { name: "Your message" })
            ).toBeVisible();
            await accessible(page);
            await page.screenshot({
                path: `test-results/profile-messages-${width}.png`,
                fullPage: true,
            });
        });
    test("load and send failure, validation, pending lock, retry and success", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 1000 });
        let release!: () => void;
        const gate = new Promise<void>((done) => {
            release = done;
        });
        let sendCalls = 0;
        let threadAction = "";
        let threadCalls = 0;
        let readAction = "";
        let readCalls = 0;
        const sends: unknown[][] = [];
        await page.route("**/profile/messages", async (route) => {
            const action = route.request().headers()["next-action"];
            if (!action) return route.continue();
            const args = JSON.parse(route.request().postData() || "[]");
            if (args.length === 0) return fulfill(route, conversations);
            if (args.length === 2) {
                sends.push(args);
                if (++sendCalls === 1) {
                    await gate;
                    return route.fulfill({ status: 500, body: "Unavailable" });
                }
                return fulfill(route, { id: "sent" });
            }
            if (!threadAction) threadAction = action;
            if (action === threadAction) {
                if (++threadCalls === 1)
                    return route.fulfill({ status: 500, body: "Unavailable" });
                return fulfill(route, messages);
            }
            readAction = action;
            if (action === readAction && ++readCalls === 1)
                return route.fulfill({ status: 500, body: "Unavailable" });
            return fulfill(route, { count: 0 });
        });
        await page
            .getByRole("button", { name: "Refresh conversations" })
            .click();
        await page
            .getByRole("button", {
                name: `Open conversation with ${conversations[0].store.name}`,
                exact: true,
            })
            .click();
        await expect(
            page
                .locator("[data-messages]")
                .getByRole("alert")
                .filter({ hasText: "We couldn’t load these messages" })
        ).toBeVisible();
        await page.getByRole("button", { name: "Retry messages" }).click();
        await expect(
            page.getByText(messages[0].content, { exact: true })
        ).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Retry read status" })
        ).toBeVisible();
        await page.getByRole("button", { name: "Retry read status" }).click();
        await expect(
            page.getByRole("button", { name: "Retry read status" })
        ).toHaveCount(0);
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await expect(
            page.locator("[data-messages]").getByRole("alert")
        ).toContainText("メッセージを入力してください");
        await accessible(page);
        const input = page.getByRole("textbox", { name: "Your message" });
        await input.fill("Thank you");
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await expect(input).toBeDisabled();
        await expect(
            page.getByRole("button", {
                name: "Open conversation with Beta Store",
            })
        ).toBeDisabled();
        await accessible(page);
        release();
        await expect(
            page.locator("[data-messages]").getByRole("alert")
        ).toContainText("We couldn’t send your message");
        await expect(input).toHaveValue("Thank you");
        await accessible(page);
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await expect(input).toHaveValue("");
        await expect(
            page
                .locator("[data-messages]")
                .getByRole("status")
                .filter({ hasText: "Message sent" })
        ).toBeVisible();
        expect(sends).toEqual([
            ["conv-one", "Thank you"],
            ["conv-one", "Thank you"],
        ]);
        await accessible(page);
    });
});
test("guest messages redirects to sign-in", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/profile/messages");
    await expect(page).toHaveURL(/sign-in/);
});
