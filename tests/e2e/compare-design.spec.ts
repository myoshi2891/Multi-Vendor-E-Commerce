import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const products = Array.from({ length: 4 }, (_, i) => ({
    id: `product-${i}`,
    slug: `piece-${i}`,
    name: `Selected piece ${i + 1}`,
    rating: 4.5,
    sales: 12,
    numReviews: 3,
    variants: [
        {
            variantId: `compare-${i}`,
            variantSlug: `variant-${i}`,
            variantName: "Ivory",
            sizes: [
                {
                    id: `size-${i}`,
                    size: "M",
                    price: 120,
                    quantity: 5,
                    discount: 0,
                },
            ],
        },
    ],
    variantImages: [
        {
            url: `/product/piece-${i}/variant-${i}`,
            image: "/compare-test-image.svg",
        },
    ],
}));

async function seed(page: Page, count: number) {
    await page.addInitScript(
        (ids) => {
            localStorage.setItem(
                "compare-store",
                JSON.stringify({ state: { items: ids }, version: 0 })
            );
        },
        products.slice(0, count).map((p) => p.variants[0].variantId)
    );
    await page.route("**/compare-test-image.svg", (route) =>
        route.fulfill({
            contentType: "image/svg+xml",
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#e8e2d6"/><circle cx="200" cy="200" r="90" fill="#a68a56"/></svg>',
        })
    );
}

async function mockProducts(
    page: Page,
    options: { failFirst?: boolean; empty?: boolean; gate?: Promise<void> } = {}
) {
    let calls = 0;
    await page.route("**/compare", async (route) => {
        if (!route.request().headers()["next-action"]) return route.continue();
        calls++;
        if (options.gate) await options.gate;
        if (options.failFirst && calls === 1)
            return route.fulfill({ status: 500, body: "Unavailable" });
        const ids = JSON.parse(
            route.request().postData() ?? "[]"
        )[0] as string[];
        const result = {
            products: options.empty
                ? []
                : products.filter((p) => ids.includes(p.variants[0].variantId)),
            totalPages: 1,
        };
        await route.fulfill({
            contentType: "text/x-component",
            body: `0:{"a":"$@1","f":"","b":"development"}\n1:${JSON.stringify(result)}\n`,
        });
    });
}

async function accessible(page: Page) {
    const results = await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
    expect(results.violations).toEqual([]);
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth
        )
    ).toBe(false);
}

for (const width of [1440, 390]) {
    test(`empty comparison at ${width}px follows the brand and offers collection navigation`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 1000 });
        await seed(page, 0);
        await page.goto("/compare", { waitUntil: "commit" });
        await expect(page.locator("main h1")).toHaveText("Compare products");
        await expect(page.locator("main")).toHaveCSS(
            "background-color",
            "rgb(243, 240, 232)"
        );
        const link = page.getByRole("link", {
            name: "Explore the collection",
            exact: true,
        });
        await expect(link).toHaveAttribute("href", "/browse");
        await link.focus();
        await expect(link).toHaveCSS("outline-style", "solid");
        await accessible(page);
    });

    test(`four products at ${width}px support scrolling and keyboard removal`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 1000 });
        await seed(page, 4);
        await mockProducts(page);
        await page.goto("/compare", { waitUntil: "commit" });
        await expect(page.getByText("4 of 4 selected")).toBeVisible();
        await expect(
            page.getByRole("heading", { name: "Selected piece 1", exact: true })
        ).toBeVisible();
        await expect(page.getByTestId("product-card-price").first()).toHaveText(
            "$120.00"
        );
        await expect(page.getByTestId("product-card-price").first()).toHaveCSS(
            "color",
            "rgb(117, 97, 59)"
        );
        const region = page.getByRole("region", { name: "Selected products" });
        await region.focus();
        await expect(region).toHaveCSS("outline-style", "solid");
        if (width < 700) {
            expect(
                await region.evaluate((el) => el.scrollWidth > el.clientWidth)
            ).toBe(true);
            await page.keyboard.press("ArrowRight");
            await expect
                .poll(() => region.evaluate((el) => el.scrollLeft))
                .toBeGreaterThan(0);
        }
        await accessible(page);
        await page.screenshot({
            path: test.info().outputPath(`compare-${width}.png`),
            fullPage: true,
        });
        const remove = page
            .getByRole("button", { name: "Remove from compare" })
            .first();
        await remove.focus();
        await page.keyboard.press("Enter");
        await expect(page.getByText("3 of 4 selected")).toBeVisible();
        await expect(
            page.getByRole("heading", { name: "Selected piece 1", exact: true })
        ).toHaveCount(0);
        await page
            .getByRole("button", { name: "Clear all", exact: true })
            .click();
        await expect(page.getByTestId("compare-empty")).toBeVisible();
        await accessible(page);
    });
}

test("failed load offers an accessible retry without losing selection", async ({
    page,
}) => {
    await seed(page, 1);
    await mockProducts(page, { failFirst: true });
    await page.goto("/compare", { waitUntil: "commit" });
    await expect(page.locator("main").getByRole("alert")).toContainText(
        "We couldn’t load your selection"
    );
    await accessible(page);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(
        page.getByRole("heading", { name: "Selected piece 1", exact: true })
    ).toBeVisible();
    await expect(page.getByText("1 of 4 selected")).toBeVisible();
});

test("loading and unavailable selections remain accessible", async ({
    page,
}) => {
    await page.setViewportSize({ width: 700, height: 1000 });
    await seed(page, 2);
    // 読み込み中の走査が終わるまでレスポンスを保留する（固定遅延だと走査と競合する）
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    await mockProducts(page, { gate, empty: true });
    await page.goto("/compare", { waitUntil: "commit" });
    await expect(page.getByRole("status")).toContainText(
        "Loading your selection"
    );
    await accessible(page);
    release();
    await expect(
        page.getByText("Your selected pieces are no longer available.")
    ).toBeVisible();
    await accessible(page);
});
