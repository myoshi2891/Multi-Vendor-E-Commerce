import { storefrontControls, storefrontToken } from "./storefront-eight-assertions";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expectReadableFocus, expectReadableBorder } from "./purchase-assertions";
async function accessible(page: Page) {
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
        )
    ).toBe(true);
    expect(
        (
            await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                .analyze()
        ).violations
    ).toEqual([]);
}
for (const width of [1440, 768, 390]) {
    test(`acceptance wishlist ${width}: last page keyboard and history`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?scenario=wishlist&page=20");
        const nav = page.getByRole("navigation", { name: "Wishlist pagination" });
        await expect(nav.getByRole("link", { name: "Page 20", exact: true })).toHaveAttribute("aria-current", "page");
        await expect(nav.getByRole("link", { name: "Next" })).toHaveCount(0);
        await expect(nav.getByText("Next", { exact: true })).toHaveAttribute("aria-disabled", "true");
        await pageTargets(page, "Wishlist pagination");
        const previous = nav.getByRole("link", { name: "Previous" });
        await expect(previous).toHaveAttribute("href", "/profile/wishlist/19");
        await expectReadableFocus(previous);
        await accessible(page);
        await page.screenshot({ path: info.outputPath(`acceptance-wishlist-${width}.png`), fullPage: true });
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/profile\/wishlist\/19$/);
        await expect(nav.getByRole("link", { name: "Page 19", exact: true })).toHaveAttribute("aria-current", "page");
        await page.goBack();
        await expect(page).toHaveURL(/scenario=wishlist&page=20$/);
        await expect(nav.getByRole("link", { name: "Page 20", exact: true })).toHaveAttribute("aria-current", "page");
        await accessible(page);
    });
    test(`acceptance compare ${width}: removal restores selection focus`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?scenario=compare");
        await expect(page.getByRole("region", { name: "Selected products" })).toBeVisible();
        await page.getByRole("button", { name: "Remove from compare" }).first().focus();
        await page.keyboard.press("Enter");
        const heading = page.getByRole("heading", { name: "Your selection" });
        await expect(heading).toBeFocused();
        await expectReadableFocus(heading);
        await expect(page.getByText("3 of 4 selected")).toBeVisible();
        await expect(page.getByRole("region", { name: "Selected products" })).toBeVisible();
        await page.getByRole("button", { name: "Clear all" }).focus();
        await page.keyboard.press("Enter");
        await expect(heading).toBeFocused();
        await expect(page.getByText("0 of 4 selected")).toBeVisible();
        await expect(page.getByRole("link", { name: "Explore the collection" })).toBeVisible();
        await accessible(page);
        await page.screenshot({ path: info.outputPath(`acceptance-compare-${width}.png`), fullPage: true });
    });
    test(`following component states at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?scenario=following-error&page=2");
        await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
            "font-family",
            /Georgia/
        );
        await expect(page.getByRole("link", { name: "Next" })).toHaveAttribute(
            "href",
            "/profile/following/3"
        );
        const button = page.getByRole("button", { name: "Following" });
        await page.keyboard.press("Tab");
        await button.focus();
        await expect(button).toHaveCSS("outline-style", "solid");
        await page.keyboard.press("Enter");
        await expect(button).toBeDisabled();
        await expect(page.getByRole("status")).toHaveText("Updating store…");
        await accessible(page);
        await expect(page.getByRole("alert")).toContainText(
            "Could not update this store."
        );
        await expect(button).toHaveAttribute("aria-pressed", "true");
        await button.click();
        await expect(
            page.getByRole("button", { name: "Follow", exact: true })
        ).toHaveAttribute("aria-pressed", "false");
        await expect(
            page.getByText("11 followers", { exact: true })
        ).toBeVisible();
        await accessible(page);
        await page.screenshot({
            path: info.outputPath(`following-${width}.png`),
            fullPage: true,
        });
        await page.getByRole("link", { name: "Next" }).click();
        await expect(
            page.getByRole("link", { name: "Page 3", exact: true })
        ).toHaveAttribute("aria-current", "page");
        await page.goBack();
        await expect(
            page.getByRole("link", { name: "Page 2", exact: true })
        ).toHaveAttribute("aria-current", "page");
        await page.goto("/?scenario=following-empty");
        await expect(
            page.getByRole("heading", { name: "No followed stores yet." })
        ).toBeVisible();
        await accessible(page);
    });
    test(`history component states at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?scenario=history-error&page=2");
        await expect(page.getByRole("alert")).toContainText(
            "Recently viewed pieces could not be loaded."
        );
        await accessible(page);
        const retry = page.getByRole("button", { name: "Try again" });
        await page.keyboard.press("Tab");
        await retry.focus();
        await expect(retry).toHaveCSS("outline-style", "solid");
        await page.keyboard.press("Enter");
        await expect(page.getByRole("status")).toContainText(
            "Loading recently viewed pieces…"
        );
        await expect(page.getByTestId("history-products")).toHaveCount(0);
        await expect(page.getByTestId("product-card-actions")).toHaveCount(4);
        await expect(page.getByRole("link", { name: "Next" })).toHaveAttribute(
            "href",
            "/profile/history/3"
        );
        await accessible(page);
        const compare = page
            .getByRole("button", { name: "Add to compare" })
            .first();
        await compare.focus();
        await page.keyboard.press("Enter");
        await expect(
            page.getByRole("button", { name: "Remove from compare" })
        ).toHaveCount(1);
        await page.screenshot({
            path: info.outputPath(`history-${width}.png`),
            fullPage: true,
        });
        // Reload a successful route before back/forward: the error scenario deliberately fails once per document.
        await page.goto("/profile/history/2");
        await expect(
            page.getByRole("link", { name: "Page 2", exact: true })
        ).toHaveAttribute("aria-current", "page");
        await page.getByRole("link", { name: "Next" }).click();
        await expect(
            page.getByRole("link", { name: "Page 3", exact: true })
        ).toHaveAttribute("aria-current", "page");
        await page.goBack();
        await expect(
            page.getByRole("link", { name: "Page 2", exact: true })
        ).toHaveAttribute("aria-current", "page");
        await page.goto("/?scenario=history-empty");
        await expect(
            page.getByRole("heading", { name: "No recently viewed pieces." })
        ).toBeVisible();
        await accessible(page);
    });
    test(`notification list states at ${width}px (plan 086)`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?scenario=notifications");
        await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
            "font-family",
            /Georgia/
        );
        await expect(page.getByText("Unread", { exact: true })).toHaveCount(2);
        await expect(
            page.getByRole("link", { name: "Older notifications" })
        ).toHaveAttribute("href", "/profile/notifications?cursor=n3");
        await accessible(page);
        await page.screenshot({
            path: info.outputPath(`notifications-${width}.png`),
            fullPage: true,
        });
        const markAll = page.getByRole("button", { name: "Mark all as read" });
        await markAll.focus();
        await expect(markAll).toHaveCSS("outline-style", "solid");
        await page.keyboard.press("Enter");
        await expect(page.getByText("Unread", { exact: true })).toHaveCount(0);
        await expect(markAll).toBeDisabled();
        await accessible(page);

        await page.goto("/?scenario=notifications-error");
        await page.getByRole("button", { name: "Mark all as read" }).click();
        await expect(page.getByRole("alert")).toHaveText(
            "Couldn't update notifications. Please try again."
        );
        await expect(page.getByText("Unread", { exact: true })).toHaveCount(2);
        await accessible(page);

        await page.goto("/?scenario=notifications-empty");
        await expect(page.getByText("No notifications yet.")).toBeVisible();
        await accessible(page);
    });
}

