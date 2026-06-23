import type { Metadata } from "next";
import SupportForm from "@/components/store/support/support-form";

export const metadata: Metadata = { title: "Contact | Marketplace" };

/**
 * Renders the contact page with a support form.
 */
export default function ContactPage() {
    return (
        <main className="mx-auto max-w-2xl px-4 py-10">
            <h1 className="mb-6 text-2xl font-bold">Contact us</h1>
            <SupportForm category="CONTACT" submitLabel="Send" />
        </main>
    );
}
