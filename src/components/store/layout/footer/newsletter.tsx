"use client";

import styles from "./footer.module.css";
import toast from "react-hot-toast";
import { useState, useRef } from "react";

export default function Newsletter() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = useRef(false);
    return (
        <section
            className={styles.newsletter}
            aria-labelledby="newsletter-title"
        >
            <div>
                <h2 id="newsletter-title">A letter. A little happiness.</h2>
                <p lang="ja">心ときめく出会いを、あなたのメールボックスへ。</p>
            </div>
            <form
                onSubmit={async (e: React.FormEvent<HTMLFormElement>) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const formData = new FormData(form);
                    const emailValue = formData.get("email");
                    const email =
                        typeof emailValue === "string" ? emailValue.trim() : "";
                    if (!email) return;
                    if (isSubmittingRef.current) return;

                    isSubmittingRef.current = true;
                    setIsSubmitting(true);
                    const controller = new AbortController();
                    const timeoutId = setTimeout(
                        () => controller.abort(),
                        8000
                    );
                    try {
                        const response = await fetch("/api/newsletter", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email }),
                            signal: controller.signal,
                        });

                        if (!response.ok)
                            throw new Error("Subscription failed");

                        toast.success("Successfully subscribed to newsletter!");
                        form.reset();
                    } catch (err: unknown) {
                        if (err instanceof Error && err.name === "AbortError") {
                            toast.error("Request timed out. Please try again.");
                        } else {
                            toast.error("Failed to subscribe.");
                        }
                    } finally {
                        clearTimeout(timeoutId);
                        isSubmittingRef.current = false;
                        setIsSubmitting(false);
                    }
                }}
            >
                <label htmlFor="newsletter-email" className="sr-only">
                    Email address
                </label>
                <input
                    id="newsletter-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="Enter your email address"
                    required
                />
                <button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Sending…" : "Subscribe ↗"}
                </button>
            </form>
        </section>
    );
}
