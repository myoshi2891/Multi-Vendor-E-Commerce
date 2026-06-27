import type { Metadata } from "next";
import TrackOrderForm from "@/components/store/track-order/track-order-form";

export const metadata: Metadata = { title: "Track your order | Marketplace" };

/**
 * Renders the public order tracking page.
 */
export default function TrackOrderPage() {
    return (
        <main className="mx-auto max-w-2xl px-4 py-10">
            <h1 className="mb-2 text-2xl font-bold">Track your order</h1>
            <p className="mb-6 text-sm text-muted-foreground">
                注文番号とご注文時のメールアドレスを入力してください。
            </p>
            <TrackOrderForm />
        </main>
    );
}
