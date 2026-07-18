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
            // HTTPS 強制（本番のみ意味を持つ。max-age は 2 年）
            {
                key: 'Strict-Transport-Security',
                value: 'max-age=63072000; includeSubDomains; preload',
            },
        ];
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
