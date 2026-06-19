import { UserProfile } from "@clerk/nextjs";

/**
 * 顧客アカウント設定ページ。
 * Clerk の <UserProfile /> を埋め込み、氏名/メール編集・パスワード変更・MFA・
 * アカウント削除を提供する。これらの編集は Clerk webhook (user.updated /
 * user.deleted) 経由で Prisma User に自動同期される（src/app/api/webhooks/route.ts）。
 *
 * routing="hash" を用いることで catch-all route ([[...rest]]) を不要にする。
 * src/queries 経由の DB 呼び出しが無いため force-dynamic は付与しない。
 */
export default function ProfileSettingsPage() {
    return (
        <div className="bg-white px-6 py-4">
            <h1 className="mb-3 text-lg font-bold">Account settings</h1>
            <UserProfile
                routing="hash"
                appearance={{
                    elements: {
                        // profile レイアウト(サイドバー 296px)と干渉しないよう
                        // カード幅を内側に収める。実値は実装時に screenshot 調整。
                        rootBox: "w-full",
                        cardBox: "w-full shadow-none",
                    },
                }}
            />
        </div>
    );
}
