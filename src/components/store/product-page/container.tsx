'use client'
import { CartProductType, ProductPageDataType, ProductShippingDetailsType } from '@/lib/types'
import { FC, ReactNode, useEffect, useMemo, useState, useCallback } from 'react'
import ProductSwiper from './product-swiper'
import ProductInfo from './product-info/product-info'
import ShipTo from './shipping/ship-to'
import ShippingDetails from './shipping/shipping-details'
import ReturnsSecurityPrivacyCard from './returns-security-privacy-card'
import { cn, isProductValidToAdd, updateProductHistory } from "@/lib/utils";
import QuantitySelector from "./quantity-selector";
import SocialShare from "../shared/social-share";
import { ProductVariantImage } from "@prisma/client";
import { useCartStore } from "@/cart-store/useCartStore";
import toast from "react-hot-toast";
import useFromStore from "@/hooks/useFromStore";
import { setCookie } from "cookies-next";

type OptionsType = NonNullable<Parameters<typeof setCookie>[2]>;

interface Props {
    productData: ProductPageDataType;
    sizeId: string | undefined;
    children: ReactNode;
}

const DEFAULT_SHIPPING_DETAILS: ProductShippingDetailsType = {
    shippingFeeMethod: "",
    shippingService: "",
    shippingFee: 0,
    extraShippingFee: 0,
    deliveryTimeMin: 0,
    deliveryTimeMax: 0,
    isFreeShipping: false,
    returnPolicy: "",
    countryCode: "",
    countryName: "",
    city: ""
};

