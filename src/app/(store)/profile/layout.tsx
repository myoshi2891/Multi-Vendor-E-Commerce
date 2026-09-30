import ProfileSidebar from "@/components/store/layout/profile-sidebar/sidebar";
import styles from "@/components/store/profile/profile.module.css";
import Link from "next/link";
import { ReactNode } from "react";

/** 顧客アカウント共通枠。認証はrequest proxyで保護する。 */
export default function ProfileLayout({ children }: { children: ReactNode }) {
    return (
        <div className={styles.shell} data-profile-shell>
            <header className={styles.hero}>
                <div className={styles.heroInner}>
                    <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
                        <Link href="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <Link href="/profile">Account</Link>
                    </nav>
                    <p className={styles.heroLabel}>
                        A little space, just for you.
                    </p>
                </div>
            </header>
            <div className={styles.frame}>
                <ProfileSidebar />
                <main className={styles.main}>{children}</main>
            </div>
        </div>
    );
}
