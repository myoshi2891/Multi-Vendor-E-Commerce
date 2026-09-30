import type { Metadata } from "next";
import OrdersOverview from "@/components/store/profile/orders-overview";
import ProfileOverview from "@/components/store/profile/overview";
import styles from "@/components/store/profile/profile.module.css";

export const metadata: Metadata = {
    title: "My account | Luxuries for Happiness",
    description: "ご注文やお気に入り、アカウント情報を確認できます。",
};

export default function ProfilePage() {
    return (
        <>
            <header className={styles.pageHeading}>
                <p className={styles.eyebrow}>YOUR PERSONAL CORNER</p>
                <h1>My account</h1>
                <p lang="ja">
                    お気に入りも、お買い物の記録も。あなたのための場所。
                </p>
            </header>
            <div className={styles.overview}>
                <ProfileOverview />
                <OrdersOverview />
            </div>
        </>
    );
}
