import WishlistContainer from "@/components/store/profile/wishlist/container";
import { getUserWishlist } from "@/queries/profile";

export default async function ProfileWishlistPage({
    params,
}: {
    params: Promise<{ page: string }>;
}) {
    const { page: pageParam } = await params;
    const page = Number(pageParam);
    const wishlist_data = await getUserWishlist(page);
    const { wishlist, totalPages } = wishlist_data;

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
