import { upsertStore } from "@/queries/store";
import StoreDetails from "@/components/dashboard/forms/store-details";
import SellerPage from "@/components/dashboard/design/seller-page";
import ThemeToggle from "@/components/shared/theme-toggle";
import Link from "next/link";
import styles from "@/components/dashboard/design/seller.module.css";

export default function SellerNewStorePage() {
    return (
        <div className={`${styles.theme} ${styles.standalone}`}>
            <header className={styles.standaloneHeader}>
                <Link href="/dashboard/seller">Seller workspace</Link>
                <ThemeToggle design="seller" />
            </header>
            <main className={styles.standaloneMain}>
                <SellerPage
                    id="create-store-heading"
                    title="Create store"
                    description="Add your store profile, images and contact information."
                >
                    <StoreDetails
                        upsertStoreAction={upsertStore}
                        design="seller"
                    />
                </SellerPage>
            </main>
        </div>
    );
}
