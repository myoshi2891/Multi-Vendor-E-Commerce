import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { ChevronDown, Globe } from "lucide-react";
import Link from "next/link";
import Brand from "@/components/shared/brand";
import { Button } from "../../ui/button";

export default async function MinimalHeader() {
    const user = await currentUser();
    return (
        <div className="h-16 w-full border-b bg-transparent">
            <div className="mx-auto px-6">
                <div className="relative flex items-center justify-between py-2">
                    <Link href="/">
                        <Brand />
                    </Link>
                    <div className="flex items-center gap-x-2">
                        <div className="hidden items-center gap-x-1 sm:flex">
                            <Globe className="w-3" />
                            <div className="cursor-pointer py-2 text-sm text-main-primary">
                                English
                            </div>
                            <ChevronDown className="w-3" />
                        </div>
                        {user ? (
                            <UserButton />
                        ) : (
                            <Link href="/sign-in">
                                <Button variant="outline">Sign in</Button>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
