import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Prisma } from "@prisma/client";
import { getProducts } from "@/queries/product";
import { getBrandCategories } from "./data";
import type { LuxuryProduct } from "./types";
import styles from "./luxury.module.css";

export default async function Selection() {
    let products: LuxuryProduct[] = [];
    let failed = false;
    try {
        const categories = await getBrandCategories();
        const results = categories.length
            ? await Promise.all(
                  categories.map((category) =>
                      getProducts({ category: category.url }, "", 1, 3)
                  )
              )
            : [await getProducts({}, "", 1, 8)];
        const selected = results
            .flatMap((result) => result.products)
            .slice(0, 8);
        const result = {
            products: selected.length
                ? selected
                : (await getProducts({}, "", 1, 8)).products,
        };
        products = result.products.flatMap((product) => {
            const variant = product.variants[0];
            if (!variant) return [];
            const prices = variant.sizes.map((size) =>
                new Prisma.Decimal(size.price).mul(
                    new Prisma.Decimal(1).sub(
                        new Prisma.Decimal(size.discount).div(100)
                    )
                )
            );
            const min = prices.length ? Prisma.Decimal.min(...prices) : null;
            return [
                {
                    id: product.id,
                    name: product.name,
                    href: `/product/${product.slug}/${variant.variantSlug}`,
                    image:
                        variant.images[0]?.url || "/assets/images/no_image.png",
                    price: min ? `$${min.toFixed(2)}` : null,
                },
            ];
        });
    } catch (error: unknown) {
        failed = true;
        console.error("[Home] Products unavailable", {
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
    return (
        <div
            data-testid="product-grid"
            className={products.length ? styles.productGrid : styles.empty}
        >
            {products.map((product, index) => (
                <Link
                    key={product.id}
                    href={product.href}
                    className={styles.product}
                    data-testid={`luxury-product-${product.id}`}
                >
                    <div className={styles.productImage}>
                        <span className={styles.productIndex}>
                            THE EDIT / {String(index + 1).padStart(2, "0")}
                        </span>
                        <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            sizes="(max-width: 767px) 44vw, 22vw"
                        />
                    </div>
                    <div className={styles.productInfo}>
                        <div>
                            <h3>{product.name}</h3>
                            <p>
                                {product.price
                                    ? `From ${product.price}`
                                    : "Discover this piece"}
                            </p>
                        </div>
                        <ArrowUpRight size={16} />
                    </div>
                </Link>
            ))}
            {!products.length && (
                <div role="status">
                    <p>
                        {failed
                            ? "Our collection is taking a little longer to arrive."
                            : "Something extraordinary is on its way."}
                    </p>
                    <p lang="ja">
                        {failed
                            ? "商品を読み込めませんでした。再読み込みしてお試しください。"
                            : "新しいコレクションの登場をお待ちください。"}
                    </p>
                    <a href={failed ? "/#collections" : "/browse"}>
                        {failed
                            ? "Try again / 再読み込み"
                            : "Explore the store →"}
                    </a>
                </div>
            )}
        </div>
    );
}
