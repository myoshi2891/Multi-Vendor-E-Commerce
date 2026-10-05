import styles from "../design/seller.module.css";
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
import StoreSwitcher from "./store-switcher";

interface SideBarProps {
    isAdmin?: boolean;
    stores?: Store[];
    design?: "seller";
}

const Sidebar: FC<SideBarProps> = async ({ isAdmin, stores, design }) => {
    const user = await currentUser();

    return (
        <div
            className={
                design === "seller"
                    ? styles.sidebarContent
                    : "fixed inset-y-0 left-0 flex h-screen w-[300px] flex-col border-r p-4"
            }
        >
            <Logo width="100%" height="180px" />
            <span className="mt-3" />
            {user && <UserInfo user={user} />}
            {!isAdmin && stores && (
                <StoreSwitcher stores={stores} design={design} />
            )}
            {isAdmin ? (
                <SideBarNavAdmin menuLinks={adminDashboardSidebarOptions} design={design} />
            ) : (
                <SideBarNavSeller menuLinks={SellerDashboardSidebarOptions} />
            )}
        </div>
    );
};

export default Sidebar;