// Theme inheritance must be observable in rendered UI, including account child screens.
test("account shell inherits shared storefront tokens", async ({ page }) => {
    await page.goto("/?scenario=notifications");
    const title = page.getByRole("heading", { name: "Notifications" });
    await page.locator("#root > div").evaluate((root) => {
        (root as HTMLElement).style.setProperty("--purchase-ink", "#243b53");
        (root as HTMLElement).style.setProperty("--purchase-link", "#604a2b");
    });
    await expect(title).toHaveCSS("color", "rgb(36, 59, 83)");
    await expect(page.getByRole("button", { name: "Mark all as read" }))
        .toHaveCSS("color", "rgb(96, 74, 43)");
});

for (const width of [1440, 768, 700, 390]) {
    test(`compare tokens and states at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?scenario=compare-error");
        await expect(page.getByRole("alert")).toContainText("couldn’t load your selection");
        const retry = page.getByRole("button", { name: "Try again" });
        await retry.focus();
        await expect(retry).toHaveCSS("outline-style", "solid");
        await page.keyboard.press("Enter");
        await expect(page.getByRole("region", { name: "Selected products" })).toBeVisible();
        await expect(page.getByTestId("product-card-price").first()).toHaveText("$45.00");
        // Inject a theme change to prove the production price/cards use shared tokens.
        await page.locator("main").evaluate((root) => {
            (root as HTMLElement).style.setProperty("--purchase-link", "#604a2b");
            (root as HTMLElement).style.setProperty("--purchase-panel", "#fffdf7");
        });
        await expect(page.getByTestId("product-card-price").first()).toHaveCSS("color", "rgb(96, 74, 43)");
        await expect(page.locator("article").first()).toHaveCSS("background-color", "rgb(255, 253, 247)");
        await page.locator("main").evaluate((root) => (root as HTMLElement).removeAttribute("style"));
        const scroller = page.getByRole("region", { name: "Selected products" });
        await scroller.focus();
        await expect(scroller).toHaveCSS("outline-style", "solid");
        if (width === 390) {
            await page.keyboard.press("ArrowRight");
            await expect.poll(() => scroller.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
        }
        await accessible(page);
        await page.screenshot({ path: info.outputPath(`compare-p2-${width}.png`), fullPage: true });
        await page.getByRole("button", { name: "Remove from compare" }).first().click();
        await expect(page.getByText("3 of 4 selected")).toBeVisible();
        await page.getByRole("button", { name: "Clear all" }).click();
        await expect(page.getByTestId("compare-empty")).toBeVisible();
        await accessible(page);
        await page.goto("/?scenario=compare-unavailable");
        await expect(page.getByRole("status")).toContainText("no longer available");
        await accessible(page);
        await page.goto("/?scenario=compare-pending");
        await expect(page.getByRole("status")).toContainText("Loading your selection");
        await accessible(page);
    });
}

async function pageTargets(page: Page, label: string) {
    const navigation = page.getByRole("navigation", { name: label });
    await expect(navigation).toBeVisible();
    const links = navigation.getByRole("link");
    for (const link of await links.all()) {
        const box = await link.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
    }
}
for (const width of [1440, 768, 480, 390]) {
    test(`wishlist tokens and pagination at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?scenario=wishlist&page=2");
        await pageTargets(page, "Wishlist pagination");
        await expect(page.getByRole("link", { name: "Page 2", exact: true })).toHaveAttribute("aria-current", "page");
        await expect(page.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/profile/wishlist/3");
        await page.locator("#root > div").evaluate(root => (root as HTMLElement).style.setProperty("--purchase-link", "#604a2b"));
        await expect(page.getByRole("link", { name: "The collection" })).toHaveCSS("color", "rgb(96, 74, 43)");
        await page.locator("#root > div").evaluate(root => (root as HTMLElement).style.removeProperty("--purchase-link"));
        const current = page.getByRole("link", { name: "Page 2", exact: true });
        await current.focus();
        await expect(current).toHaveCSS("outline-style", "solid");
        await accessible(page);
        await page.screenshot({ path: info.outputPath(`wishlist-p2-${width}.png`), fullPage: true });
        await page.getByRole("link", { name: "Next" }).click();
        await expect(page.getByRole("link", { name: "Page 3", exact: true })).toHaveAttribute("aria-current", "page");
        await page.goBack();
        await expect(page.getByRole("link", { name: "Page 2", exact: true })).toHaveAttribute("aria-current", "page");
        await page.goto("/?scenario=wishlist-empty");
        await expect(page.getByRole("heading", { name: "Your wishlist is empty." })).toBeVisible();
        await accessible(page);
        await page.goto("/?scenario=wishlist-error&page=2");
        await expect(page.getByRole("alert")).toContainText("Your wishlist is unavailable");
        await expect(page.getByRole("link", { name: "Reload wishlist" })).toHaveAttribute("href", "/profile/wishlist/2");
        await accessible(page);
        await page.goto("/?scenario=wishlist-pending");
        await expect(page.getByRole("status")).toContainText("Loading");
        await accessible(page);
    });
}

