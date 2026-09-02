import { expect, test } from "@playwright/test";
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";
import { createCustomerSession, requiresClerkAdmin } from "./helpers/auth";
import { gotoStable } from "@/config/test-helpers";

/**
 * 管理者によるカテゴリツリー編集 E2E（plan 068 Step 1–4）。
 *
 * 066/067 でストアフロントの読み取りはツリー（materialized path の prefix）で
 * 動くようになったが、**3 階層目のノードを作る手段が admin に無かった** ——
 * Category と SubCategory が別ルート・別フォームで、いずれも 2 階層固定だったため
 * ツリーはデータ投入経路が塞がったままだった。本 spec はその経路が開いたことを
 * 実際の UI 操作で確認する。
 *
 * **共有 seed のカテゴリは触らない。** 使い捨てのルートを作り、その配下だけを操作する。
 *
 * CLERK_SECRET_KEY 未設定の環境では自動スキップ。
 */
test.describe("管理者によるカテゴリツリー編集", () => {
    test.skip(
        () => requiresClerkAdmin,
        "Requires CLERK_SECRET_KEY for Clerk admin operations."
    );

    const session = createCustomerSession();
    const prisma = new PrismaClient();
    const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const rootName = `E2E Tree Root ${uniqueId}`;
    const rootUrl = `e2e-tree-root-${uniqueId}`;
    const midName = `E2E Tree Mid ${uniqueId}`;
    const midUrl = `e2e-tree-mid-${uniqueId}`;
    const leafName = `E2E Tree Leaf ${uniqueId}`;
    const leafUrl = `e2e-tree-leaf-${uniqueId}`;
    let rootId: string | undefined;

    test.beforeAll(async () => {
        await session.create({ role: "ADMIN" });

        // /dashboard/admin の認可は **Clerk の privateMetadata** を見る
        // （`admin/layout.tsx`）。DB の User.role だけでは通らない。
        const clerk = createClerkClient({
            secretKey: process.env.CLERK_SECRET_KEY,
        });
        if (!session.clerkUserId) {
            throw new Error("session.create() did not yield a Clerk user id.");
        }
        await clerk.users.updateUserMetadata(session.clerkUserId, {
            privateMetadata: { role: "ADMIN" },
        });

        // ルートと 2 階層目は前提データなので直接作る。**検証対象は 3 階層目の
        // 作成**であり、そこだけを UI 操作で通す（変数を 1 つに絞る）。
        const root = await prisma.category.create({
            data: {
                name: rootName,
                image: "https://res.cloudinary.com/test/image/upload/root.png",
                url: rootUrl,
                path: rootUrl,
                depth: 0,
                childCount: 1,
            },
        });
        rootId = root.id;
        await prisma.category.create({
            data: {
                name: midName,
                image: "https://res.cloudinary.com/test/image/upload/mid.png",
                url: midUrl,
                parentId: root.id,
                path: `${rootUrl}/${midUrl}`,
                depth: 1,
            },
        });
    });

    test.afterAll(async () => {
        // 子から順に消す（self-relation は onDelete: Restrict）
        await prisma.category
            .deleteMany({ where: { path: { startsWith: `${rootUrl}/` } } })
            .catch(() => {});
        if (rootId) {
            await prisma.category
                .delete({ where: { id: rootId } })
                .catch(() => {});
        }
        await prisma.$disconnect();
        await session.cleanup();
    });

    test("3 階層目のノードを作成し、ツリーとして一覧に現れる", async ({
        page,
    }) => {
        // サインイン + admin ダッシュボード + 本番ビルドの SSR を含む重いフロー。
        test.setTimeout(90000);
        await session.signIn(page);

        // --- control（必須）: 作成前は 3 階層目が存在しない -------------------
        // これを省くと後段の「現れた」assert が、最初から存在していても緑になる。
        await gotoStable(page, "/dashboard/admin/categories");
        const search = page.getByPlaceholder("Search category name ...");
        await expect(search).toBeVisible({ timeout: 15000 });
        await search.fill(leafName);
        await expect(
            page.getByRole("row").filter({ hasText: leafName })
        ).toHaveCount(0, { timeout: 10000 });

        // --- 3 階層目を admin フォームから作成 -------------------------------
        await gotoStable(page, "/dashboard/admin/categories/new");
        await expect(page.getByPlaceholder("Name")).toBeVisible({
            timeout: 15000,
        });
        await page.getByPlaceholder("Name").fill(leafName);
        await page.getByPlaceholder("/category-url").fill(leafUrl);
        // Cloudinary ウィジェットは E2E で開けないため、ImageUpload の
        // 隠しテスト入力へ URL を直接流す（seller-onboarding.spec.ts と同じ経路）。
        await page
            .getByTestId("n-mock-input-profile")
            .fill("https://res.cloudinary.com/test/image/upload/leaf.png", {
                force: true,
            });

        // 親に depth 1 のノードを選ぶ = 作られるのは depth 2（3 階層目）。
        // **この select が存在すること自体が本 spec の主目的である** ——
        // 従来のフォームには親選択が無く、ルートしか作れなかった。
        // **`page.getByRole("combobox")` で引かないこと** —— ダッシュボードの
        // サイドバーにもナビゲーション用の combobox があり、`.first()` はそちらを
        // 掴む（実測でそのまま click し、フォームではなくメニューが開いた）。
        // フォーム内へスコープする。
        await page.locator("form").getByRole("combobox").click();
        await page.getByRole("option", { name: midName }).click();

        await page.getByRole("button", { name: "Create category" }).click();

        // 作成後は一覧へリダイレクトされる
        await page.waitForURL(/\/dashboard\/admin\/categories$/, {
            timeout: 30000,
        });

        // --- 一覧に 3 階層目が現れ、親が表示される ---------------------------
        const searchAfter = page.getByPlaceholder("Search category name ...");
        await expect(searchAfter).toBeVisible({ timeout: 15000 });
        await searchAfter.fill(leafName);
        const row = page.getByRole("row").filter({ hasText: leafName });
        await expect(row).toHaveCount(1, { timeout: 15000 });
        // parent 列は path の 1 つ手前のセグメント。ここが `/{midUrl}` であることは、
        // path が `root/mid/leaf` の形で書かれた（= 親から導出された）ことの証拠になる。
        await expect(row.getByText(`/${midUrl}`)).toBeVisible();

        // --- DB 上も 3 階層目として整合している -----------------------------
        // 表示だけでは path / depth / childCount の不変条件までは見えない。
        const created = await prisma.category.findUniqueOrThrow({
            where: { url: leafUrl },
            select: { path: true, depth: true, parentId: true },
        });
        expect(created.path).toBe(`${rootUrl}/${midUrl}/${leafUrl}`);
        expect(created.depth).toBe(2);

        const mid = await prisma.category.findUniqueOrThrow({
            where: { url: midUrl },
            select: { id: true, childCount: true },
        });
        expect(created.parentId).toBe(mid.id);
        // 親の childCount が実数へ追随している（リーフ強制 V-5 がこの値を読む）
        expect(mid.childCount).toBe(1);
    });
});
