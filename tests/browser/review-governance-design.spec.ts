import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expectTouch } from "./seller-residual-assertions";

/**
 * レビュー ガバナンスの UI（plan 092 Step 7・DS-COMP-072 / DS-PAGE-069 / DS-COMP-250 / DS-COMP-251）。
 * DESIGN_SUITE=review-governance bun run test:design
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
    test(`store review card ${width}: badge, report failure, retry and success`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/?screen=store&scenario=fail");

        // 購入者バッジは購入者のレビューだけ
        await expect(page.getByText("Verified purchase")).toHaveCount(1);
        // 本人の履歴: 公開されていない状態と理由
        await expect(
            page.getByText("Pending review — not visible to shoppers yet")
        ).toBeVisible();
        await expect(
            page.getByText("Reason: Mentions another shop by name.")
        ).toBeVisible();
        await expectNoOverflowAndAxe(page);
        await page.screenshot({
            path: info.outputPath(`store-${width}.png`),
            fullPage: true,
        });

        const toggle = page
            .getByRole("button", { name: "Report review" })
            .first();
        await expectTouch(toggle);
        // focus はマウス操作の前に確かめる（クリック後の focus() には :focus-visible が付かない）
        await toggle.focus();
        await expect(toggle).toHaveCSS("outline-style", "solid");
        await page.keyboard.press("Enter");
        await expect(toggle).toHaveAttribute("aria-expanded", "true");

        const reason = page.getByLabel("Reason");
        await expectTouch(reason);
        const submit = page.getByRole("button", { name: "Submit report" });
        await submit.click();
        await expect(page.getByRole("alert")).toHaveText(
            "Choose a reason for your report."
        );

        await reason.selectOption("SPAM");
        await page
            .getByLabel("Details (optional)")
            .fill("Links to another shop");
        await expectNoOverflowAndAxe(page);
        await page.screenshot({
            path: info.outputPath(`report-form-${width}.png`),
            fullPage: true,
        });

        // 1 回目はサーバー側で失敗 → メッセージを出し、入力は残る
        await submit.click();
        await expect(page.getByRole("alert")).toHaveText(
            "Failed to report review."
        );
        await expect(reason).toHaveValue("SPAM");
        await expectNoOverflowAndAxe(page);

        await submit.click();
        await expect(
            page.getByText(/Thanks for letting us know/)
        ).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Report review" })
        ).toHaveCount(1);
        await expectNoOverflowAndAxe(page);
    });

    for (const theme of ["light", "dark"]) {
        test(`admin review queue ${width} ${theme}: states, reasons, failure and retry`, async ({
            page,
        }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=admin&scenario=fail");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", { level: 1, name: "Reviews" })
            ).toHaveCSS("font-family", /Georgia/);
            // 既定の絞り込みは「要対応」（審査待ち + FLAGGED）
            await expect(page.getByRole("article")).toHaveCount(2);
            await expectNoOverflowAndAxe(page);
            await page.screenshot({
                path: info.outputPath(`admin-queue-${width}-${theme}.png`),
                fullPage: true,
            });

            const flagged = page.getByRole("article", {
                name: /Considered piece flagged/,
            });
            await expect(flagged.getByText("3 open reports")).toBeVisible();
            const remove = flagged.getByRole("button", { name: "Remove" });
            await remove.focus();
            await expect(remove).toHaveCSS("outline-style", "solid");
            await expectTouch(remove);

            // 削除は理由が必須
            await remove.click();
            await flagged
                .getByRole("button", { name: "Confirm remove" })
                .click();
            await expect(flagged.getByRole("alert")).toHaveText(
                "Enter a reason before continuing."
            );
            await expectNoOverflowAndAxe(page);

            // 失敗 → 再試行で成功（承認）
            const pending = page.getByRole("article", {
                name: /Considered piece pending/,
            });
            await expect(pending.getByText("Verified purchase")).toBeVisible();
            const approve = pending.getByRole("button", { name: "Approve" });
            await approve.click();
            await expect(pending.getByRole("alert")).toHaveText(
                "Invalid moderation transition."
            );
            await approve.click();
            await expect(pending.getByRole("status")).toHaveText(
                "Review updated."
            );
            await expectNoOverflowAndAxe(page);

            // 絞り込み: 削除済みは操作なしで理由を出す
            await page.getByLabel("Filter by status").selectOption("REMOVED");
            await expect(page.getByRole("article")).toHaveCount(1);
            const removed = page.getByRole("article");
            await expect(
                removed.getByText(/Contains a link to another shop/)
            ).toBeVisible();
            await expect(removed.getByRole("button")).toHaveCount(0);
            await expectNoOverflowAndAxe(page);
            await page.screenshot({
                path: info.outputPath(`admin-removed-${width}-${theme}.png`),
                fullPage: true,
            });
        });
    }
}

// 送信中の表示は scenario=pending で固定して検査する（fail の 400ms の窓では間に合わないことがある）
test("store report: sending state disables the form", async ({ page }) => {
    await page.goto("/?screen=store&scenario=pending");
    await page.getByRole("button", { name: "Report review" }).first().click();
    await page.getByLabel("Reason").selectOption("FAKE");
    await page.getByRole("button", { name: "Submit report" }).click();
    await expect(page.getByText("Sending…")).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Submit report" })
    ).toBeDisabled();
    await expect(page.getByLabel("Reason")).toBeDisabled();
});

test("admin review queue: saving state disables actions", async ({ page }) => {
    await page.goto("/?screen=admin&scenario=pending");
    const pending = page.getByRole("article", {
        name: /Considered piece pending/,
    });
    const approve = pending.getByRole("button", { name: "Approve" });
    await approve.click();
    await expect(pending.getByRole("status")).toHaveText("Saving…");
    await expect(approve).toBeDisabled();
    await expect(
        pending.getByRole("button", { name: "Reject" })
    ).toBeDisabled();
});

test("admin review queue empty state", async ({ page }) => {
    await page.goto("/?screen=admin&scenario=empty");
    await expect(page.getByText("No reviews need attention.")).toBeVisible();
    await expect(
        page.getByRole("navigation", { name: "Review queue pages" })
    ).toHaveCount(0);
    await expectNoOverflowAndAxe(page);
});
