import { expect, test, type Locator } from "@playwright/test";
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";
import { buildE2ESeed } from "./seed/constants";
import { signInWithPassword } from "./helpers/auth";
import {
    gotoStable,
    setupE2ETestState,
    waitForCartPersist,
} from "@/config/test-helpers";

const prisma = new PrismaClient();

/**
 * 表示済みの金額文字列を **セント整数** に正規化する。
 *
 * 金額規約（`.claude/steering/tech.md`）の唯一の例外である
 * 「E2E の表示文字列検算」に該当する。DOM に届く値はサーバー側で `.toFixed(2)` 済みの
 * 終端表示であり、失われた精度は `Prisma.Decimal` を被せても戻らない。パース時に
 * 1 度だけ丸めて整数化すれば、以降の加減算は厳密になり許容誤差が不要になる。
 *
 * fail-fast の要件:
 * - `$` トークンは 1 つに固定する。`match` は最初の一致を返すため、個数を固定しないと
 *   不正なトークン（`"$1,23.45 $12.34"` の 1 つ目）を読み飛ばして後続の正常値を返す。
 * - 整数部は「カンマ無し」と「1〜3 桁始まりのカンマ形式」を分けて表す。
 *   `[0-9]+(?:,[0-9]{3})*` だと `$1234,567.89` のような不正な桁区切りを受理する。
 * - 末尾境界は `(?![\w.,])`。`(?![0-9])` では `$12.34.56` / `$12.34abc` を
 *   静かに `1234` と読んでしまう。`Total: $12.34 USD` 等は許容される。
 */
const parseMoneyToCents = (text: string): number => {
    const tokenCount = (text.match(/\$/g) ?? []).length;
    if (tokenCount !== 1) {
        throw new Error(`金額トークンが 1 つではありません: ${text}`);
    }
    const matched = text.match(
        /\$\s*((?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})*)\.[0-9]{2})(?![\w.,])/
    );
    if (!matched) throw new Error(`金額を抽出できません: ${text}`);
    return Math.round(Number(matched[1].replace(/,/g, "")) * 100); // 丸めはここ 1 回だけ
};

/** locator のテキストをセント整数で取り出す */
const readMoneyCents = async (locator: Locator): Promise<number> =>
    parseMoneyToCents((await locator.innerText()).trim());

const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const clerk = clerkSecretKey
    ? createClerkClient({ secretKey: clerkSecretKey })
    : null;

