'use client'
import { CartProductType, ProductPageDataType, ProductShippingDetailsType } from '@/lib/types'
import { FC, ReactNode, useEffect, useMemo, useState, useCallback } from 'react'
import ProductSwiper from './product-swiper'
import ProductInfo from './product-info/product-info'
import ShipTo from './shipping/ship-to'
import ShippingDetails from './shipping/shipping-details'
import ReturnsSecurityPrivacyCard from './returns-security-privacy-card'
import { isProductValidToAdd, updateProductHistory } from "@/lib/utils";
import QuantitySelector from "./quantity-selector";
import { ProductVariantImage, ShippingFeeMethod } from "@prisma/client";
import { useCartStore } from "@/cart-store/useCartStore";
import toast from "react-hot-toast";
import useFromStore from "@/hooks/useFromStore";
import { setCookie } from "cookies-next";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ShoppingBag } from "lucide-react";
import styles from "./product.module.css";

type OptionsType = NonNullable<Parameters<typeof setCookie>[2]>;

interface Props {
    productData: ProductPageDataType;
    sizeId: string | undefined;
    children: ReactNode;
}

interface InnerProps {
    productData: NonNullable<ProductPageDataType>;
    sizeId: string | undefined;
    children: ReactNode;
}

const DEFAULT_SHIPPING_DETAILS: ProductShippingDetailsType = {
    shippingFeeMethod: ShippingFeeMethod.FIXED,
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

const ProductPageContainerInner: FC<InnerProps> = ({ productData, sizeId, children }) => {
    const {
        productId,
        variantId,
        images,
        shippingDetails,
    } = productData;

    // State for temporary product images
    const [variantImages, setVariantImages] =
        useState<ProductVariantImage[]>(images);

    // useState hook to manage the active image being displayed, initialized to the first image in the array
    const [activeImage, setActiveImage] = useState<ProductVariantImage | null>(
        images[0]
    );

    const hasShippingDetails = shippingDetails !== false;
    // 全サイズが在庫切れなら選択できるサイズが無いため、選択ヒントの代わりに在庫切れを伝える
    const isSoldOut = productData.sizes.every((size) => size.quantity <= 0);
    const router = useRouter();
    const normalizedShippingDetails = hasShippingDetails ? (shippingDetails as Exclude<ProductShippingDetailsType, false>) : DEFAULT_SHIPPING_DETAILS;

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
        if (!isProductValid) return toast.error("Please select a size first");
        if (maxQty <= 0) return toast.error("Out of stock");
        addToCart(productToBeAddedToCart);
        toast.success("Added to your bag");
    };

    const handleBuyNow = () => {
        if (!isProductValid) return toast.error("Please select a size first");
        if (maxQty <= 0) return toast.error("Out of stock");
        addToCart(productToBeAddedToCart);
        router.push("/cart");
    };

    const maxQty = useMemo(() => {
        const search_product = cartItems?.find(
            (p) =>
                p.productId === productId &&
                p.variantId === variantId &&
                p.sizeId === sizeId
        );

        // カート行の stock は投入時点の値で古い可能性があるため、現在の在庫から投入済み数量を差し引く
        return search_product ? stock - search_product.quantity : stock;
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
        <div className={styles.productBody}>
            <div className={styles.productGrid}>
                {/* Product images swiper */}
                <ProductSwiper
                    images={variantImages.length > 0 ? variantImages : images}
                    activeImage={activeImage || images[0]}
                    setActiveImage={setActiveImage}
                    productName={productData.name}
                />
                <div className={styles.productDetails}>
                    {/* Product main info */}
                    <ProductInfo
                        productData={productData}
                        sizeId={sizeId}
                        handleChange={handleChange}
                        setVariantImages={setVariantImages}
                        setActiveImage={setActiveImage}
                    />
                    {/* Shipping details - buy actions buttons */}
                    <aside className={styles.purchasePanel} aria-label="Purchase options">
                        <div className={styles.purchaseCard}>
                            <p className={styles.cardEyebrow}>YOUR NEXT FAVORITE THING</p>
                            <h2>Make it yours.</h2>
                            <p className={styles.cardIntro}>A little luxury, ready for your everyday.</p>
                            <div className={styles.cardDivider} />
                                {/* Ship to */}
                                {hasShippingDetails && (
                                    <>
                                        <ShipTo
                                            countryCode={normalizedShippingDetails.countryCode}
                                            countryName={normalizedShippingDetails.countryName}
                                            city={normalizedShippingDetails.city}
                                        />
                                        <div className={styles.shippingBlock}>
                                            <ShippingDetails
                                                shippingDetails={normalizedShippingDetails}
                                                quantity={productToBeAddedToCart.quantity}
                                                weight={productData.weight}
                                            />
                                        </div>
                                    </>
                                )}
                                {!hasShippingDetails && (
                                    <div className={styles.shippingUnavailable} role="status">
                                        <strong>Delivery</strong>
                                        <p>Delivery details are unavailable for your selected country.</p>
                                    </div>
                                )}
                                <ReturnsSecurityPrivacyCard
                                    returnPolicy={hasShippingDetails
                                        ? normalizedShippingDetails.returnPolicy
                                        : productData.store.returnPolicy}
                                />
                                {/* Action buttons */}
                                <div className={styles.purchaseActions}>
                                    {/* Qty selector */}
                                    {sizeId && (
                                        <div className={styles.quantityRow}>
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
                                    <button type="button" className={styles.buyButton} onClick={handleBuyNow} disabled={!isProductValid || maxQty <= 0}>
                                        <span>Buy now</span><ArrowUpRight size={17} />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!isProductValid || maxQty <= 0}
                                        className={styles.cartButton}
                                        data-testid="add-to-cart"
                                        onClick={handleAddToCart}
                                    >
                                        <ShoppingBag size={16} /><span>Add to bag</span>
                                    </button>
                                    {!sizeId && (
                                        <p className={styles.selectionHint}>
                                            {isSoldOut ? 'This piece is currently out of stock.' : 'Select a size to continue.'}
                                        </p>
                                    )}
                                </div>
                        </div>
                    </aside>
                </div>
            </div>
            <div className={styles.belowFold}>
                <div className={styles.sectionIntro}><span>✦</span><p>THE STORY CONTINUES</p><h2>Explore the <em>details.</em></h2></div>
                {children}
            </div>
        </div>
    );
};

const ProductPageContainer: FC<Props> = ({ productData, sizeId, children }) => {
    if (!productData) return null;
    return <ProductPageContainerInner productData={productData} sizeId={sizeId}>{children}</ProductPageContainerInner>;
};

export default ProductPageContainer;
