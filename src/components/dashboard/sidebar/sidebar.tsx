// React, Next.js
import { FC } from "react";

// Clerk
import { currentUser } from "@clerk/nextjs/server";

// Custom UI components
import Logo from "@/components/shared/logo";
import UserInfo from "./user-info";
import SideBarNavAdmin from "./nav-admin";
import SideBarNavSeller from "./nav-seller";

// Menu links
import {
	adminDashboardSidebarOptions,
	SellerDashboardSidebarOptions,
} from "@/constants/data";

// Prisma models
import { Store } from "@prisma/client";

interface SideBarProps {
	isAdmin?: boolean;
	stores?: Store[];
}

const Sidebar: FC<SideBarProps> = async ({ isAdmin }) => {
	const user = await currentUser();

	return (
		<div className="w-[300px] border-r h-screen p-4 flex flex-col fixed top-0 left-0 bottom-0">
			<Logo width="100%" height="180px" />
			<span className="mt-3" />
			{user && <UserInfo user={user} />}
			{isAdmin ? (
				<SideBarNavAdmin menuLinks={adminDashboardSidebarOptions} />
			) : (
				<SideBarNavSeller menuLinks={SellerDashboardSidebarOptions} />
			)}
		</div>
	);
};

export default Sidebar;
