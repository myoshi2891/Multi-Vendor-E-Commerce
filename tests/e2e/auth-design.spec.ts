import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const modes = [
    { path: "/sign-in", root: ".cl-signIn-root", title: "Sign in" },
    { path: "/sign-up", root: ".cl-signUp-root", title: "Create your account" },
];

function redirectDestination(url: string): string | null {
    const parsed = new URL(url);
    // Clerk retains redirect_url in the hash when navigating between widgets.
    return parsed.searchParams.get("redirect_url") ?? new URLSearchParams(parsed.hash.split("?")[1]).get("redirect_url");
}

async function expectAccessible(page: Page) {
    const result = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
}

for (const mode of modes) {
    for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
        test(`${mode.path}: ${viewport.name} uses the brand theme and remains accessible`, async ({ page, baseURL }) => {
            await page.setViewportSize(viewport);
            const destination = new URL("/profile/wishlist", baseURL).href;
            await page.goto(`${mode.path}?redirect_url=${encodeURIComponent(destination)}`);
            const widget = page.locator(mode.root);
            await expect(widget).toBeVisible({ timeout: 30000 });
            await expect(widget.locator("input").first()).toBeVisible();

            await expect(page.locator("main h1")).toHaveCount(1);
            await expect(widget.locator(".cl-headerTitle")).toHaveText(mode.title);
            await expect(widget.locator(".cl-formButtonPrimary")).toHaveCSS("background-color", "rgb(212, 186, 131)");
            await expect(widget.locator(".cl-formButtonPrimary")).toHaveCSS("color", "rgb(20, 28, 22)");
            const input = widget.locator("input").first();
            await expect(input).toHaveCSS("background-color", "rgb(250, 248, 242)");
            await input.focus();
            await expect(input).toHaveCSS("outline-style", "solid");
            expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
            expect(redirectDestination(page.url())).toBe(destination);
            await expectAccessible(page);
        });
    }

    test(`${mode.path}: empty submission keeps the form and its validation readable`, async ({ page }) => {
        await page.goto(mode.path);
        const widget = page.locator(mode.root);
        await expect(widget).toBeVisible({ timeout: 30000 });
        await widget.locator(".cl-formButtonPrimary").click();
        // Native required validation must keep the user in the form without authenticating.
        expect(await widget.locator("input").first().evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false);
        await expect(widget).toBeVisible();
        await expectAccessible(page);
    });
}

test("switching between sign-in and sign-up retains the wishlist destination", async ({ page, baseURL }) => {
    const destination = new URL("/profile/wishlist", baseURL).href;
    await page.goto(`/sign-in?redirect_url=${encodeURIComponent(destination)}`);
    const signIn = page.locator(".cl-signIn-root");
    await expect(signIn).toBeVisible({ timeout: 30000 });
    await signIn.getByRole("link", { name: "Sign up", exact: true }).click();
    const signUp = page.locator(".cl-signUp-root");
    await expect(signUp).toBeVisible({ timeout: 30000 });
    expect(redirectDestination(page.url())).toBe(destination);
    await signUp.getByRole("link", { name: "Sign in", exact: true }).click();
    await expect(signIn).toBeVisible({ timeout: 30000 });
    expect(redirectDestination(page.url())).toBe(destination);
});
