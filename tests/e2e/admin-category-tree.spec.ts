import { expect, test, type Locator } from "@playwright/test";
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
/**
 * 値が残るまで `fill` を繰り返す。
 *
 * **ハイドレーション前に fill すると、フォーム値は静かに巻き戻る。** react-hook-form の
 * `defaultValues`（空文字）でマウントされた制御 input が、後から走るハイドレーションで
 * DOM 値を上書きするため。実測（2026-09-03）では name / url が空へ戻り、送信は
 * 「Category name must be at least 2 characters long.」で止まっていた ——
 * このとき**非制御**の画像隠し入力と Radix Select の値は残っていたため、
 * 「一部のフィールドだけ消える」という紛らわしい失敗になる。
 *
 * `waitForLoadState` ではハイドレーション完了を判定できない（スクリプト取得の完了は
 * React のマウント完了を意味しない）ので、**書けたことを値で確認する**方式を採る。
 */
const fillStable = async (locator: Locator, value: string): Promise<void> => {
    await expect(async () => {
        await locator.fill(value);
        await expect(locator).toHaveValue(value, { timeout: 1000 });
    }).toPass({ timeout: 15000 });
};

test.describe("管理者によるカテゴリツリー編集", () => {
    test.skip(
        () => requiresClerkAdmin,
        "Requires CLERK_SECRET_KEY for Clerk admin operations."
    );

    const session = createCustomerSession();
    const prisma = new PrismaClient();
    const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    // **name と url では許される文字集合が違う。** `CategoryFormSchema.name` は
    // `^[a-zA-Z0-9\s]+$` でハイフンを弾く（`url` 側の slug 規則は逆にハイフン区切りを
    // 要求する）。同じ `uniqueId` を両方へ流すと name だけがクライアント検証で落ち、
    // 症状は「送信しても遷移しない」という遠い形で出る（2026-09-03 実測）。
    const nameId = uniqueId.replace(/-/g, " ");
    const rootName = `E2E Tree Root ${nameId}`;
    const rootUrl = `e2e-tree-root-${uniqueId}`;
    const midName = `E2E Tree Mid ${nameId}`;
    const midUrl = `e2e-tree-mid-${uniqueId}`;
    const leafName = `E2E Tree Leaf ${nameId}`;
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
        await fillStable(search, leafName);
        await expect(
            page.getByRole("row").filter({ hasText: leafName })
        ).toHaveCount(0, { timeout: 10000 });

        // --- 3 階層目を admin フォームから作成 -------------------------------
        await gotoStable(page, "/dashboard/admin/categories/new");
        await expect(page.getByPlaceholder("Name")).toBeVisible({
            timeout: 15000,
        });

        // **fill の前にクライアントマウントを待つ。** `ImageUpload` は
        // `if (!isMounted) return null`（image-upload.tsx）なので、
        // `n-mock-input-profile` は**マウント後にしか DOM に現れない** ——
        // このフォーム自身が持つハイドレーション完了シグナルとして使える。
        // これを待たずに書くと、react-hook-form の空 defaultValues による
        // 再レンダーが入力値を静かに巻き戻す（2026-09-03 実測: url は残り
        // name だけが消え、送信は「at least 2 characters」で止まった）。
        const imageInput = page.getByTestId("n-mock-input-profile");
        await expect(imageInput).toBeAttached({ timeout: 15000 });

        // Cloudinary ウィジェットは E2E で開けないため、ImageUpload の
        // 隠しテスト入力へ URL を直接流す（seller-onboarding.spec.ts と同じ経路）。
        await imageInput.fill(
            "https://res.cloudinary.com/test/image/upload/leaf.png",
            { force: true }
        );
        await fillStable(page.getByPlaceholder("Name"), leafName);
        await fillStable(page.getByPlaceholder("/category-url"), leafUrl);

        // 親に depth 1 のノードを選ぶ = 作られるのは depth 2（3 階層目）。
        // **この select が存在すること自体が本 spec の主目的である** ——
        // 従来のフォームには親選択が無く、ルートしか作れなかった。
        // **`page.getByRole("combobox")` で引かないこと** —— ダッシュボードの
        // サイドバーにもナビゲーション用の combobox があり、`.first()` はそちらを
        // 掴む（実測でそのまま click し、フォームではなくメニューが開いた）。
        // フォーム内へスコープする。
        // Radix Select は開閉時にポータルの中身を作り直すため、option を素直に
        // click すると "element is not stable" → "detached from the DOM" で落ちる
        // （2026-09-03 実測。1 回目の run では通ったので**間欠**である）。
        // 「開く → 選ぶ → トリガーに反映されたことを確認」までを 1 単位で再試行し、
        // 最後の assert で「クリックが本当に届いた」ことを固定する。
        //
        // `.first()` が要る: 値が入ると Radix がフォーム送信用の隠し native select を
        // 足すので、`form` 配下の combobox は 2 つになる（DOM 順でトリガーが先）。
        const parentTrigger = page
            .locator("form")
            .getByRole("combobox")
            .first();
        await expect(async () => {
            if (
                (await parentTrigger.getAttribute("aria-expanded")) !== "true"
            ) {
                await parentTrigger.click();
            }
            await page
                .getByRole("option", { name: midName })
                .click({ timeout: 3000 });
            await expect(parentTrigger).toContainText(midName);
        }).toPass({ timeout: 20000 });

        // 送信直前の検算。ここが崩れていると失敗は「リダイレクトしない」という
        // 遠い症状で出る（実際 2 回とも waitForURL のタイムアウトとして現れた）ので、
        // 原因の近くで落とす。
        await expect(page.getByPlaceholder("Name")).toHaveValue(leafName);
        await expect(page.getByPlaceholder("/category-url")).toHaveValue(
            leafUrl
        );

        await page.getByRole("button", { name: "Create category" }).click();

        // 作成後は一覧へリダイレクトされる
        await page.waitForURL(/\/dashboard\/admin\/categories$/, {
            timeout: 30000,
        });

        // --- 一覧に 3 階層目が現れ、親が表示される ---------------------------
        const searchAfter = page.getByPlaceholder("Search category name ...");
        await expect(searchAfter).toBeVisible({ timeout: 15000 });
        await fillStable(searchAfter, leafName);
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
