import { permanentRedirect } from "next/navigation";

/**
 * Redirects requests from the legacy /faq route to /faqs.
 */
export default function FaqRedirectPage() {
    permanentRedirect("/faqs");
}
