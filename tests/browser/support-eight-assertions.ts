import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export async function supportAccessible(page: Page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({page}).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
}
export async function supportTargets(page: Page) {
    for (const control of await page.locator("main a, main button, main input, main textarea").all()) {
        const box = await control.boundingBox();
        if (box) {
            expect(box.width, await control.innerText()).toBeGreaterThanOrEqual(44);
            expect(box.height, await control.innerText()).toBeGreaterThanOrEqual(44);
        }
    }
}
export async function expectSupportTokens(page: Page, surface: string) {
    const main = page.getByRole("main");
    await main.evaluate(root => {
        (root as HTMLElement).style.setProperty("--purchase-page", "rgb(241, 238, 228)");
        (root as HTMLElement).style.setProperty("--purchase-panel", "rgb(247, 244, 234)");
    });
    await expect(main).toHaveCSS("background-color", "rgb(241, 238, 228)");
    if (surface) await expect(main.locator(surface).first()).toHaveCSS("background-color", "rgb(247, 244, 234)");
    await main.evaluate(root => (root as HTMLElement).removeAttribute("style"));
}
