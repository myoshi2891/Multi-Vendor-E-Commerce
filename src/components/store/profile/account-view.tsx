import type { ReactNode } from "react";
import OrdersOverview from "./orders-overview";
import styles from "./profile.module.css";

/**
 * アカウント概要の表示枠（見出し・会員情報・注文概要）。
 * 会員情報は Server Component（`ProfileOverview`）なので呼び出し側で `identity` として渡す。
 * page と browser fixture が同じ構成を共有し、構成の複製によるドリフトを防ぐ。
 */
export default function AccountView({ identity }: { identity: ReactNode }) {
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
                {identity}
                <OrdersOverview />
            </div>
        </>
    );
}
