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
 * **国リストについて**: profile の住所フォームは DB の Country を id で選ぶ native select なので、
 * seed が project ごとに作る国（"United States CHROMIUM-W0" 等）をそのまま選べる。
 * 実国名の行を自前で作ると `Country.name` の UNIQUE に衝突する（実国名の行がある DB、
 * および 3 project の並列実行で同名を作る場合。OI-18）。共有 CountrySelector の
 * 静的リスト/名前照合は shipping-form の component テストで確認する。
 */
test.describe.serial("プロフィール（住所管理 / 注文履歴）", () => {
    let seed: ReturnType<typeof buildE2ESeed>;
    let userEmail: string;
    let userPassword: string;
    let clerkUserId: string;
    /** seed が project ごとに作る国。住所フォームの選択肢にもそのまま現れる */
    let seedCountryId: string;

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

        // 3 プロジェクト（chromium / firefox / webkit）は並列に beforeAll へ入るため、
        // Date.now() だけでは同一ミリ秒で衝突し、Clerk 側で重複ユーザーの作成に化ける。
        // project 名と parallelIndex を混ぜて、並列実行間で必ず一意にする。
        const runSlug = `${testInfo.project.name.replace(/[^a-z0-9]/gi, "").toLowerCase()}${testInfo.parallelIndex}`;
        const uniqueId = `${Date.now()}${runSlug}`;
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
        // OI-12（[`docs/testing/QA_HANDOFF.md`](../../docs/testing/QA_HANDOFF.md) の
        // 「現在アクティブな残課題」）。ローカル dev サーバでのみ Firefox の navigation が
        // hang する。CI は本番ビルドで走るため skip されず、3 ブラウザのカバレッジは維持される。
        // 解消条件: `bun run dev` 起動下で当該テストが Firefox 連続 2 回 pass すること。
        // 見直し期限: 2026-10-31。
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
        await page.getByRole("button", { name: "Add new address" }).click();
        // ShippingAddressSchemaの英字名制約を保持。国はDB対応国のnative select。
        for (const [label, value] of [
            ["First name", "Profile"],
            ["Last name", "Tester"],
            ["Phone number", "+15550001111"],
            ["Address line 1", uniqueStreet],
            ["City", "Testville"],
            ["State / Province", "CA"],
            ["Postal code", "90210"],
        ])
            await page.getByLabel(label, { exact: true }).fill(value);
        await page
            .getByRole("combobox", { name: "Country" })
            .selectOption(seedCountryId);
        await page.getByRole("button", { name: "Save address" }).click();

        // Assert: 一覧に**その固有の Street** がちょうど 1 件現れる
        await expect(page.getByText(uniqueStreet)).toHaveCount(1, {
            timeout: 15000,
        });
    });

    test("注文が履歴に載り、詳細へ遷移できる", async ({ page }, testInfo) => {
        // OI-12（[`docs/testing/QA_HANDOFF.md`](../../docs/testing/QA_HANDOFF.md) の
        // 「現在アクティブな残課題」）。ローカル dev サーバでのみ Firefox の navigation が
        // hang する。CI は本番ビルドで走るため skip されず、3 ブラウザのカバレッジは維持される。
        // 解消条件: `bun run dev` 起動下で当該テストが Firefox 連続 2 回 pass すること。
        // 見直し期限: 2026-10-31。
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
        await expect(page.getByText(/Added to your bag/i)).toBeVisible({
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

        // クエリ文字列やハッシュを orderId に混入させない。
        // `page.url().split("/order/")[1]` だと `?foo=1` や `#bar` まで拾ってしまい、
        // 行検索 (`#${orderId}`) と URL 待機の両方が静かに外れる。
        const orderId = new URL(page.url()).pathname.split("/order/")[1];
        expect(orderId).toBeTruthy();

        // Assert: 履歴の**その注文の行**から詳細へ遷移できる。
        // 行を特定せずに View を押すと、注文が複数あるときに別の注文へ飛んでも気づけない。
        await gotoStable(page, "/profile/orders");
        const row = page
            .getByRole("list", { name: "Your orders" })
            .getByRole("listitem")
            .filter({ hasText: orderId });
        await expect(row).toHaveCount(1, { timeout: 15000 });
        await row
            .getByRole("link", { name: `View order ${orderId}`, exact: true })
            .click();
        // 正規表現に orderId を埋めると ID 内の記号がメタ文字として解釈されうるため、
        // pathname を直接検証する述語で待つ。
        await page.waitForURL((url) => url.pathname === `/order/${orderId}`, {
            timeout: 15000,
        });
    });
});
