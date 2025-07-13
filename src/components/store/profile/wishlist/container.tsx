"use client"
import { ProductWishListType } from "@/lib/types";
import ProductList from "../../shared/product-list";
import Pagination from "../../shared/pagination";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function WishlistContainer({
    products,
    page,
    totalPages,
}: {
    products: ProductWishListType[];
    page: number;
    totalPages: number;
    }) {
    const router = useRouter();
    const [currentPage, setPage] = useState<number>(page);

    useEffect(() => {
        if (currentPage !== page) {
            router.push(`/profile/wishlist/${currentPage}`)
        }
    }, [page, currentPage]);
    return <div>
        <div className="flex flex-wrap pb-16">
            <ProductList products={products}/>
        </div>
        <Pagination page={page} setPage={setPage} totalPages={totalPages} />
    </div>;
}