for (const width of [1440, 768, 480, 390]) {
    test(`following tokens and pagination at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?scenario=following&page=2");
        await pageTargets(page, "Followed stores pagination");
        await page.locator("main").evaluate(root => {
            (root as HTMLElement).style.setProperty("--purchase-panel", "#fffdf7");
            (root as HTMLElement).style.setProperty("--purchase-link", "#604a2b");
        });
        await expect(page.locator("article")).toHaveCSS("background-color", "rgb(255, 253, 247)");
        await expect(page.getByRole("link", { name: "Browse the collection" })).toHaveCSS("color", "rgb(96, 74, 43)");
        await page.locator("main").evaluate(root => {
            (root as HTMLElement).style.removeProperty("--purchase-panel");
            (root as HTMLElement).style.removeProperty("--purchase-link");
        });
        await page.getByRole("link", { name: "Page 2", exact: true }).focus();
        await expect(page.getByRole("link", { name: "Page 2", exact: true })).toHaveCSS("outline-style", "solid");
        await accessible(page);
        await page.screenshot({ path: info.outputPath(`following-p2-${width}.png`), fullPage: true });
    });
}

for (const width of [1440, 768, 480, 390]) {
    test(`history tokens and states at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?scenario=history-error&page=2");
        await expect(page.getByRole("alert")).toBeVisible();
        await page.locator("main").evaluate(root => {
            (root as HTMLElement).style.setProperty("--purchase-panel", "#fffdf7");
            (root as HTMLElement).style.setProperty("--purchase-muted", "#47594b");
        });
        await expect(page.getByRole("alert")).toHaveCSS("background-color", "rgb(255, 253, 247)");
        await page.locator("main").evaluate(root => {
            (root as HTMLElement).style.removeProperty("--purchase-panel");
            (root as HTMLElement).style.removeProperty("--purchase-muted");
        });
        const retry = page.getByRole("button", { name: "Try again" });
        await retry.focus();
        await expect(retry).toHaveCSS("outline-style", "solid");
        await page.keyboard.press("Enter");
        await pageTargets(page, "View history pagination");
        await expect(page.getByRole("link", { name: "Page 2", exact: true })).toHaveAttribute("aria-current", "page");
        await accessible(page);
        await page.screenshot({ path: info.outputPath(`history-p2-${width}.png`), fullPage: true });
        await page.goto("/?scenario=history-pending");
        await expect(page.getByRole("status")).toContainText("Loading recently viewed pieces");
        await page.locator("main").evaluate(root => (root as HTMLElement).style.setProperty("--purchase-muted", "#47594b"));
        await expect(page.getByRole("status")).toHaveCSS("color", "rgb(71, 89, 75)");
        await accessible(page);
        await page.goto("/?scenario=history-empty");
        await expect(page.getByRole("heading", { name: "No recently viewed pieces." })).toBeVisible();
        await accessible(page);
    });
}

