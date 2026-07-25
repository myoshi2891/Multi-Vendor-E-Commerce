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
        // したがって NODE_ENV=production かつ Vercel の preview デプロイでない場合に限定する
        // （`VERCEL_ENV` は本番=production / preview / development）。
        const isProduction = process.env.NODE_ENV === 'production';
        const isVercelPreview = process.env.VERCEL_ENV === 'preview';

        // `includeSubDomains` / `preload` は環境名だけで有効化しない（明示 opt-in を必須とする）。
        // NODE_ENV=production は「本番ドメインで配信されている」ことを意味しない —— self-host の
        // staging や社内環境も production ビルドで動くため、環境名だけを条件にすると
        // 全サブドメインの HTTPS 強制と preload リスト入り（取り消しに数週間〜数ヶ月かかる
        // 非可逆操作）を、その意図がないドメインで誤発火させる。ドメインの所有者が明示的に
        // 選ぶべき設定なので、環境変数の opt-in に切り出す。
        const isEnabled = (name) => process.env[name]?.trim() === '1';
        // preload はブラウザ要件として includeSubDomains を伴う必要があるため、
        // HSTS_PRELOAD=1 のときは includeSubDomains も強制する（不完全な preload 宣言を防ぐ）
        const withPreload = isEnabled('HSTS_PRELOAD');
        const withSubDomains = withPreload || isEnabled('HSTS_INCLUDE_SUBDOMAINS');

        if (isProduction && !isVercelPreview) {
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
