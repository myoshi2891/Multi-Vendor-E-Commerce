import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { User } from "@clerk/nextjs/server";

export default function UserInfo({
    user,
    design,
}: {
    user: User | null;
    design?: "seller";
}) {
    const role = user?.privateMetadata.role?.toString() || "USER";

    if (design === "seller")
        return (
            <div className="flex min-w-0 items-start gap-3 py-4">
                <Avatar className="size-12">
                    <AvatarImage
                        src={user?.imageUrl}
                        alt={`${user?.firstName} ${user?.lastName}`}
                    />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                        {user?.firstName?.[0]}
                        {user?.lastName?.[0]}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <p>
                        {user?.firstName} {user?.lastName}
                    </p>
                    <p className="break-words text-muted-foreground">
                        {user?.emailAddresses[0]?.emailAddress}
                    </p>
                    <Badge variant="secondary" className="whitespace-normal">
                        {role.toLocaleLowerCase()} Dashboard
                    </Badge>
                </div>
            </div>
        );
    return (
        <div>
            <div className="">
                <Button
                    className="mb-4 mt-5 flex w-full items-center justify-between py-10"
                    variant="ghost"
                >
                    <div className="flex items-center gap-2 text-left">
                        <Avatar className="size-16">
                            <AvatarImage
                                src={user?.imageUrl}
                                alt={`${user?.firstName} ${user?.lastName}`}
                            />
                            <AvatarFallback className="bg-primary text-white">
                                {user?.firstName} {user?.lastName}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col gap-y-1">
                            {user?.firstName} {user?.lastName}
                            <span className="text-muted-foreground">
                                {user?.emailAddresses[0].emailAddress}
                            </span>
                            <span className="w-fit">
                                <Badge
                                    variant="secondary"
                                    className="capitalize"
                                >
                                    {role.toLocaleLowerCase()} Dashboard
                                </Badge>
                            </span>
                        </div>
                    </div>
                </Button>
            </div>
        </div>
    );
}
