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

        // HSTS は「本番ドメイン」でのみ付与する。`includeSubDomains; preload` を
        // 非本番（localhost / Vercel preview の *.vercel.app 等）へ送ると、HTTPS で
        // 配信される preview では実際にブラウザへ記録され、全サブドメインの HTTPS 強制と
        // preload リスト入り（取り消しに数週間〜数ヶ月かかる非可逆操作）を誤って引き起こす。
        // したがって全環境・全サブドメインへ無条件適用せず、NODE_ENV=production かつ
        // Vercel の preview デプロイでない場合に限定する（`VERCEL_ENV` は本番=production /
        // preview / development）。
        const isProduction = process.env.NODE_ENV === 'production';
        const isVercelPreview = process.env.VERCEL_ENV === 'preview';
        if (isProduction && !isVercelPreview) {
            securityHeaders.push({
                // HTTPS 強制（max-age は 2 年）
                key: 'Strict-Transport-Security',
                value: 'max-age=63072000; includeSubDomains; preload',
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
