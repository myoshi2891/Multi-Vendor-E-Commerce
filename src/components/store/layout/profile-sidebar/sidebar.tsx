"use client";
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
                </div>
            </div>
        </div>
    );
}
