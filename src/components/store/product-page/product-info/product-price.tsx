"use client";
import { CartProductType } from "@/lib/types";
import styles from '../product.module.css'
import { FC, useEffect } from "react";

interface SimplifiedSize {
    id: string;
    size: string;
    quantity: number;
    price: number;
    discount: number;
}

interface Props {
    sizeId?: string | undefined;
    sizes: SimplifiedSize[];
    isCard?: boolean;
    handleChange: <K extends keyof CartProductType>(property: K, value: CartProductType[K]) => void;
}

const ProductPrice: FC<Props> = ({ sizeId, sizes, isCard, handleChange }) => {
    // Determine selected size and price unconditionally for the hook
    const selectedSize = (sizes || []).find((size) => size.id === sizeId);
    const discountedPriceForHook = selectedSize 
        ? selectedSize.price * (1 - selectedSize.discount / 100) 
        : 0;

    // Update product to be added to cart with price and stock quantity
    useEffect(() => {
        if (sizeId && selectedSize) {
            handleChange("price", discountedPriceForHook);
            handleChange("stock", selectedSize.quantity);
        }
    }, [sizeId, selectedSize, discountedPriceForHook, handleChange]);

    // Check if the sizes array is either undefined or empty
    if (!sizes || sizes.length === 0) {
        // If no sizes are available, simply return from the function, performing no further
        return null;
    }

    // Scenario 1: No sizeId passed, calculate range of prices and total quantity
    if (!sizeId) {
        // Calculate discounted prices for all sizes
        const discountedPrices = sizes.map(
            (size) => size.price * (1 - size.discount / 100)
        );

        const totalQuantity = sizes.reduce(
            (total, size) => total + size.quantity,
            0
        );
        const minPrice = Math.min(...discountedPrices).toFixed(2);
        const maxPrice = Math.max(...discountedPrices).toFixed(2);

        // If all prices are the same, return a single price; otherwise, return a range of prices
        const priceDisplay =
            minPrice === maxPrice
                ? `$${minPrice}`
                : `$${minPrice} - $${maxPrice}`;

        return (
            <div>
                <div>
                    <span
                        className={isCard ? 'text-lg font-bold text-orange-primary' : styles.priceValue}
                        data-testid={
                            isCard ? "product-card-price" : "product-price"
                        }
                    >
                        {priceDisplay}
                    </span>
                </div>
                {!sizeId && !isCard && (
                    <div className={styles.priceNote}>
                        <span>Note : Select a size to see the exact price</span>
                    </div>
                )}
                {!sizeId && !isCard && (
                    <p className={styles.priceNote}>{totalQuantity} pieces available</p>
                )}
            </div>
        );
    }

    // Scenario 2: SizeId passed, find the specific size and return its details

    if (!selectedSize) {
        return <></>;
    }

    // Calculate the price after the discount
    const discountedPrice =
        selectedSize.price * (1 - selectedSize.discount / 100);

    return (
        <div>
            <div className="inline-block">
                <span
                    className={isCard ? 'text-lg font-bold text-orange-primary' : styles.priceValue}
                    data-testid={isCard ? "product-card-price" : "product-price"}
                >
                    ${discountedPrice.toFixed(2)}
                </span>
            </div>
            {selectedSize.price !== discountedPrice && (
                <span className={styles.priceOriginal}>
                    ${selectedSize.price.toFixed(2)}
                </span>
            )}
            {selectedSize.discount > 0 && (
                <span className={styles.priceDiscount}>
                    {selectedSize.discount}% off
                </span>
            )}
            <p className={styles.priceNote}>
                {selectedSize.quantity > 0 ? (
                    `${selectedSize.quantity} items`
                ) : (
                    <span className="text-red-500">Out of stock</span>
                )}
            </p>
        </div>
    );
};

export default ProductPrice;