for (const width of [1440, 768, 390]) {
    test(`notification refined states at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?scenario=notifications-retry");
        await page.locator("#root > div").evaluate(root => (root as HTMLElement).style.setProperty("--purchase-panel", "#fffdf7"));
        await expect(page.getByRole("list")).toHaveCSS("background-color", "rgb(255, 253, 247)");
        await page.locator("#root > div").evaluate(root => (root as HTMLElement).style.removeProperty("--purchase-panel"));
        const button = page.getByRole("button", {name: "Mark all as read"});
        await button.focus();
        await page.keyboard.press("Enter");
        await expect(button).toBeDisabled();
        await expect(button).toHaveAttribute("aria-busy", "true");
        await expect(page.getByRole("status")).toContainText("Updating notifications…");
        await expect(page.getByRole("alert")).toBeVisible();
        await expect(page.getByText("Unread", {exact: true})).toHaveCount(2);
        await button.click();
        await expect(page.getByRole("status")).toHaveText("Notifications marked as read.");
        await expect(page.getByText("Read", {exact: true})).toHaveCount(3);
        await accessible(page);
        await page.screenshot({path: info.outputPath(`notifications-p2-${width}.png`), fullPage: true});
        await page.goto("/?scenario=notifications-nolink");
        const markOne = page.getByRole("button", {name: /Your items were delivered/});
        await markOne.focus();
        await expect(markOne).toHaveCSS("outline-style", "solid");
        await page.keyboard.press("Enter");
        await expect(markOne).toHaveCount(0);
        await expect(page.getByText("Unread", {exact: true})).toHaveCount(1);
        await accessible(page);
        await page.goto("/?scenario=notifications-empty-cursor");
        await expect(page.getByText("No notifications yet.")).toBeVisible();
        const older = page.getByRole("link", {name: "Older notifications"});
        await expect(older).toHaveAttribute("href", "/profile/notifications?cursor=n3");
        await older.focus();
        await expect(older).toHaveCSS("outline-style", "solid");
        await accessible(page);
        await page.goto("/?scenario=notifications-fetch-error");
        await expect(page.getByRole("heading", {name: "Notifications", level: 1})).toBeVisible();
        await expect(page.getByRole("alert")).toBeVisible();
        await expect(page.getByRole("link", {name: "Reload notifications"})).toHaveAttribute("href", "/profile/notifications?cursor=12345678-1234-1234-1234-123456789abc");
        await accessible(page);
    });
}

// P2 support eight: actual page bodies and mock actions, no external submissions.
import { expectSupportTokens, supportAccessible, supportTargets } from "./support-eight-assertions";

test("support-eight foundation opt-in inherits tokens and leaves default caller unchanged", async ({page}) => {
    await page.goto("/?scenario=support-frame");
    await expectSupportTokens(page, "section");
    await supportTargets(page);
    await supportAccessible(page);
    await page.goto("/?scenario=support-frame-default");
    await expect(page.getByRole("main")).toHaveCSS("background-color", "rgb(243, 240, 232)");
    await expect(page.getByRole("main").locator("section")).toHaveCSS("background-color", "rgb(250, 248, 242)");
});

for (const width of [1440, 768, 390]) {
    for (const [scenario, surface] of [
        ["support-track-retry", "section[aria-labelledby='tracking-form-title']"],
        ["support-hub", ""],
        ["support-returns-retry", "section[aria-labelledby='returns-form-title']"],
        ["support-dispute-retry", "section"],
        ["support-problem-retry", "section"],
        ["support-offers", "a[href^='/browse?offer=']"],
    ]) {
        test(`support-eight ${scenario} ${width}: tokens, keyboard and states`, async ({page}, info) => {
            await page.setViewportSize({width, height:1000});
            await page.goto(`/?scenario=${scenario}`);
            await expect(page.getByRole("heading", {level:1})).toHaveCSS("font-family", /Georgia/);
            if (scenario === "support-returns-retry") {
                for (const number of await page.locator("section[aria-labelledby='returns-policy-title'] li > span").all()) {
                    expect(await number.evaluate(element => {
                        const range = document.createRange();
                        range.selectNodeContents(element);
                        return range.getClientRects().length;
                    })).toBe(1);
                }
            }
            await expectSupportTokens(page, surface);
            await supportTargets(page);
            const home = page.getByRole("navigation", {name:"Breadcrumb"}).getByRole("link", {name:"Home"});
            await home.focus();
            await expectReadableFocus(home);
            await supportAccessible(page);
            if (scenario === "support-hub") {
                const menu = page.getByRole("navigation", {name:"サポートメニュー"});
                await expect(menu.getByRole("link")).toHaveCount(5);
                const contact = menu.getByRole("link").first();
                await contact.hover();
                await expect(contact).toHaveCSS("background-color", "rgb(236, 231, 218)");
                await contact.focus();
                await expectReadableFocus(contact);
            } else if (scenario.startsWith("support-track")) {
                await page.getByLabel("注文番号", {exact:true}).fill("order-001");
                await page.getByLabel("メールアドレス").fill("owner@example.com");
                const submit = page.locator("form button[type=submit]");
                await submit.focus();
                await page.keyboard.press("Enter");
                await expect(submit).toBeDisabled();
                await expect(page.getByLabel("注文番号", {exact:true})).toBeDisabled();
                await supportAccessible(page);
                await expect(page.getByRole("status")).toContainText("注文の照会に失敗しました。");
                await expect(page.getByLabel("注文番号", {exact:true})).toHaveValue("order-001");
                await submit.click();
                const result = page.getByRole("region", {name:"注文追跡の結果"});
                await expect(result).toBeVisible();
                await expect(result.locator('[data-appearance="store"]')).toHaveCount(3);
                await supportAccessible(page);
                await page.goto("/?scenario=support-track-missing");
                await page.getByLabel("注文番号", {exact:true}).fill("unknown-order");
                await page.getByLabel("メールアドレス").fill("owner@example.com");
                await page.getByRole("button", {name:"追跡する"}).click();
                await expect(page.getByText("注文が見つかりませんでした。")).toBeVisible();
            } else if (!scenario.startsWith("support-offers")) {
                const submit = page.locator("form button[type=submit]");
                await submit.click();
                await expect(page.getByText("お名前を入力してください。")).toBeVisible();
                for (const [name, value] of [["お名前","Test Customer"],["メールアドレス","customer@example.test"],["件名","Test request"],["内容","Test details"]]) await page.getByLabel(name, {exact:true}).fill(value);
                const order = page.getByLabel("対象の注文番号", {exact:true});
                if (scenario.startsWith("support-problem")) await expect(order).toHaveCount(0);
                else {
                    await order.fill("invalid");
                    await submit.click();
                    await expect(page.getByText("有効な注文番号を入力してください。")).toBeVisible();
                    await order.fill("123e4567-e89b-12d3-a456-426614174000");
                }
                await submit.focus();
                await page.keyboard.press("Enter");
                await expect(page.getByRole("button", {name:"送信中…"})).toBeDisabled();
                await expect(page.getByLabel("内容", {exact:true})).toBeDisabled();
                await supportAccessible(page);
                await expect(page.getByRole("alert")).toBeVisible();
                await expect(page.getByLabel("内容", {exact:true})).toHaveValue("Test details");
                await submit.click();
                await expect(page.getByRole("status")).toContainText("受け付けました。");
                await expect(page.getByRole("status")).toHaveCSS("background-color", "rgb(228, 238, 229)");
            } else {
                const offer = page.getByRole("link", {name:/beautiful offer/});
                await expect(offer).toHaveAttribute("href", "/browse?offer=spring");
                await expect(offer).toContainText("2 商品");
                for (const state of ["empty", "error", "loading"]) {
                    await page.goto(`/?scenario=support-offers-${state}`);
                    await expect(page.getByRole("heading", {level:1})).toBeVisible();
                    await expectSupportTokens(page, state === "loading" ? "" : "section");
                    if (state === "loading") await expect(page.getByRole("status")).toHaveText("Loading offers…");
                    else await expect(page.getByRole(state === "error" ? "alert" : "region")).toBeVisible();
                    await supportAccessible(page);
                }
            }
            await supportAccessible(page);
            await page.screenshot({path:info.outputPath(`support-eight-${scenario}-${width}.png`),fullPage:true});
        });
    }
}


for (const width of [1440, 768, 390]) {
    test(`storefront eight following ${width}: store link and focus`, async ({page}, info) => {
        await page.setViewportSize({width, height:1000});
        await page.goto("/?scenario=following-error&page=2");
        await storefrontControls(page.locator("main article a, main article button"));
        await storefrontControls(page.getByRole("navigation", {name:"Followed stores pagination"}).getByRole("link"));
        const name = page.locator("article h2 a");
        await name.hover();
        await expect(name).toHaveCSS("color", "rgb(117, 97, 59)");
        await accessible(page);
        await page.screenshot({path:info.outputPath(`storefront-following-${width}.png`), fullPage:true});
    });
}

for (const width of [1440, 768, 390]) {
    test(`storefront eight history ${width}: retry hover and keyboard`, async ({page}, info) => {
        await page.setViewportSize({width, height:1000});
        await page.goto("/?scenario=history-error&page=2");
        const retry = page.getByRole("button", {name:"Try again"});
        await storefrontControls(retry);
        await retry.hover();
        await expect(retry).toHaveCSS("background-color", "rgb(33, 56, 42)");
        await retry.focus();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("navigation", {name:"View history pagination"})).toBeVisible();
        await storefrontControls(page.getByRole("navigation", {name:"View history pagination"}).getByRole("link"));
        await accessible(page);
        await page.screenshot({path:info.outputPath(`storefront-history-${width}.png`), fullPage:true});
    });
}

for (const width of [1440, 768, 390]) {
    test(`storefront eight contact ${width}: tokens targets and anchors`, async ({page}, info) => {
        await page.setViewportSize({width,height:1000});
        await page.goto("/?scenario=storefront-contact");
        const main = page.getByRole("main");
        await storefrontToken(main,"--purchase-page","background-color","rgb(241, 238, 228)");
        await storefrontControls(main.locator("a, button, input, textarea"));
        for (const link of await main.locator('a[href^="#"]').all()) {
            await link.focus();
            const href = await link.getAttribute("href");
            await page.keyboard.press("Enter");
            await expect(page).toHaveURL(url => url.hash === href);
            await expect(page.locator(href!)).toBeInViewport();
        }
        await accessible(page);
        await page.screenshot({path:info.outputPath(`storefront-contact-${width}.png`),fullPage:true});
    });
}

for (const width of [1440, 768, 390]) {
    test(`storefront eight contact ${width}: validation pending retry receipt`, async ({page}) => {
        await page.setViewportSize({width,height:1000});
        await page.goto("/?scenario=storefront-contact-retry");
        const submit = page.getByRole("button", {name:"Send message ↗"});
        await submit.click();
        await expect(page.getByText("お名前を入力してください。")).toBeVisible();
        for (const [label,value] of [["お名前","Test"],["メールアドレス","test@example.com"],["件名","Test request"],["内容","Test details"]]) {
            await page.getByLabel(label,{exact:true}).fill(value);
        }
        for (const input of await page.getByRole("textbox").all()) await expectReadableBorder(input);
        await submit.click();
        await expect(page.getByRole("button", {name:"送信中…"})).toBeDisabled();
        for (const input of await page.getByRole("textbox").all()) await expect(input).toBeDisabled();
        await expect(page.getByRole("alert")).toContainText("Request failed");
        await expect(page.getByLabel("内容",{exact:true})).toHaveValue("Test details");
        await accessible(page);
        await page.getByRole("button", {name:"Send message ↗"}).click();
        await expect(page.getByRole("status")).toContainText("受け付けました。");
        await accessible(page);
    });
}
