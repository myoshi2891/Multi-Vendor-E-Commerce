import { auth } from "@clerk/nextjs/server";
import ProfileSidebar from "@/components/store/layout/profile-sidebar/sidebar";
import styles from "@/components/store/profile/profile.module.css";
import Link from "next/link";
import { ReactNode } from "react";

/**
 * 顧客アカウント共通枠。
 * 認証はここ（リソース側）で行う。proxy のパスマッチ保護は Next.js のルーティングと
 * 乖離し得るため使わない（plans/072）。データ取得側の Server Action も各自で検証する。
 */
export default async function ProfileLayout({
    children,
}: {
    children: ReactNode;
}) {
    const { userId, redirectToSignIn } = await auth();
    if (!userId) return redirectToSignIn();

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
