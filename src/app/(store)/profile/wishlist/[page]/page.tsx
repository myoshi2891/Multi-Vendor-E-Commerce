import { getUserWishlist } from "@/queries/profile";

export default async function ProfileWishlistPage({ params }: { params: { page: string } }) {
    const page = params.page;
    const wishlist_data = await getUserWishlist();
    console.log(wishlist_data);
    
    
  return <div>page</div>;
}
