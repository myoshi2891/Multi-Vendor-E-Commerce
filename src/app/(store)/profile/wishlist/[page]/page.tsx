import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Heart } from "lucide-react";
import WishlistContainer from "@/components/store/profile/wishlist/container";
import WishlistHeading from "@/components/store/profile/wishlist/heading";
import styles from "@/components/store/profile/wishlist/wishlist.module.css";
import { normalizePageParam } from "@/lib/utils";
import { getUserWishlist } from "@/queries/profile";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
    title: "Your Wishlist | Luxuries for Happiness",
    description: "お気に入りに保存した商品を確認できます。",
};

export default async function ProfileWishlistPage({
    params,
}: {
    params: Promise<{ page: string }>;
}) {
    const { page: pageParam } = await params;
    const page = normalizePageParam(pageParam);
    let data;
    try {
        data = await getUserWishlist(page);
    } catch {
        return (
            <div className={styles.wishlist}>
                <WishlistHeading />
                <section role="alert" className={styles.error}>
                    <h2>Your wishlist is unavailable</h2>
                    <p lang="ja">
                        お気に入りを取得できませんでした。もう一度お試しください。
                    </p>
                    <a href={`/profile/wishlist/${page}`}>Reload wishlist</a>
                </section>
            </div>
        );
    }
    const { wishlist, totalPages } = data;
    // redirectは例外をthrowするので取得のtry/catchの外で実行する。
    const canonicalPage = totalPages >= 1 ? Math.min(page, totalPages) : 1;
    if (canonicalPage !== page) redirect(`/profile/wishlist/${canonicalPage}`);
    return (
        <div className={styles.wishlist}>
            <WishlistHeading />
            {wishlist.length > 0 ? (
                <WishlistContainer
                    products={wishlist}
                    page={page}
                    totalPages={totalPages}
                />
            ) : (
                <section
                    className={styles.empty}
                    aria-labelledby="wishlist-empty-title"
                >
                    <Heart size={32} strokeWidth={1.2} aria-hidden="true" />
                    <h2 id="wishlist-empty-title">Your wishlist is empty.</h2>
                    <p lang="ja">
                        心ときめく一品を見つけたら、お気に入りに保存してみませんか。
                    </p>
                    <Link href="/browse">
                        Explore the collection{" "}
                        <ArrowUpRight size={16} aria-hidden="true" />
                    </Link>
                </section>
            )}
        </div>
    );
}
