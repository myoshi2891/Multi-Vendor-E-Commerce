// React, Nextjs
import { redirect } from "next/navigation";
import { ReactNode } from "react";

// Clerk
import { currentUser } from "@clerk/nextjs/server";

// Header
import Header from "@/components/dashboard/header/Header";

// Sidebar
import Sidebar from "@/components/dashboard/sidebar/sidebar";
export default async function AdminDashboardLayout({
	children,
}: {
	children: ReactNode;
}) {
	// Block non admins from accessing the admin dashboard
	const user = await currentUser();

	if (!user || user.privateMetadata.role !== "ADMIN") redirect("/");
	return (
		<div className="size-full">
			{/* Sidebar */}
			<Sidebar isAdmin />
			<div className="ml-[300px]">
				{/* Header */}
				<Header />
				<div className="mt-[75px] w-full p-4">{children}</div>
			</div>
		</div>
	);
}
