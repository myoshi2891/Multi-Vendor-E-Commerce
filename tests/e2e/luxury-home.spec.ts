import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: "userCountry", value: JSON.stringify({ name: "United States", code: "US", city: "", region: "" }), url: baseURL! }]);
});

for (const width of [390, 768, 1440]) {
    test(`home is readable and navigable at ${width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.goto("/");
        await expect(page).toHaveTitle("Luxuries for Happiness");
        await expect(page.getByRole("heading", { level: 1 })).toContainText("Happiness.");
        await expect(page.getByTestId("store-header")).toHaveCount(1);
        await expect(page.getByTestId("store-footer")).toHaveCount(1);
        await expect(page.getByTestId("luxury-canvas")).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`) });
        await page.getByRole("link", { name: "Explore the collection" }).click();
        await expect(page.getByRole("heading", { name: "Objects of desire." })).toBeInViewport();
        await expect(page.getByTestId("product-grid")).toBeVisible();
        const count = await page.locator('[data-testid^="luxury-product-"]').count();
        expect(count).toBeLessThanOrEqual(8);
        await page.screenshot({ path: testInfo.outputPath(`collection-${width}.png`) });
        expect(errors).toEqual([]);
    });
}

test("header panels support keyboard dismissal and search navigation", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Open menu / メニュー").click();
    await expect(page.getByRole("link", { name: "My account / マイアカウント" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", { name: "My account / マイアカウント" })).not.toBeVisible();
    await page.getByLabel("Open search / 検索").click();
    await page.getByRole("textbox", { name: "Search products" }).fill("pendant");
    await page.getByRole("textbox", { name: "Search products" }).press("Enter");
    await expect(page).toHaveURL(/\/browse\?search=pendant/);
    await expect(page.getByRole("textbox", { name: "Search products" })).not.toBeVisible();
});

test("home has no serious accessibility violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("product-grid")).toBeVisible();
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations.filter(item => item.impact === "serious" || item.impact === "critical")).toEqual([]);
});

test("cinematic scene can be paused and resumed", async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    await expect(page.getByTestId("luxury-canvas").locator("canvas")).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: testInfo.outputPath("home-webgl.png") });
    await page.getByRole("button", { name: "Pause animation / 演出を停止" }).click();
    await expect(page.getByTestId("luxury-canvas")).toHaveCount(0);
    await page.getByRole("button", { name: "Resume animation / 演出を再開" }).click();
    await expect(page.getByTestId("luxury-canvas").locator("canvas")).toBeVisible();
    await page.locator("#fortune").scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("fortune-webgl.png") });
});

test("WebGL unavailable retains the complete shopping experience", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript(`const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type.startsWith('webgl') ? null : original.call(this, type, ...args); };`);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("luxury-canvas")).toHaveCount(0);
    await page.getByRole("link", { name: "Explore the collection" }).click();
    await expect(page.getByRole("heading", { name: "Objects of desire." })).toBeInViewport();
});
