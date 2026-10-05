import Input from "@/components/store/ui/input";
import { UserButton, useUser } from "@clerk/nextjs";
export default function UserDetails() {
    const { user } = useUser();
    return (
        <div className="flex w-full flex-col gap-4">
            <div className="self-center">
                <UserButton
                    appearance={{ elements: { avatarBox: "size-24" } }}
                />
            </div>
            <label>
                First name
                <Input
                    name="firstName"
                    value={user?.firstName || ""}
                    onChange={() => {}}
                    type="text"
                    readonly
                />
            </label>
            <label>
                Last name
                <Input
                    name="lastName"
                    value={user?.lastName || ""}
                    onChange={() => {}}
                    type="text"
                    readonly
                />
            </label>
        </div>
    );
}
