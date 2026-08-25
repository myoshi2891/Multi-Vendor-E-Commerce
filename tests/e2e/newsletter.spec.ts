import { expect, test } from "@playwright/test";

/**
 * Characterization: Newsletter 購読フォームの現挙動を固定する。
 *
 * 2026-08-23 時点で `/api/newsletter` route はリポジトリに存在せず（`prisma/schema.prisma`
 * にも購読者モデル無し）、全購読操作は失敗し "Failed to subscribe." トーストに終わる
 * （dormant 機能ギャップ — plans/audit/findings-17-e2e-coverage-r9.md TESTS-39）。
 * 観測されたステータスは 404 だが、**それは route 不在という偶発的な機構**であり契約ではない。
 * assert は `response.ok() === false`（＝ 2xx でない = 購読が成功しない）で固定し、
 * 404 そのものは `console.info` の記録に留める。
 *
 * このテストは「壊れた挙動」を意図的に固定している。route が実装されて購読が成功する
 * ようになったらこのスイートは fail する —— その時は成功系テストへ**書き直す**こと
 * （`test.skip` で黙らせない）。
 *
 * 対象実装: src/components/store/layout/footer/newsletter.tsx
 *   - `fetch('/api/newsletter', { method: 'POST', ... })` → `!response.ok` で throw
 *   - catch で `toast.error("Failed to subscribe.")`（AbortError のみ別メッセージ）
 *   - `form.reset()` は**成功時のみ**（失敗時は入力値が残る）
 *
 * フッターは MinimalHeader 系を除く全ストアフロントページに描画される。ホーム（/）は
 * OI-9 の SSR 500 が未解消のため `/browse` を使う。seed / 認証には依存しない。
 */
test.describe("Newsletter 購読フォーム（characterization: dormant 404）", () => {
    test("購読は成功せず、失敗トーストが出て入力値が残る", async ({ page }) => {
        await page.goto("/browse");

        const emailInput = page.locator("#newsletter-email");
        await emailInput.scrollIntoViewIfNeeded();
        await emailInput.fill("e2e-newsletter@example.com");

        // waitForResponse は click より**前**に仕掛ける（後だと取りこぼす）。
        const responsePromise = page.waitForResponse(
            (r) =>
                r.url().includes("/api/newsletter") &&
                r.request().method() === "POST"
        );
        await page
            .locator("form")
            .getByRole("button", { name: "Sign up" })
            .click();
        const response = await responsePromise;

        // 購読が成功していないことだけを契約にする。
        //
        // `toBe(404)` で固定してはいけない。404 は「購読は成功しない」という恒久的な命題では
        // なく、「route ファイルが無い」という偶発的な機構にすぎない。404 を成功条件にすると
        // (1) ルーティング回帰で API が軒並み 404 になっても緑のまま「characterization どおり」
        // と報告し、(2) catch-all が 501 を返す等の無害な変更で赤くなる。
        //
        // `not.toBe(200)` でも不足で、201 Created / 202 Accepted / 204 No Content を
        // 「成功していない」と見なしてしまう。ok() は 200-299 で true なので 2xx を一括で拒否する。
        expect(response.ok()).toBe(false);

        // 観測値は記録するがゲートにはしない。2026-08-23 時点では 404（route 不在）。
        console.info(
            `[characterization] /api/newsletter status = ${response.status()}`
        );

        // ユーザーに見える失敗の契約
        await expect(page.getByText("Failed to subscribe.")).toBeVisible({
            timeout: 10000,
        });

        // form.reset() は成功時のみ呼ばれるため、失敗時は入力値が保持される
        await expect(emailInput).toHaveValue("e2e-newsletter@example.com");
    });

    test("空メールでは POST が発生しない（HTML5 required でブロックされる）", async ({
        page,
    }) => {
        await page.goto("/browse");

        // 収集は click より**前**に開始する（開始が遅れると初回リクエストを取りこぼす）。
        const newsletterRequests: string[] = [];
        page.on("request", (request) => {
            if (
                request.url().includes("/api/newsletter") &&
                request.method() === "POST"
            ) {
                newsletterRequests.push(request.url());
            }
        });

        const emailInput = page.locator("#newsletter-email");
        await emailInput.scrollIntoViewIfNeeded();

        // 「submit が試行され、制約検証でブロックされた」ことを一意に示す invalid イベントを待つ。
        //
        // checkValidity() を判定基準にしてはいけない。あれは validity を問い合わせるだけの
        // 純粋関数で、空の required 欄なら **click の前でも後でも常に false** を返す。
        // つまり expect.poll(...).toBe(false) は初回評価で即座に成立して何も待たず、直後の
        // toHaveLength(0) が「まだ発火していないだけの POST」を「無かった」と誤判定しうる。
        // invalid イベントは submit 試行時の制約検証失敗でのみ発火するので、
        // これを待てば POST が発火する機会は既に過ぎている。
        await page.evaluate(() => {
            const w = window as Window & {
                __newsletterInvalidFired?: boolean;
            };
            w.__newsletterInvalidFired = false;
            document.querySelector("#newsletter-email")?.addEventListener(
                "invalid",
                () => {
                    w.__newsletterInvalidFired = true;
                },
                { once: true }
            );
        });

        await emailInput.fill("");
        await page
            .locator("form")
            .getByRole("button", { name: "Sign up" })
            .click();

        // 固定待機（時間で待つ API）は使わない。「1s 待って POST が無ければ OK」は決定論的でなく、
        // 遅い環境では見逃し（偽陰性）、速い環境では無駄に払うだけで、「どれだけ待てば十分か」に
        // 原理的な答えが無い。expect.poll は条件成立まで再評価するので両方を回避できる。
        await expect
            .poll(async () =>
                page.evaluate(
                    () =>
                        (
                            window as Window & {
                                __newsletterInvalidFired?: boolean;
                            }
                        ).__newsletterInvalidFired
                )
            )
            .toBe(true);

        // ブロックされた以上、POST は 1 件も発生していないはず。
        // なお本 assert の「捕捉が機能していること」の裏付けは上のテスト 1 が兼ねる
        // （テスト 1 が落ちている状態では、ここは無意味に緑になる）。
        expect(newsletterRequests).toHaveLength(0);
    });
});
