// React, Next.js
import { ReactNode } from "react";
import { redirect } from "next/navigation";
//Custom UI components
import Header from "@/components/dashboard/header/Header";
import Sidebar from "@/components/dashboard/sidebar/sidebar";
// Clerk
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Store } from "@prisma/client";
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
    if (user.privateMetadata.role !== "SELLER") {
        redirect("/");
        return;
    }

    // Retrieve the list of stores associated with the authenticated user.
    let stores: Store[] = [];
    try {
        stores = await db.store.findMany({
            where: {
                userId: user.id,
            },
        });
    } catch (error) {
        if (error instanceof Error) {
            console.error("Error retrieving stores for seller dashboard:", error.message, error.stack);
        } else {
            console.error("Error retrieving stores for seller dashboard:", String(error));
        }
    }

    // Render the dashboard layout with the sidebar and the child component.
    return (
		<div className="flex size-full">
			<Sidebar stores={stores} />
            <div className="ml-[300px] w-full">
                <Header />
                <div className="mt-[75px] w-full p-4">{children}</div>
            </div>
		</div>
	);
}
