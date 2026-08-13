import WishlistContainer from "@/components/store/profile/wishlist/container";
import { normalizePageParam } from "@/lib/utils";
import { getUserWishlist } from "@/queries/profile";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

/**
 * Renders the authenticated user's wishlist for the requested page.
 *
 * Out-of-range pages are redirected to the canonical page.
 *
 * @param params - Route parameters containing the requested page number.
 * @returns The wishlist content with pagination, or an empty-state message.
 */
export default async function ProfileWishlistPage({
    params,
}: {
    params: Promise<{ page: string }>;
}) {
    const { page: pageParam } = await params;
    const page = normalizePageParam(pageParam);
    const wishlist_data = await getUserWishlist(page);
    const { wishlist, totalPages } = wishlist_data;

    // 範囲外ページは最終ページ（該当 0 件なら 1 ページ目）へ寄せる。
    // 遷移後は canonicalPage === page になるためループしない。
    // redirect() は NEXT_REDIRECT を throw するため try/catch の外に置くこと。
    const canonicalPage = totalPages >= 1 ? Math.min(page, totalPages) : 1;
    if (canonicalPage !== page) {
        redirect(`/profile/wishlist/${canonicalPage}`);
    }

    return (
        <div className="bg-white px-6 py-4">
            <h1 className="mb-3 text-lg font-bold">Your Wishlist</h1>
            {wishlist.length > 0 ? (
                <WishlistContainer
                    products={wishlist}
                    page={page}
                    totalPages={totalPages}
                />
            ) : (
                <div>Your wishlist is empty.</div>
            )}
        </div>
    );
}
