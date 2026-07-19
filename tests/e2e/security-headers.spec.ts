import { expect, test } from "@playwright/test";

/**
 * レスポンス強化ヘッダの回帰ガード（plan 061 / SECURITY-06）。
 *
 * next.config.mjs の headers() が全ルート（`/:path*`）へ 5 つの強化ヘッダを
 * 付与することを検証する。ヘッダ「名」の存在確認では不十分で、「値」まで
 * 厳密に一致させる点が重要（値だけが緩められた場合〔例: SAMEORIGIN →
 * ALLOWALL〕を検知できないため）。
 *
 * ブラウザ描画は不要なため page ではなく request（APIRequestContext）を使う。
 */
const EXPECTED_SECURITY_HEADERS = {
    "x-frame-options": "SAMEORIGIN",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
} as const;

test.describe("セキュリティレスポンスヘッダ", () => {
    // 公開ページと保護ページ（未認証ではサインインへリダイレクト）の双方を確認
    for (const path of ["/", "/checkout"]) {
        test(`${path} が 5 つの強化ヘッダを正確な値で返す`, async ({
            request,
        }) => {
            // リダイレクトを追わず、そのレスポンス自体のヘッダを検証する
            const response = await request.get(path, { maxRedirects: 0 });

            // ヘッダは 500 エラーページにも付与されるため、ステータスを検証しないと
            // アプリが壊れていてもこのテストは緑のままになる。`/` は 200、
            // `/checkout` は未認証でサインインへの 3xx を返すので 4xx/5xx を弾く。
            expect(
                response.status(),
                `${path} のステータス`
            ).toBeLessThan(400);

            const headers = response.headers(); // キーは小文字に正規化済み

            for (const [name, value] of Object.entries(
                EXPECTED_SECURITY_HEADERS
            )) {
                expect(headers[name], `${path} の ${name}`).toBe(value);
            }
        });
    }
});
