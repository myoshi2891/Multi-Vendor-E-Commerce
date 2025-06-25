import { UserShippingAddressType } from '@/lib/types'
import Image from 'next/image'
import React from 'react'

export default function OrderUserDetailsCard({
    details,
}: {
    details: UserShippingAddressType
}) {
    const {
        user,
        firstName,
        lastName,
        address1,
        address2,
        city,
        country,
        phone,
        state,
        zip_code,
    } = details
    const { picture, email } = user
    return (
        <div>
            <section className="w-full p-2 shadow-sm">
                <div className="mx-auto w-fit">
                    <Image
                        src={picture}
                        alt="profile pic"
                        width={100}
                        height={100}
                        className="size-28 rounded-full object-cover"
                    />
                </div>
                <div className="mt-2 space-y-2 text-main-primary">
                    <h2 className="text-center text-2xl font-bold capitalize tracking-wide">
                        {firstName} {lastName}
                    </h2>
                    <h6 className="border-t border-dashed border-neutral-400 py-2 text-center">
                        {email}
                    </h6>
                    <h6 className='text-center'>{phone}</h6>
                    <p className="border-t border-dashed border-neutral-400 py-2">
                        {address1}, {address2}, {city}, {state}, {zip_code}, {country.name}
</p>
                </div>
            </section>
        </div>
    )
}
