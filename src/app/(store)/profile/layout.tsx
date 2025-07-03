import StoreHeader from "@/components/store/layout/header/header";
import ProfileSidebar from "@/components/store/layout/profile-sidebar/sidebar";
import { ReactNode } from "react";

export default function ProfileLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-[#f5f5f5]">
            <StoreHeader />
            <div className="mx-auto flex max-w-container gap-4 p-4">
                <ProfileSidebar />
                <div className="mt-12 w-full">{children}</div>
            </div>
        </div>
    );
}
