'use client'
import { CartProductType, ProductPageDataType } from '@/lib/types'
import Image from 'next/image'
import Link from 'next/link'
import { Dispatch, FC, SetStateAction } from 'react'
import { CopyIcon } from '@/components/store/icons'
import toast from 'react-hot-toast'
import ReactStars from 'react-rating-stars-component'
import ProductPrice from './product-price'
import Countdown from '../../shared/countdown'
import { Separator } from '@/components/ui/separator'
import ColorWheel from '@/components/shared/color-wheel'
import ProductVariantSelector from './variant-selector'
import SizeSelector from './size.selector'
import ProductAssurancePolicy from './assurance-policy'
import { ProductVariantImage } from '@prisma/client'

interface Props {
    productData: ProductPageDataType
    quantity?: number
    sizeId: string | undefined
    handleChange: (property: keyof CartProductType, value: any) => void
    setVariantImages: Dispatch<SetStateAction<ProductVariantImage[]>>
    setActiveImage: Dispatch<SetStateAction<ProductVariantImage | null>>
}

const ProductInfo: FC<Props> = ({
    productData,
    quantity,
    sizeId,
    handleChange,
    setVariantImages,
    setActiveImage,
}) => {
    // Check if productData exists return null if it's missing (prevents rendering when no data is available)
    if (!productData) return null

    // Destructure necessary properties from the productData object
    const {
        productId,
        name,
        sku,
        colors,
        variantInfo,
        sizes,
        isSale,
        saleEndDate,
        variantName,
        store,
        rating,
        reviewsStatistics,
    } = productData

    const { totalReviews } = reviewsStatistics
    // Function to copy the SKU to the clipboard
    const copySkuToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(sku)
            toast.success('Copied successfully!')
        } catch (error) {
            toast.error('Failed to copy...')
        }
    }

    return (
        <div className="relative w-full xl:w-[540px]">
            {/* Title */}
            <div>
                <h1 className="inline font-bold leading-5 text-main-primary">
                    {name}・{variantName}
                </h1>
            </div>
            {/* Sku - Rating - Num reviews */}
            <div className="mt-2 flex items-center text-xs">
                {/* Store details */}
                <Link
                    href={`/store/${store.url}`}
                    className="mr-2 hidden hover:underline sm:inline-block md:hidden lg:inline-block"
                >
                    <div className="flex w-full items-center gap-x-1">
                        <Image
                            src={store.logo}
                            alt={store.name}
                            width={100}
                            height={100}
                            className="size-8 rounded-full object-cover"
                        />
                    </div>
                </Link>
                <div className="whitespace-nowrap">
                    <span className="flex-1 overflow-hidden overflow-ellipsis whitespace-nowrap text-gray-500">
                        SKU: {sku}
                    </span>
                    <span
                        className="mx-1 inline-block cursor-pointer align-middle text-[#2F68A8]"
                        onClick={copySkuToClipboard}
                    >
                        <CopyIcon />
                    </span>
                </div>
                <div className="ml-4 flex flex-1 items-center gap-x-2 whitespace-nowrap">
                    <ReactStars
                        count={5}
                        size={24}
                        color="#F5F5F5"
                        activeColor="#FFD804"
                        value={rating}
                        isHalf
                        edit={false}
                    />
                    <Link
                        href="#review"
                        className="text-[#ffd804] hover:underline"
                    >
                        (
                        {totalReviews === 0
                            ? 'No reviews yet'
                            : totalReviews === 1
                              ? '1 review'
                              : `${totalReviews} reviews`}
                        )
                    </Link>
                </div>
            </div>
            {/* Price - Sale countdown */}
            <div className="relative my-2 flex flex-col justify-between sm:flex-row">
                <ProductPrice
                    sizeId={sizeId}
                    sizes={sizes}
                    handleChange={handleChange}
                />
                {isSale && saleEndDate && (
                    <div className="mt-4 pb-2">
                        <Countdown targetDate={saleEndDate} />
                    </div>
                )}
            </div>
            <Separator className="mt-2" />
            {/* Color Wheel - variant switcher */}
            <div className="mt-4 space-y-2">
                <div className="relative flex items-center justify-between font-bold text-main-primary">
                    <span className="flex items-center gap-x-2">
                        {colors.length > 1 ? 'Colors' : 'Color'}
                        <ColorWheel colors={colors} size={25} />
                    </span>
                </div>
                <div className="mt-4">
                    {variantInfo.length > 0 && (
                        <ProductVariantSelector
                            variants={variantInfo}
                            slug={productData.variantSlug}
                            setVariantImages={setVariantImages}
                            setActiveImage={setActiveImage}
                        />
                    )}
                </div>
            </div>
            {/* Size selector */}
            <div className="mt-4 space-y-2 pb-2">
                <div>
                    <h1 className="font-bold text-main-primary">Size</h1>
                </div>
                <SizeSelector
                    sizeId={sizeId}
                    sizes={sizes}
                    handleChange={handleChange}
                />
            </div>
            {/* Product assurance */}
            <Separator className="mt-2" />
            <ProductAssurancePolicy />
        </div>
    )
}

export default ProductInfo
