import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Supplemental component browser verification; never interpreted as authenticated route coverage.
async function accessible(page: Page) {
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
    test(`checkout and address dialog at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?scenario=checkout");
        await expect(
            page.getByRole("heading", { name: "Checkout", level: 1 })
        ).toHaveCSS("font-family", /Georgia/);
        await expect(
            page.getByRole("button", { name: "Place order" })
        ).toBeEnabled();
        await expect(page.getByRole("radio").first()).toBeChecked();
        await page.getByRole("radio").nth(1).focus();
        await page.keyboard.press("Space");
        await expect(page.getByRole("radio").nth(1)).toBeChecked();
        await accessible(page);
        const trigger = page.getByRole("button", { name: "Add new address" });
        await trigger.focus();
        await expect(trigger).toHaveCSS("outline-style", "solid");
        await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog", { name: "Add new address" });
        await expect(dialog).toBeVisible();
        await expect(page.getByLabel("First name")).toBeFocused();
        const box = await dialog.boundingBox();
        expect(box!.width).toBeLessThanOrEqual(width);
        await accessible(page);
        await page.screenshot({
            path: info.outputPath(`checkout-dialog-${width}.png`),
            fullPage: true,
        });
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        expect(
            await page.evaluate(() =>
                Boolean(document.activeElement?.closest('[role="dialog"]'))
            )
        ).toBe(true);
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(trigger).toBeFocused();
        await page.screenshot({
            path: info.outputPath(`checkout-${width}.png`),
            fullPage: true,
        });
    });
    test(`order paid and pending at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?scenario=order-paid");
        await expect(
            page.getByRole("heading", { name: "Order Details", level: 1 })
        ).toHaveCSS("font-family", /Georgia/);
        await expect(page.getByTestId("order-total")).toHaveCount(1);
        await expect(page.getByTestId("order-payment")).toHaveCount(0);
        await expect(
            page.getByRole("button", { name: "Cancel Order" }).first()
        ).toBeDisabled();
        await expect(
            page.getByRole("link", { name: "Back to orders" })
        ).toHaveAttribute("href", "/profile/orders");
        await accessible(page);
        await page.screenshot({
            path: info.outputPath(`order-paid-${width}.png`),
            fullPage: true,
        });
        await page.goto("/?scenario=order-pending");
        await expect(page.getByRole("alert")).toHaveText(
            "Payment could not be initialized."
        );
        await expect(page.getByTestId("order-total")).toHaveCount(1);
        await page.getByRole("button", { name: "Retry card payment" }).click();
        await expect(page.getByRole("status")).toHaveText(
            "Loading card payment…"
        );
        await expect(page.getByRole("alert")).toHaveText(
            "Payment could not be initialized."
        );
        await accessible(page);
        await page.screenshot({
            path: info.outputPath(`order-pending-${width}.png`),
            fullPage: true,
        });
    });
}
test("checkout refresh pending, error and retry lock order controls", async ({
    page,
}) => {
    await page.goto("/?scenario=checkout-pending");
    await expect(page.getByRole("status")).toHaveText(
        "Updating checkout details…"
    );
    await expect(
        page.getByRole("button", { name: "Place order" })
    ).toBeDisabled();
    await expect(
        page.getByRole("button", { name: "Place order" })
    ).toBeEnabled();
    await page.goto("/?scenario=checkout-error");
    await expect(page.getByRole("alert")).toContainText("We couldn’t refresh");
    await expect(
        page.getByRole("button", { name: "Place order" })
    ).toBeDisabled();
    await page.getByRole("button", { name: "Retry checkout" }).click();
    await expect(
        page.getByRole("button", { name: "Place order" })
    ).toBeEnabled();
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page.getByRole("status")).toContainText("Placing your order");
    await expect(page.getByRole("radio").first()).toBeDisabled();
    await expect(page.getByRole("alert")).toContainText(
        "We couldn’t place your order"
    );
    await expect(
        page.getByRole("button", { name: "Place order" })
    ).toBeEnabled();
});
test("empty bag and missing addresses have clear destinations", async ({
    page,
}) => {
    await page.goto("/?scenario=checkout-empty");
    await expect(page.getByText("Your bag is empty.")).toBeVisible();
    await expect(
        page.getByRole("link", { name: "Explore the collection" })
    ).toHaveAttribute("href", "/browse");
    await expect(
        page.getByRole("button", { name: "Place order" })
    ).toBeDisabled();
    await accessible(page);
    await page.goto("/?scenario=address-empty");
    await expect(page.getByText(/No shipping addresses yet/)).toBeVisible();
    await accessible(page);
});
test("coupon submission locks checkout and preserves failed input", async ({
    page,
}) => {
    await page.goto("/?scenario=coupon-error");
    await expect(
        page.getByRole("button", { name: "Place order" })
    ).toBeEnabled();
    await page.getByLabel("Coupon code").fill("BADCODE");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Applying coupon…");
    await expect(
        page.getByRole("button", { name: "Place order" })
    ).toBeDisabled();
    await expect(page.getByRole("alert")).toHaveText("Invalid coupon code");
    await expect(page.getByLabel("Coupon code")).toHaveValue("BADCODE");
    await expect(
        page.getByRole("button", { name: "Place order" })
    ).toBeEnabled();
    await accessible(page);
});
test("address save keeps dialog open while pending and restores inputs after failure", async ({
    page,
}) => {
    await page.goto("/?scenario=address-error");
    await expect(
        page.getByRole("button", { name: "Place order" })
    ).toBeEnabled();
    await page
        .getByRole("button", {
            name: "Edit address for Test User",
            exact: true,
        })
        .click();
    await page
        .getByLabel("Address line 1", { exact: true })
        .fill("123 Test Street");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByRole("status")).toHaveText("Saving address…");
    await expect(
        page.getByRole("button", { name: "Close address dialog" })
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveText(
        "We couldn’t save this address. Please try again."
    );
    await expect(page.getByLabel("First name")).toHaveValue("Test");
    await accessible(page);
});

