"use client";
import styles from "./seller.module.css";
export default function SellerError({ reset }: { reset: () => void }) {
    return (
        <section className={styles.alert} role="alert">
            <h2>Store information is unavailable</h2>
            <p>We couldn’t load this information. Please try again.</p>
            <button
                type="button"
                className="mt-4 border px-4 py-2"
                onClick={reset}
            >
                Try again
            </button>
        </section>
    );
}
export function LookupFailure() {
    return <SellerError reset={() => window.location.reload()} />;
}
