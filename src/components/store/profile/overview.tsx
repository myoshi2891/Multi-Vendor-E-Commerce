import { currentUser } from "@clerk/nextjs/server";
import { Eye, Heart, Puzzle, Rss, WalletCards } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default async function ProfileOverview() {
    const user = await currentUser();
    if (!user) return;

    return (
        <div className="w-full bg-red-500">
            <div className="border bg-white p-4 shadow-sm">
                <div className="flex items-center">
                    <Image
                        src={user.imageUrl}
                        alt={user.fullName || "User Profile"}
                        width={200}
                        height={200}
                        className="size-14 rounded-full object-cover"
                        priority
                    />
                    <div className="ml-4 flex-1 text-xl font-bold capitalize text-main-primary">
                        {user.fullName?.toLowerCase()}
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap py-4">
                    {menu.map((item) => (
                        <Link
                            key={item.title}
                            href={item.link}
                            className="relative flex w-36 cursor-pointer flex-col items-center justify-center"
                        >
                            <div className="text-3xl">
                                <span>{item.icon}</span>
                            </div>
                            <div className="mt-2">{item.title}</div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

const menu = [
    {
        title: "Wishlist",
        icon: <Heart />,
        link: "/profile/wishlist",
    },
    {
        title: "Following",
        icon: <Rss />,
        link: "/profile/following/1",
    },
    {
        title: "Viewed",
        icon: <Eye />,
        link: "/profile/history/1",
    },
    {
        title: "Coupons",
        icon: <Puzzle />,
        link: "/profile/coupons",
    },
    {
        title: "Shopping credit",
        icon: <WalletCards />,
        link: "/profile/credit",
    },
];
