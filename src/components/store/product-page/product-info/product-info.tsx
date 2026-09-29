'use client'
import { CartProductType, ProductPageDataType } from '@/lib/types'
import Image from 'next/image'
import Link from 'next/link'
import { Dispatch, FC, SetStateAction } from 'react'
import { CopyIcon } from '@/components/store/icons'
import toast from 'react-hot-toast'
import ProductPrice from './product-price'
import Countdown from '../../shared/countdown'
import ColorWheel from '@/components/shared/color-wheel'
import ProductVariantSelector from './variant-selector'
import SizeSelector from './size.selector'
import { ProductVariantImage } from '@prisma/client'
import ProductWatch from "./product-watch";
import { ArrowUpRight, Star } from 'lucide-react'
import styles from '../product.module.css'
import { resolveProductRating } from '../display-rating'
import SocialShare from '../../shared/social-share'

interface Props {
    productData: ProductPageDataType;
    sizeId: string | undefined;
    handleChange: <K extends keyof CartProductType>(property: K, value: CartProductType[K]) => void;
    setVariantImages: Dispatch<SetStateAction<ProductVariantImage[]>>;
    setActiveImage: Dispatch<SetStateAction<ProductVariantImage | null>>;
}

const ProductInfo: FC<Props> = ({
    productData,
    sizeId,
    handleChange,
    setVariantImages,
    setActiveImage,
}) => {
    // Check if productData exists return null if it's missing (prevents rendering when no data is available)
    // if (!productData) return null
    if (!productData) {
        return (
            <div className="relative w-full xl:w-[540px]">
                <div className="mb-4 h-6 w-3/4 animate-pulse rounded bg-gray-200"></div>
                <div className="mb-2 h-4 w-1/2 animate-pulse rounded bg-gray-100"></div>
                <div className="h-20 w-full animate-pulse rounded bg-gray-100"></div>
                {/* 他にも必要に応じて Skeleton を追加 */}
            </div>
        );
    }

    // Destructure necessary properties from the productData object
    const {
        name,
        sku,
        colors,
        variantInfo,
        sizes,
        isSale,
        saleEndDate,
        variantName,
        variantDescription,
        variantId,
        store,
        rating,
        reviewsStatistics,
    } = productData;

    const { totalReviews } = reviewsStatistics;
    const displayRating = resolveProductRating(rating, reviewsStatistics.ratingStatistics)
    // Function to copy the SKU to the clipboard
    const copySkuToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(sku);
            toast.success("Copied successfully!");
        } catch (error) {
            toast.error("Failed to copy...");
        }
    };

    return (
        <div className={styles.info}>
            <p className={styles.infoEyebrow}><span>✦</span> THE CURATED COLLECTION <span> / {store.name}</span></p>
            <h1>{name}<span>{variantName}</span></h1>
            <div className={styles.ratingRow}>
                <span className={styles.stars} aria-label={`${displayRating.toFixed(2)} out of 5 stars`}><Star size={15} fill="currentColor" /> {displayRating.toFixed(2)}</span>
                <Link href="#reviews">{totalReviews === 0 ? 'Be the first to review' : `${totalReviews} reviews`} <ArrowUpRight size={13} /></Link>
            </div>
            <div className={styles.priceBlock}>
                <p>THE PRICE</p>
                <ProductPrice
                    sizeId={sizeId}
                    sizes={sizes}
                    handleChange={handleChange}
                />
                {isSale && saleEndDate && (
                    <div className={styles.countdown}>
                        <Countdown targetDate={saleEndDate} />
                    </div>
                )}
            </div>
            <div className={styles.infoStory}>
                {variantDescription && <p data-testid="product-summary">{variantDescription}</p>}
                <Link href="#description">Read the story <ArrowUpRight size={14} /></Link>
            </div>
            <div className={styles.watch}><ProductWatch productId={variantId} /></div>
            <div className={styles.infoDivider} />
            {/* Color Wheel - variant switcher */}
            <div className={styles.optionGroup}>
                <p>01 <span>{colors.length > 1 ? 'Choose your color' : 'Color'}</span><ColorWheel colors={colors} size={22} /></p>
                <div className={styles.variantOptions}>
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
            <div className={styles.optionGroup}>
                <p>02 <span>Choose your size</span></p>
                <SizeSelector
                    sizeId={sizeId}
                    sizes={sizes}
                    handleChange={handleChange}
                />
            </div>
            {/* Product assurance */}
            <div className={styles.infoDivider} />
            <div className={styles.sku}>REFERENCE <button type="button" onClick={copySkuToClipboard}>{sku} <CopyIcon /></button></div>
            <div className={styles.storeLink} data-testid="curated-by"><Image src={store.logo.includes('/no_image') ? '/assets/brand/star.svg' : store.logo} alt="" width={34} height={34} /><div><span>CURATED BY</span><Link href={`/store/${store.url}`}>{store.name} <ArrowUpRight size={13} /></Link></div></div>
            <SocialShare
                url={`/product/${productData.productSlug}/${productData.variantSlug}`}
                quote={`${name} ・ ${variantName}`}
                editorial
                media={productData.images[0]?.url}
            />
        </div>
    );
};

export default ProductInfo
