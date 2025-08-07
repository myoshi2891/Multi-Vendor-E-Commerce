"use client";
import { ProductType, VariantSimplified } from "@/lib/types";
import Link from "next/link";
import { useState } from "react";
import ReactStars from "react-rating-stars-component";
import ProductCardImageSwiper from "./swiper";
import VariantSwitcher from "./variant-switcher";
import { Button } from "@/components/store/ui/button";
import { Heart } from "lucide-react";
import ProductPrice from "../../product-page/product-info/product-price";
import { addToWishlist } from "@/queries/user";
import toast from "react-hot-toast";

export default function ProductCard({ product }: { product: ProductType }) {
    const { name, slug, rating, sales, variantImages, variants, id } = product;
    const [variant, setVariant] = useState<VariantSimplified>(variants[0]);
    const { variantSlug, variantName, images, sizes } = variant;

    const handleAddToWishlist = async () => {
        try {
            const res = await addToWishlist(id, variant.variantId);
            if (res) toast.success("Product successfully added to wishlist");
        } catch (error: any) {
            toast.error(error.toString());
        }
    };

    return (
        <div>
            <div className="group relative w-48 rounded-t-3xl border border-transparent bg-white p-4 transition-all duration-75 ease-in-out hover:border-border hover:shadow-xl sm:w-[225px]">
                <div className="relative size-full">
                    <Link
                        href={`/product/${slug}/${variantSlug}`}
                        className="relative inline-block w-full overflow-hidden"
                    >
                        {/* Images Swiper */}
                        <ProductCardImageSwiper images={images} />
                        {/* Title */}
                        <div className="line-clamp-1 h-[18px] overflow-hidden text-ellipsis text-sm text-main-primary">
                            {name} ・ {variantName}
                        </div>
                        {/* Rating - Sales */}
                        {product.rating > 0 && product.sales > 0 && (
                            <div className="flex h-5 items-center gap-x-1">
                                <ReactStars
                                    count={5}
                                    size={24}
                                    color="#F5F5F5"
                                    activeColor="#FFD804"
                                    value={rating}
                                    isHalf
                                    edit={false}
                                />
                                <div className="text-xs text-main-secondary">
                                    {sales} sold
                                </div>
                            </div>
                        )}
                        {/* Price */}
                        <ProductPrice
                            sizes={sizes}
                            isCard
                            handleChange={() => {}}
                        />
                    </Link>
                </div>
                <div className="absolute -left-px z-30 hidden w-[calc(100%+2px)] space-y-2 rounded-b-3xl border border-t-0 bg-white px-4 pb-4 shadow-xl group-hover:block">
                    {/* Variant switcher */}
                    <VariantSwitcher
                        images={variantImages}
                        variants={variants}
                        setVariant={setVariant}
                        selectedVariant={variant}
                    />
                    <div className="h-4"></div>
                    {/* Action buttons */}
                    <div className="flex flex-row gap-x-1">
                        <Button>
                            <Link href={`/product/${slug}/${variantSlug}`}>
                                Add to cart
                            </Link>
                        </Button>
                        <Button
                            variant="black"
                            size="icon"
                            onClick={() => handleAddToWishlist()}
                        >
                            <Heart className="w-5" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
