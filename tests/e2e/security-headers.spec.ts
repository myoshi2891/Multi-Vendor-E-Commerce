import { expect, test } from "@playwright/test";

/**
 * レスポンス強化ヘッダの回帰ガード（plan 061 / SECURITY-06）。
 *
 * next.config.mjs の headers() が全ルート（`/:path*`）へ強化ヘッダを付与することを
 * 検証する。ヘッダ「名」の存在確認では不十分で、「値」まで厳密に一致させる点が
 * 重要（値だけが緩められた場合〔例: SAMEORIGIN → ALLOWALL〕を検知できないため）。
 *
 * HSTS（`Strict-Transport-Security`）は**本番ドメインのみ**付与する（非本番・
 * Vercel preview へ送ると HTTPS な preview でブラウザに記録される）。E2E の webServer は
 * 既定で `next start`（NODE_ENV=production）のため present を期待し、`E2E_USE_DEV=1` の
 * dev 起動、または `VERCEL_ENV=preview` では absent を期待する。テストランナーと
 * webServer はこの env を共有するため、同じ判定でサーバー挙動を鏡写しにできる。
 *
 * さらに `includeSubDomains` / `preload` は**明示 opt-in**（`HSTS_INCLUDE_SUBDOMAINS` /
 * `HSTS_PRELOAD`）でのみ付く。NODE_ENV=production は「本番ドメインで配信中」を意味せず、
 * self-host の staging も production ビルドで動くため、環境名だけで非可逆な preload 登録を
 * 誘発させない設計（plan 061 / CodeRabbit 指摘）。期待値も同じ規則で組み立てて、
 * 「opt-in なしで拡張ディレクティブが付く」退行を検知する。
 *
 * ブラウザ描画は不要なため page ではなく request（APIRequestContext）を使う。
 */
const CORE_SECURITY_HEADERS = {
    "x-frame-options": "SAMEORIGIN",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
} as const;

const HSTS_HEADER = "strict-transport-security";

// next.config.mjs の HSTS ゲート（NODE_ENV=production かつ VERCEL_ENV!==preview）と
// 同じ条件。E2E_USE_DEV=1 の dev 起動は NODE_ENV=development になるため HSTS は付かない。
const expectHsts =
    !process.env.E2E_USE_DEV && process.env.VERCEL_ENV !== "preview";

// next.config.mjs と同じ opt-in 判定・同じディレクティブ順で期待値を組み立てる
const isEnabled = (name: string): boolean => process.env[name]?.trim() === "1";
const expectPreload = isEnabled("HSTS_PRELOAD");
const expectSubDomains = expectPreload || isEnabled("HSTS_INCLUDE_SUBDOMAINS");

const HSTS_VALUE = [
    "max-age=63072000",
    ...(expectSubDomains ? ["includeSubDomains"] : []),
    ...(expectPreload ? ["preload"] : []),
].join("; ");

test.describe("セキュリティレスポンスヘッダ", () => {
    // 公開ページと保護ページ（未認証ではサインインへリダイレクト）の双方を確認
    for (const path of ["/", "/checkout"]) {
        test(`${path} が強化ヘッダを正確な値で返す`, async ({ request }) => {
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

            for (const [name, value] of Object.entries(CORE_SECURITY_HEADERS)) {
                expect(headers[name], `${path} の ${name}`).toBe(value);
            }

            // HSTS は本番ドメインのみ。付与条件を鏡写しにして「無条件適用」への
            // 退行（非本番でも preload が付く）も、本番で消える退行も両方検知する。
            if (expectHsts) {
                expect(headers[HSTS_HEADER], `${path} の ${HSTS_HEADER}`).toBe(
                    HSTS_VALUE
                );
            } else {
                expect(
                    headers[HSTS_HEADER],
                    `${path} の ${HSTS_HEADER}（非本番では付与しない）`
                ).toBeUndefined();
            }
        });
    }
});
