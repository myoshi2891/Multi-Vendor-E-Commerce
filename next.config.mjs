/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
            },
            {
                protocol: 'https',
                hostname: 'img.clerk.com',
            },
        ],
    },
    async headers() {
        const securityHeaders = [
            // クリックジャッキング防御（/checkout の決済面が第三者に frame されるのを防ぐ）
            { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
            // MIME スニッフィング防御
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            // リファラ漏洩の最小化
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            // 未使用のブラウザ機能を無効化
            {
                key: 'Permissions-Policy',
                value: 'camera=(), microphone=(), geolocation=()',
            },
        ];

        // HSTS は「本番ドメイン」でのみ付与する。非本番（localhost / Vercel preview の
        // *.vercel.app 等）へ送ると、HTTPS で配信される preview では実際にブラウザへ記録される。
        //
        // 判定軸は**環境名ではなく配信先**である。`NODE_ENV=production` は「本番ドメインで
        // 配信されている」ことを意味しない —— self-host の staging・社内環境・レビュー環境も
        // production ビルドで動く。base の `max-age=63072000`（2 年）も取り消しは容易でない
        // （そのホストから `max-age=0` を残存 TTL の間ずっと配信し、しかも再訪した
        // ブラウザにしか届かない）ため、拡張ディレクティブと同じく明示シグナルを必須とする。
        const isProduction = process.env.NODE_ENV === 'production';
        const isVercelPreview = process.env.VERCEL_ENV === 'preview';
        const isVercelProduction = process.env.VERCEL_ENV === 'production';

        const isEnabled = (name) => process.env[name]?.trim() === '1';

        // 実際の配信先が本番であることを示すシグナル。Vercel は `VERCEL_ENV` で本番を
        // 自己申告するので追加設定は不要。self-host はドメイン所有者が `HSTS_ENABLED=1` を
        // 明示的に立てる。どちらも無ければ HSTS は付与しない（fail safe）。
        const isProductionDomain = isVercelProduction || isEnabled('HSTS_ENABLED');

        // `includeSubDomains` / `preload` はさらに個別の opt-in を必須とする。
        // 全サブドメインの HTTPS 強制と preload リスト入り（取り消しに数週間〜数ヶ月かかる
        // 非可逆操作）は、本番ドメインであっても所有者が個別に選ぶべき設定であるため。
        // preload はブラウザ要件として includeSubDomains を伴う必要があるため、
        // HSTS_PRELOAD=1 のときは includeSubDomains も強制する（不完全な preload 宣言を防ぐ）
        const withPreload = isEnabled('HSTS_PRELOAD');
        const withSubDomains = withPreload || isEnabled('HSTS_INCLUDE_SUBDOMAINS');

        // `!isVercelPreview` は `isProductionDomain` と重複しない拒否条件として残す:
        // Vercel でプロジェクト全体に `HSTS_ENABLED=1` を設定すると preview デプロイにも
        // 環境変数が渡るため、preview は無条件に除外しておく必要がある。
        if (isProduction && !isVercelPreview && isProductionDomain) {
            const directives = ['max-age=63072000']; // 2 年
            if (withSubDomains) directives.push('includeSubDomains');
            if (withPreload) directives.push('preload');

            securityHeaders.push({
                key: 'Strict-Transport-Security',
                value: directives.join('; '),
            });
        }

        return [
            {
                // すべてのルート（ページ・API・静的アセット）に適用
                source: '/:path*',
                headers: securityHeaders,
            },
        ];
    },
}

export default nextConfig;
