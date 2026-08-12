import { expect, test, Page } from "@playwright/test";
import { createCustomerSession, requiresClerkAdmin } from "./helpers/auth";
import { buildE2ESeed } from "./seed/constants";
import {
    gotoStable,
    setupE2ETestState,
    waitForCartPersist,
} from "@/config/test-helpers";

/**
 * ゲストカート → サインイン後の引き継ぎ E2E（plan 055 / TESTS-42）。
 *
 * 既存カバーは「未認証で Checkout → 認証エラー表示」（purchase-flow）と
 * 「最初から認証済みでカート構築」（a11y/checkout・plan 047）のみで、
 * **ゲスト→会員化の順序**を踏む導線はどの層でも検証されていなかった。
 *
 * 金額の厳密検証は意図的に行わない —— `saveUserCart` は plan 005 の correctness
 * 修正対象であり、修正が入っても壊れない「アイテムが存在する」レベルに留める。
 */

// スラグに正規表現メタ文字が混入しても URL マッチが壊れないようエスケープする
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function addItemToCart(
    page: Page,
    productSlug: string,
    variantSlug: string
) {
    await page.goto(`/product/${productSlug}/${variantSlug}`);
    await page.locator('[data-testid^="size-option-"]').first().click();
    await page.waitForURL(
        new RegExp(
            `/product/${escapeRegex(productSlug)}/${escapeRegex(variantSlug)}\\?size=`
        ),
        { timeout: 5000 }
    );
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByText(/Product added to cart/i)).toBeVisible({
        timeout: 5000,
    });
    // Zustand persist が localStorage に書き終えるのを待つ
    await waitForCartPersist(page);
}

test.describe("ゲストカートのサインイン引き継ぎ", () => {
    test.skip(
        () => requiresClerkAdmin,
        "Requires CLERK_SECRET_KEY for Clerk admin operations."
    );

    const session = createCustomerSession();

    test.beforeAll(async () => {
        await session.create({ role: "USER" });
    });

    test.afterAll(async () => {
        await session.cleanup();
    });

    test("ゲストで積んだカートがサインイン後も残り、サーバーにも保存される", async ({
        page,
        browser,
    }, testInfo) => {
        // ゲストのカート構築 + サインイン往復 + 新規コンテキストでの再サインインを
        // 直列に含むため、既定 30s では不足する。
        test.setTimeout(120000);

        const seed = buildE2ESeed({
            parallelIndex: testInfo.parallelIndex,
            projectName: testInfo.project.name,
        });
        await setupE2ETestState(page, seed);

        // 1. ゲスト状態でカートを構築する
        await addItemToCart(page, seed.product.slug, seed.variant.slug);
        await gotoStable(page, "/cart");
        await expect(
            page.getByText(seed.product.name).first()
        ).toBeVisible();
        await expect(page.getByTestId("cart-total")).toBeVisible();

        // 2. サインインする（カートは localStorage 上に残っている想定）
        await session.signIn(page);

        // 3. カートが引き継がれている
        await gotoStable(page, "/cart");
        await expect(
            page.getByText(seed.product.name).first()
        ).toBeVisible();

        // 4. Checkout でサーバー保存 → /checkout へ遷移
        //    `summary.tsx` は `saveUserCart` が成功したときだけ push するので、
        //    URL が変わったこと自体がサーバー保存の成功を意味する。
        await page.getByTestId("checkout").click();
        await page.waitForURL(/\/checkout/, { timeout: 15000 });
        await expect(
            page.getByText(seed.product.name).first()
        ).toBeVisible({ timeout: 15000 });

        // 5. サーバー往復の確認 —— **localStorage を持たない新規コンテキスト**で開く。
        //
        //    `page.reload()` では検証にならない。reload は同一コンテキストのままで
        //    localStorage が残るため、Zustand がそこから再水和して同じ商品名を描画する
        //    ——— つまり `saveUserCart` が完全に壊れて DB に 1 行も書かれていなくても
        //    green になる。「表示元がサーバーの Cart であること」を主張するには、
        //    クライアント永続を一切持たない場所から開くしかない。
        //    `storageState` の使い回しも同じ理由で不可（localStorage ごと復元される）。
        const freshContext = await browser.newContext();
        try {
            const freshPage = await freshContext.newPage();
            await setupE2ETestState(freshPage, seed);
            // 新規コンテキストなので cookie も無い。改めてサインインする。
            await session.signIn(freshPage);

            // **この assert が step 5 の前提そのもの**。「新規コンテキストだから
            // localStorage は空のはず」をコメントで主張するのではなく機械で固定する
            // —— ここが空でなければ、下の検証は再びクライアント永続を見ているだけになる。
            const persistedCart = await freshPage.evaluate(() =>
                window.localStorage.getItem("cart")
            );
            expect(persistedCart === null || persistedCart === "").toBe(true);

            await gotoStable(freshPage, "/checkout");
            await expect(
                freshPage.getByText(seed.product.name).first()
            ).toBeVisible({ timeout: 15000 });
        } finally {
            await freshContext.close();
        }
    });
});
