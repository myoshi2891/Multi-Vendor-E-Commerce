"use server";
import type { Store } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/auth-guards";

export type SellerStoreSummary = Pick<
    Store,
    "id" | "name" | "url" | "logo" | "status"
>;
export type SellerStoresResult =
    | { ok: true; stores: SellerStoreSummary[] }
    | { ok: false };

export async function getSellerStores(): Promise<SellerStoresResult> {
    // Authorization errors must propagate; only lookup failures become UI feedback.
    const user = await requireSeller();
    try {
        const stores = await db.store.findMany({
            where: { userId: user.id },
            select: {
                id: true,
                name: true,
                url: true,
                logo: true,
                status: true,
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
        return { ok: true, stores };
    } catch {
        return { ok: false };
    }
}
