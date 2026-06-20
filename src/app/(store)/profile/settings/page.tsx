import { UserProfile } from "@clerk/nextjs";

/**
 * Renders the customer account settings page.
 *
 * Displays a heading and embeds Clerk's UserProfile component configured with
 * hash-based routing and styling overrides for layout compatibility.
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
