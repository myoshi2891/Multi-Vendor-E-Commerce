import AddressContainer from "@/components/store/profile/addresses/container";
import {
    getProfileShippingAddresses,
    saveProfileShippingAddress,
    makeProfileShippingAddressDefault,
} from "@/queries/user";
import type { ProfileAddressData } from "@/lib/profile-addresses";

export const dynamic = "force-dynamic";

export default async function ProfileAddressesPage() {
    let data: ProfileAddressData = { addresses: [], countries: [] };
    let initialError = false;
    try {
        data = await getProfileShippingAddresses();
    } catch {
        initialError = true;
    }
    return (
        <AddressContainer
            {...data}
            initialError={initialError}
            loadAddressesAction={getProfileShippingAddresses}
            saveAddressAction={saveProfileShippingAddress}
            makeDefaultAction={makeProfileShippingAddressDefault}
        />
    );
}
