import { expect, Locator, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * WCAG 2.1 AA 違反スキャンの共通ヘルパー。
 *
 * networkidle 待ちは flake の原因となるため使用しない。
 * ページごとに「準備完了」を示す具体的な Locator を受け取り、
 * その可視化を待ってから axe-core を走らせる。
 *
 * 違反が見つかった場合は CI ログ用に { id, impact, help, nodes } の
 * 簡潔なサマリを console.log で出力する。
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
