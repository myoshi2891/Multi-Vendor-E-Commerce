import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { User } from '@clerk/nextjs/server'

export default function UserInfo({ user }: { user: User | null }) {
    const role = user?.privateMetadata.role?.toString() || 'USER'

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
    )
}
