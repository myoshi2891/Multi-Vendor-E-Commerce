import { currentUser } from "@clerk/nextjs/server";
import {
    ArrowUpRight,
    Eye,
    Heart,
    Puzzle,
    Rss,
    WalletCards,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import styles from "./profile.module.css";

const shortcuts = [
    { title: "Wishlist", icon: Heart, href: "/profile/wishlist" },
    { title: "Following", icon: Rss, href: "/profile/following/1" },
    { title: "Viewed", icon: Eye, href: "/profile/history/1" },
];
const upcoming = [
    { title: "Coupons", icon: Puzzle },
    { title: "Shopping credit", icon: WalletCards },
];

export default async function ProfileOverview() {
    let user;
    try {
        user = await currentUser();
    } catch {
        return (
            <div role="alert" className={styles.error}>
                <p>Account details are unavailable. Please try again.</p>
                <a href="/profile">Reload account</a>
            </div>
        );
    }
    if (!user) return null;
    const name = user.fullName?.trim() || "Your account";
    return (
        <section
            aria-labelledby="profile-identity-title"
            className={styles.identity}
        >
            <div className={styles.identityHeader}>
                <Image
                    src={user.imageUrl}
                    alt={name}
                    width={64}
                    height={64}
                    className={styles.avatar}
                    priority
                />
                <div className={styles.identityCopy}>
                    <p className={styles.eyebrow}>WELCOME BACK</p>
                    <h2 id="profile-identity-title">{name}</h2>
                </div>
                <Link href="/profile/settings" className={styles.settings}>
                    Account settings{" "}
                    <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
            </div>
            <nav aria-label="Account shortcuts" className={styles.shortcuts}>
                {shortcuts.map(({ title, icon: Icon, href }) => (
                    <Link key={href} href={href} className={styles.shortcut}>
                        <Icon size={22} strokeWidth={1.4} aria-hidden="true" />
                        <span>{title}</span>
                    </Link>
                ))}
                {upcoming.map(({ title, icon: Icon }) => (
                    <div
                        key={title}
                        className={`${styles.shortcut} ${styles.unavailable}`}
                    >
                        <Icon size={22} strokeWidth={1.4} aria-hidden="true" />
                        <span>{title}</span>
                        <small>Coming soon</small>
                    </div>
                ))}
            </nav>
        </section>
    );
}
