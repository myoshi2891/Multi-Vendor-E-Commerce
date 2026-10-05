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
createRoot(document.getElementById("root")!).render(
    <ModalProvider>
        <SellerShell sidebar={sidebar} header={<Header design="seller" />}>
            <section className={styles.page}>
                <header className={styles.heading}>
                    <p className={styles.eyebrow}>Seller workspace</p>
                    <h1>Store overview</h1>
                    <p className={styles.description}>Manage your store.</p>
                </header>
                <div className={styles.panel}>Responsive brand foundation</div>
            </section>
        </SellerShell>
    </ModalProvider>
);
