import { expect, test } from "@playwright/test";
import { createCustomerSession, requiresClerkAdmin } from "./helpers/auth";
import { buildE2ESeed } from "./seed/constants";
import { gotoStable, setupE2ETestState } from "@/config/test-helpers";

/**
 * 顧客エンゲージメント導線の E2E（plan 048 / TESTS-34+35+36）。
 *
 * ウィッシュリスト・ストアフォロー・レビュー投稿はいずれも UI・server action・
 * 専用プロフィールページが実装済みなのに、「ブラウザから実 DB まで」の導線が
 * 未固定だった。リピート購入を支える主要導線としてまとめて 1 spec で押さえる。
 *
 * CLERK_SECRET_KEY 未設定の環境では自動スキップ。
 *
 * 3 テストは別リソース（wishlist / follow / review）を触り、フォローはテスト内で
 * unfollow まで戻すため相互干渉しない。リトライ時は Playwright がワーカーを破棄して
 * モジュールを再 import するため `beforeAll` が別の Clerk ユーザーを作り直す
 * （`helpers/auth.ts` の `uniqueId` はモジュールスコープ採番）。
 */
/**
 * Clerk のクライアント初期化完了を待つ。
 *
 * **StoreCard のフォロー導線ではこれが必須。** `store-card.tsx:30-31` は
 * `useUser()` の `isSignedIn` だけを見て `router.push('/sign-in')` する（しかも `return`
 * が無い）。`useUser()` は Clerk のロード完了まで `isSignedIn: false` を返すため、
 * ハイドレーション直後にクリックすると **実際にはサインイン済みでもホームへ飛ばされ、
 * フォローも成立しない**（実測: クリック後 URL が `/` になり toast も出ない。
 * `/sign-in` はサインイン済みユーザーを `/` へ跳ね返すため最終的に `/` に着く）。
 * これはアプリ側の潜在バグだが plan 048 の In scope 外なので、テスト側で待って回避する。
 */
async function waitForClerkLoaded(page: import("@playwright/test").Page) {
    await page.waitForFunction(
        () =>
            (window as unknown as { Clerk?: { loaded?: boolean } }).Clerk
                ?.loaded === true,
        undefined,
        { timeout: 20000 }
    );
}

