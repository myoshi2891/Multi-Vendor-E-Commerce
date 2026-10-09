import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

type Route = {
    id: string;
    route: string;
    actualPath: string;
    previousSource: string;
    file: string;
};
// Inventory is supplied explicitly: identifiers must come from the selected audit DB.
const inventoryPath = process.env.DESIGN_AUDIT_INVENTORY;
if (!inventoryPath)
    throw new Error(
        "Set DESIGN_AUDIT_INVENTORY to the prepared read-only route inventory JSON."
    );
const routes: Route[] = JSON.parse(readFileSync(inventoryPath, "utf8"));
test("read-only inventory of every actual route", async ({ browser }, info) => {
    test.setTimeout(1_200_000);
    const evidence = [];
    expect(new Set(routes.map((row) => row.id)).size).toBe(routes.length);
    for (const width of [1440, 390]) {
        const context = await browser.newContext({
            viewport: { width, height: 900 },
            reducedMotion: "reduce",
        });
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
        const page = await context.newPage();
        for (const row of routes) {
            let status: number | null = null;
            let failure: string | null = null;
            try {
                const response = await page.goto(
                    `http://localhost:3129${row.actualPath}`,
                    { waitUntil: "domcontentloaded", timeout: 45000 }
                );
                status = response?.status() ?? null;
                await page.waitForTimeout(1200);
                const display = await page.evaluate(() => {
                    const main =
                        document.querySelector("main") ?? document.body;
                    const heading = main.querySelector("h1,h2");
                    const bodyText = document.body.innerText;
                    return {
                        title: document.title,
                        headings: Array.from(document.querySelectorAll("h1,h2"))
                            .slice(0, 8)
                            .map((e) => e.textContent?.trim()),
                        error: /Application error|Internal Server Error|Unhandled Runtime Error|This page could not be found/i.test(
                            bodyText
                        ),
                        clerkLoaded: !!document.querySelector(
                            ".cl-signIn-root,.cl-signUp-root,.cl-userProfile-root"
                        ),
                        overflow:
                            document.documentElement.scrollWidth >
                            innerWidth + 1,
                        mainBackground: getComputedStyle(main).backgroundColor,
                        bodyBackground: getComputedStyle(document.body)
                            .backgroundColor,
                        headingFont: heading
                            ? getComputedStyle(heading).fontFamily
                            : null,
                        headingColor: heading
                            ? getComputedStyle(heading).color
                            : null,
                        purchaseToken: getComputedStyle(main)
                            .getPropertyValue("--purchase-page")
                            .trim(),
                        sellerShell: !!document.querySelector(
                            "[data-seller-shell]"
                        ),
                    };
                });
                const finalPath = new URL(page.url()).pathname;
                const screenshot = `${row.id}-${width}.png`;
                await page.screenshot({
                    path: info.outputPath(screenshot),
                    fullPage: true,
                    timeout: 15000,
                });
                evidence.push({
                    id: row.id,
                    route: row.route,
                    width,
                    status,
                    finalPath,
                    redirected: finalPath !== row.actualPath,
                    ...display,
                    screenshot,
                });
            } catch (error) {
                failure = error instanceof Error ? error.name : "UnknownError";
                evidence.push({
                    id: row.id,
                    route: row.route,
                    width,
                    status,
                    failure,
                });
            }
            writeFileSync(
                info.outputPath("route-audit.json"),
                JSON.stringify(evidence, null, 2)
            );
        }
        await context.close();
    }
    expect(evidence).toHaveLength(routes.length * 2);
});

test("read-only Clerk hydration and shared disclosure audit", async ({
    page,
}, info) => {
    test.setTimeout(180000);
    const evidence = [];
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const path of ["/sign-in", "/sign-up"]) {
            await page.goto(`http://localhost:3129${path}`, {
                waitUntil: "domcontentloaded",
            });
            const selector =
                path === "/sign-in" ? ".cl-signIn-root" : ".cl-signUp-root";
            const loaded = await page
                .locator(selector)
                .waitFor({ state: "visible", timeout: 20000 })
                .then(() => true)
                .catch(() => false);
            const image = `${path.slice(1)}-sdk-${width}.png`;
            await page.screenshot({
                path: info.outputPath(image),
                fullPage: true,
            });
            evidence.push({ path, width, loaded, image });
        }
        await page.goto("http://localhost:3129/browse", {
            waitUntil: "domcontentloaded",
        });
        const currentPage = page.locator('button[aria-current="page"]');
        await currentPage.waitFor({ state: "visible", timeout: 15000 });
        const paging = await currentPage.evaluate((node) =>
            Array.from(
                node.parentElement?.querySelectorAll("button") ?? []
            ).map((button) => {
                const rect = button.getBoundingClientRect();
                return {
                    label: button.textContent?.trim(),
                    width: rect.width,
                    height: rect.height,
                };
            })
        );
        const secondPage = page.getByRole("button", { name: "2", exact: true });
        await secondPage.hover();
        const hoverColor = await secondPage.evaluate(
            (node) => getComputedStyle(node).color
        );
        evidence.push({ width, browsePagination: paging, hoverColor });
        for (const label of [
            "Account menu",
            "Open search / 検索",
            "Open menu / メニュー",
        ]) {
            const control = page
                .getByRole("button", { name: label, exact: true })
                .or(page.locator(`summary[aria-label="${label}"]`));
            if ((await control.count()) !== 1) {
                evidence.push({ width, disclosure: label, missing: true });
                continue;
            }
            await control.click();
            const overflow = await page.evaluate(
                () => document.documentElement.scrollWidth > innerWidth + 1
            );
            await page.screenshot({
                path: info.outputPath(
                    `disclosure-${label.replaceAll(" ", "-").replaceAll("/", "-")}-${width}.png`
                ),
                fullPage: true,
            });
            evidence.push({ width, disclosure: label, overflow });
            await page.keyboard.press("Escape");
        }
    }
    writeFileSync(
        info.outputPath("sdk-disclosure-audit.json"),
        JSON.stringify(evidence, null, 2)
    );
});

test("read-only public control dimensions", async ({ page }, info) => {
    test.setTimeout(600000);
    const publicRoutes = routes.filter(
        (row) =>
            row.previousSource !== "転送専用" &&
            !/^\/(profile|dashboard|checkout|order)(\/|$)/.test(row.route)
    );
    const evidence = [];
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const row of publicRoutes) {
            await page.goto(`http://localhost:3129${row.actualPath}`, {
                waitUntil: "domcontentloaded",
                timeout: 45000,
            });
            await page.waitForTimeout(1200);
            const controls = await page.evaluate(() =>
                Array.from(
                    document.querySelectorAll(
                        "button,input:not([type=hidden]),select,textarea"
                    )
                ).flatMap((node) => {
                    const bounds = node.getBoundingClientRect();
                    if (
                        !bounds.width ||
                        !bounds.height ||
                        getComputedStyle(node).visibility === "hidden"
                    )
                        return [];
                    return [
                        {
                            tag: node.tagName.toLowerCase(),
                            name:
                                node.getAttribute("aria-label") ??
                                node.textContent?.trim().slice(0, 80) ??
                                node.getAttribute("placeholder"),
                            width: bounds.width,
                            height: bounds.height,
                            color: getComputedStyle(node).color,
                        },
                    ];
                })
            );
            evidence.push({ id: row.id, route: row.route, width, controls });
            writeFileSync(
                info.outputPath("public-controls-audit.json"),
                JSON.stringify(evidence, null, 2)
            );
        }
    }
    expect(evidence).toHaveLength(publicRoutes.length * 2);
});
