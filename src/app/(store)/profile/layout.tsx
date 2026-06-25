import ProfileSidebar from "@/components/store/layout/profile-sidebar/sidebar";
import { ReactNode } from "react";

/**
 * Wraps page content in the store profile layout, rendering the sidebar and main content area.
 * ヘッダー/フッターは (store) レイアウトが供給する。
 *
 * @param children - Content to display inside the profile's main content region.
 * @returns The layout JSX element containing the sidebar and provided children.
 */
export default async function ProfileLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-[#f5f5f5]">
            <div className="mx-auto flex max-w-container gap-4 p-4">
                <ProfileSidebar />
                <main className="mt-12 w-full">{children}</main>
            </div>
        </div>
    );
}
