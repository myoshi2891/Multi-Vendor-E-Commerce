import { expect, test, type Page } from "@playwright/test";

/**
 * 国選択セレクタ（Ship to）の cookie 往復 E2E（TESTS-40）。
 *
 * `userCountry` cookie は配送先表示・配送料計算の入力となる中核状態だが、
 * 「hover でドロップダウンを開く → 国を選ぶ → cookie 書き込み → router.refresh()
 * → ヘッダー表示更新」というブラウザ往復はどの層でも検証されていなかった
 * （unit は API route 単体と `parseUserCountryCookie` のパースのみ）。
 *
 * 認証不要・DB seed 非依存（countries.json は静的データ、cookie はブラウザ状態）。
 *
 * **初期 cookie を明示的に投入する理由**: `src/middleware.ts:18-27` は cookie が
 * 無いと ipinfo.io で IP から国を判定して `userCountry` を先に設定する。よって
 * 「cookie 未設定なら DEFAULT_COUNTRY（United States）」は実行マシンの所在地に
 * 依存し、日本から実行すると初期表示が `Japan/EN/` になる（実測で確認）。
 * cookie を先に入れれば middleware の分岐に入らないため、外部ネットワークにも
 * 実行地にも依存しない決定論的なテストになる。
 * DEFAULT_COUNTRY フォールバック自体は `src/lib/utils.ts` の unit テストが担当する。
 *
 * 操作契約:
 *   - ヘッダーのトリガーは CSS `group-hover` で開く（click ではない）
 *     — src/components/store/layout/header/country-lang-curr-selector.tsx:84
 *   - ドロップダウン内は role="button"（選択中の国名を表示）を click で
 *     role="listbox" が開き、placeholder="Search a country" で先頭一致フィルタ
 *     — src/components/shared/country-selector.tsx:59,129
 *   - 国旗は外部 CDN の next/image。**読み込みは assert しない**（フレーク源）。
 */
test.describe("国選択セレクタ（Ship to）", () => {
    // home `/` は OI-9（featured.tsx の SSR 500）が未解消のため /browse を使う。
    // ヘッダーは (store) レイアウト共通なのでどちらでも同じ表示になる。
    const PAGE_WITH_HEADER = "/browse";

    // cookie の紐付け先オリジンと、後段の https 判定の両方が参照する単一の基準値。
    // `playwright.config.ts` の `baseURL` と同じフォールバックに揃えること。
    const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

    // middleware / route handler と同じ shape（`isCountry` の 4 フィールド必須）
    const US_COUNTRY = {
        name: "United States",
        code: "US",
        city: "",
        region: "",
    };

    /** 既知の国を cookie に入れてから対象ページを開く（middleware の IP 判定を迂回） */
    const gotoWithCountry = async (page: Page) => {
        await page.context().addCookies([
            {
                name: "userCountry",
                value: JSON.stringify(US_COUNTRY),
                url: BASE_URL,
            },
        ]);
        await page.goto(PAGE_WITH_HEADER);
    };

    test("既存の userCountry cookie がヘッダー表示に反映される", async ({
        page,
    }) => {
        await gotoWithCountry(page);

        await expect(page.getByText("United States/EN/")).toBeVisible();
    });

    test("国を変更するとヘッダー表示が更新され、リロード後も永続する", async ({
        page,
    }, testInfo) => {
        // WebKit は `Secure` cookie を安全でないオリジンで破棄する。Chromium /
        // Firefox は localhost を信頼できるオリジンとして例外扱いするが、WebKit は
        // しない。ローカル E2E は本番ビルド（NODE_ENV=production）を **http** で
        // 配信するため、`route.ts:49` の `secure: NODE_ENV === "production"` が
        // 立ち、WebKit だけ cookie が保存されずヘッダーが更新されない。
        // 実測: POST は 200 を返し `Secure; HttpOnly; SameSite=lax` を送っている。
        // これはアプリの欠陥ではなく配信スキームの問題なので、https 配信時は実行する。
        // （テスト 1 は Playwright が cookie を直接注入するため WebKit でも通る。）
        const isHttps = BASE_URL.startsWith("https:");
        test.skip(
            testInfo.project.name === "webkit" && !isHttps,
            "WebKit: Secure cookie は http 配信では保存されない（https 配信時のみ実行）"
        );

        await gotoWithCountry(page);

        // group-hover 制御のため hover が必須。以降の操作は dropdown 内の要素へ
        // 連続して行う（間にマウスを逃がすと閉じてしまう）。
        //
        // `force: true` が必要な理由: hover した瞬間に開く dropdown
        // （`.absolute.top-0.group-hover:block`）がトリガー要素の上に重なるため、
        // Playwright の actionability 再チェックが常に
        // "intercepts pointer events" を報告し、hover が成功扱いにならない。
        // これは「hover で自分を覆う要素を開く」CSS パターンの構造的な帰結であり、
        // 待てば解消する類のものではない（実測: 30s タイムアウトまでリトライし続ける）。
        // force はチェックを飛ばすだけでマウスは実際に移動するので、
        // CSS :hover は正しく発火する。
        await page.getByText("United States/EN/").hover({ force: true });
        await expect(page.getByText("Ship to")).toBeVisible();

        // ドロップダウン内のコンボボックストリガー（選択中の国名を表示している）
        await page
            .getByRole("button", { name: /United States/ })
            .first()
            .click();

        await page.getByPlaceholder("Search a country").fill("Japan");

        const japanOption = page
            .getByRole("option")
            .filter({ hasText: "Japan" })
            .first();
        await expect(japanOption).toBeVisible();

        // レスポンス待ちは click の *前* に仕掛ける。click してから waitForResponse を
        // 呼ぶと、その間にレスポンスが返ってしまった場合に待ち受けが取りこぼし、
        // タイムアウトするまで固まる（典型的なレースで、速い環境ほど再現する）。
        const countryResponse = page.waitForResponse(
            (r) =>
                r.url().includes("/api/setUserCountryInCookies") &&
                r.status() === 200
        );

        await japanOption.click();

        await countryResponse; // click 前に仕掛けた待ち受けをここで回収する

        // router.refresh() による SSR 再取得でヘッダーが更新される
        await expect(page.getByText("Japan/EN/")).toBeVisible({
            timeout: 10000,
        });

        // 同一テスト内で永続まで見る。cookie は httpOnly なのでリロード後も
        // サーバー側が Japan を読み出す。テストを分けると 2 本目が 1 本目の
        // 実行順に暗黙依存し、Playwright の独立コンテキスト前提で成立しない。
        await page.reload();
        await expect(page.getByText("Japan/EN/")).toBeVisible({
            timeout: 10000,
        });
    });
});
