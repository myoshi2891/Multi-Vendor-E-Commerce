import type { Metadata } from "next";
import Link from "next/link";
import { getAllOfferTags } from "@/queries/offer-tag";

export const dynamic = "force-dynamic"; // Prisma 依存ページ規約（tech.md）

export const metadata: Metadata = { title: "Discounts & Offers | Marketplace" };

/**
 * Displays all available offer tags as browsable options.
 *
 * Shows an empty state if no offer tags are available; otherwise, renders a responsive grid of links to the browse page filtered by each tag.
 *
 * @returns A React element representing the offers page
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
