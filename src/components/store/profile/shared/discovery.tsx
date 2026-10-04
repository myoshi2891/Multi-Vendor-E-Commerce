import Link from "next/link";
import { Fragment } from "react";
import styles from "./discovery.module.css";

export function DiscoveryHeading({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <header className={styles.heading}>
            <p className={styles.eyebrow}>YOUR PERSONAL COLLECTION</p>
            <h1>{title}</h1>
            <p>{description}</p>
            <Link href="/browse" className={styles.collection}>
                Explore the collection
            </Link>
        </header>
    );
}

/** Bounded URL pagination, safe with browser back/forward and updated route props. */
export function DiscoveryPagination({
    page,
    totalPages,
    base,
    label,
}: {
    page: number;
    totalPages: number;
    base: string;
    label: string;
}) {
    if (totalPages <= 1) return null;
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    const pages = [
        ...new Set([
            1,
            ...Array.from(
                { length: Math.min(5, totalPages) },
                (_, i) => start + i
            ),
            totalPages,
        ]),
    ].sort((a, b) => a - b);
    return (
        <nav className={styles.pagination} aria-label={label}>
            {page > 1 ? (
                <Link href={`${base}/${page - 1}`}>Previous</Link>
            ) : (
                <span aria-disabled="true">Previous</span>
            )}
            <div>
                {pages.map((number, index) => (
                    <Fragment key={number}>
                        {index > 0 && number - pages[index - 1] > 1 && (
                            <span aria-hidden="true">…</span>
                        )}
                        <Link
                            href={`${base}/${number}`}
                            aria-label={`Page ${number}`}
                            aria-current={number === page ? "page" : undefined}
                        >
                            {number}
                        </Link>
                    </Fragment>
                ))}
            </div>
            {page < totalPages ? (
                <Link href={`${base}/${page + 1}`}>Next</Link>
            ) : (
                <span aria-disabled="true">Next</span>
            )}
        </nav>
    );
}
