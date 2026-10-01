import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { RETURNS_POLICY_SUMMARY } from "../../src/components/store/static/content/returns";

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

for (const width of [1440, 390, 768]) {
    test(`returns appearance and submission states at ${width}px`, async ({
        page,
    }, testInfo) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/returns-exchange", { waitUntil: "commit" });
        const main = page.getByRole("main");
        await expect(main).toHaveCSS("background-color", "rgb(243, 240, 232)");
        await expect(main.getByRole("heading", { level: 1 })).toHaveCSS(
            "font-family",
            /Georgia/
        );
        await expect(
            main.getByText(RETURNS_POLICY_SUMMARY.intro)
        ).toBeVisible();
        for (const point of RETURNS_POLICY_SUMMARY.points)
            await expect(main.getByText(point)).toBeVisible();
        await page.waitForFunction(() => {
            const form = document.querySelector("main form");
            return (
                form &&
                Object.keys(form).some((key) => key.startsWith("__reactProps$"))
            );
        });
        const name = main.getByRole("textbox", { name: "お名前" });
        await accessible(page);
        await page.screenshot({
            path: testInfo.outputPath(`returns-form-${width}.png`),
            fullPage: true,
        });
        await name.focus();
        await expect(name).toHaveCSS("outline-style", "solid");
        const submit = main.getByRole("button", {
            name: "返品・交換を申請する",
        });
        await submit.click();
        await expect(
            main.getByText("お名前を入力してください。")
        ).toBeVisible();
        await accessible(page);
        await name.fill("山田太郎");
        await main
            .getByRole("textbox", { name: "メールアドレス" })
            .fill("invalid");
        await main.getByRole("textbox", { name: "件名" }).fill("返品申請");
        await main
            .getByRole("textbox", { name: "内容", exact: true })
            .fill("サイズが合わないため交換を希望します。");
        const order = main.getByRole("textbox", { name: "対象の注文番号" });
        await order.fill("invalid");
        await submit.click();
        await expect(
            main.getByText("有効なメールアドレスを入力してください。")
        ).toBeVisible();
        await expect(
            main.getByText("有効な注文番号を入力してください。")
        ).toBeVisible();
        await main
            .getByRole("textbox", { name: "メールアドレス" })
            .fill("taro@example.com");
        await order.fill("123e4567-e89b-12d3-a456-426614174000");
        let release!: () => void;
        let gate: Promise<void> | undefined = new Promise((resolve) => {
            release = resolve;
        });
        let failed = true;
        let calls = 0;
        await page.route("**/returns-exchange", async (route) => {
            if (!route.request().headers()["next-action"])
                return route.continue();
            calls++;
            if (gate) await gate;
            if (failed)
                return route.fulfill({ status: 500, body: "Unavailable" });
            await route.fulfill({
                contentType: "text/x-component",
                body: '0:{"a":"$@1","f":"","b":"development"}\n1:{"id":"ticket-1"}\n',
            });
        });
        await submit.focus();
        await page.keyboard.press("Enter");
        await expect(
            main.getByRole("button", { name: "送信中…" })
        ).toBeDisabled();
        await expect(order).toBeDisabled();
        await expect(main.locator("form")).toHaveAttribute("aria-busy", "true");
        await accessible(page);
        release();
        gate = undefined;
        await expect(main.getByRole("alert")).toBeVisible();
        await expect(order).toHaveValue("123e4567-e89b-12d3-a456-426614174000");
        await accessible(page);
        failed = false;
        await submit.click();
        await expect(main.getByRole("status")).toContainText(
            "受け付けました。"
        );
        await expect(main.getByRole("textbox")).toHaveCount(0);
        expect(calls).toBe(2);
        await accessible(page);
        await page.screenshot({
            path: testInfo.outputPath(`returns-success-${width}.png`),
            fullPage: true,
        });
    });
}

test("shared support callers retain their fields and submit actions", async ({
    page,
}) => {
    for (const [path, button, hasOrder] of [
        ["/contact", "Send message ↗", false],
        ["/dispute", "申立を送信する", true],
        ["/report-problem", "報告する", false],
    ] as const) {
        await page.goto(path, { waitUntil: "commit" });
        await page.waitForFunction(() => {
            const form = document.querySelector("main form");
            return (
                form &&
                Object.keys(form).some((key) => key.startsWith("__reactProps$"))
            );
        });
        const main = page.getByRole("main");
        await expect(
            main.getByRole("textbox", { name: "対象の注文番号" })
        ).toHaveCount(hasOrder ? 1 : 0);
        await main
            .getByRole("textbox", { name: "お名前" })
            .fill("Test Customer");
        await main
            .getByRole("textbox", { name: "メールアドレス" })
            .fill("customer@example.com");
        await main
            .getByRole("textbox", { name: "件名" })
            .fill("Support request");
        await main
            .getByRole("textbox", { name: "内容", exact: true })
            .fill("Test request");
        if (hasOrder)
            await main
                .getByRole("textbox", { name: "対象の注文番号" })
                .fill("123e4567-e89b-12d3-a456-426614174000");
        await page.route(`**${path}`, async (route) => {
            if (!route.request().headers()["next-action"])
                return route.continue();
            await route.fulfill({
                contentType: "text/x-component",
                body: '0:{"a":"$@1","f":"","b":"development"}\n1:{"id":"ticket-1"}\n',
            });
        });
        await main.getByRole("button", { name: button }).click();
        await expect(main.getByRole("status")).toContainText(
            "受け付けました。"
        );
    }
});
