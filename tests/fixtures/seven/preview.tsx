import Apply from "@/components/store/forms/apply-seller/apply-seller";
import type { applySeller } from "@/queries/store";
import ProfileSettingsPage from "@/app/(store)/profile/settings/page";
import Link from "next/link";
import React from "react";
import { createRoot } from "react-dom/client";
import SellerShell from "@/components/dashboard/design/seller-shell";
import Header from "@/components/dashboard/header/Header";
import styles from "@/components/dashboard/design/seller.module.css";
import ModalProvider from "@/providers/modal-provider";

const sidebar = (
    <nav aria-label="Store navigation">
        <p className={styles.eyebrow}>Seller workspace</p>
        <Link href="/?screen=overview">Overview</Link>
        <br />
        <Link href="/?screen=products">Products</Link>
        <br />
        <Link href="/?screen=inventory">Inventory</Link>
        <br />
        <Link href="/?screen=orders">Orders</Link>
        <br />
        <Link href="/?screen=messages">Messages</Link>
    </nav>
);
let applyAttempts = 0;
const applyAction: typeof applySeller = async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (++applyAttempts === 1) throw new Error("Fixture failure");
    return { id: "fixture-store" } as Awaited<ReturnType<typeof applySeller>>;
};
const screen = new URLSearchParams(location.search).get("screen");
createRoot(document.getElementById("root")!).render(
    screen === "apply" ? (
        <Apply applySellerAction={applyAction} />
    ) : screen === "settings" ? (
        <main>
            <ProfileSettingsPage />
        </main>
    ) : (
        <ModalProvider>
            <SellerShell sidebar={sidebar} header={<Header design="seller" />}>
                <section className={styles.page}>
                    <header className={styles.heading}>
                        <p className={styles.eyebrow}>Seller workspace</p>
                        <h1>Store overview</h1>
                        <p className={styles.description}>Manage your store.</p>
                    </header>
                    <div className={styles.panel}>
                        Responsive brand foundation
                    </div>
                </section>
            </SellerShell>
        </ModalProvider>
    )
);
