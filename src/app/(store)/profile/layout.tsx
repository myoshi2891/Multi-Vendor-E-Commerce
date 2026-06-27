import ProfileSidebar from "@/components/store/layout/profile-sidebar/sidebar";
import { ReactNode } from "react";

/**
 * Wraps profile page content in the store profile layout.
 *
 * @param children - Content to display in the main profile area.
 * @returns The layout JSX element containing the sidebar and provided content.
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
