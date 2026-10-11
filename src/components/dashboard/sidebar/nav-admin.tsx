"use client";

import { DashboardSidebarMenuInterface } from "@/lib/types";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

// cmdk の CommandItem（role="option"）にリンクを入れると nested-interactive になるため、
// 素のリンクで描画する（旧 cmdk 分岐は admin layout が使っておらず削除した）
export default function SideBarNavAdmin({
    menuLinks,
}: {
    menuLinks: DashboardSidebarMenuInterface[];
}) {
    const pathname = usePathname();
    return (
        <nav aria-label="Administration" className="flex flex-col gap-2">
            {menuLinks.map((link) => (
                <Link
                    key={link.link}
                    href={link.link}
                    aria-current={pathname === link.link ? "page" : undefined}
                    className={cn(
                        "block border px-3 py-3",
                        pathname === link.link &&
                            "bg-accent text-accent-foreground"
                    )}
                >
                    {link.label}
                </Link>
            ))}
        </nav>
    );
}
