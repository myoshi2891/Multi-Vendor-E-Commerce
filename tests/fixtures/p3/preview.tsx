import Link from "next/link";
import React from "react";
import { createRoot } from "react-dom/client";
import AdminCouponsPage from "@/app/dashboard/admin/coupons/page";
import NewCategoryPage from "@/app/dashboard/admin/categories/new/page";
import CategoriesPage from "@/app/dashboard/admin/categories/page";
import LegalPage from "@/app/(store)/legal/page";
import NewCouponPage from "@/app/dashboard/seller/stores/[storeUrl]/coupons/new/page";
import CouponsPage from "@/app/dashboard/seller/stores/[storeUrl]/coupons/page";
import StoresPage from "@/app/dashboard/admin/stores/page";
import OrdersPage from "@/app/dashboard/admin/orders/page";
import Page from "@/app/dashboard/admin/page";
import Sidebar from "@/components/dashboard/sidebar/sidebar";
import Header from "@/components/dashboard/header/Header";
import DataTable from "@/components/ui/data-table";
import Shell from "@/components/dashboard/design/seller-shell";
import ModalProvider from "@/providers/modal-provider";
async function preview() {
    const screen = new URLSearchParams(location.search).get("screen");
    const admin = !["coupons", "newcoupon"].includes(screen ?? "overview");
    const sidebar = admin ? (
        await Sidebar({ isAdmin: true, design: "seller" })
    ) : (
        <nav aria-label="Store navigation">
            <Link href="/?screen=coupons">Coupons</Link>
        </nav>
    );
    const content =
        screen === "admincoupons" ? (
            await AdminCouponsPage()
        ) : screen === "newcategory" ? (
            await NewCategoryPage()
        ) : screen === "categories" ? (
            await CategoriesPage()
        ) : screen === "legacy" ? (
            <section aria-label="Legacy P4 content">
                <DataTable
                    data={[{ name: "Example category" }]}
                    columns={[{ accessorKey: "name", header: "Name" }]}
                    filterValue="name"
                    searchPlaceholder="Search category ..."
                    actionButtonText="Create New Category"
                    modalChildren={<p>Legacy form</p>}
                    newTabLink="/dashboard/admin/categories/new"
                />
            </section>
        ) : screen === "legal" ? (
            <LegalPage />
        ) : screen === "newcoupon" ? (
            await NewCouponPage({
                params: Promise.resolve({ storeUrl: "example" }),
            })
        ) : screen === "coupons" ? (
            await CouponsPage({
                params: Promise.resolve({ storeUrl: "example" }),
            })
        ) : screen === "stores" ? (
            await StoresPage()
        ) : new URLSearchParams(location.search).get("screen") === "orders" ? (
            await OrdersPage({ searchParams: Promise.resolve({}) })
        ) : (
            await Page()
        );
    createRoot(document.getElementById("root")!).render(
        <ModalProvider>
            {screen === "legal" ? (
                content
            ) : (
                <Shell
                    navigationLabel={
                        admin ? "Administration navigation" : "Store navigation"
                    }
                    sidebar={sidebar}
                    header={<Header design="seller" />}
                >
                    {content}
                </Shell>
            )}
        </ModalProvider>
    );
}
void preview();