test("successful address editing selects fresh data and restores focus", async ({
    page,
}) => {
    await page.goto("/?scenario=checkout");
    await expect(
        page.getByRole("button", { name: "Place order" })
    ).toBeEnabled();
    const trigger = page.getByRole("button", {
        name: "Edit address for Test User",
        exact: true,
    });
    await trigger.click();
    await page
        .getByLabel("Address line 1", { exact: true })
        .fill("123 Updated Street");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(
        page.getByRole("radio", { name: /123 Updated Street/ })
    ).toBeChecked();
    await expect(trigger).toBeFocused();
    await expect(
        page.getByRole("button", { name: "Place order" })
    ).toBeEnabled();
    await page
        .getByRole("button", { name: "Make address default for Second User" })
        .click();
    await expect(page.getByRole("status")).toContainText("Updating");
    await expect(page.getByRole("status")).toHaveText(
        "Default address updated."
    );
    await expect(
        page.getByText("· Default address", { exact: true })
    ).toHaveCount(1);
    await accessible(page);
});

for (const width of [1440, 768, 390]) {
    test(`checkout shared header and dialog ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?scenario=checkout&header=1");
        await expect(
            page.getByRole("button", { name: "Place order" })
        ).toBeEnabled();
        const account = page.getByLabel("Account menu", { exact: true });
        await account.press("Enter");
        await expect(
            page.getByRole("link", { name: "Sign in", exact: true })
        ).toBeVisible();
        await account.press("Escape");
        const trigger = page.getByRole("button", { name: "Add new address" });
        await trigger.press("Enter");
        await expect(
            page.getByRole("dialog", { name: "Add new address" })
        ).toBeVisible();
        await expect(page.getByLabel("First name")).toBeFocused();
        await accessible(page);
        await page.screenshot({
            path: info.outputPath(`checkout-header-dialog-${width}.png`),
            fullPage: true,
        });
        await page.keyboard.press("Escape");
        await expect(trigger).toBeFocused();
        await page.goto("/?scenario=checkout-error&header=1");
        await expect(page.getByRole("alert")).toContainText("refresh");
        await expect(
            page.getByRole("button", { name: "Place order" })
        ).toBeDisabled();
        await page.getByRole("button", { name: "Retry checkout" }).click();
        await expect(
            page.getByRole("button", { name: "Place order" })
        ).toBeEnabled();
        await accessible(page);
    });
}

for (const width of [1440, 768, 390]) {
    test(`residual checkout ${width}: portal form uses purchase controls`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?scenario=checkout");
        await expect(page.getByRole("button", { name: "Place order" })).toBeEnabled();
        const trigger = page.getByRole("button", { name: "Add new address" });
        await trigger.press("Enter");
        const dialog = page.getByRole("dialog", { name: "Add new address" });
        await expect(dialog).toHaveCSS("color-scheme", "light");
        const save = dialog.getByRole("button", { name: "Save address" });
        await expect(save).toHaveCSS("background-color", "rgb(212, 186, 131)");
        await expect(save).toHaveCSS("color", "rgb(23, 37, 29)");
        await expect(page.getByLabel("First name")).toBeFocused();
        await accessible(page);
        await page.screenshot({ path: info.outputPath(`residual-checkout-dialog-${width}.png`), fullPage: true });
        await page.keyboard.press("Escape");
        await expect(trigger).toBeFocused();
    });
}

test("residual checkout compatibility: account address form keeps its default palette", async ({ page }) => {
    await page.goto("/?scenario=account-address-form");
    const dialog = page.getByRole("dialog", { name: "Account address form" });
    await expect(dialog.getByRole("button", { name: "Save address" })).toHaveCSS("background-color", "rgb(23, 37, 29)");
    await expect(dialog.getByRole("button", { name: "Save address" })).toHaveCSS("color", "rgb(241, 238, 228)");
    await expect(page.getByLabel("First name")).toHaveCSS("background-color", "rgb(255, 253, 247)");
    await accessible(page);
});
