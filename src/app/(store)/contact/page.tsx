import type { Metadata } from "next";
import SupportForm from "@/components/store/support/support-form";

export const metadata: Metadata = { title: "Contact | Marketplace" };

/** お問い合わせフォーム。公開（ゲスト可）。DB 書込は server action 側のため force-dynamic 不要。 */
export default function ContactPage() {
    return (
        <main className="mx-auto max-w-2xl px-4 py-10">
            <h1 className="mb-6 text-2xl font-bold">Contact us</h1>
            <SupportForm category="CONTACT" submitLabel="Send" />
        </main>
    );
}
