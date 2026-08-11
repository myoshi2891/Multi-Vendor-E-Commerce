import { expect, test } from "@playwright/test";
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";
import { createCustomerSession, requiresClerkAdmin } from "./helpers/auth";
import { gotoStable } from "@/config/test-helpers";

/**
 * 管理者の店舗ステータス変更 E2E（plan 050 / TESTS-38）。
 *
 * 店舗の BAN / 無効化は運営の主要オペレーションだが、admin UI からの操作 →
 * ストアフロント反映の E2E が無かった。隣接する `seller-onboarding.spec.ts` は
 * ステータスを Prisma 直更新しており admin UI を通らない。
 *
 * **共有 seed 店舗（E2E Store / E2E Store B）は絶対に触らない。** 他 spec が
 * 依存する共有リソースのため、使い捨て店舗を作って BAN する。
 *
 * CLERK_SECRET_KEY 未設定の環境では自動スキップ。
 */
test.describe("管理者による店舗ステータス変更", () => {
    test.skip(
        () => requiresClerkAdmin,
        "Requires CLERK_SECRET_KEY for Clerk admin operations."
    );

    const session = createCustomerSession();
    const prisma = new PrismaClient();
    const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const storeName = `E2E Status Store ${uniqueId}`;
    const storeUrl = `e2e-status-store-${uniqueId}`;
    let storeId: string | undefined;

    test.beforeAll(async () => {
        await session.create({ role: "ADMIN" });

        // /dashboard/admin の認可は **Clerk の privateMetadata** を見る
        // （`admin/layout.tsx:21`）。DB の User.role だけでは通らないため、
        // seller-onboarding.spec.ts:148 の前例どおり Clerk 側も同期する。
        const clerk = createClerkClient({
            secretKey: process.env.CLERK_SECRET_KEY,
        });
        if (!session.clerkUserId) {
            throw new Error("session.create() did not yield a Clerk user id.");
        }
        await clerk.users.updateUserMetadata(session.clerkUserId, {
            privateMetadata: { role: "ADMIN" },
        });

        const store = await prisma.store.create({
            data: {
                name: storeName,
                description: "Disposable store for admin status E2E.",
                email: `${storeUrl}@example.com`,
                phone: "0000000002",
                url: storeUrl,
                logo: "/assets/images/no_image.png",
                cover: "/assets/images/home-wallpaper.webp",
                status: "ACTIVE",
                defaultShippingService: "International Delivery",
                defaultShippingFeePerItem: 0,
                defaultShippingFeeForAdditionalItem: 0,
                defaultShippingFeePerKg: 0,
                defaultShippingFeeFixed: 0,
                defaultDeliveryTimeMin: 3,
                defaultDeliveryTimeMax: 7,
                returnPolicy: "Return in 30 days.",
                userId: session.clerkUserId,
            },
        });
        storeId = store.id;
    });

    test.afterAll(async () => {
        if (storeId) {
            await prisma.store.delete({ where: { id: storeId } }).catch(() => {});
        }
        await prisma.$disconnect();
        await session.cleanup();
    });

    test("admin UI で BANNED にすると store ページが非公開になる", async ({
        page,
    }) => {
        // サインイン + admin ダッシュボード + 本番ビルドの SSR を含む重いフロー。
        test.setTimeout(90000);
        await session.signIn(page);

        // sign-in 直後は着地先 `/` へのリダイレクトが飛んでおり、そのまま goto すると
        // 割り込まれる（firefox: NS_BINDING_ABORTED / webkit: interrupted by another
        // navigation を実測）。以降の遷移は割り込みを吸収する gotoStable を使う。

        // --- control（必須）: BAN 前は公開されている -------------------------
        // これを省くと後段の「非公開」assert が、ページが最初から壊れていても緑になる。
        // 「土台は健全で、状態を変えたから見えなくなった」と言えるのはこの control のおかげ。
        const before = await gotoStable(page, `/store/${storeUrl}`);
        expect(before).not.toBeNull();
        expect(before!.status()).toBe(200);
        await expect(page.getByText(storeName).first()).toBeVisible({
            timeout: 15000,
        });

        // --- admin UI でステータスを Banned に変更 ---------------------------
        await gotoStable(page, "/dashboard/admin/stores");

        // 名前でフィルタして対象行を一意にする。
        // **これはハイドレーションのゲートも兼ねている** —— 絞り込みは
        // TanStack Table のクライアント側フィルタなので、行数が減ったこと自体が
        // React が動いている証拠になる（未ハイドレートのままステータスタグを
        // クリックしてもドロップダウンは開かない）。
        const search = page.getByPlaceholder("Search store name ...");
        await expect(search).toBeVisible({ timeout: 15000 });
        await search.fill(storeName);

        const row = page.getByRole("row").filter({ hasText: storeName });
        await expect(row).toHaveCount(1, { timeout: 10000 });

        // StoreStatusSelect: 現在ステータスのタグを click → ドロップダウンから選択。
        // 表示文言は StoreStatusTag の label（Pending / Active / Banned / Disabled）。
        await row.getByText("Active", { exact: true }).click();
        await page.getByRole("button").filter({ hasText: "Banned" }).click();

        // **成功 toast は存在しない**（store-status-select.tsx はエラー時のみ toast を出す）ので、
        // 完了は DOM の状態で判定する。ただし **`Banned` の可視性を見てはいけない** ——
        // ドロップダウンが開いている間は**選択肢としての `Banned` タグ**が行内に存在するため、
        // 「更新が成功した」ではなく「ドロップダウンが開いている」だけで緑になる。
        // 実際これで server action の完了を待たずに先へ進み、DB がまだ ACTIVE のうちに
        // store ページを見に行って落ちた（実測: DB status = ACTIVE / store ページ 200）。
        //
        // `handleClick` は **成功時にだけ `setIsOpen(false)`** する（失敗時は開いたまま）。
        // したがって「旧ステータスのタグが消えた（= 選択肢ごと閉じた）」ことが真の成功シグナル。
        await expect(row.getByText("Active", { exact: true })).toHaveCount(0, {
            timeout: 15000,
        });
        await expect(row.getByText("Banned", { exact: true })).toHaveCount(1);

        // --- BAN 後: store ページが公開されていない -------------------------
        // **HTTP 500 を期待値として固定しない。** 現実装は notFound() を持たず
        // getStorePageDetails の throw が素通りするため 500 になるが、本来は 404 が正しい。
        // `toBe(500)` にすると「バグがある間は緑・修正した瞬間に赤」という
        // 修正を罰するテストになる。`not.toBe(200)` なら 500 でも 404 でも通る。
        //
        // また `response?.status()` の形にしないこと —— goto が null を返すと
        // `undefined !== 200` で空振り合格し、「公開されていない」の証明にならない。
        const after = await gotoStable(page, `/store/${storeUrl}`);
        expect(after).not.toBeNull();
        expect(after!.status()).not.toBe(200);
        await expect(page.getByText(storeName)).toHaveCount(0);

        // --- 復帰: Active に戻すと再び公開される ----------------------------
        await gotoStable(page, "/dashboard/admin/stores");
        const searchAgain = page.getByPlaceholder("Search store name ...");
        await expect(searchAgain).toBeVisible({ timeout: 15000 });
        await searchAgain.fill(storeName);

        const rowAgain = page.getByRole("row").filter({ hasText: storeName });
        await expect(rowAgain).toHaveCount(1, { timeout: 10000 });
        await rowAgain.getByText("Banned", { exact: true }).click();
        await page.getByRole("button").filter({ hasText: "Active" }).click();
        // BAN 時と同じ理由で、旧ステータス（Banned）が消えたことを完了条件にする。
        await expect(rowAgain.getByText("Banned", { exact: true })).toHaveCount(
            0,
            { timeout: 15000 }
        );
        await expect(rowAgain.getByText("Active", { exact: true })).toHaveCount(
            1
        );

        const restored = await gotoStable(page, `/store/${storeUrl}`);
        expect(restored).not.toBeNull();
        expect(restored!.status()).toBe(200);
        await expect(page.getByText(storeName).first()).toBeVisible({
            timeout: 15000,
        });
    });
});
