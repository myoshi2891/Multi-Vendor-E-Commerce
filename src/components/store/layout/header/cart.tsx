"use client";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/cart-store/useCartStore";
export default function Cart() {
    const totalItems = useCartStore((state) => state.totalItems);
    return (
        <Link
            href="/cart"
            aria-label={`Cart (${totalItems})`}
            className="relative inline-flex items-center gap-1 py-2"
        >
            <ShoppingBag size={19} />
            <span className="text-[10px]">{totalItems}</span>
        </Link>
    );
}
