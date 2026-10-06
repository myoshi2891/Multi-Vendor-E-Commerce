import { cookies } from "next/headers";
import { parseUserCountryCookie } from "@/lib/utils";
import UserMenu from "./user-menu/user-menu";
import StoreHeaderFrame from "./header-frame";

export default async function StoreHeader() {
    const cookieStore = await cookies();
    const userCountry = parseUserCountryCookie(
        cookieStore.get("userCountry")?.value
    );
    return (
        <StoreHeaderFrame
            userCountry={userCountry}
            accountMenu={<UserMenu disclosureName="store-header-panel" />}
        />
    );
}