const ProductPageContainer: FC<Props> = ({ productData, sizeId, children }) => {
    if (!productData) return null;
    const {
        productId,
        variantId,
        variantSlug,
        images,
        shippingDetails,
        sizes,
    } = productData;

    // State for temporary product images
    const [variantImages, setVariantImages] =
        useState<ProductVariantImage[]>(images);

    // useState hook to manage the active image being displayed, initialized to the first image in the array
    const [activeImage, setActiveImage] = useState<ProductVariantImage | null>(
        images[0]
    );

    const hasShippingDetails = typeof shippingDetails !== "boolean";
    const normalizedShippingDetails = hasShippingDetails ? (shippingDetails as ProductShippingDetailsType) : DEFAULT_SHIPPING_DETAILS;

    // Initialize the default product data for the cart item
    const data: CartProductType = {
        productId: productData.productId,
        variantId: productData.variantId,
        productSlug: productData.productSlug,
        variantSlug: productData.variantSlug,
        name: productData.name,
        variantName: productData.variantName,
        image: productData.images[0].url,
        variantImage: productData.variantImage,
        sizeId: sizeId || "",
        size: "",
        quantity: 1,
        price: 0,
        stock: 1,
        weight: productData.weight,
        shippingMethod: normalizedShippingDetails.shippingFeeMethod,
        shippingService: normalizedShippingDetails.shippingService,
        shippingFee: normalizedShippingDetails.shippingFee,
        extraShippingFee: normalizedShippingDetails.extraShippingFee,
        deliveryTimeMin: normalizedShippingDetails.deliveryTimeMin,
        deliveryTimeMax: normalizedShippingDetails.deliveryTimeMax,
        isFreeShipping: normalizedShippingDetails.isFreeShipping,
    };
    // useState hook to manage the product's state in the cart
    const [productToBeAddedToCart, setProductToBeAddedToCart] =
        useState<CartProductType>(data);

    const { stock } = productToBeAddedToCart;

    // useState hook to manage product validity to be added to cart
    const [isProductValid, setIsProductValid] = useState<boolean>(false);

    // Function to handle state changes for the product properties
    const handleChange = useCallback(<K extends keyof CartProductType>(property: K, value: CartProductType[K]) => {
        setProductToBeAddedToCart((prevProduct) => {
            if (prevProduct[property] === value) return prevProduct;
            return {
                ...prevProduct,
                [property]: value,
            };
        });
    }, []);

    useEffect(() => {
        const check = isProductValidToAdd(productToBeAddedToCart);
        setIsProductValid(check);
    }, [productToBeAddedToCart]);

    // Get the store action to add items to cart
    const addToCart = useCartStore((state) => state.addToCart);
    // Get the set Cart action to update items in cart
    const setCart = useCartStore((state) => state.setCart);

    const cartItems = useFromStore(useCartStore, (state) => state.cart);

    // Keeping cart state updated
    useEffect(() => {
        const handleStorageChange = (event: StorageEvent) => {
            // Check if the "cart" key was changed in localStorage
            if (event.key === "cart") {
                try {
                    const parsedValue = event.newValue
                        ? JSON.parse(event.newValue)
                        : null;

                    // Check if parsedValue and state are valid and then update the cart
                    if (
                        parsedValue &&
                        parsedValue.state &&
                        Array.isArray(parsedValue.state.cart)
                    ) {
                        setCart(parsedValue.state.cart);
                    }
                } catch (error) {
                    console.error("Failed to parse updated cart data:", error);
                }
            }
        };

        // Attache the event listener to localStorage changes
        window.addEventListener("storage", handleStorageChange);

        // Remove the event listener when the component unmounts
        return () => {
            window.removeEventListener("storage", handleStorageChange);
        };
    }, [setCart]);

    useEffect(() => {
        if (variantId) {
            updateProductHistory(variantId);
        }
    }, [variantId]);

    const handleAddToCart = () => {
        if (maxQty <= 0) return toast.error("Out of stock");
        addToCart(productToBeAddedToCart);
        toast.success("Product added to cart successfully!");
    };

    const maxQty = useMemo(() => {
        const search_product = cartItems?.find(
            (p) =>
                p.productId === productId &&
                p.variantId === variantId &&
                p.sizeId === sizeId
        );

        return search_product
            ? search_product.stock - search_product?.quantity
            : stock;
    }, [cartItems, productId, variantId, sizeId, stock]);

    // Set view cookie
    useEffect(() => {
        const cookieOptions: OptionsType & { maxAge?: number; path?: string } = {
            maxAge: 3600,
            path: "/",
        };
        setCookie(`viewedProduct_${productId}`, "true", cookieOptions);
    }, [productId]);

    return (
        <div className="relative">
            <div className="w-full xl:flex xl:gap-4">
                {/* Product images swiper */}
                <ProductSwiper
                    images={variantImages.length > 0 ? variantImages : images}
                    activeImage={activeImage || images[0]}
                    setActiveImage={setActiveImage}
                />
                <div className="mt-4 flex w-full flex-col gap-4 md:mt-0 md:flex-row">
                    {/* Product main info */}
                    <ProductInfo
                        productData={productData}
                        sizeId={sizeId}
                        handleChange={handleChange}
                        setVariantImages={setVariantImages}
                        setActiveImage={setActiveImage}
                    />
                    {/* Shipping details - buy actions buttons */}
                    <div className="w-[390px]">
                        <div className="z-20">
                            <div className="overflow-hidden overflow-y-auto rounded-md border bg-white p-4 pb-0">
                                {/* Ship to */}
                                {hasShippingDetails && (
                                    <>
                                        <ShipTo
                                            countryCode={
                                                (shippingDetails as ProductShippingDetailsType).countryCode
                                            }
                                            countryName={
                                                (shippingDetails as ProductShippingDetailsType).countryName
                                            }
                                            city={(shippingDetails as ProductShippingDetailsType).city}
                                        />
                                        <div className="mt-3 space-y-3">
                                            <ShippingDetails
                                                shippingDetails={
                                                    (shippingDetails as ProductShippingDetailsType)
                                                }
                                                quantity={1}
                                                weight={productData.weight}
                                            />
                                        </div>
                                        <ReturnsSecurityPrivacyCard
                                            returnPolicy={
                                                (shippingDetails as ProductShippingDetailsType).returnPolicy
                                            }
                                        />
                                    </>
                                )}
                                {/* Action buttons */}
                                <div className="sticky bottom-0 mt-5 space-y-3 bg-white pb-4">
                                    {/* Qty selector */}
                                    {sizeId && (
                                        <div className="mt-4 flex w-full justify-end">
                                            <QuantitySelector
                                                productId={
                                                    productToBeAddedToCart.productId
                                                }
                                                variantId={
                                                    productToBeAddedToCart.variantId
                                                }
                                                sizeId={
                                                    productToBeAddedToCart.sizeId
                                                }
                                                quantity={
                                                    productToBeAddedToCart.quantity
                                                }
                                                stock={
                                                    productToBeAddedToCart.stock
                                                }
                                                handleChange={handleChange}
                                            />
                                        </div>
                                    )}
                                    {/* Action buttons */}
                                    <button className="relative inline-block h-11 w-full min-w-20 cursor-pointer select-none whitespace-nowrap rounded-3xl border border-orange-border bg-orange-background py-2.5 font-bold leading-6 text-white transition-all duration-300 ease-bezier-1 hover:bg-orange-hover">
                                        <span>Buy now</span>
                                    </button>
                                    <button
                                        // disabled={!isProductValid}
                                        className={cn(
                                            "relative inline-block h-11 w-full min-w-20 cursor-pointer select-none whitespace-nowrap rounded-3xl border border-orange-border bg-orange-border py-2.5 font-bold leading-6 text-orange-hover transition-all duration-300 ease-bezier-1 hover:bg-[#e4cdce]",
                                            {
                                                "cursor-not-allowed":
                                                    !isProductValid ||
                                                    maxQty <= 0,
                                            }
                                        )}
                                        data-testid="add-to-cart"
                                        onClick={() => handleAddToCart()}
                                    >
                                        <span>Add to cart</span>
                                    </button>
                                    {/* Share to socials */}
                                    <SocialShare
                                        url={`/product/${productData.productSlug}/${productData.variantSlug}`}
                                        quote={`${productData.name} ・ ${productData.variantName}`}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="mt-6 w-[calc(100%-390px)] pb-16">{children}</div>
        </div>
    );
};

export default ProductPageContainer
