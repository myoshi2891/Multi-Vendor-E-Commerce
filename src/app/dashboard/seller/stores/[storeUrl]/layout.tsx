// React, Next.js
import { ReactNode } from "react";
import { redirect } from "next/navigation";
//Custom UI components
import Header from "@/components/dashboard/header/header";
import Sidebar from "@/components/dashboard/sidebar/sidebar";
// Clerk
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
export default async function SellerStoreDashboardLayout({
	children,
}: {
	children: ReactNode;
    }) {
    // Fetch the current user. If the user is not authenticated, redirect to the home page.
    const user = await currentUser();
    if (!user) {
        redirect("/");
        return; // Ensure no further code is executed after the redirect.
    }

    // Retrieve the list of stores associated with the authenticated user.
    const stores = await db.store.findMany({
        where: {
            userId: user.id,
        },
    });

    // Render the dashboard layout with the sidebar and the child component.
    return (
		<div className="h-full w-full flex">
			<Sidebar stores={stores} />
            <div className="w-full ml-[300px]">
                <Header />
                <div className="w-full mt-[75px] p-4">{children}</div>
            </div>
		</div>
	);
}
