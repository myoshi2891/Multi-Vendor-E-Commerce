import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_LINKS } from "@/components/store/static/content/customer-service";

export const metadata: Metadata = {
    title: "Customer service | Marketplace",
    description: "サポート窓口のハブ。お問い合わせ・返品・配送状況・FAQ への入口。",
};

/**
 * Displays a customer service hub page with navigation cards to support resources.
 */
export default function CustomerServicePage() {
    return (
        <main className="mx-auto max-w-5xl px-4 py-10">
            <h1 className="mb-6 text-3xl font-bold">Customer service</h1>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {SUPPORT_LINKS.map((l) => (
                    <Link
                        key={l.href}
                        href={l.href}
                        className="rounded-xl border p-5 transition hover:shadow-md"
                    >
                        <h2 className="mb-1 font-semibold">{l.title}</h2>
                        <p className="text-sm text-muted-foreground">
                            {l.description}
                        </p>
                    </Link>
                ))}
            </div>
        </main>
    );
}
