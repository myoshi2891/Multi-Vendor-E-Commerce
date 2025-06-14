import { UserShippingAddressType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Country } from '@prisma/client'
import { Check } from 'lucide-react'
import { FC, useState } from 'react'
import Modal from '../shared/modal'
import AddressDetails from '../shared/shipping-addresses/address-details'
import toast from 'react-hot-toast'
import { upsertShippingAddress } from '@/queries/user'
import { useRouter } from 'next/navigation'

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
    const router = useRouter()
    const [show, setShow] = useState<boolean>(false)
    const handleMakeDefault = async () => {
        try {
            const { country, user, ...newAddress } = address
            const response = await upsertShippingAddress({
                ...newAddress,
                default: true, // Update the address as default
            })
            if (response) {
                toast.success('Address marked as default.')
                router.refresh()
            }
        } catch (error) {
            toast.error(
                'Something went wrong while making this address default.'
            )
        }
    }

    return (
        <div className="group relative flex w-full self-start">
            {/* checkbox */}
            <label
                htmlFor={address.id}
                className="mr-3 inline-flex cursor-pointer items-center p-0 text-sm leading-6 text-gray-900"
                onClick={onSelect}
            >
                <span className="inline-flex cursor-pointer p-0.5 leading-8">
                    <span
                        className={cn(
                            'inline-block size-5 rounded-full border border-gray-300 bg-white leading-8',
                            {
                                'flex items-center justify-center border-none bg-orange-background':
                                    isSelected,
                            }
                        )}
                    >
                        {isSelected && <Check className="w-3 stroke-white" />}
                    </span>
                </span>
                <input
                    type="checkbox"
                    hidden
                    id={address.id}
                    // onChange={onSelect}
                />
            </label>
            {/* Address */}
            <div className="w-full border-t pt-2">
                {/* Full name - Phone number */}
                <div className="flex max-w-[328px] truncate">
                    <span className="mr-4 text-sm font-semibold capitalize text-black">
                        {address.firstName} {address.lastName}
                    </span>
                    <span>{address.phone}</span>
                </div>
                {/* Address 1 - Address 2 */}
                <div className="max-w-[90%] truncate text-sm leading-4 text-gray-600">
                    {address.address1}
                    {address.address2 && `, ${address.address2}`}
                </div>
                {/* State - City - Country - Zipcode */}
                <div className="max-w-[90%] truncate text-sm leading-4 text-gray-600">
                    {address.state}, {address.city}, {address.country.name}
                    ,&nbsp;
                    {address.zip_code}
                </div>
                {/* Save as default - Edit */}
                <div className="absolute right-0 top-1/2 flex items-center gap-x-3">
                    <div
                        className="hidden cursor-pointer group-hover:block"
                        onClick={() => setShow(true)}
                    >
                        <span className="text-xs text-[#27f]">Edit</span>
                    </div>
                    {isSelected && !address.default && (
                        <div
                            className="cursor-pointer"
                            onClick={() => handleMakeDefault()}
                        >
                            <span className="text-xs text-[#27f]">
                                Save as default
                            </span>
                        </div>
                    )}
                </div>
                {show && (
                    <Modal
                        title="Edit Shipping Address"
                        show={show}
                        setShow={setShow}
                    >
                        <AddressDetails
                            data={address}
                            countries={countries}
                            setShow={setShow}
                        />
                    </Modal>
                )}
            </div>
        </div>
    )
}

export default ShippingAddressCard
