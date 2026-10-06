// React, Nextjs
import { redirect } from "next/navigation";
import { ReactNode } from "react";

// Clerk
import { currentUser } from "@clerk/nextjs/server";

// Header
import Header from "@/components/dashboard/header/Header";

// Sidebar
import Sidebar from "@/components/dashboard/sidebar/sidebar";
import SellerShell from "@/components/dashboard/design/seller-shell";
export default async function AdminDashboardLayout({
    children,
}: {
    children: ReactNode;
}) {
    // Block non admins from accessing the admin dashboard
    const user = await currentUser();

    if (!user || user.privateMetadata.role !== "ADMIN") redirect("/");
    return (
        <SellerShell
            navigationLabel="Administration navigation"
            sidebar={<Sidebar isAdmin design="seller" />}
            header={<Header design="seller" />}
        >
            {children}
        </SellerShell>
    );
}
