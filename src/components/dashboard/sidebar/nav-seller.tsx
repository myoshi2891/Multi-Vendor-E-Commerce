"use client";

import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { icons } from "@/constants/icons";
import { DashboardSidebarMenuInterface } from "@/lib/types";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SideBarNavSeller({
    menuLinks,
    design,
}: {
    design?: "seller";
    menuLinks: DashboardSidebarMenuInterface[];
}) {
    const pathname = usePathname();
    const storeUrlStart = pathname.split("/stores/")[1];
    const activeStore = storeUrlStart ? storeUrlStart.split("/")[0] : "";
    const isActive = (link: DashboardSidebarMenuInterface) =>
        link.link === ""
            ? pathname === `/dashboard/seller/stores/${activeStore}`
            : `/dashboard/seller/stores/${activeStore}/${link.link}` ===
              pathname;

    // cmdk の CommandItem（role="option"）にリンクを入れると nested-interactive になるため、
    // seller design は nav-admin と同じく素のリンクで描画する
    if (design === "seller")
        return (
            <nav aria-label="Store pages" className="relative grow py-2">
                {menuLinks.map((link) => {
                    const Icon = icons.find(
                        (icon) => icon.value === link.icon
                    )?.path;
                    return (
                        <Link
                            key={link.link}
                            href={`/dashboard/seller/stores/${activeStore}/${link.link}`}
                            aria-current={isActive(link) ? "page" : undefined}
                            className={cn(
                                "mt-1 flex h-12 w-full items-center gap-2 rounded-md px-2 transition-all hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                isActive(link) &&
                                    "bg-accent text-accent-foreground"
                            )}
                        >
                            {Icon && (
                                <span aria-hidden="true" className="contents">
                                    <Icon />
                                </span>
                            )}
                            <span>{link.label}</span>
                        </Link>
                    );
                })}
            </nav>
        );

    return (
        <nav className="relative grow">
            <Command className="overflow-visible rounded-lg bg-transparent">
                <CommandInput placeholder="Search..." />
                <CommandList className="overflow-visible py-2">
                    <CommandEmpty>No Links Found.</CommandEmpty>
                    <CommandGroup className="relative overflow-visible pt-0">
                        {menuLinks.map((link, index) => {
                            let icon;
                            const iconSearch = icons.find(
                                (icon) => icon.value === link.icon
                            );
                            if (iconSearch) icon = <iconSearch.path />;
                            return (
                                <CommandItem
                                    key={index}
                                    className={cn(
                                        "mt-1 h-12 w-full cursor-pointer",
                                        {
                                            "bg-accent text-accent-foreground":
                                                isActive(link),
                                        }
                                    )}
                                >
                                    <Link
                                        href={`/dashboard/seller/stores/${activeStore}/${link.link}`}
                                        className="flex w-full items-center gap-2 rounded-md transition-all hover:bg-transparent"
                                    >
                                        {icon}
                                        <span>{link.label}</span>
                                    </Link>
                                </CommandItem>
                            );
                        })}
                    </CommandGroup>
                </CommandList>
            </Command>
        </nav>
    );
}
