import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export async function touchControl(control: Locator, icon = false) {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box?.height, "control height must be at least 44px").toBeGreaterThanOrEqual(44);
    if (icon) expect(box?.width, "icon width must be at least 44px").toBeGreaterThanOrEqual(44);
}

export async function sellerEvidence(page: Page, info: TestInfo) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
    await page.screenshot({ path: info.outputPath("seller-residual.png"), fullPage: true });
}
