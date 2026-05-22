import { expect, test, Page } from "@playwright/test";
import { buildE2ESeed } from "./seed/constants";
import { setupE2ETestState, waitForCartPersist } from "@/config/test-helpers";

async function addItemToCart(
    page: Page,
    productSlug: string,
    variantSlug: string
) {
    await page.goto(`/product/${productSlug}/${variantSlug}`);

    // Select the first available size
    const firstSize = page.locator('[data-testid^="size-option-"]').first();
    await firstSize.click();

    // Wait for URL to update with size parameter
    await page.waitForURL(/.*\?size=.*/, { timeout: 5000 });

    await page.getByTestId("add-to-cart").click();
    // Zustand persist が localStorage に書き込むのを待つ
    await expect(page.getByText(/Product added to cart/i)).toBeVisible({
        timeout: 5000,
    });

    // 共通ヘルパーで localStorage 書き込み完了を待つ
    await waitForCartPersist(page);

    await page.goto("/cart", { waitUntil: "commit" });
    await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
}

test.describe("購入フルフロー", () => {
    let seed: ReturnType<typeof buildE2ESeed>;
    let productSlug: string;
    let variantSlug: string;
    let productName: string;
    let unitPrice: number;

    test.beforeEach(async ({ page }, testInfo) => {
        seed = buildE2ESeed({
            workerIndex: testInfo.workerIndex,
            projectName: testInfo.project.name,
        });
        productSlug = process.env.E2E_PRODUCT_SLUG || seed.product.slug;
        variantSlug = process.env.E2E_VARIANT_SLUG || seed.variant.slug;
        productName = process.env.E2E_PRODUCT_NAME || seed.product.name;
        // Trim and validate E2E_UNIT_PRICE before using it
        const envPrice = process.env.E2E_UNIT_PRICE?.trim();
        unitPrice = envPrice ? Number(envPrice) : seed.size.price;
        if (!Number.isFinite(unitPrice)) {
            throw new Error(
                `Invalid E2E_UNIT_PRICE: ${process.env.E2E_UNIT_PRICE}`
            );
        }

        await setupE2ETestState(page, seed);
    });

    test("商品一覧→詳細→サイズ選択→カート追加→カートページ表示と数量変更", async ({
        page,
    }, testInfo) => {
        test.skip(
            testInfo.project.name === "firefox" && !process.env.CI,
            "Firefox: cart navigation hangs in dev mode (HMR issue)"
        );
        await page.goto(`/product/${productSlug}/${variantSlug}`);

        // Select the first available size
        const firstSize = page.locator('[data-testid^="size-option-"]').first();
        await firstSize.click();

        await page.waitForURL(/.*\?size=.*/, { timeout: 5000 });
        const current = new URL(page.url());
        expect(current.pathname).toBe(`/product/${productSlug}/${variantSlug}`);
        expect(current.searchParams.has("size")).toBe(true);
        await expect(page.getByTestId("product-price")).toBeVisible();

        await page.getByTestId("add-to-cart").click();
        // カート追加成功の toast を待つ（Out of stock はテスト失敗とする）
        await expect(page.getByText(/Product added to cart/i)).toBeVisible({
            timeout: 5000,
        });

        // 共通ヘルパーで localStorage 書き込み完了を待つ
        await waitForCartPersist(page);

        await page.goto("/cart", { waitUntil: "commit" });
        await page.waitForLoadState("domcontentloaded", { timeout: 10000 });

        const itemName = page.getByTestId("cart-item-name");
        await expect(itemName).toContainText(productName);

        const qtyInput = page.getByTestId("cart-item-qty");
        await expect(qtyInput).toHaveValue("1");

        const total = page.getByTestId("cart-total");
        await expect(total).toHaveText(`$${unitPrice.toFixed(2)}`);

        // 数量増加
        await page.getByTestId("cart-qty-increase").click();
        await expect(qtyInput).toHaveValue("2");
        await expect(total).toHaveText(`$${(unitPrice * 2).toFixed(2)}`);

        // 数量減少
        await page.getByTestId("cart-qty-decrease").click();
        await expect(qtyInput).toHaveValue("1");
        await expect(total).toHaveText(`$${unitPrice.toFixed(2)}`);
    });

    test("カートからアイテムを削除できる", async ({ page }, testInfo) => {
        test.skip(
            testInfo.project.name === "firefox" && !process.env.CI,
            "Firefox: cart navigation hangs in dev mode (HMR issue)"
        );
        // Add item
        await addItemToCart(page, productSlug, variantSlug);

        const itemName = page.getByTestId("cart-item-name");
        await expect(itemName).toContainText(productName);

        // qty=1 の状態で decrease すると削除される
        await page.getByTestId("cart-qty-decrease").click();

        await expect(page.getByTestId("cart-empty-message")).toBeVisible();
        await expect(page.getByTestId("cart-item-name")).toHaveCount(0);
    });

    test("ページリロード後もカートが永続化されている", async ({
        page,
    }, testInfo) => {
        test.skip(
            testInfo.project.name === "firefox" && !process.env.CI,
            "Firefox: cart navigation hangs in dev mode (HMR issue)"
        );
        await addItemToCart(page, productSlug, variantSlug);

        await expect(page.getByTestId("cart-item-name")).toBeVisible();

        await page.reload();

        await expect(page.getByTestId("cart-item-name")).toBeVisible();
        await expect(page.getByTestId("cart-item-qty")).toHaveValue("1");
    });

    test("未認証ユーザーがチェックアウトに進むと認証エラーが表示される", async ({
        page,
    }, testInfo) => {
        test.skip(
            testInfo.project.name === "firefox" && !process.env.CI,
            "Firefox: cart navigation hangs in dev mode (HMR issue)"
        );
        await addItemToCart(page, productSlug, variantSlug);

        await page.getByTestId("checkout").click();

        // saveUserCart が未認証エラーを throw し、toast でエラー表示される
        // 注: 現在の実装では router.push("/checkout") に到達しないため sign-in リダイレクトは発生しない
        // getText は i18n や auth-message の変更に弱いため、toast の role で判断する
        await expect(page.getByRole("alert")).toBeVisible({
            timeout: 10000,
        });
    });

    test("複数バリアントをカートに追加すると別行として表示される", async ({
        page,
    }, testInfo) => {
        test.skip(
            testInfo.project.name === "firefox" && !process.env.CI,
            "Firefox: cart navigation hangs in dev mode (HMR issue)"
        );

        const [v1, v2] = seed.variants;
        expect(v2, "Second variant must be seeded for this test").toBeDefined();

        // 1つ目のバリアントを追加
        await addItemToCart(page, productSlug, v1.slug);
        await expect(page.getByTestId("cart-item-name")).toHaveCount(1);

        // 2つ目のバリアントを追加（別 SKU のため別行になるはず）
        await addItemToCart(page, productSlug, v2.slug);

        // カート行が2つ存在することを確認
        const rows = page.getByTestId("cart-item-name");
        await expect(rows).toHaveCount(2);

        // 各バリアントの価格が個別に表示されている（バリアントごとの単価表示）
        const v1Price = v1.size.price.toFixed(2);
        const v2Price = v2.size.price.toFixed(2);
        await expect(page.getByText(`$${v1Price}`).first()).toBeVisible();
        await expect(page.getByText(`$${v2Price}`).first()).toBeVisible();

        // カート合計は両バリアントの合算
        const expectedTotal = (v1.size.price + v2.size.price).toFixed(2);
        await expect(page.getByTestId("cart-total")).toHaveText(
            `$${expectedTotal}`
        );
    });
});
