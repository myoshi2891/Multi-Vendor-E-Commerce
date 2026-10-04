import type { SerializedCartType } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import styles from "../shared/commerce.module.css";
export default function CheckoutProductCard({
    product,
    isDiscounted,
}: {
    product: SerializedCartType["cartItems"][number];
    isDiscounted: boolean;
}) {
    const href = `/product/${product.productSlug}/${product.variantSlug}?size=${product.sizeId}`;
    return (
        <article className={styles.product}>
            <Link href={href} aria-label={`View ${product.name}`} tabIndex={-1}>
                <Image
                    src={product.image || "/assets/images/no_image.png"}
                    alt={product.name}
                    width={90}
                    height={110}
                />
            </Link>
            <div className={styles.productInfo}>
                <h3>
                    <Link href={href}>{product.name}</Link>
                </h3>
                <p className={styles.note}>
                    Size: {product.size} · Quantity: {product.quantity}
                </p>
                <p>
                    ${product.price.toFixed(2)} x {product.quantity}
                </p>
                {isDiscounted && (
                    <p className={styles.success}>Coupon applied</p>
                )}
                <p className={styles.note}>
                    Shipping:{" "}
                    {product.shippingFee
                        ? `$${product.shippingFee.toFixed(2)}`
                        : "Free Delivery"}
                </p>
            </div>
        </article>
    );
}
