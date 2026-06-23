import type { Metadata } from "next";
import Link from "next/link";
import { getAllOfferTags } from "@/queries/offer-tag";

export const dynamic = "force-dynamic"; // Prisma 依存ページ規約（tech.md）

export const metadata: Metadata = { title: "Discounts & Offers | Marketplace" };

/**
 * プラットフォーム全体のオファー（OfferTag）一覧ページ。
 *
 * 商品グリッドは持たず、各オファーを /browse?offer=<url> へ誘導する（DRY: 商品の
 * 絞り込み・ソート・ページングは既存 /browse の getProducts フィルタへ委譲する）。
 * getAllOfferTags は src/queries 経由で Prisma を読むため force-dynamic を宣言する。
 *
 * @returns オファー一覧（タグが無い場合は空状態メッセージ）の React 要素
 */
export default async function OffersPage() {
    const offerTags = await getAllOfferTags();

    if (offerTags.length === 0) {
        return (
            <main className="mx-auto max-w-5xl px-4 py-10">
                <h1 className="mb-6 text-2xl font-bold">Discounts & Offers</h1>
                <p className="text-muted-foreground">
                    現在ご紹介できるオファーはありません。
                </p>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-5xl px-4 py-10">
            <h1 className="mb-6 text-2xl font-bold">Discounts & Offers</h1>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {offerTags.map((tag) => (
                    <Link
                        key={tag.id}
                        href={`/browse?offer=${tag.url}`}
                        className="rounded-xl border p-5 transition hover:shadow-md"
                    >
                        <h2 className="font-semibold">{tag.name}</h2>
                        <p className="text-sm text-muted-foreground">
                            {tag.products.length} 商品
                        </p>
                    </Link>
                ))}
            </div>
        </main>
    );
}
