import { SignOutButton } from "@clerk/nextjs";
import DismissibleDetails from "../dismissible-details";
import ClientUserButton from "./client-user-button";
import { UserIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { MessageIcon, OrderIcon, WishlistIcon } from "../../../icons";
import styles from "../panels.module.css";

export default function AccountMenu({
    user,
    disclosureName,
}: Readonly<{
    user: { imageUrl: string; fullName: string | null } | null;
    disclosureName?: string;
}>) {
    return (
        <DismissibleDetails
            className={`${styles.theme} ${styles.account}`}
            name={disclosureName}
        >
            <summary aria-label="Account menu" className={styles.trigger}>
                {user ? (
                    <Image
                        src={user.imageUrl}
                        alt={user.fullName || "Your account"}
                        width={40}
                        height={40}
                        className="size-10 rounded-full object-cover"
                    />
                ) : (
                    <UserIcon color="#f3f0e8" aria-hidden="true" />
                )}
            </summary>
            <div className={`${styles.panel} ${styles.accountPanel}`}>
                <h2 className={styles.heading}>Your account</h2>
                {user ? (
                    <>
                        <ClientUserButton />
                        <SignOutButton>
                            <button type="button" className={styles.secondary}>
                                Sign out
                            </button>
                        </SignOutButton>
                    </>
                ) : (
                    <>
                        <Link href="/sign-in" className={styles.primary}>
                            Sign in
                        </Link>
                        <Link href="/sign-up" className={styles.secondary}>
                            Register
                        </Link>
                    </>
                )}
                <ul className={styles.quickLinks}>
                    {links.map((item) => (
                        <li key={item.link}>
                            <Link href={item.link}>
                                <span aria-hidden="true">{item.icon}</span>
                                {item.title}
                            </Link>
                        </li>
                    ))}
                </ul>
                <ul className={styles.links}>
                    {extraLinks.map((item) => (
                        <li key={item.link}>
                            <Link href={item.link}>{item.title}</Link>
                        </li>
                    ))}
                </ul>
            </div>
        </DismissibleDetails>
    );
}
const links = [
    {
        icon: <OrderIcon />,
        title: "My Orders",
        link: "/profile/orders",
    },
    {
        icon: <MessageIcon />,
        title: "Messages",
        link: "/profile/messages",
    },
    {
        icon: <WishlistIcon />,
        title: "WishList",
        link: "/profile/wishlist",
    },
];
const extraLinks = [
    {
        title: "Profile",
        link: "/profile",
    },
    {
        title: "Settings",
        link: "/profile/settings",
    },
    {
        title: "Become a Seller",
        link: "/seller/apply",
    },
    {
        title: "Help Center",
        link: "/customer-service",
    },
    {
        title: "Return & Refund Policy",
        link: "/returns-exchange",
    },
    {
        title: "Legal & Privacy",
        link: "/legal",
    },
    {
        title: "Discounts & Offers",
        link: "/offers",
    },
    {
        title: "Order Dispute Resolution",
        link: "/dispute",
    },
    {
        title: "Report a Problem",
        link: "/report-problem",
    },
];
