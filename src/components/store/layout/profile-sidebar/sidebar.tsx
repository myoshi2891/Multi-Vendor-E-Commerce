"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import styles from "@/components/store/profile/profile.module.css";

export default function ProfileSidebar() {
    const pathname = usePathname();
    return (
        <aside className={styles.sidebar}>
            <p className={styles.sidebarTitle}>Your account</p>
            <nav aria-label="Account navigation" className={styles.nav}>
                {menu.map((item) => {
                    const base = item.link.endsWith("/1")
                        ? item.link.slice(0, -2)
                        : item.link;
                    const active =
                        pathname === base ||
                        (base !== "/profile" &&
                            pathname.startsWith(`${base}/`));
                    return (
                        <Link
                            key={item.link}
                            href={item.link}
                            aria-current={active ? "page" : undefined}
                        >
                            <span>{item.title}</span>
                            <ArrowUpRight size={14} aria-hidden="true" />
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}

const menu = [
    {
        title: "Overview",
        link: "/profile",
    },
    {
        title: "Orders",
        link: "/profile/orders",
    },
    {
        title: "Payment",
        link: "/profile/payment",
    },
    {
        title: "Shipping address",
        link: "/profile/addresses",
    },
    {
        title: "Reviews",
        link: "/profile/reviews",
    },
    {
        title: "Messages",
        link: "/profile/messages",
    },
    {
        title: "History",
        link: "/profile/history/1",
    },
    {
        title: "Wishlist",
        link: "/profile/wishlist/1",
    },
    {
        title: "Following",
        link: "/profile/following/1",
    },
    {
        title: "Settings",
        link: "/profile/settings",
    },
];
