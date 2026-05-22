import { expect, Locator, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Run an Axe WCAG 2.1 AA accessibility scan against a page and fail the test if any violations are found.
 *
 * Navigates to the given URL, waits for the provided readiness locator to become visible, runs axe with WCAG 2.1 AA tags,
 * logs a concise CI-friendly summary when violations are present, and asserts that there are no violations.
 *
 * @param readinessLocator - Locator that indicates the page is ready for scanning; the function waits for it to be visible before running the scan
 * @param timeoutMs - Maximum time in milliseconds to wait for `readinessLocator` to become visible (defaults to 15000)
 */
export async function runA11yScan(
    page: Page,
    url: string,
    opts: { readinessLocator: Locator; timeoutMs?: number }
): Promise<void> {
    const { readinessLocator, timeoutMs = 15000 } = opts;

    await page.goto(url, { waitUntil: "domcontentloaded" });
    await readinessLocator.waitFor({ state: "visible", timeout: timeoutMs });

    const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

    if (results.violations.length > 0) {
        console.log(
            "[a11y violations]",
            JSON.stringify(
                results.violations.map((v) => ({
                    id: v.id,
                    impact: v.impact,
                    help: v.help,
                    nodes: v.nodes.length,
                })),
                null,
                2
            )
        );
    }

    expect(results.violations).toEqual([]);
}
