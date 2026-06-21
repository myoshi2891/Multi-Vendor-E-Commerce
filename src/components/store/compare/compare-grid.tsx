"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { useCompareStore } from "@/compare-store/useCompareStore";
import { getProductsByIds } from "@/queries/product";
import { Button } from "@/components/store/ui/button";
import ProductPrice from "@/components/store/product-page/product-info/product-price";
import type { ProductType } from "@/lib/types";

/**
 * 比較グリッド（client）。useCompareStore のバリアント ID を読み、getProductsByIds で
 * 商品を取得して横並びカラムで描画する。比較リストが空のときは getProductsByIds を呼ばず
 * （ids 空配列で throw する仕様を回避）空状態を表示する。
 */
export default function CompareGrid() {
    const items = useCompareStore((s) => s.items);
    const removeFromCompare = useCompareStore((s) => s.removeFromCompare);
    const clearCompare = useCompareStore((s) => s.clearCompare);
    const [products, setProducts] = useState<ProductType[]>([]);
    const [loading, setLoading] = useState(false);

    // tech.md「useEffect キャンセルフラグ」パターンで古いレスポンスの上書きを防ぐ。
    useEffect(() => {
        let cancelled = false;
        if (items.length === 0) {
            setProducts([]); // 空リストは getProductsByIds を呼ばない（空配列 throw 回避）
            return;
        }
        setLoading(true);
        void (async () => {
            try {
                const { products } = await getProductsByIds(items);
                if (!cancelled) setProducts(products);
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error(
                        "[Compare:fetch] failed",
                        error.message,
                        error.stack
                    );
                } else {
                    console.error("[Compare:fetch] Unknown error", { error });
                }
                if (!cancelled) setProducts([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [items]);

    if (items.length === 0) {
        return (
            <p data-testid="compare-empty" className="text-main-secondary">
                No products to compare yet. Add products from the store to
                compare them here.
            </p>
        );
    }

    return (
        <div>
            <div className="mb-4 flex justify-end">
                <Button variant="outline" onClick={() => clearCompare()}>
                    Clear all
                </Button>
            </div>

            {loading ? (
                <div className="flex gap-4 overflow-x-auto">
                    {items.map((id) => (
                        <div
                            key={id}
                            className="h-72 w-56 shrink-0 animate-pulse rounded-xl bg-gray-100"
                        />
                    ))}
                </div>
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-2">
                    {products.map((product) => {
                        const variant = product.variants[0];
                        const image = product.variantImages[0];
                        return (
                            <div
                                key={variant.variantId}
                                className="relative flex w-56 shrink-0 flex-col gap-y-3 rounded-xl border p-4"
                            >
                                <Button
                                    variant="gray"
                                    size="icon"
                                    aria-label="Remove from compare"
                                    className="absolute right-2 top-2"
                                    onClick={() =>
                                        removeFromCompare(variant.variantId)
                                    }
                                >
                                    <X className="w-4" />
                                </Button>
                                <Link
                                    href={image.url}
                                    className="relative mx-auto block size-40 overflow-hidden rounded-lg"
                                >
                                    <Image
                                        src={image.image}
                                        alt={product.name}
                                        fill
                                        sizes="160px"
                                        className="object-cover"
                                    />
                                </Link>
                                <Link
                                    href={image.url}
                                    className="line-clamp-2 text-sm font-medium text-main-primary"
                                >
                                    <span>{product.name}</span>
                                    <span className="text-main-secondary">
                                        {" "}
                                        ・ {variant.variantName}
                                    </span>
                                </Link>
                                <ProductPrice
                                    sizes={variant.sizes}
                                    isCard
                                    handleChange={() => {}}
                                />
                                <p className="text-xs text-main-secondary">
                                    Rating: {product.rating.toFixed(1)} ・{" "}
                                    {product.sales} sold
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
