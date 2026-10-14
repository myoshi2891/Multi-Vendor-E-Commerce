import { expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expectBoundaryContrast } from "./seller-residual-assertions";

export async function masterFocus(target: Locator) {
    await target.page().keyboard.press("Tab");
    await target.focus();
    await expect(target).toBeFocused();
    await expectBoundaryContrast(target, "outlineColor");
}

export async function masterAccessible(page: Page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
}