test.describe.serial("PLATFORM クーポン購入フロー", () => {
    let seed: ReturnType<typeof buildE2ESeed>;
    let userEmail: string;
    let userPassword: string;
    let clerkUserId: string;

    test.setTimeout(120000); // Allow Next.js compiler more time in dev

    test.beforeAll(async ({}, testInfo) => {
        if (!clerk) {
            throw new Error("CLERK_SECRET_KEY is not set. Cannot run this test.");
        }

        seed = buildE2ESeed({
            parallelIndex: testInfo.parallelIndex,
            projectName: testInfo.project.name,
        });

        const country = await prisma.country.findUnique({
            where: { code: seed.country.code },
        });
        if (!country) {
            throw new Error(
                `Country not seeded for code ${seed.country.code}. Run \`bun run seed:e2e\` before this test.`
            );
        }

        const uniqueId = Date.now();
        userEmail = `e2e-platform-coupon-${uniqueId}+clerk_test@example.com`;
        userPassword = `TestP@ssw0rd!${uniqueId}`;

        const clerkUser = await clerk.users.createUser({
            emailAddress: [userEmail],
            username: `e2eplatformcoupon${uniqueId}`,
            password: userPassword,
            skipPasswordChecks: true,
        });
        clerkUserId = clerkUser.id;

        await prisma.user.upsert({
            where: { id: clerkUserId },
            update: {
                email: userEmail,
                name: "E2E Platform Coupon Customer",
                picture: "/assets/images/default-user.jpg",
            },
            create: {
                id: clerkUserId,
                email: userEmail,
                name: "E2E Platform Coupon Customer",
                picture: "/assets/images/default-user.jpg",
            },
        });

        // チェックアウトの住所選択 UI は別関心事のため、デフォルト住所は直接 DB に投入する
        await prisma.shippingAddress.create({
            data: {
                firstName: "E2E",
                lastName: "Customer",
                phone: "1234567890",
                address1: "123 Test St",
                state: "CA",
                city: "Test City",
                zip_code: "90210",
                default: true,
                userId: clerkUserId,
                countryId: country.id,
            },
        });
    });

    test.afterAll(async () => {
        if (clerkUserId) {
            // ShippingAddress 削除 → Order/OrderGroup/OrderItem へカスケード
            await prisma.shippingAddress
                .deleteMany({ where: { userId: clerkUserId } })
                .catch(() => {});
            // User 削除 → Cart へカスケード
            await prisma.user.delete({ where: { id: clerkUserId } }).catch(() => {});
        }
        if (clerk && clerkUserId) {
            await clerk.users.deleteUser(clerkUserId).catch(() => {});
        }
        await prisma.$disconnect();
    });

    test("複数ストアの商品を PLATFORM クーポン適用後に注文すると全 OrderGroup に割引が反映される", async ({
        page,
    }) => {
        await setupE2ETestState(page, seed);

        // Sign in as the pre-created Clerk test user
        // （テストトークン注入と Clerk ウィジェット操作は共有ヘルパーが行う）
        await signInWithPassword(page, userEmail, userPassword);

        // Store A の商品をカートに追加（遅延リダイレクト割り込み時は再試行）。
        //
        // サインイン直後に `waitForPostSignInSettle` を挟まないこと。挟むと後続の
        // 商品ページ goto がリクエストを発行しないままハングし、per-goto 予算 ×
        // リトライ回数を丸ごと消費する（実測: 本 spec が 3 回連続で 2 分 timeout。
        // 同時刻にシェルから同 URL を curl すると 0.5〜1.5s で 200 が返りサーバーは健全）。
        // これは run-local.sh ヘッダーと plan 042 実行記録が「重い注文フローの
        // 間欠ハング」として記録していた症状の正体。settle を外すと同一フローが
        // 10.9s で完走する（settle を使わない a11y/checkout.spec.ts と同じ形）。
        await gotoStable(page, `/product/${seed.product.slug}/${seed.variant.slug}`);
        await page.locator('[data-testid^="size-option-"]').first().click();
        await page.waitForURL(/.*\?size=.*/, { timeout: 5000 });
        await page.getByTestId("add-to-cart").click();
        await expect(page.getByText(/Product added to cart/i)).toBeVisible({
            timeout: 5000,
        });
        await waitForCartPersist(page);

        // Store B の商品をカートに追加（別ストア商品で別行になる）
        await page.goto(`/product/${seed.productB.slug}/${seed.variantB.slug}`);
        await page.locator('[data-testid^="size-option-"]').first().click();
        await page.waitForURL(/.*\?size=.*/, { timeout: 5000 });
        await page.getByTestId("add-to-cart").click();
        await expect(page.getByText(/Product added to cart/i)).toBeVisible({
            timeout: 5000,
        });
        await waitForCartPersist(page);

        await page.goto("/cart", { waitUntil: "commit" });
        await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
        await expect(page.getByTestId("cart-item-name")).toHaveCount(2);

        // チェックアウトへ（saveUserCart で DB Cart に同期される）
        // 遷移はサーバーアクション完了後に起きる。Firefox で 10s を超える実測が
        // あったため 30s とる（待ち時間の予算であって検証内容の緩和ではない）。
        await page.getByTestId("checkout").click();
        await page.waitForURL(/\/checkout/, { timeout: 30000 });

        // PLATFORM クーポンを適用
        await page.getByPlaceholder("Coupon code").fill(seed.platformCoupon.code);
        await page.getByRole("button", { name: "Apply" }).click();
        await expect(page.getByText("Coupon applied !")).toBeVisible({
            timeout: 10000,
        });
        await expect(page.locator("p", { hasText: "全店舗" })).toBeVisible();

        // デフォルト住所が自動選択された状態で注文確定
        await page.getByRole("button", { name: "Place order" }).click();
        await page.waitForURL(/\/order\//, { timeout: 15000 });

        // 両ストアの OrderGroup が存在し、それぞれにクーポン割引が反映されていることを確認
        await expect(page.locator("p", { hasText: "Order Id:" })).toHaveCount(2);
        const couponRows = page.locator("p", {
            hasText: `Coupon (${seed.platformCoupon.code})`,
        });
        await expect(couponRows).toHaveCount(2);

        // --- 金額明細の検証（TESTS-31）---------------------------------------
        // 表示金額はハードコードせず、(1) 明細行の構造 (2) グループ内の算術不変条件
        // (3) 全体合計との一致 を検証する。比較はセント整数の完全一致（許容誤差なし）。

        // (1) 構造: グループ毎の明細行が 2 グループ分そろっている
        const subtotalRows = page.locator("p", { hasText: "Subtotal:" });
        const shippingRows = page.locator("p", { hasText: "Shipping Fees:" });
        const totalRows = page.locator("p", { hasText: "Total price:" });
        await expect(subtotalRows).toHaveCount(2);
        await expect(shippingRows).toHaveCount(2);
        await expect(totalRows).toHaveCount(2);

        // (2) グループ内検算: subtotal + shipping - discount === total
        // 行は DOM 順（= グループ順）に並ぶため nth(i) 同士が同一グループに対応する。
        const groupTotalsCents: number[] = [];
        for (let i = 0; i < 2; i++) {
            const subtotalCents = await readMoneyCents(subtotalRows.nth(i));
            const shippingCents = await readMoneyCents(shippingRows.nth(i));
            const discountCents = await readMoneyCents(couponRows.nth(i));
            const totalCents = await readMoneyCents(totalRows.nth(i));

            expect(subtotalCents + shippingCents - discountCents).toBe(
                totalCents
            );
            groupTotalsCents.push(totalCents);
        }

        // (3) 全体合計カード（cards/order/total.tsx）。
        // 決済待ちの注文では左カラムと支払いカラムの 2 箇所に描画されるため first() を使う。
        // 値の p は金額列のみが `$` を含むので、ラベル列と機械的に分離できる。
        const totalCard = page.getByTestId("order-total").first();
        const totalCardAmounts = totalCard.locator("p").filter({ hasText: "$" });
        // Subtotal / Shipping Fee / Taxes / Total の 4 行
        await expect(totalCardAmounts).toHaveCount(4);

        const orderSubtotalCents = await readMoneyCents(
            totalCardAmounts.nth(0)
        );
        const orderShippingCents = await readMoneyCents(
            totalCardAmounts.nth(1)
        );
        const orderTotalCents = await readMoneyCents(totalCardAmounts.nth(3));

        expect(orderSubtotalCents + orderShippingCents).toBe(orderTotalCents);
        expect(groupTotalsCents[0] + groupTotalsCents[1]).toBe(orderTotalCents);

        // (4) 支払い領域の存在（決済プロバイダ非依存のコンテナ testid）。実決済はしない。
        await expect(page.getByTestId("order-payment")).toBeVisible();
    });
});
