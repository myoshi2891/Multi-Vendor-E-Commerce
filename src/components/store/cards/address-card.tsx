import { UserShippingAddressType } from "@/lib/types";
import { Country } from "@prisma/client";
import { FC } from "react";

interface Props {
    address: UserShippingAddressType
    isSelected: boolean
    onSelect: () => void
    countries: Country[]
}

const ShippingAddressCard: FC<Props> = ({
    address,
    isSelected,
    onSelect,
    countries,
}) => {
    return <div></div>
}

export default ShippingAddressCard