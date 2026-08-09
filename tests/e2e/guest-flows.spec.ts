import { expect, test } from "@playwright/test";
import { buildE2ESeed } from "./seed/constants";
import { setupE2ETestState } from "@/config/test-helpers";

/**
 * ゲスト導線（認証不要）の E2E — plan 045 / TESTS-33。
 *
 * compare（Zustand 永続化）・track-order（公開照会フォーム）・offers（一覧 → /browse 誘導）・
 * 静的ページの表示を固定する。すべてサインイン不要のため、認証系 E2E の状態に依存しない。
 *
 * 注意（このリポジトリの規約）:
 * - seed 値は buildE2ESeed から取得し、slug / オファー URL をテストへ literal で埋め込まない
 *   （ワーカー毎サフィックスが付くため）。
 * - 商品カードのアクションボタンは testid を持つ <Link> の *外側*（group-hover オーバーレイ内）に
 *   あるため、カード単位のスコープは group コンテナで取る（下の compare テスト参照）。
 */

/** 正規表現に埋め込む前にメタ文字をエスケープする。 */
const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 静的ページの表示契約。
 * status と見出し文言の *両方* を assert する:
 * - status だけでは「200 だが中身が空 / 別ページ」を検出できない。
 * - 見出しの存在だけでは 404 を検出できない（Next.js の not-found にも main + heading がある）。
 * - 任意の heading（.first()）ではページの取り違えに気付けない（3 ページとも同じ構造のため）。
 * 実装側の文言を変更したときは本表も同時に更新すること。
 */
const STATIC_PAGES = [
    { path: "/about", heading: "About" },
    { path: "/contact", heading: "Contact us" },
    { path: "/customer-service", heading: "Customer service" },
] as const;

test.describe("ゲスト導線（compare / track-order / offers / 静的ページ）", () => {
    let seed: ReturnType<typeof buildE2ESeed>;

    test.beforeEach(async ({ page }, testInfo) => {
        seed = buildE2ESeed({
            parallelIndex: testInfo.parallelIndex,
            projectName: testInfo.project.name,
        });
        await setupE2ETestState(page, seed);
    });

    test("compare: 比較リストが空のとき空状態メッセージを表示する", async ({
        page,
    }) => {
        await page.goto("/compare");

        await expect(page.getByTestId("compare-empty")).toBeVisible();
    });

    test("compare: /browse から追加 → /compare に表示 → Clear all で空状態へ戻る", async ({
        page,
    }) => {
        await page.goto("/browse");

        // testid は <Link> に付いており、アクションボタンはその外側の
        // group-hover オーバーレイ内にある。カードのスコープは group コンテナで取る。
        const cardLink = page.getByTestId(`product-card-${seed.product.slug}`);
        await expect(cardLink).toBeVisible();
        const card = page.locator("div.group").filter({ has: cardLink });

        // オーバーレイは hover で初めて表示される。
        await cardLink.hover();
        const compareButton = card.getByRole("button", {
            name: "Add to compare",
        });
        await compareButton.click();

        // トグル済みであることを状態で確認する（toast は消えるためフレーク源になりやすい）。
        await expect(
            card.getByRole("button", { name: "Remove from compare" })
        ).toHaveAttribute("aria-pressed", "true");

        await page.goto("/compare");
        await expect(page.getByTestId("compare-empty")).toHaveCount(0);
        // 比較リストに入っているのは 1 件だけ = 重複描画も検出する。
        await expect(page.getByText(seed.product.name)).toHaveCount(1);

        await page.getByRole("button", { name: "Clear all" }).click();
        await expect(page.getByTestId("compare-empty")).toBeVisible();
    });

    test("track-order: 存在しない注文番号では not-found メッセージを表示する", async ({
        page,
    }) => {
        await page.goto("/track-order");

        await page.getByPlaceholder("注文番号").fill("nonexistent-order-id");
        await page
            .getByPlaceholder("メールアドレス")
            .fill("guest-e2e@example.com");
        await page.getByRole("button", { name: "追跡する" }).click();

        await expect(
            page.getByText("注文が見つかりませんでした。")
        ).toBeVisible();
    });

    test("track-order: 不正なメールアドレスはバリデーションで弾かれる", async ({
        page,
    }) => {
        await page.goto("/track-order");

        await page.getByPlaceholder("注文番号").fill("nonexistent-order-id");
        await page.getByPlaceholder("メールアドレス").fill("not-an-email");
        await page.getByRole("button", { name: "追跡する" }).click();

        await expect(
            page.getByText("有効なメールアドレスを入力してください。")
        ).toBeVisible();
        // 送信自体が行われないため、not-found メッセージは出ない。
        await expect(
            page.getByText("注文が見つかりませんでした。")
        ).toHaveCount(0);
    });

    test("offers: シードのオファーが一覧に出て /browse?offer= へ誘導する", async ({
        page,
    }) => {
        await page.goto("/offers");

        // オファー名は全ワーカー共通（url だけがサフィックス付き）なので、
        // 一意な href でスコープしてから見出し文言を検証する。
        const offerLink = page.locator(
            `a[href="/browse?offer=${seed.offerTag.url}"]`
        );
        await expect(
            offerLink.getByRole("heading", { name: seed.offerTag.name })
        ).toBeVisible();

        await offerLink.click();
        await page.waitForURL(
            new RegExp(`/browse\\?offer=${escapeRegExp(seed.offerTag.url)}`)
        );
    });

    test("静的ページ: about / contact / customer-service が 200 で固有の見出しを描画する", async ({
        page,
    }) => {
        for (const { path, heading } of STATIC_PAGES) {
            const response = await page.goto(path);

            expect(response?.status(), `${path} should return 200`).toBe(200);
            await expect(
                page
                    .getByRole("main")
                    .getByRole("heading", { name: heading, level: 1 })
            ).toBeVisible();
        }
    });
});
