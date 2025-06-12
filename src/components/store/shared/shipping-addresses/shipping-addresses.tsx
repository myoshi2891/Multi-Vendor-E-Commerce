import { UserShippingAddressType } from '@/lib/types'
import { Country, ShippingAddress } from '@prisma/client'
import { Plus } from 'lucide-react'
import { Dispatch, FC, SetStateAction } from 'react'

interface Props {
    countries: Country[]
    addresses: UserShippingAddressType[]
    selectedAddress: ShippingAddress | null
    setSelectedAddress: Dispatch<SetStateAction<ShippingAddress | null>>
}

const UserShippingAddresses: FC<Props> = ({
    countries,
    addresses,
    selectedAddress,
    setSelectedAddress,
}) => {
    return (
        <div className="w-full bg-white px-6 py-4">
            <div className="relative flex flex-col text-sm">
                <h1 className="mb-3 text-lg font-bold">Shipping Addresses</h1>
                {addresses && addresses.length > 0 && (
                    // AddressesList
                    <div></div>
                )}
                <div className="ml-8 mt-4 cursor-pointer text-orange-background">
                    <Plus className="mr-1 inline-block w-3" />
                    <span className="text-sm">Add new address</span>
                </div>
                {/* Modal */}
                <div>
                    {/* AddressDetail */}
                </div>
            </div>
        </div>
    )
}

export default UserShippingAddresses
