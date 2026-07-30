import { expect, test } from "@playwright/test";

/**
 * レスポンス強化ヘッダの回帰ガード（plan 061 / SECURITY-06）。
 *
 * next.config.mjs の headers() が全ルート（`/:path*`）へ強化ヘッダを付与することを
 * 検証する。ヘッダ「名」の存在確認では不十分で、「値」まで厳密に一致させる点が
 * 重要（値だけが緩められた場合〔例: SAMEORIGIN → ALLOWALL〕を検知できないため）。
 *
 * HSTS（`Strict-Transport-Security`）は**本番ドメインのみ**付与する（非本番・
 * Vercel preview へ送ると HTTPS な preview でブラウザに記録される）。判定軸は環境名では
 * なく**配信先**であり、`NODE_ENV=production` は「本番ドメインで配信中」を意味しない
 * （self-host の staging も production ビルドで動く）。したがって next.config.mjs は
 * `VERCEL_ENV=production` か `HSTS_ENABLED=1` という明示シグナルを要求する。
 *
 * E2E の webServer は既定で `next start`（NODE_ENV=production）だが、そのシグナルを
 * 持たないため **既定では absent を期待**する。present 側の分岐を実際に走らせるには
 * `HSTS_ENABLED=1 bunx playwright test tests/e2e/security-headers.spec.ts` のように
 * 明示シグナルを立てて実行する。webServer は `bun run build && bun run start`（既定）で
 * **ビルドごとこの env を共有する**ため、同じ判定でサーバー挙動を鏡写しにできる。
 *
 * ⚠️ ただし `reuseExistingServer`（ローカル = 有効）で既存サーバーが再利用されると
 * **ビルドが走らない**。next.config.mjs の `headers()` は `next build` 時に 1 回だけ
 * 評価され `.next/routes-manifest.json` へ焼き込まれるため、旧ビルドを配っている
 * サーバーは `HSTS_ENABLED` を後から立てても HSTS を返さず、present 期待が
 * false-fail する。present 側を検証するときは既存サーバーを止めてから実行すること。
 * 実際に焼き込まれた値は次で確認できる:
 *   node -p "JSON.stringify(require('./.next/routes-manifest.json').headers)"
 *
 * さらに `includeSubDomains` / `preload` は**個別の明示 opt-in**（`HSTS_INCLUDE_SUBDOMAINS` /
 * `HSTS_PRELOAD`）でのみ付く。全サブドメインの HTTPS 強制と preload リスト登録は
 * 取り消しが非可逆に近いため、本番ドメインであっても所有者が個別に選ぶ設計
 * （plan 061 / CodeRabbit 指摘）。期待値も同じ規則で組み立てて、
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

// next.config.mjs と同じ opt-in 判定（trim 後に "1" のみ有効 = fail safe）
const isEnabled = (name: string): boolean => process.env[name]?.trim() === "1";

// next.config.mjs の HSTS ゲートと同じ条件:
//   NODE_ENV=production（E2E_USE_DEV=1 の dev 起動は development になるため付かない）
//   かつ VERCEL_ENV!==preview（preload 変数が preview に漏れても弾く拒否条件）
//   かつ 配信先が本番であるシグナル（VERCEL_ENV=production または HSTS_ENABLED=1）
//
// E2E_USE_DEV も他の opt-in 変数と同じ `isEnabled` で判定する。素の真偽値判定だと
// `E2E_USE_DEV=0` で「dev 起動」と誤認して HSTS を absent 期待にしてしまう。
// playwright.config.ts の webServer も同じ `isEnabled` を使っており、
// **起動モードと期待値が同一規則**であることがこの spec の前提。
const expectHsts =
    !isEnabled("E2E_USE_DEV") &&
    process.env.VERCEL_ENV !== "preview" &&
    (process.env.VERCEL_ENV === "production" || isEnabled("HSTS_ENABLED"));

// 拡張ディレクティブも next.config.mjs と同じ順序で期待値を組み立てる
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
            // リダイレクトを追わず、そのレスポンス自体のヘッダを検証する。
            //
            // ブラウザのページ遷移と同じヘッダを明示的に送る。Clerk の `auth.protect()`
            // は「文書リクエストならサインインへ 3xx / それ以外は 404」と振る舞いを
            // 変えるため、既定の APIRequestContext（`Accept: */*`・`Sec-Fetch-*` なし）
            // では保護ルートが 404 を返し、下のステータス検証が落ちる。
            const response = await request.get(path, {
                maxRedirects: 0,
                headers: {
                    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "sec-fetch-dest": "document",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "none",
                },
            });

            // ヘッダは 500 エラーページにも付与されるため、ステータスを検証しないと
            // アプリが壊れていてもこのテストは緑のままになる。`/` は 200、
            // `/checkout` は未認証でサインインへの 3xx を返すので 4xx/5xx を弾く。
            expect(response.status(), `${path} のステータス`).toBeLessThan(400);

            const headers = response.headers(); // キーは小文字に正規化済み

            for (const [name, value] of Object.entries(CORE_SECURITY_HEADERS)) {
                expect(headers[name], `${path} の ${name}`).toBe(value);
            }

            // HSTS は本番ドメインのみ。付与条件を鏡写しにして「無条件適用」への
            // 退行（明示シグナルなしでも付く / 非本番でも preload が付く）も、
            // 本番で消える退行も両方検知する。
            if (expectHsts) {
                expect(headers[HSTS_HEADER], `${path} の ${HSTS_HEADER}`).toBe(
                    HSTS_VALUE
                );
            } else {
                expect(
                    headers[HSTS_HEADER],
                    `${path} の ${HSTS_HEADER}（本番ドメインの明示シグナルがなければ付与しない）`
                ).toBeUndefined();
            }
        });
    }
});
