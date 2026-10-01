import { useCartStore } from "@/cart-store/useCartStore";
import { CartProductType, Country } from "@/lib/types";
import styles from "../cart-page/cart.module.css";

import { Heart, Minus, Plus, Trash, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Dispatch, FC, SetStateAction, useEffect, useRef } from "react";
import toast from "react-hot-toast";

// addToWishlist（src/queries/user.ts）が重複時に投げる文言。
// "use server" モジュールは関数以外を export できないためここで持つ。
const WISHLIST_DUPLICATE_MESSAGE = "Product is already in the wishlist.";

interface Props {
    product: CartProductType;
    selectedItems: CartProductType[];
    setSelectedItems: Dispatch<SetStateAction<CartProductType[]>>;
    setTotalShipping: Dispatch<SetStateAction<number>>;
    userCountry: Country;
    wishlistAction: (
        productId: string,
        variantId: string,
        sizeId?: string
    ) => Promise<unknown>;
}

const CartProduct: FC<Props> = ({
    product,
    selectedItems,
    setSelectedItems,
    setTotalShipping,
    userCountry,
    wishlistAction,
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
        extraShippingFee,
    } = product;

    const unique_id = `${productId}-${variantId}-${sizeId}`;
    const totalPrice = price * quantity;
    const shippingContribution = useRef(0);
    const initialFee = shippingMethod === "ITEM" ? shippingFee : 0;
    const shippingInfo = {
        initialFee,
        weight,
        totalFee:
            shippingMethod === "ITEM"
                ? shippingFee +
                  (quantity > 1 ? extraShippingFee * (quantity - 1) : 0)
                : shippingMethod === "WEIGHT"
                  ? shippingFee * weight * quantity
                  : shippingFee,
    };

    useEffect(() => {
        const previous = shippingContribution.current;
        const next = stock > 0 ? shippingInfo.totalFee : 0;
        shippingContribution.current = next;
        setTotalShipping((total) => total - previous + next);
    }, [shippingInfo.totalFee, stock, setTotalShipping]);

    useEffect(
        () => () => {
            const previous = shippingContribution.current;
            shippingContribution.current = 0;
            setTotalShipping((total) => total - previous);
        },
        [setTotalShipping]
    );

    const selected = selectedItems.find(
        (p) => unique_id === `${p.productId}-${p.variantId}-${p.sizeId}`
    );

    const { updateProductQuantity, removeFromCart } = useCartStore(
        (state) => state
    );

    const handleSelectProduct = () => {
        setSelectedItems((prev) => {
            const exists = prev.some(
                (item) =>
                    item.productId === product.productId &&
                    item.variantId === product.variantId &&
                    item.sizeId === product.sizeId
            );
            return exists
                ? prev.filter(
                      (item) =>
                          `${item.productId}-${item.variantId}-${item.sizeId}` !==
                          unique_id
                  )
                : [...prev, product];
        });
    };

    const updateProductQuantityHandler = (type: "add" | "remove") => {
        if (type === "add" && quantity < stock) {
            // increase quantity by 1 but ensure it doesn't exceed stock
            updateProductQuantity(product, quantity + 1);
        } else if (type === "remove") {
            // decrease quantity by 1 but ensure it doesn't go below 1
            if (quantity > 1) {
                updateProductQuantity(product, quantity - 1);
            } else {
                removeFromCart(product);
            }
        }
    };

    // Handle add product to wishlist
    const handleAddToWishlist = async () => {
        try {
            const res = await wishlistAction(productId, variantId, sizeId);
            if (res) toast.success("Product successfully added to wishlist");
        } catch (error: unknown) {
            // サーバーの内部エラー（Prisma の生メッセージ等）は表示しない。
            // 利用者が対処できる「登録済み」だけを区別して伝える。
            const isDuplicate =
                error instanceof Error &&
                error.message === WISHLIST_DUPLICATE_MESSAGE;
            toast.error(
                isDuplicate
                    ? WISHLIST_DUPLICATE_MESSAGE
                    : "Failed to add product to wishlist"
            );
        }
    };

    return (
        <article
            className={`${styles.product} ${stock === 0 ? styles.unavailable : ""}`}
            data-testid={`cart-item-${unique_id}`}
        >
            <div className={styles.productRow}>
                {stock > 0 ? (
                    <input
                        type="checkbox"
                        id={unique_id}
                        aria-label={`Select ${name}`}
                        checked={Boolean(selected)}
                        onChange={handleSelectProduct}
                    />
                ) : (
                    <span />
                )}
                <Link
                    href={`/product/${productSlug}/${variantSlug}?size=${sizeId}`}
                >
                    <Image
                        src={image}
                        alt={name}
                        width={200}
                        height={200}
                        className={styles.image}
                        data-testid="cart-item-image"
                    />
                </Link>
                <div className={styles.productInfo}>
                    <div className={styles.productTitle}>
                        <Link
                            href={`/product/${productSlug}/${variantSlug}?size=${sizeId}`}
                            className={styles.productName}
                            data-testid="cart-item-name"
                        >
                            {name} ・ {variantName}
                        </Link>
                        <div className={styles.actions}>
                            <button
                                type="button"
                                className={styles.iconButton}
                                aria-label={`Save ${name} to wishlist`}
                                onClick={handleAddToWishlist}
                                data-testid="cart-item-wishlist-btn"
                            >
                                <Heart size={16} aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                className={styles.iconButton}
                                aria-label={`Remove ${name} from cart`}
                                onClick={() => removeFromCart(product)}
                            >
                                <Trash size={16} aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                    <p className={styles.size}>
                        Size: <span>{size}</span>
                    </p>
                    <div className={styles.priceRow}>
                        {stock > 0 ? (
                            <span>
                                ${price.toFixed(2)} x {quantity} = $
                                {totalPrice.toFixed(2)}
                            </span>
                        ) : (
                            <span className={styles.error}>Out of stock</span>
                        )}
                        <div className={styles.quantity}>
                            <button
                                type="button"
                                className={styles.iconButton}
                                aria-label="Decrease quantity"
                                data-testid="cart-qty-decrease"
                                onClick={() =>
                                    updateProductQuantityHandler("remove")
                                }
                            >
                                <Minus size={13} aria-hidden="true" />
                            </button>
                            <input
                                aria-label={`Quantity for ${name}`}
                                type="text"
                                value={quantity}
                                readOnly
                                data-testid="cart-item-qty"
                            />
                            <button
                                type="button"
                                className={styles.iconButton}
                                aria-label="Increase quantity"
                                disabled={quantity >= stock}
                                data-testid="cart-qty-increase"
                                onClick={() =>
                                    updateProductQuantityHandler("add")
                                }
                            >
                                <Plus size={13} aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                    {stock > 0 && (
                        <div className={styles.shipping}>
                            <Truck aria-hidden="true" />
                            {shippingInfo.totalFee > 0 ? (
                                <span>
                                    {shippingMethod === "ITEM" ? (
                                        <>
                                            ${shippingInfo.initialFee}
                                            (first item)&nbsp;
                                            {quantity === 1
                                                ? ""
                                                : `+ ${quantity - 1 === 1 ? "1 item" : `${quantity - 1} items`}
                                                    x $${extraShippingFee}
                                                    (${quantity - 1 === 1 ? "1 additional item" : `${quantity - 1} additional items`})`}
                                            = $
                                            {shippingInfo.totalFee.toFixed(2)}
                                        </>
                                    ) : shippingMethod === "WEIGHT" ? (
                                        <>
                                            ${shippingFee} x{" "}
                                            {shippingInfo.weight}kg x {quantity}{" "}
                                            {quantity > 1 ? "items" : "item"} =
                                            ${shippingInfo.totalFee.toFixed(2)}
                                        </>
                                    ) : (
                                        <>
                                            Fixed Fee : $
                                            {shippingInfo.totalFee.toFixed(2)}
                                        </>
                                    )}
                                </span>
                            ) : (
                                <span>Free Delivery</span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </article>
    );
};

export default CartProduct;
