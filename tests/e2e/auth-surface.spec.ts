import { expect, test } from "@playwright/test";
import { createCustomerSession, requiresClerkAdmin } from "./helpers/auth";
import { gotoStable } from "@/config/test-helpers";

/**
 * 認証サーフェスのスモーク E2E（plan 053 / TESTS-41）。
 *
 * 目的は「Clerk ウィジェットが描画され、そこへ至る導線が生きている」ことの canary。
 * サインアップの完走（確認コード入力 → セッション成立）は意図的に対象外
 * （Clerk 自身のテスト責務。findings-17 Rejected 節）。
 *
 * **セレクタ設計の必須知識**: `/sign-in` `/sign-up` は共通ヘッダー/フッター付きで、
 * フッターの Newsletter 入力欄が `<label class="sr-only">Email address</label>` を持つ
 * （`src/components/store/layout/footer/newsletter.tsx`）。Clerk ウィジェットは
 * client-only なのでハイドレーション前は Newsletter 欄だけが存在し、
 * ページ全体スコープの `getByLabel("Email address")` はそちらへ解決してしまう
 * （plan 042 が `/sign-in` で踏んだ根本原因）。**Clerk 要素は必ず Clerk ルートへ
 * スコープしてから引くこと。**
 */
test.describe("認証サーフェス（ゲスト）", () => {
    test("サインアップウィジェットが描画される", async ({ page }) => {
        await page.goto("/sign-up");

        // ハイドレーション後に現れるため長めに待つ。クラス名は helpers/auth.ts が
        // `/sign-in` 側で使う `.cl-signIn-root` と対の Clerk 既定クラス。
        const clerkRoot = page.locator(".cl-signUp-root");
        await expect(clerkRoot).toBeVisible({ timeout: 20000 });

        // 識別子入力。ラベル文言より name 属性のほうが安定
        // （かつ Newsletter 欄への誤解決を構造的に防げる）。
        await expect(
            clerkRoot.locator('input[name="emailAddress"]')
        ).toBeVisible();

        // `exact: true` は必須。Google ソーシャルボタンのアクセシブル名が
        // "Sign up with Google Continue with Google" のため、部分一致だと
        // strict mode violation か OAuth 遷移になる（auth.ts:73-79 の教訓）。
        await expect(
            clerkRoot.getByRole("button", { name: "Continue", exact: true })
        ).toBeVisible();
    });

    test("ヘッダーの Register リンクから /sign-up へ遷移できる", async ({
        page,
    }) => {
        await page.goto("/browse");

        // **`<UserMenu />` はヘッダー内に 2 回描画される**（header.tsx:32 のモバイル用
        // `lg:hidden` と :48 のデスクトップ用 `hidden lg:flex`）。両方とも DOM には存在し、
        // 表示されているのはビューポート次第なので、テキスト一致だけでは strict mode
        // violation になる。`visible: true` で絞ると、どのビューポートで動かしても
        // 「今ユーザーが操作できるほうのメニュー」を指せる。
        const header = page.getByTestId("store-header");

        // ドロップダウンは user-menu.tsx:74 の `hidden group-hover:block` で制御される。
        // トリガーを hover するまで Register は DOM 上 hidden なので、
        // いきなり click すると可視性待ちでタイムアウトする。
        //
        // **`force: true` は必須（自己遮蔽デッドロックの回避）。** ドロップダウンの器は
        // `absolute -left-20 top-0` で、開くと**トリガー自身の上に重なる**。素の `hover()` は
        // 「対象がポインタイベントを受け取れるか」を確認してからマウスを動かすが、
        // マウスが乗った瞬間に器が覆いかぶさるため判定が永久に通らず、30s タイムアウトする
        // （マウス移動の前後で `document.elementFromPoint` を撮って実測: 移動前は
        // `SPAN`、移動後は `DIV.absolute -left-20 top-0 ... group-hover:block`）。
        // ログは "waiting for element to be visible and stable" と出るが**レイアウトは静止して
        // おり**、実際に詰まっているのは遮蔽の方。この器を開けたいテストは全て同じ罠を踏む。
        await header
            .getByText("Sign in / Register")
            .filter({ visible: true })
            .hover({ force: true });

        const registerLink = header
            .getByRole("link", { name: "Register" })
            .filter({ visible: true });
        await expect(registerLink).toBeVisible();
        await registerLink.click();

        await page.waitForURL(/\/sign-up/);
    });
});

test.describe("認証サーフェス（サインアウト往復）", () => {
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

    test("サインアウトするとゲスト状態に戻る", async ({ page }) => {
        // Clerk のサインイン往復を含むため既定 30s では不足しうる。
        test.setTimeout(90000);

        await session.signIn(page);
        // サインイン直後の遅延リダイレクトが goto に割り込む既知現象を吸収する
        // （Firefox: NS_BINDING_ABORTED / WebKit: interrupted by another navigation）。
        await gotoStable(page, "/browse");

        const header = page.getByTestId("store-header");

        // 認証成立の裏付け。ゲスト用トリガーは**そもそも描画されない**ので、
        // 「見えない」ではなく「存在しない」で assert する（user-menu.tsx:52-69 の
        // 三項が user の有無で分岐するため）。
        await expect(header.getByText("Sign in / Register")).toHaveCount(0);

        // 認証時のトリガーは user-menu.tsx:44-51 のアバター `<Image>`。
        // **プラン 053 本文の `.cl-userButtonTrigger` は使えない** ——
        // `<UserButton />`（user-menu.tsx:87）は `hidden group-hover:block` の
        // **内側**にあり、メニューを開く前は不可視。それを hover 対象にすると
        // 「開くために開いた状態が要る」鶏卵になる。053 の STOP conditions が
        // 代替として挙げている `.group` 配下のトリガー領域を使う。
        //
        // alt は `user.fullName ?? "user name"`。E2E ユーザーは Clerk に姓名を
        // 設定しないため後者になる。
        const avatar = header
            .getByAltText("user name")
            .filter({ visible: true });
        // `force: true` の理由はゲスト側テストのコメントを参照（自己遮蔽デッドロック）。
        // 認証時の器は `-left-[200px] lg:-left-[148px]` だが `top-0` は同じで、
        // 開くとアバターに重なる点も同じ。
        await avatar.hover({ force: true });

        // group-hover でメニューが開いたことの確認を兼ねる
        const signOut = header
            .getByRole("button", { name: "Sign out" })
            .filter({ visible: true });
        await expect(signOut).toBeVisible();
        await signOut.click();

        // ゲスト表示の復帰だけを assert する（サインアウト後のリダイレクト先は
        // Clerk 既定に委ねられており、固定すると Clerk 設定変更で壊れる）。
        await expect(
            header.getByText("Sign in / Register").filter({ visible: true })
        ).toBeVisible({ timeout: 15000 });
    });
});
