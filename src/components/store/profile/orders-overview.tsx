import Link from "next/link";
import {
    ArrowUpRight,
    CreditCard,
    Package,
    Truck,
    PackageCheck,
} from "lucide-react";
import styles from "./profile.module.css";

const orderLinks = [
    {
        title: "Unpaid",
        label: "お支払い待ち",
        icon: CreditCard,
        filter: "unpaid",
    },
    {
        title: "To be shipped",
        label: "発送待ち",
        icon: Package,
        filter: "toShip",
    },
    { title: "Shipped", label: "配送中", icon: Truck, filter: "shipped" },
    {
        title: "Delivered",
        label: "お届け済み",
        icon: PackageCheck,
        filter: "delivered",
    },
];
const supportLinks = [
    {
        title: "Order support",
        label: "ご注文に関するお問い合わせ",
        href: "/contact",
    },
    {
        title: "Open a dispute",
        label: "お取引の問題について相談する",
        href: "/dispute",
    },
];

export default function OrdersOverview() {
    return (
        <section
            aria-labelledby="profile-orders-title"
            className={styles.panel}
        >
            <div className={styles.panelHeading}>
                <div>
                    <p className={styles.eyebrow}>EVERY LITTLE DISCOVERY</p>
                    <h2 id="profile-orders-title">My orders</h2>
                </div>
                <Link href="/profile/orders">
                    View all orders{" "}
                    <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
            </div>
            <div className={styles.orderLinks}>
                {orderLinks.map(({ title, label, icon: Icon, filter }) => (
                    <Link
                        href={`/profile/orders/${filter}`}
                        key={filter}
                        className={styles.orderLink}
                    >
                        <Icon size={25} strokeWidth={1.4} aria-hidden="true" />
                        <span>{title}</span>
                        <small lang="ja">{label}</small>
                    </Link>
                ))}
            </div>
            <div className={styles.supportLinks}>
                {supportLinks.map((link) => (
                    <Link href={link.href} key={link.href}>
                        <span>
                            <span className={styles.supportTitle}>
                                {link.title}
                            </span>
                            <span lang="ja">{link.label}</span>
                        </span>
                        <ArrowUpRight size={18} aria-hidden="true" />
                    </Link>
                ))}
            </div>
        </section>
    );
}
