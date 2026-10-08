import ProductStatusTag from "@/components/shared/product-status";
import type { ProductStatus } from "@/lib/types";
import type { OrderItem } from "@prisma/client";
import Image from "next/image";
import styles from "../shared/commerce.module.css";
export default function ProductRow({ product }: { product: OrderItem }) {
    return (
        <div className={styles.product}>
            <Image
                src={product.image || "/assets/images/no_image.png"}
                alt={product.name}
                width={90}
                height={110}
            />
            <div className={styles.productInfo}>
                <h4 className={styles.productTitle}>{product.name}</h4>
                <p className={styles.note}>#{product.sku}</p>
                <p>
                    Size: {product.size} · Qty: {product.quantity}
                </p>
                <p>Price: ${product.price.toFixed(2)}</p>
                <ProductStatusTag variant="store" status={product.status as ProductStatus} />
            </div>
        </div>
    );
}
