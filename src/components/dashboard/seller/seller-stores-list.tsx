import Image from "next/image";
import Link from "next/link";
import type { SellerStoresResult } from "@/queries/seller-stores";
import SellerPage from "@/components/dashboard/design/seller-page";
import ThemeToggle from "@/components/shared/theme-toggle";
import styles from "@/components/dashboard/design/seller.module.css";

const labels = {
    PENDING: "Pending",
    ACTIVE: "Active",
    BANNED: "Banned",
    DISABLED: "Disabled",
};

export default function SellerStoresList({
    result,
}: {
    result: SellerStoresResult;
}) {
    return (
        <div className={`${styles.theme} ${styles.standalone}`}>
            <header className={styles.standaloneHeader}>
                <Link className={styles.control} href="/dashboard/seller">
                    Seller workspace
                </Link>
                <ThemeToggle design="seller" />
            </header>
            <main className={styles.standaloneMain}>
                <SellerPage
                    id="seller-stores-heading"
                    title="Your stores"
                    description="Choose a store to manage its products, orders and settings."
                >
                    <Link
                        className={styles.control}
                        href="/dashboard/seller/stores/new"
                    >
                        Create store
                    </Link>
                    {!result.ok ? (
                        <div className={styles.panel}>
                            <p role="alert">
                                Unable to load your stores. Please try again.
                            </p>
                            {/* Full navigation must retry this URL even when the router caches its failed RSC payload. */}
                            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                            <a
                                className={styles.control}
                                href="/dashboard/seller/stores"
                            >
                                Try again
                            </a>
                        </div>
                    ) : result.stores.length === 0 ? (
                        <section
                            className={styles.panel}
                            aria-labelledby="empty-stores-heading"
                        >
                            <h2 id="empty-stores-heading">No stores yet</h2>
                            <p>
                                Create your first store to start building your
                                collection.
                            </p>
                        </section>
                    ) : (
                        <ul
                            className={styles.storeGrid}
                            aria-label="Your stores"
                        >
                            {result.stores.map((store) => (
                                <li key={store.id} className={styles.panel}>
                                    <Image
                                        src={
                                            store.logo ||
                                            "/assets/images/default-user.jpg"
                                        }
                                        alt={`${store.name} logo`}
                                        width={64}
                                        height={64}
                                        className={styles.storeLogo}
                                    />
                                    <h2>{store.name}</h2>
                                    <p>
                                        Status:{" "}
                                        <span>{labels[store.status]}</span>
                                    </p>
                                    <Link
                                        className={styles.control}
                                        href={`/dashboard/seller/stores/${encodeURIComponent(store.url)}`}
                                        aria-label={`Manage ${store.name}`}
                                    >
                                        Manage store
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </SellerPage>
            </main>
        </div>
    );
}
