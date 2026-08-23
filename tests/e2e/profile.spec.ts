import { expect, test } from "@playwright/test";
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

const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const clerk = clerkSecretKey
    ? createClerkClient({ secretKey: clerkSecretKey })
    : null;

/**
 * プロフィール系 E2E（TESTS-37）: 住所管理 UI と注文履歴一覧。
 *
 * `/profile` 配下は a11y スキャン 1 本しか E2E が無かった。住所はチェックアウト成立の
 * 前提データであり、注文履歴は「注文した → 後から確認できる」という取引の基本保証で、
 * どちらもブラウザ導線でしか固定できない。
 *
 * **国リストについて（本 spec 固有の前提）**: `CountrySelector` が描画するのは
 * 静的な ISO 国リストだが、配送先として保存できるのは DB の `Country` 行だけで、
 * 両者は名前一致でしか結びつかない。E2E の seed は並列分離のため国名にサフィックスを
 * 付ける（"United States CHROMIUM-W0" 等）ので、**seed の国は選択肢に現れない**。
 * そこでテスト 1 は静的リストと一致する実国名の Country 行を自前で作り、それを選ぶ。
 * （一致しない国を選んだ場合にフォームがエラーを出すことは、component テスト
 * `tests/component/store/shipping-form.test.tsx` が固定している。）
 *
 * 構造の手本: tests/e2e/stock-decrement.spec.ts（認証付き DB バック構成・購入フロー）。
 */
