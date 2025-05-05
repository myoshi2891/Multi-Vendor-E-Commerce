import { db } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function SellerDashboardPage() {
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

	// If the user has no stores, redirect to the store creation page.
	if (stores.length === 0) {
		redirect("/dashboard/seller/stores/new");
		return; // Ensure no further code is executed after the redirect.
	}

	// if the user has stores, render the dashboard page.
	redirect(`/dashboard/seller/stores/${stores[0].url}`);

	return <div>Seller DashboardPage</div>;
}