test.describe("顧客エンゲージメント導線", () => {
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

    test("ウィッシュリストに追加すると一覧に反映される", async ({
        page,
    }, testInfo) => {
        // サインイン + 本番ビルドの SSR を含む重いフロー。既定 30s では不足する。
        test.setTimeout(90000);
        const seed = buildE2ESeed({
            parallelIndex: testInfo.parallelIndex,
            projectName: testInfo.project.name,
        });

        await session.signIn(page);
        await setupE2ETestState(page, seed);

        await gotoStable(page, `/browse?category=${seed.category.url}`);

        // カードの testid は `<Link>` に付いており、アクションボタンは
        // `group-hover:block` のオーバーレイ＝ Link の外にある（product-card.tsx:103-143）。
        // testid 配下でボタンを探しても 1 つも見つからないため、
        // group コンテナまで遡ってからボタンを取る（plan 045 が確立した形）。
        const cardLink = page.getByTestId(`product-card-${seed.product.slug}`);
        await expect(cardLink).toBeVisible({ timeout: 15000 });
        const card = page.locator("div.group").filter({ has: cardLink });

        await card.hover();
        await card
            .getByRole("button", { name: "Add to wishlist" })
            .click();

        await expect(
            page.getByText("Product successfully added to wishlist")
        ).toBeVisible({ timeout: 10000 });

        await gotoStable(page, "/profile/wishlist/1");
        await expect(
            page.getByRole("heading", { name: "Your Wishlist" })
        ).toBeVisible({ timeout: 10000 });
        await expect(
            page.getByText(seed.product.name).first()
        ).toBeVisible({ timeout: 10000 });
    });

    test("ストアをフォロー・アンフォローでき一覧に反映される", async ({
        page,
    }, testInfo) => {
        test.setTimeout(90000);
        const seed = buildE2ESeed({
            parallelIndex: testInfo.parallelIndex,
            projectName: testInfo.project.name,
        });

        await session.signIn(page);
        await setupE2ETestState(page, seed);

        const productUrl = `/product/${seed.product.slug}/${seed.variant.slug}`;
        await gotoStable(page, productUrl);
        await waitForClerkLoaded(page);

        // StoreCard は商品詳細ページに描画される。フォロー要素は button ロールではなく
        // onClick 付き div なので、テキストで取る（store-card.tsx:82-97）。
        const followControl = page.getByText("Follow", { exact: true });
        await expect(followControl).toBeVisible({ timeout: 15000 });

        // Followers 数はクリック前に読んでおき、+1 されることを確認する。
        const followersCount = page.locator("strong", {
            hasText: /^\d+$/,
        });
        const before = Number(
            (await followersCount.first().textContent())?.trim()
        );
        expect(Number.isFinite(before)).toBe(true);

        await followControl.click();

        await expect(
            page.getByText(`You are now following ${seed.store.name}`)
        ).toBeVisible({ timeout: 10000 });
        await expect(
            page.getByText("Following", { exact: true })
        ).toBeVisible();
        await expect(followersCount.first()).toHaveText(String(before + 1));

        await gotoStable(page, "/profile/following/1");
        await expect(
            page.getByText(seed.store.name).first()
        ).toBeVisible({ timeout: 10000 });

        // 商品詳細へ戻ってアンフォローし、初期状態へ復帰させる
        // （同一 spec 内の他テストと状態を奪い合わないため）。
        await gotoStable(page, productUrl);
        await waitForClerkLoaded(page);
        const followingControl = page.getByText("Following", { exact: true });
        await expect(followingControl).toBeVisible({ timeout: 15000 });
        await followingControl.click();

        await expect(
            page.getByText(`You unfollowed ${seed.store.name}`)
        ).toBeVisible({ timeout: 10000 });
        await expect(page.getByText("Follow", { exact: true })).toBeVisible();
    });

    test("レビューを投稿すると成功トーストが出て一覧に反映される", async ({
        page,
    }, testInfo) => {
        test.setTimeout(90000);
        const seed = buildE2ESeed({
            parallelIndex: testInfo.parallelIndex,
            projectName: testInfo.project.name,
        });
        // 10 文字以上（AddReviewSchema の下限）かつ一覧での照合に使える一意な本文。
        const reviewBody = `Great product, works as expected! ${Date.now()}`;

        await session.signIn(page);
        await setupE2ETestState(page, seed);

        await gotoStable(
            page,
            `/product/${seed.product.slug}/${seed.variant.slug}`
        );

        await expect(
            page.getByRole("heading", { name: "Add a review" })
        ).toBeVisible({ timeout: 15000 });

        // 星は 0..4 の index。4 をクリックして rating = 5。
        await page.getByTestId("star-wrapper-4").click();

        // size は独自 Select（focus でドロップダウンが開き、`<li>` の mousedown で確定）。
        // **`placeholder="Select size"` は quantity の <input type="number"> にも付いており
        // （review-details.tsx:375）、プレースホルダだけでは 2 要素に一致する。**
        // type で除外して size 側だけを掴む。
        const sizeSelect = page.locator(
            'input[placeholder="Select size"]:not([type="number"])'
        );
        await sizeSelect.click();
        await page
            .getByRole("listitem")
            .filter({ hasText: seed.size.size })
            .first()
            .click();
        await expect(sizeSelect).toHaveValue(seed.size.size);

        await page
            .getByPlaceholder("Write your review here...")
            .fill(reviewBody);

        await page.getByRole("button", { name: "Submit Review" }).click();

        await expect(
            page.getByText("Review added successfully.")
        ).toBeVisible({ timeout: 15000 });
        await expect(page.getByText(reviewBody).first()).toBeVisible({
            timeout: 10000,
        });
    });
});
