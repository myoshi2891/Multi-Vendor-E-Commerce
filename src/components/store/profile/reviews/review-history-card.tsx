import Image from "next/image";
import type { ReviewHistoryEntry } from "./reviews-container";
import styles from "./reviews.module.css";

export default function ReviewHistoryCard({
    review,
}: {
    review: ReviewHistoryEntry;
}) {
    const name = review.user.name.trim();
    const maskedName = name
        ? `${name[0]}***${name[name.length - 1]}`.toUpperCase()
        : "Your review";
    return (
        <li className={styles.card}>
            <div className={styles.cardHeader}>
                <div className={styles.identity}>
                    <p className={styles.eyebrow}>YOUR REVIEW</p>
                    <h2>{review.variant || "Your review"}</h2>
                    <p className={styles.date}>
                        Last updated:{" "}
                        <time
                            dateTime={new Date(review.updatedAt).toISOString()}
                        >
                            {new Date(review.updatedAt).toLocaleDateString(
                                "en-US",
                                {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    timeZone: "UTC",
                                }
                            )}
                        </time>
                    </p>
                    <div className={styles.reviewer}>
                        {review.user.picture && (
                            <Image
                                src={review.user.picture}
                                alt=""
                                width={36}
                                height={36}
                            />
                        )}
                        <span>{maskedName}</span>
                    </div>
                </div>
                <p className={styles.rating}>{review.rating} out of 5 stars</p>
            </div>
            <p className={styles.reviewText}>{review.review}</p>
            <dl className={styles.details}>
                <div>
                    <dt>Color</dt>
                    <dd>{review.color || "Not specified"}</dd>
                </div>
                <div>
                    <dt>Size</dt>
                    <dd>{review.size || "Not specified"}</dd>
                </div>
                <div>
                    <dt>Quantity</dt>
                    <dd>{review.quantity} PC</dd>
                </div>
            </dl>
            {review.images.length > 0 && (
                <div
                    className={styles.photos}
                    role="group"
                    aria-label="Review photos"
                >
                    {review.images.map((photo, index) => (
                        <Image
                            key={photo.id}
                            src={photo.url}
                            alt={photo.alt || `Review photo ${index + 1}`}
                            width={96}
                            height={96}
                        />
                    ))}
                </div>
            )}
        </li>
    );
}
