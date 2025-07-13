"use client";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ProfileSidebar() {
    const pathname = usePathname();
    const path = pathname.split("/profile/")[1];
    return (
        <div>
            <div className="w-full p-4 text-xs text-[#999]">
                <span>
                    <Link href="/">Home</Link>
                    <span className="mx-2">&gt;</span>
                </span>
                <span>
                    <Link href="/profile">Account</Link>
                    {pathname !== "/profile" && (
                        <span className="mx-2">&gt;</span>
                    )}
                </span>
                {path && (
                    <span>
                        <Link href={pathname} className="capitalize">
                            {path}
                        </Link>
                    </span>
                )}
            </div>
            <div className="bg-white">
                <div className="mr-6 inline-block min-h-72 w-[296px] py-3">
                    <div className="flex h-9 items-center px-4 font-bold text-main-primary">
                        <div className="truncate">Account</div>
                    </div>
                    {/* Links */}
                    {menu.map((item) => (
                        <Link key={item.link} href={item.link}>
                            <div
                                className={cn(
                                    "relative flex h-9 cursor-pointer items-center px-4 text-sm hover:bg-[#f5f5f5]",
                                    {
                                        "user-menu-item bg-[#f5f5f5]":
                                            item.link &&
                                            (pathname === item.link ||
                                                (pathname.startsWith(
                                                    item.link
                                                ) &&
                                                    item.link !== "/profile")),
                                    }
                                )}
                            >
                                <span>{item.title}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
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
];
