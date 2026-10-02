import type { Country, ShippingAddress } from "@prisma/client";
import type { z } from "zod";
import type { ProfileShippingAddressSchema } from "./schemas";

export type AddressCountry = Pick<Country, "id" | "name" | "code">;
export type ProfileAddressFields = Pick<
    ShippingAddress,
    | "id"
    | "firstName"
    | "lastName"
    | "phone"
    | "address1"
    | "address2"
    | "city"
    | "state"
    | "zip_code"
    | "countryId"
    | "default"
>;
export type ProfileAddress = ProfileAddressFields & { country: AddressCountry };
export type ProfileAddressData = {
    addresses: ProfileAddress[];
    countries: AddressCountry[];
};
export type ProfileAddressInput = z.input<typeof ProfileShippingAddressSchema>;
export type AddressActions = {
    loadAddressesAction: () => Promise<ProfileAddressData>;
    saveAddressAction: (
        input: ProfileAddressInput
    ) => Promise<ProfileAddressFields>;
    makeDefaultAction: (id: string) => Promise<{ id: string }>;
};
