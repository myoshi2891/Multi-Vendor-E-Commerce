import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function accessible(page: Page) {
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
        )
    ).toBe(true);
    const result = await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
    expect(result.violations).toEqual([]);
}
for (const width of [1440, 768, 390]) {
    test(`offers actual route at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/offers");
        const main = page.getByRole("main");
        await expect(
            main.getByRole("heading", { level: 1, name: "Discounts & Offers" })
        ).toHaveCSS("font-family", /Georgia/);
        await expect(main).toHaveCSS("background-color", "rgb(243, 240, 232)");
        await expect(
            main.getByRole("navigation", { name: "Breadcrumb" })
        ).toBeVisible();
        for (const link of await main
            .locator('a[href^="/browse?offer="]')
            .all()) {
            await expect(link).toContainText("商品");
            await expect(link).toHaveAttribute("href", /\/browse\?offer=.+/);
        }
        const link = main.getByRole("link").first();
        await link.focus();
        await expect(link).toHaveCSS("outline-style", "solid");
        await accessible(page);
        await page.screenshot({
            path: info.outputPath(`offers-${width}.png`),
            fullPage: true,
        });
    });
    for (const [path, title, submitLabel, orderRequired] of [
        ["/dispute", "Order dispute resolution", "申立を送信する", true],
        ["/report-problem", "Report a problem", "報告する", false],
    ] as const) {
        test(`${path} actual route and mocked submission at ${width}px`, async ({
            page,
        }, info) => {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto(path);
            const main = page.getByRole("main");
            await expect(
                main.getByRole("heading", { name: title, level: 1 })
            ).toHaveCSS("font-family", /Georgia/);
            await expect(main).toHaveCSS(
                "background-color",
                "rgb(243, 240, 232)"
            );
            await page.waitForFunction(() => {
                const form = document.querySelector("main form");
                return (
                    form &&
                    Object.keys(form).some((key) =>
                        key.startsWith("__reactProps$")
                    )
                );
            });
            const submit = main.getByRole("button", { name: submitLabel });
            await accessible(page);
            await page.screenshot({
                path: info.outputPath(`form-${width}.png`),
                fullPage: true,
            });
            await submit.click();
            await expect(
                main.getByText("お名前を入力してください。")
            ).toBeVisible();
            await main
                .getByLabel("お名前", { exact: true })
                .fill("Test Customer");
            await main
                .getByLabel("メールアドレス", { exact: true })
                .fill("customer@example.com");
            await main.getByLabel("件名", { exact: true }).fill("Test request");
            await main
                .getByLabel("内容", { exact: true })
                .fill("Test request details");
            const order = main.getByLabel("対象の注文番号", { exact: true });
            await expect(order).toHaveCount(orderRequired ? 1 : 0);
            if (orderRequired) {
                await order.fill("invalid");
                await submit.click();
                await expect(
                    main.getByText("有効な注文番号を入力してください。")
                ).toBeVisible();
                await order.fill("123e4567-e89b-12d3-a456-426614174000");
            }
            let release!: () => void;
            let gate: Promise<void> | undefined = new Promise((done) => {
                release = done;
            });
            let fail = true;
            let calls = 0;
            await page.route(`**${path}`, async (route) => {
                if (!route.request().headers()["next-action"])
                    return route.continue();
                calls++;
                if (gate) await gate;
                if (fail)
                    return route.fulfill({ status: 500, body: "Unavailable" });
                return route.fulfill({
                    contentType: "text/x-component",
                    body: '0:{"a":"$@1","f":"","b":"development"}\n1:{"id":"ticket-fixture"}\n',
                });
            });
            await page.keyboard.press("Tab");
            await submit.focus();
            await expect(submit).toHaveCSS("outline-style", "solid");
            await page.keyboard.press("Enter");
            await expect(
                main.getByRole("button", { name: "送信中…" })
            ).toBeDisabled();
            for (const input of await main.getByRole("textbox").all())
                await expect(input).toBeDisabled();
            await accessible(page);
            release();
            gate = undefined;
            await expect(main.getByRole("alert")).toBeVisible();
            await expect(main.getByLabel("内容", { exact: true })).toHaveValue(
                "Test request details"
            );
            await accessible(page);
            fail = false;
            await submit.click();
            await expect(main.getByRole("status")).toContainText(
                "受け付けました。"
            );
            expect(calls).toBe(2);
            await accessible(page);
            await page.screenshot({
                path: info.outputPath(`success-${width}.png`),
                fullPage: true,
            });
        });
    }
}
for (const path of ["/profile/following/1", "/profile/history/1"]) {
    test(`guest redirect preserves ${path}`, async ({ page }) => {
        await page.goto(path);
        await expect(page).toHaveURL(/sign-in/);
        expect(new URL(page.url()).searchParams.get("redirect_url")).toContain(
            path
        );
    });
}
