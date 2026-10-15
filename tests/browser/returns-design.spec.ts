import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
    expectTouch,
    expectBoundaryContrast,
} from "./seller-residual-assertions";

/**
 * 返品 RMA の UI（plan 088 Step 5・DS-COMP-247 / DS-COMP-248 / DS-PAGE-068）。
 * DESIGN_SUITE=returns bun run test:design
 */

async function expectNoOverflowAndAxe(page: Page) {
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
        )
    ).toBe(true);
    const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
    expect(result.violations).toEqual([]);
}

for (const width of [1440, 768, 390]) {
    test(`customer return panel ${width}: request, failure, retry and success`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/?screen=order&scenario=fail");
        const panel = page
            .getByRole("article", { name: "Order group group-0" })
            .getByRole("region", { name: "Returns" });
        await expect(panel.getByText(/can be returned until/)).toBeVisible();
        await expect(panel.getByText("Approved")).toBeVisible();
        await expect(panel.getByText(/Item shows wear/)).toBeVisible();
        await expect(panel.getByText(/\$240\.00/)).toBeVisible();
        // 適格な item も RMA も無い group には返品欄を出さない
        await expect(
            page
                .getByRole("article", { name: "Order group group-1" })
                .getByRole("region", { name: "Returns" })
        ).toHaveCount(0);
        await expectNoOverflowAndAxe(page);

        const toggle = panel.getByRole("button", { name: "Request a return" });
        await expectTouch(toggle);
        await toggle.focus();
        await expect(toggle).toHaveCSS("outline-style", "solid");
        await page.keyboard.press("Enter");
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        const quantity = panel.getByLabel("Quantity to return: Silk scarf (M)");
        await expectBoundaryContrast(quantity, "borderTopColor");
        await quantity.selectOption("2");
        await panel
            .getByLabel("Note for the store (optional)")
            .fill("Stitching came loose");
        await expectNoOverflowAndAxe(page);
        await page.screenshot({
            path: info.outputPath(`customer-form-${width}.png`),
            fullPage: true,
        });

        const submit = panel.getByRole("button", {
            name: "Submit return request",
        });
        await submit.click();
        await expect(panel.getByRole("alert")).toHaveText(
            "Return quantity exceeds purchased quantity."
        );
        await expect(quantity).toHaveValue("2");
        await expectNoOverflowAndAxe(page);

        await submit.click();
        await expect(panel.getByRole("status").last()).toHaveText(
            "Return request submitted."
        );
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expectNoOverflowAndAxe(page);
        await page.screenshot({
            path: info.outputPath(`customer-success-${width}.png`),
            fullPage: true,
        });
    });

    for (const theme of ["light", "dark"]) {
        test(`seller returns ${width} ${theme}: queue states and actions`, async ({
            page,
        }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=seller&scenario=fail");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", { level: 1, name: "Returns" })
            ).toHaveCSS("font-family", /Georgia/);
            await expect(page.getByRole("article")).toHaveCount(6);
            await expectNoOverflowAndAxe(page);
            await page.screenshot({
                path: info.outputPath(`seller-queue-${width}-${theme}.png`),
                fullPage: true,
            });

            const requested = page.getByRole("article", {
                name: "Return rma-requested",
            });
            // focus はマウス操作の前に確かめる（クリック後の focus() には :focus-visible が付かない）
            const approve = requested.getByRole("button", { name: "Approve" });
            await approve.focus();
            await expect(approve).toHaveCSS("outline-style", "solid");
            await expectTouch(approve);

            // 却下は理由が必須
            await requested.getByRole("button", { name: "Reject" }).click();
            await requested
                .getByRole("button", { name: "Confirm rejection" })
                .click();
            await expect(requested.getByRole("alert")).toHaveText(
                "Enter a reason to reject this return."
            );
            await expectNoOverflowAndAxe(page);

            // 受け取りは全明細の状態が必須
            const approved = page.getByRole("article", {
                name: "Return rma-approved",
            });
            await expect(approved.getByText(/TRK-0042/)).toBeVisible();
            const condition = approved.getByLabel("Condition: Silk scarf (M)");
            await expectTouch(condition);
            await condition.selectOption("RESELLABLE");
            await approved
                .getByRole("button", { name: "Mark as received" })
                .click();
            await expect(approved.getByRole("alert")).toHaveText(
                "Select a condition for every item."
            );

            // 失敗 → 再試行で成功
            await approve.click();
            await expect(requested.getByRole("alert")).toHaveText(
                "Return quantity exceeds purchased quantity."
            );
            await approve.click();
            await expect(requested.getByRole("status")).toHaveText(
                "Return updated."
            );
            await expectNoOverflowAndAxe(page);

            // 絞り込み
            await page.getByLabel("Filter by status").selectOption("RECEIVED");
            await expect(page.getByRole("article")).toHaveCount(1);
            await expect(
                page.getByText(/Issue the refund manually/)
            ).toBeVisible();
            await page.screenshot({
                path: info.outputPath(`seller-received-${width}-${theme}.png`),
                fullPage: true,
            });
        });
    }
}

// 送信中の表示は scenario=pending で固定して検査する（fail の 400ms の窓では間に合わないことがある）
test("customer return panel: submitting state disables the form", async ({
    page,
}) => {
    await page.goto("/?screen=order&scenario=pending");
    const panel = page
        .getByRole("article", { name: "Order group group-0" })
        .getByRole("region", { name: "Returns" });
    await panel.getByRole("button", { name: "Request a return" }).click();
    const quantity = panel.getByLabel("Quantity to return: Silk scarf (M)");
    await quantity.selectOption("2");
    await panel.getByRole("button", { name: "Submit return request" }).click();
    await expect(
        panel.getByRole("button", { name: "Submitting…" })
    ).toBeDisabled();
    await expect(quantity).toBeDisabled();
});

test("seller returns: saving state disables actions", async ({ page }) => {
    await page.goto("/?screen=seller&scenario=pending");
    const requested = page.getByRole("article", {
        name: "Return rma-requested",
    });
    const approve = requested.getByRole("button", { name: "Approve" });
    await approve.click();
    await expect(requested.getByRole("status")).toHaveText("Saving…");
    await expect(approve).toBeDisabled();
});

test("seller returns empty state", async ({ page }) => {
    await page.goto("/?screen=seller&scenario=empty");
    await expect(page.getByText("No return requests yet.")).toBeVisible();
    await expectNoOverflowAndAxe(page);
});
