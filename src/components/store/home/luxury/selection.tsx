import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Prisma } from "@prisma/client";
import { getProducts } from "@/queries/product";
import { getBrandCategories } from "./data";
import RetryLink from "./retry-link";
import type { LuxuryProduct } from "./types";
import styles from "./luxury.module.css";

export default async function Selection() {
    let products: LuxuryProduct[] = [];
    let failed = false;
    try {
        const categories = await getBrandCategories();
        // カテゴリ別取得は個別に settle させ、一部が失敗しても成功分は描画する。
        // 失敗の詳細は getProducts 側で構造化ログ済みのため、ここでは除外のみ行う。
        const results = categories.length
            ? (
                  await Promise.allSettled(
                      categories.map((category) =>
                          getProducts({ category: category.url }, "", 1, 3)
                      )
                  )
              ).flatMap((settled) =>
                  settled.status === "fulfilled" ? [settled.value] : []
              )
            : [await getProducts({}, "", 1, 8)];
        // 先頭バリアントの無い商品は下の map で除外されるため、描画可能なものだけで
        // フォールバック要否を判定する (全件除外で空グリッドになるのを防ぐ)。
        const selected = results
            .flatMap((result) => result.products)
            .filter((product) => product.variants[0])
            .slice(0, 8);
        // 汎用クエリへのフォールバックはカテゴリ別取得の後だけ。カテゴリが空なら
        // results[0] が既に汎用クエリの結果なので、同一クエリを再発行しない。
        const result = {
            products:
                selected.length || !categories.length
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
                <>
                    {/* <output> はフレーズ内容のみ許容するため、リンクは live region の外に置く */}
                    <output className={styles.statusMessage}>
                        <span>
                            {failed
                                ? "Our collection is taking a little longer to arrive."
                                : "Something extraordinary is on its way."}
                        </span>
                        <span lang="ja">
                            {failed
                                ? "商品を読み込めませんでした。再読み込みしてお試しください。"
                                : "新しいコレクションの登場をお待ちください。"}
                        </span>
                    </output>
                    {failed ? (
                        <RetryLink>Try again / 再読み込み</RetryLink>
                    ) : (
                        <a href="/browse">Explore the store →</a>
                    )}
                </>
            )}
        </div>
    );
}
