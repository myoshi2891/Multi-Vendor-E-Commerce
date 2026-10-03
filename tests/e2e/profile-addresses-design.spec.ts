import { expect, test, type Page, type Route } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import AxeBuilder from "@axe-core/playwright";
import { createCustomerSession, requiresClerkAdmin } from "./helpers/auth";

const country = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Japan",
    code: "JP",
};
const address = {
    id: "11111111-1111-4111-8111-111111111111",
    firstName: "Mina",
    lastName: "Mori",
    phone: "+819012345678",
    address1: "GardenStreet".repeat(7),
    address2: "Apartment 2",
    city: "Tokyo",
    state: "Tokyo",
    zip_code: "1000001",
    countryId: country.id,
    country,
    default: false,
};
const other = {
    ...address,
    id: "22222222-2222-4222-8222-222222222222",
    firstName: "Yuki",
    default: true,
};
const data = { addresses: [address, other], countries: [country] };
async function fulfill(route: Route, value: unknown) {
    await route.fulfill({
        contentType: "text/x-component",
        body: `0:{"a":"$@1","f":"","b":"development"}\n1:${JSON.stringify(value)}\n`,
    });
}
async function accessible(page: Page, dialog = false) {
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
        )
    ).toBe(true);
    const results = await new AxeBuilder({ page })
        .include(dialog ? '[role="dialog"]' : "[data-addresses]")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
    expect(results.violations).toEqual([]);
}
test.describe("Profile addresses design system", () => {
    test.skip(() => requiresClerkAdmin, "Requires Clerk test credentials");
    const session = createCustomerSession();
    test.beforeAll(async () => {
        await session.create({ role: "USER" });
    });
    test.afterAll(async () => {
        await session.cleanup();
    });
    test.beforeEach(async ({ page }) => {
        await setupClerkTestingToken({ page });
        await page.goto("/sign-in", { waitUntil: "commit" });
        await clerk.signIn({ page, emailAddress: session.email });
        await page.goto("/profile/addresses", { waitUntil: "networkidle" });
    });
    for (const width of [1440, 390, 768]) {
        test(`empty, populated and edit form at ${width}px`, async ({
            page,
        }) => {
            await page.setViewportSize({ width, height: 1000 });
            await expect(
                page.getByRole("heading", {
                    name: "My shipping addresses",
                    level: 1,
                })
            ).toHaveCSS("font-family", /Georgia/);
            await expect(
                page.getByRole("heading", { name: "No addresses yet" })
            ).toBeVisible();
            await accessible(page);
            await page.route("**/profile/addresses", async (route) => {
                if (!route.request().headers()["next-action"])
                    return route.continue();
                await fulfill(route, data);
            });
            await page
                .getByRole("button", { name: "Refresh addresses" })
                .click();
            await expect(
                page.getByText("Mina Mori", { exact: true })
            ).toBeVisible();
            await expect(
                page.getByText("Default address", { exact: true })
            ).toHaveCount(1);
            await accessible(page);
            await page.screenshot({
                path: `test-results/profile-addresses-${width}.png`,
                fullPage: true,
            });
            const edit = page.getByRole("button", {
                name: "Edit address for Mina Mori",
            });
            await page.keyboard.press("Tab");
            await edit.focus();
            await expect(edit).toHaveCSS("outline-style", "solid");
            await page.keyboard.press("Enter");
            await expect(
                page.getByRole("dialog", { name: "Edit shipping address" })
            ).toBeVisible();
            await expect(page.getByLabel(/^Address line 2/)).toHaveValue(
                "Apartment 2"
            );
            await expect(
                page.getByRole("combobox", { name: "Country" })
            ).toHaveValue(country.id);
            await expect(
                page.getByLabel("First name", { exact: true })
            ).toBeFocused();
            await page.keyboard.press("Tab");
            await expect(
                page.getByLabel("Last name", { exact: true })
            ).toBeFocused();
            await expect(
                page.getByLabel("Last name", { exact: true })
            ).toHaveCSS("outline-style", "solid");
            await accessible(page, true);
            await page.screenshot({
                path: `test-results/profile-addresses-dialog-${width}.png`,
                fullPage: true,
            });
            await page.keyboard.press("Escape");
            await expect(page.getByRole("dialog")).toHaveCount(0);
            await expect(edit).toBeFocused();
        });
    }
    test("validation, pending lock, failure, retry, create, edit and default", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 1000 });
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        let saveCalls = 0;
        let defaultCalls = 0;
        const saves: Record<string, unknown>[] = [];
        await page.route("**/profile/addresses", async (route) => {
            if (!route.request().headers()["next-action"])
                return route.continue();
            const args = JSON.parse(route.request().postData() || "[]");
            if (args.length === 0) return fulfill(route, data);
            if (typeof args[0] === "string") {
                if (++defaultCalls === 1)
                    return route.fulfill({ status: 500, body: "Unavailable" });
                return fulfill(route, { id: args[0] });
            }
            saves.push(args[0]);
            if (++saveCalls === 1) {
                await gate;
                return route.fulfill({ status: 500, body: "Unavailable" });
            }
            return fulfill(route, { ...address, ...args[0] });
        });
        await page.getByRole("button", { name: "Add new address" }).click();
        await page.getByRole("button", { name: "Save address" }).click();
        await expect(
            page.getByLabel("First name", { exact: true })
        ).toHaveAttribute("aria-invalid", "true");
        await accessible(page, true);
        for (const [label, value] of [
            ["First name", "Mina"],
            ["Last name", "Mori"],
            ["Phone number", "+819012345678"],
            ["Address line 1", "12 Garden Street"],
            ["City", "Tokyo"],
            ["State / Province", "Tokyo"],
            ["Postal code", "1000001"],
        ])
            await page.getByLabel(label, { exact: true }).fill(value);
        // The initial country list is real DB data; choose one available destination without writing it.
        const countryId = await page
            .getByRole("combobox", { name: "Country" })
            .locator("option")
            .nth(1)
            .getAttribute("value");
        expect(countryId).toBeTruthy();
        await page
            .getByRole("combobox", { name: "Country" })
            .selectOption(countryId!);
        await page.getByRole("button", { name: "Save address" }).click();
        await expect(
            page.getByRole("button", { name: "Saving address…" })
        ).toBeDisabled();
        await expect(
            page.getByRole("button", { name: "Cancel", exact: true })
        ).toBeDisabled();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toBeVisible();
        await accessible(page, true);
        release();
        await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
            "We couldn’t save this address"
        );
        await expect(
            page.getByLabel("First name", { exact: true })
        ).toHaveValue("Mina");
        await accessible(page, true);
        await page.getByRole("button", { name: "Save address" }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByRole("status")).toContainText("Address saved");
        await expect(
            page.getByText("Mina Mori", { exact: true })
        ).toBeVisible();
        expect(saves).toHaveLength(2);
        expect(saves[0]).toEqual(saves[1]);
        await page.getByRole("button", { name: "Refresh addresses" }).click();
        await expect(
            page.getByText("Yuki Mori", { exact: true })
        ).toBeVisible();
        await page
            .getByRole("button", { name: "Edit address for Mina Mori" })
            .click();
        await page.getByLabel(/^Address line 2/).fill("Apartment 3");
        await page.getByRole("button", { name: "Save address" }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        expect(saves.at(-1)?.id).toBe(address.id);
        await expect(
            page.getByText("Apartment 3", { exact: true })
        ).toBeVisible();
        const makeDefault = page.getByRole("button", {
            name: "Make default address for Mina Mori",
        });
        await makeDefault.click();
        await expect(
            page.locator("[data-addresses]").getByRole("alert")
        ).toContainText("We couldn’t update the default address");
        await accessible(page);
        await makeDefault.click();
        await expect(page.getByRole("status")).toContainText(
            "Default address updated"
        );
        await expect(
            page.getByText("Default address", { exact: true })
        ).toHaveCount(1);
        await expect(makeDefault).toHaveCount(0);
        await accessible(page);
    });
});
test("guest addresses access redirects to sign-in", async ({ page }) => {
    await page.goto("/profile/addresses", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/sign-in/);
});
