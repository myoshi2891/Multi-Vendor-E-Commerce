import { CartProductType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Dispatch, FC, SetStateAction, useEffect, useState } from 'react'

interface Props {
    product: CartProductType
    selectedItems: CartProductType[]
    setSelectedItems: Dispatch<SetStateAction<CartProductType[]>>
    setTotalShipping: Dispatch<SetStateAction<number>>
}

const CartProduct: FC<Props> = ({
    product,
    selectedItems,
    setSelectedItems,
    setTotalShipping,
}) => {
    const {
        productId,
        variantId,
        name,
        variantName,
        productSlug,
        variantSlug,
        sizeId,
        quantity,
        price,
        image,
        stock,
        size,
        weight,
        shippingFee,
        shippingMethod,
        shippingService,
        extraShippingFee,
    } = product

    const unique_id = `${productId}-${variantId}-${sizeId}`
    const [shippingInfo, setShippingInfo] = useState({
        initialFee: 0,
        extraFee: 0,
        totalFee: 0,
        method: shippingMethod,
        weight: weight,
        shippingService: shippingService,
    })

    // Function to calculate shipping fee
    const calculateShipping = () => {
        let initialFee = 0
        let extraFee = 0
        let totalFee = 0

        if (shippingMethod === 'ITEM') {
            initialFee = shippingFee
            extraFee = quantity > 1 ? extraShippingFee * (quantity - 1) : 0
            totalFee = initialFee + extraFee
        } else if (shippingMethod === 'WEIGHT') {
            totalFee = shippingFee * weight * quantity
        } else if (shippingMethod === 'FIXED') {
            totalFee = shippingFee
        }

        // Subtract the previous shipping total for this product before updating
        setTotalShipping(
            (prevTotal) => prevTotal - shippingInfo.totalFee + totalFee
        )

        // Update state
        setShippingInfo({
            initialFee,
            extraFee,
            totalFee,
            method: shippingMethod,
            weight,
            shippingService,
        })
    }

    // Recalculate shipping fees whenever quantity changes
    useEffect(() => {
        calculateShipping()
    }, [quantity])

    const selected = selectedItems.find(
        (p) => unique_id === `${p.productId}-${p.variantId}-${p.sizeId}`
    )

    const handleSelectProduct = () => {}

    return (
        <div className="select-none border-t border-t-[#ebebeb] bg-white px-6">
            <div className="py-4">
                <div className="relative flex self-start">
                    {/* Image */}
                    <div className="flex items-center">
                        <label
                            htmlFor={unique_id}
                            className="mr-2 inline-flex cursor-pointer items-center p-0 align-middle text-sm leading-6 text-gray-900"
                        >
                            <span className="inline-flex cursor-pointer p-0.5 leading-8">
                                <span
                                    className={cn(
                                        'bg-full flex size-5 items-center justify-center rounded-full border border-gray-300 leading-8 hover:border-orange-background',
                                        {
                                            'border-orange-background':
                                                selected,
                                        }
                                    )}
                                >
                                    {selected && (
                                        <span className="flex size-5 items-center justify-center rounded-full bg-orange-background">
                                            <Check className="mt-0.5 w-3.5 text-white" />
                                        </span>
                                    )}
                                </span>
                            </span>
                            <input
                                type="checkbox"
                                id={unique_id}
                                hidden
                                onChange={() => handleSelectProduct()}
                            />
                        </label>
                        <Link
                            href={`/product/${productSlug}/${variantSlug}?size=${sizeId}`}
                        >
                            <div className="relative m-0 ml-2 mr-4 size-28 rounded-lg bg-gray-200">
                                <Image
                                    src={image}
                                    alt={name}
                                    height={200}
                                    width={200}
                                    className="size-full rounded-md object-cover"
                                />
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CartProduct
