import type { Metadata } from "next";
import SupportForm from "@/components/store/support/support-form";

export const metadata: Metadata = {
    title: "Order Dispute | Marketplace",
};

/** 注文紛争（Order Dispute）の申立フォーム。公開（ゲスト可）。
 *  DB 書込は server action 側のため force-dynamic 不要。 */
export default function DisputePage() {
    return (
        <main className="mx-auto max-w-2xl px-4 py-10">
            <h1 className="mb-6 text-2xl font-bold">Order dispute resolution</h1>
            <SupportForm
                category="DISPUTE"
                requireOrderId
                submitLabel="申立を送信する"
            />
        </main>
    );
}
