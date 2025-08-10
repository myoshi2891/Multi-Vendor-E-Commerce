import Input from "@/components/store/ui/input";
import { UserButton, useUser } from "@clerk/nextjs";
import Image from "next/image";
import { useRef } from "react";

export default function UserDetails() {
    const { user } = useUser();
    const btnContainerRef = useRef<HTMLDivElement|null>(null)

    const handleImageClick = () => {
        const userButton = btnContainerRef.current?.querySelector('button')
        if (userButton) {
            userButton.click()
        }
    }
    return (
        <div className="flex w-full flex-col items-center justify-center gap-y-4">
            <div className="relative">
                {/* User Image */}
                <Image
                    src={user?.imageUrl!}
                    alt="User Image"
                    width={200}
                    height={200}
                    className="rounded-full object-cover"
                    priority
                    onClick={handleImageClick}
                />
                {/* Hidden UserButton */}
                <div
                    ref={btnContainerRef}
                    className="pointer-events-none absolute inset-0 z-0 opacity-0">
                    <UserButton />
                </div>
            </div>
            {/* First Name Input */}
            <Input
                name="firstName"
                value={user?.firstName || ""}
                onChange={() => {}}
                type="text"
                readonly
            />
            {/* Last Name Input */}
            <Input
                name="lastName"
                value={user?.lastName || ""}
                onChange={() => {}}
                type="text"
                readonly
            />
        </div>
    );
}