test.describe.serial("プロフィール（住所管理 / 注文履歴）", () => {
    let seed: ReturnType<typeof buildE2ESeed>;
    let userEmail: string;
    let userPassword: string;
    let clerkUserId: string;
    let seedCountryId: string;
    /** 静的国リストと一致する実国名の Country 行（UI から選べる唯一の国） */
    let selectableCountryId: string;
    let selectableCountryName: string;

    test.setTimeout(120000);

    test.beforeAll(async ({}, testInfo) => {
        if (!clerk) {
            throw new Error(
                "CLERK_SECRET_KEY is not set. Cannot run this test."
            );
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
        seedCountryId = country.id;

        // UI から選べる国を用意する。code は seed 側と衝突しないよう本 spec 専用にし、
        // name は静的リストに実在する値（"United States"）にする。
        selectableCountryName = "United States";
        const selectableCode = `PS-${testInfo.project.name.slice(0, 3).toUpperCase()}`;
        const selectable = await prisma.country.upsert({
            where: { code: selectableCode },
            update: { name: selectableCountryName },
            create: { name: selectableCountryName, code: selectableCode },
        });
        selectableCountryId = selectable.id;

        const uniqueId = Date.now();
        userEmail = `e2e-profile-${uniqueId}+clerk_test@example.com`;
        userPassword = `TestP@ssw0rd!${uniqueId}`;

        const clerkUser = await clerk.users.createUser({
            emailAddress: [userEmail],
            username: `e2eprofile${uniqueId}`,
            password: userPassword,
            skipPasswordChecks: true,
        });
        clerkUserId = clerkUser.id;

        await prisma.user.upsert({
            where: { id: clerkUserId },
            update: {},
            create: {
                id: clerkUserId,
                email: userEmail,
                name: "E2E Profile Customer",
                picture: "/assets/images/default-user.jpg",
            },
        });
    });

    test.afterAll(async () => {
        let primaryError: unknown;
        try {
            if (clerkUserId) {
                // 子（住所）を先に消す。ShippingAddress.userId は RESTRICT なので、
                // 残したまま User を消そうとすると P2003 で失敗する
                // （「ユーザーを消せばカスケードで住所も消える」は誤り）。
                // 注文は住所にカスケードするため、住所の削除で一緒に片付く。
                await prisma.shippingAddress.deleteMany({
                    where: { userId: clerkUserId },
                });
                await prisma.user
                    .delete({ where: { id: clerkUserId } })
                    .catch(() => {});
            }
        } catch (error: unknown) {
            primaryError = error;
        } finally {
            // deleteMany が throw しても Clerk ユーザー削除と切断は必ず行う。
            // 直列に並べると失敗時にこれらがスキップされてリークする。
            try {
                if (clerk && clerkUserId) {
                    await clerk.users.deleteUser(clerkUserId).catch(() => {});
                }
                if (selectableCountryId) {
                    await prisma.country
                        .delete({ where: { id: selectableCountryId } })
                        .catch(() => {});
                }
            } catch (cleanupError: unknown) {
                if (primaryError === undefined) primaryError = cleanupError;
                else console.error("[afterAll] cleanup も失敗:", cleanupError);
            } finally {
                await prisma.$disconnect();
            }
        }
        if (primaryError !== undefined) throw primaryError;
    });

    test("住所をフォームから追加すると一覧に表示される", async ({
        page,
    }, testInfo) => {
        test.skip(
            testInfo.project.name === "firefox" && !process.env.CI,
            "Firefox: navigation hangs in dev mode (HMR issue)"
        );

        // Street はこの実行に固有にする。DB は実行をまたいで共有されるため、固定値だと
        // 住所が累積し、2 回目以降の「一覧に表示される」assert が strict mode violation になる。
        const uniqueStreet = `123 Profile St ${Date.now()}`;

        await setupE2ETestState(page, seed);
        await signInWithPassword(page, userEmail, userPassword);

        await gotoStable(page, "/profile/addresses");
        await page.getByText("Add new address").click();

        // 名前は英字のみ（ShippingAddressSchema の `/^[a-zA-Z]+$/`）。
        // "E2E" は数字を含むため "First name can only contain letters." で弾かれる。
        await page.getByPlaceholder("First name").fill("Profile");
        await page.getByPlaceholder("Last name").fill("Tester");
        await page.getByPlaceholder("Phone number").fill("+15550001111");
        await page
            .getByPlaceholder("Street, house/apartment/unit")
            .fill(uniqueStreet);
        await page.getByPlaceholder("City").fill("Testville");
        await page.getByPlaceholder("State/Province").fill("CA");
        await page.getByPlaceholder("Zip code").fill("90210");

        // 国はカスタムコンボボックス（native select ではない）。
        // トグルボタン → 検索 → role="option" の順に操作する。
        await page
            .getByRole("button", { name: /United States/ })
            .first()
            .click();
        await page
            .getByPlaceholder("Search a country")
            .fill(selectableCountryName);
        await page
            .getByRole("option")
            .filter({ hasText: selectableCountryName })
            .first()
            .click();

        // 送信ボタンのラベルは**新規と編集で違う**。プラン本文は
        // "Save Address information" を指定しているが、それは編集時
        // （`data?.id` あり）のラベルで、新規追加は "Create Address"。
        await page.getByRole("button", { name: /Create Address/i }).click();

        // Assert: 一覧に**その固有の Street** がちょうど 1 件現れる
        await expect(page.getByText(uniqueStreet)).toHaveCount(1, {
            timeout: 15000,
        });
    });

    test("注文が履歴に載り、詳細へ遷移できる", async ({ page }, testInfo) => {
        test.skip(
            testInfo.project.name === "firefox" && !process.env.CI,
            "Firefox: cart navigation hangs in dev mode (HMR issue)"
        );

        // テスト 1 が作った住所には依存しない。依存すると、チェックアウトの住所選択が
        // どれを拾うかが**テスト実行順に依存**し、--grep で単体実行したときに結果が変わる。
        // 自分の住所を default で作り、それが選ばれる状態にする。
        await prisma.shippingAddress.updateMany({
            where: { userId: clerkUserId },
            data: { default: false },
        });
        await prisma.shippingAddress.create({
            data: {
                firstName: "E2E",
                lastName: "Orders",
                phone: "1234567890",
                address1: "456 Orders Ave",
                state: "CA",
                city: "Test City",
                zip_code: "90210",
                default: true,
                userId: clerkUserId,
                countryId: seedCountryId,
            },
        });

        await setupE2ETestState(page, seed);
        await signInWithPassword(page, userEmail, userPassword);

        // サインイン直後に networkidle 待ちを挟まないこと（plan 047 が特定した
        // 120s ハングの真因。後続の goto がリクエストを発行しないまま固まる）。
        await gotoStable(
            page,
            `/product/${seed.product.slug}/${seed.variant.slug}`
        );
        await page.locator('[data-testid^="size-option-"]').first().click();
        await page.waitForURL(/.*\?size=.*/, { timeout: 5000 });
        await page.getByTestId("add-to-cart").click();
        await expect(page.getByText(/Product added to cart/i)).toBeVisible({
            timeout: 5000,
        });
        await waitForCartPersist(page);

        await gotoStable(page, "/cart");
        await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
        await expect(page.getByTestId("cart-item-name")).toHaveCount(1);

        await page.getByTestId("checkout").click();
        await page.waitForURL(/\/checkout/, { timeout: 10000 });
        await page.getByRole("button", { name: "Place order" }).click();
        await page.waitForURL(/\/order\//, { timeout: 15000 });

        const orderId = page.url().split("/order/")[1];
        expect(orderId).toBeTruthy();

        // Assert: 履歴の**その注文の行**から詳細へ遷移できる。
        // 行を特定せずに View を押すと、注文が複数あるときに別の注文へ飛んでも気づけない。
        await gotoStable(page, "/profile/orders");
        const row = page.locator("tr").filter({ hasText: `#${orderId}` });
        await expect(row).toHaveCount(1, { timeout: 15000 });
        await row.getByRole("link", { name: "View" }).click();
        await page.waitForURL(new RegExp(`/order/${orderId}`), {
            timeout: 15000,
        });
    });
});
