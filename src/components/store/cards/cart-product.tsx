import { useCartStore } from '@/cart-store/useCartStore'
import { CartProductType, Country } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
    Check,
    ChevronRight,
    Heart,
    Minus,
    Plus,
    Trash,
    Truck,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import {
    Dispatch,
    FC,
    SetStateAction,
    useEffect,
    useRef,
    useState,
} from 'react'

interface Props {
    product: CartProductType
    selectedItems: CartProductType[]
    setSelectedItems: Dispatch<SetStateAction<CartProductType[]>>
    setTotalShipping: Dispatch<SetStateAction<number>>
    userCountry: Country
}

const CartProduct: FC<Props> = ({
    product,
    selectedItems,
    setSelectedItems,
    setTotalShipping,
    userCountry,
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

    // Store previous values to avoid unnecessary re-renders
    const prevShippingFeeRef = useRef(shippingFee)
    const prevUserCountryRef = useRef(userCountry)

    const unique_id = `${productId}-${variantId}-${sizeId}`

    const totalPrice = price * quantity

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
        if (stock > 0) {
            setTotalShipping(
                (prevTotal) => prevTotal - shippingInfo.totalFee + totalFee
            )
        }

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

    // Recalculate shipping fees whenever quantity, country or fees changes
    useEffect(() => {
        if (
            shippingFee !== prevShippingFeeRef.current ||
            userCountry !== prevUserCountryRef.current
        ) {
            calculateShipping()
        }
        //Update refs after calculating shipping
        prevShippingFeeRef.current = shippingFee
        prevUserCountryRef.current = userCountry

        // Add a check to recalculate shipping fee on component load (after a refresh)
        if (!shippingInfo.totalFee) {
            calculateShipping()
        }
    }, [quantity, shippingFee, userCountry, shippingInfo.totalFee, stock])

    const selected = selectedItems.find(
        (p) => unique_id === `${p.productId}-${p.variantId}-${p.sizeId}`
    )

    const { updateProductQuantity, removeFromCart } = useCartStore(
        (state) => state
    )

    const handleSelectProduct = () => {
        setSelectedItems((prev) => {
            const exists = prev.some(
                (item) =>
                    item.productId === product.productId &&
                    item.variantId === product.variantId &&
                    item.sizeId === product.sizeId
            )
            return exists
                ? prev.filter((item) => item !== product) // Remove if exists
                : [...prev, product]
        })
    }

    const updateProductQuantityHandler = (type: 'add' | 'remove') => {
        if (type === 'add' && quantity < stock) {
            // increase quantity by 1 but ensure it doesn't exceed stock
            updateProductQuantity(product, quantity + 1)
        } else if (type === 'remove') {
            // decrease quantity by 1 but ensure it doesn't go below 1
            if (quantity > 1) {
                updateProductQuantity(product, quantity - 1)
            } else {
                removeFromCart(product)
            }
        }
    }

    return (
        <div
            className={cn(
                'select-none border-t border-t-[#ebebeb] bg-white px-6',
                {
                    'bg-red-100': stock === 0,
                }
            )}
        >
            <div className="py-4">
                <div className="relative flex self-start">
                    {/* Image */}
                    <div className="flex items-center">
                        {stock > 0 && (
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
                        )}
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
                    {/* Info */}
                    <div className="w-0 min-w-0 flex-1">
                        {/* Title - Actions */}
                        <div className="w-[calc(100%-48px] flex items-start overflow-hidden whitespace-nowrap">
                            <Link
                                href={`/product/${productSlug}/${variantSlug}?size=${sizeId}`}
                                className="inline-block truncate text-sm"
                            >
                                {name} ・ {variantName}
                            </Link>
                            <div className="absolute right-0 top-0">
                                <span className="mr-2.5 inline-block cursor-pointer">
                                    <Heart className="w-4 hover:stroke-orange-secondary" />
                                </span>
                                <span
                                    className="inline-block cursor-pointer"
                                    onClick={() => removeFromCart(product)}
                                >
                                    <Trash className="w-4 hover:stroke-orange-secondary" />
                                </span>
                            </div>
                        </div>
                        {/* Style - size */}
                        <div className="my-1">
                            <button className="relative h-[24px] max-w-full cursor-pointer whitespace-normal rounded-xl bg-gray-100 px-2.5 py-0 text-xs font-bold leading-4 text-main-primary outline-0">
                                <span className="flex flex-wrap items-center justify-between">
                                    <div className="inline-block max-w-[95%] truncate text-left">
                                        {size}
                                    </div>
                                    <span className="ml-0.5">
                                        <ChevronRight className="w-3" />
                                    </span>
                                </span>
                            </button>
                        </div>
                        {/* Price - Delivery */}
                        <div className="relative mt-2 flex items-center justify-between">
                            {stock > 0 ? (
                                <div>
                                    <span className="inline-block break-all">
                                        ${price.toFixed(2)} x {quantity} = $
                                        {totalPrice.toFixed(2)}
                                    </span>
                                </div>
                            ) : (
                                <div>
                                    <span className="inline-block break-all text-sm text-red-500">
                                        Out of stock
                                    </span>
                                </div>
                            )}
                            {/* Quantity changer */}
                            <div className="text-xs">
                                <div className="inline-flex list-none items-center text-sm leading-6 text-gray-900">
                                    <div
                                        className="grid size-6 cursor-pointer place-items-center rounded-full bg-gray-100 text-xs leading-6 hover:bg-gray-200"
                                        onClick={() =>
                                            updateProductQuantityHandler(
                                                'remove'
                                            )
                                        }
                                    >
                                        <Minus className="stroke-[#555} w-3" />
                                    </div>
                                    <input
                                        type="text"
                                        value={quantity}
                                        readOnly
                                        min={1}
                                        max={stock}
                                        className="m-1 h-6 w-[32px] border-none bg-transparent text-center font-bold leading-6 tracking-normal text-gray-900 outline-none"
                                    />
                                    <div
                                        className="grid size-6 cursor-pointer place-items-center rounded-full bg-gray-100 text-xs leading-6 hover:bg-gray-200"
                                        onClick={() =>
                                            updateProductQuantityHandler('add')
                                        }
                                    >
                                        <Plus className="stroke-[#555} w-3" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Shipping info */}
                        {stock > 0 && (
                            <div className="mt-1 cursor-pointer text-xs text-[#999]">
                                <div className="mb-1 flex items-center">
                                    <span>
                                        <Truck className="inline-block w-4 text-[#01A971]" />
                                        {shippingInfo.totalFee > 0 ? (
                                            <span className="ml-1 text-[#01A971]">
                                                {shippingMethod === 'ITEM' ? (
                                                    <>
                                                        $
                                                        {
                                                            shippingInfo.initialFee
                                                        }
                                                        (first item)&nbsp;
                                                        {quantity === 1
                                                            ? ''
                                                            : `+ ${quantity - 1 === 1 ? '1 item' : `${quantity - 1} items`}
                                                    x $${extraShippingFee}
                                                    (${quantity - 1 === 1 ? '1 additional item' : `${quantity - 1} additional items`})`}
                                                        = $
                                                        {shippingInfo.totalFee.toFixed(
                                                            2
                                                        )}
                                                    </>
                                                ) : shippingMethod ===
                                                  'WEIGHT' ? (
                                                    <>
                                                        ${shippingFee} x{' '}
                                                        {shippingInfo.weight}kg
                                                        x {quantity}{' '}
                                                        {quantity > 1
                                                            ? 'items'
                                                            : 'item'}{' '}
                                                        = $
                                                        {shippingInfo.totalFee.toFixed(
                                                            2
                                                        )}
                                                    </>
                                                ) : (
                                                    <>
                                                        Fixed Fee : $
                                                        {shippingInfo.totalFee.toFixed(
                                                            2
                                                        )}
                                                    </>
                                                )}
                                            </span>
                                        ) : (
                                            <span className="ml-1 text-[#01A971]">
                                                Free Delivery
                                            </span>
                                        )}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CartProduct
