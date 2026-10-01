import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [1440, 390, 768]) {
    test(`tracking appearance and states at ${width}px`, async ({
        page,
    }, testInfo) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/track-order", { waitUntil: "commit" });
        await page.waitForFunction(() => {
            const form = document.querySelector("main form");
            return (
                form &&
                Object.keys(form).some((key) => key.startsWith("__reactProps$"))
            );
        });
        const main = page.getByRole("main");
        await expect(main).toHaveCSS("background-color", "rgb(243, 240, 232)");
        await expect(main.locator("h1")).toHaveCSS("font-family", /Georgia/);
        const order = main.getByRole("textbox", { name: "注文番号" });
        await order.focus();
        await expect(order).toHaveCSS("outline-style", "solid");
        await main.getByRole("button", { name: "追跡する" }).click();
        await expect(
            main.getByText("注文番号を入力してください。")
        ).toBeVisible();
        await order.fill("order-001");
        await main
            .getByRole("textbox", { name: "メールアドレス" })
            .fill("owner@example.com");
        let release!: () => void;
        let gate: Promise<void> | undefined = new Promise((resolve) => {
            release = resolve;
        });
        const accessible = async () => {
            const result = await new AxeBuilder({ page })
                .include("main")
                .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                .analyze();
            expect(result.violations).toEqual([]);
        };
        await accessible();
        let outcome: "missing" | "failed" | "success" = "missing";
        await page.route("**/track-order", async (route) => {
            if (!route.request().headers()["next-action"])
                return route.continue();
            if (gate) await gate;
            if (outcome === "failed")
                return route.fulfill({ status: 500, body: "Unavailable" });
            const result =
                outcome === "success"
                    ? {
                          id: "order-" + "1234567890".repeat(12),
                          orderStatus: "Processing",
                          paymentStatus: "Paid",
                          groups: [
                              {
                                  id: "group-1",
                                  store: { name: "Test Store" },
                                  shippingService: "Standard Shipping",
                                  shippingDeliveryMin: 3,
                                  shippingDeliveryMax: 5,
                                  items: [
                                      {
                                          id: "item-1",
                                          name: "LongProductName".repeat(15),
                                          image: "/test-tracking.svg",
                                          quantity: 2,
                                          status: "Shipped",
                                      },
                                  ],
                              },
                          ],
                      }
                    : null;
            await route.fulfill({
                contentType: "text/x-component",
                body: `0:{"a":"$@1","f":"","b":"development"}\n1:${JSON.stringify(result)}\n`,
            });
        });
        await main.getByRole("button", { name: "追跡する" }).click();
        await expect(
            main.getByRole("button", { name: "照会中…" })
        ).toBeDisabled();
        await accessible();
        release();
        gate = undefined;
        await expect(
            main.getByText("注文が見つかりませんでした。")
        ).toBeVisible();
        await accessible();
        outcome = "failed";
        await main.getByRole("button", { name: "追跡する" }).click();
        await expect(
            main.getByText(
                "注文の照会に失敗しました。時間をおいて再度お試しください。"
            )
        ).toBeVisible();
        await accessible();
        outcome = "success";
        await page.route("**/test-tracking.svg", (route) =>
            route.fulfill({
                contentType: "image/svg+xml",
                body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#c9c7b8"/></svg>',
            })
        );
        await main.getByRole("button", { name: "追跡する" }).click();
        await expect(
            main.getByRole("region", { name: "注文追跡の結果" })
        ).toBeVisible();
        await expect(main.getByText("Test Store")).toBeVisible();
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
            )
        ).toBe(true);
        const results = await new AxeBuilder({ page })
            .include("main")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();
        expect(results.violations).toEqual([]);
        await page.screenshot({
            path: testInfo.outputPath(`tracking-${width}.png`),
            fullPage: true,
        });
    });
}
