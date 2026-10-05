import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ context }) => {
    await context.addCookies([
        {
            name: "userCountry",
            value: JSON.stringify({
                name: "United States",
                code: "US",
                city: "",
                region: "",
            }),
            domain: "localhost",
            path: "/",
        },
    ]);
});
for (const width of [1440, 768, 390])
    test(`seller application actual guest route ${width}`, async ({
        page,
    }, info) => {
        const hydrationErrors: string[] = [];
        page.on("console", (message) => {
            if (
                message.type() === "error" &&
                /hydrat|didn.t match/i.test(message.text())
            )
                hydrationErrors.push(message.text());
        });
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/seller/apply");
        await expect(
            page.getByRole("heading", { name: "Become a seller", exact: true })
        ).toBeVisible();
        await expect(
            page.getByText("Sign in", { exact: true }).first()
        ).toBeVisible();
        await expect(
            page
                .getByRole("main")
                .getByRole("link", { name: "Sign up", exact: true })
        ).toBeVisible();
        expect(hydrationErrors).toEqual([]);
        expect(
            await page
                .getByRole("main")
                .getByRole("link", { name: "Sign up", exact: true })
                .evaluate((node) => {
                    for (
                        let parent: Element | null = node;
                        parent;
                        parent = parent.parentElement
                    ) {
                        if (getComputedStyle(parent).opacity === "0")
                            return false;
                    }
                    return true;
                })
        ).toBe(true);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
            )
        ).toBe(true);
        expect(
            (
                await new AxeBuilder({ page })
                    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                    .analyze()
            ).violations
        ).toEqual([]);
        await page.screenshot({
            path: info.outputPath(`application-guest-${width}.png`),
            fullPage: true,
        });
    });
test("seller workspaces redirect guests before store data is rendered", async ({
    request,
}) => {
    for (const suffix of [
        "",
        "/products",
        "/inventory",
        "/orders",
        "/messages",
    ]) {
        const response = await request.get(
            `/dashboard/seller/stores/example${suffix}`,
            { maxRedirects: 0 }
        );
        expect([302, 303, 307, 308]).toContain(response.status());
        expect(response.headers().location).toBe("/");
    }
});
test("profile settings redirects guests to sign in", async ({ request }) => {
    const response = await request.get("/profile/settings", {
        maxRedirects: 0,
    });
    expect([302, 303, 307, 308]).toContain(response.status());
    expect(response.headers().location).toMatch(/sign-in/);
});
