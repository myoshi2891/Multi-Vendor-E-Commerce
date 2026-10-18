import React from "react";
import Link from "next/link";
import { createRoot } from "react-dom/client";
import type { ReviewStatus } from "@prisma/client";
import ReviewCard from "@/components/store/cards/review";
import ReviewHistoryCard from "@/components/store/profile/reviews/review-history-card";
import type { ReviewHistoryEntry } from "@/components/store/profile/reviews/reviews-container";
import AdminReviews from "@/components/dashboard/admin/admin-reviews";
import SellerShell from "@/components/dashboard/design/seller-shell";
import productStyles from "@/components/store/product-page/product.module.css";
import reviewsStyles from "@/components/store/profile/reviews/reviews.module.css";
import profileStyles from "@/components/store/profile/profile.module.css";
import type {
    ModerateReviewAction,
    ReportReviewAction,
    ReviewModerationQueueItem,
} from "@/lib/review-moderation";
import type { ReviewWithImageType } from "@/lib/types";

const params = new URLSearchParams(location.search);
const screen = params.get("screen") ?? "store";
const scenario = params.get("scenario") ?? "";
const LONG =
    "A thoughtfully made piece whose drape and weight reward a second look. ";
const AVATAR = "/assets/images/default-user.jpg";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let calls = 0;
/** ?scenario=fail は 1 回目だけ失敗し、?scenario=pending は送信中のまま止める */
async function act<T>(value: T, failure: string): Promise<T> {
    await wait(scenario === "pending" ? 60_000 : 400);
    if (scenario === "fail" && ++calls === 1) throw new Error(failure);
    return value;
}

// 本番の reportReview は業務エラーを throw せず { ok: false } で返す
const reportAction: ReportReviewAction = () =>
    act({ ok: true as const, status: "PUBLISHED" as const }, "Failed to report review.").catch(
        (error: unknown) => ({
            ok: false as const,
            error: error instanceof Error ? error.message : "",
        })
    );
const moderateAction: ModerateReviewAction = ({ reviewId }) =>
    act(
        { id: reviewId, status: "PUBLISHED" as const },
        "Invalid moderation transition."
    );

const storeReview = (
    id: string,
    overrides: Partial<ReviewWithImageType>
): ReviewWithImageType => ({
    id,
    productId: "product",
    userId: `user-${id}`,
    variant: "Ivory",
    review: LONG.repeat(3),
    rating: 4.5,
    color: "ivory",
    size: "M",
    quantity: "1",
    likes: 0,
    status: "PUBLISHED",
    isVerifiedPurchase: false,
    moderationReason: null,
    moderatedAt: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    images: [],
    user: { name: "Avery Stone", picture: AVATAR },
    ...overrides,
});

const history = (
    id: string,
    status: ReviewStatus,
    moderationReason: string | null
): ReviewHistoryEntry => ({
    id,
    rating: 4,
    review: LONG,
    variant: `Silk scarf ${id}`,
    color: "Gold",
    size: "One size",
    quantity: "1",
    updatedAt: "2026-10-01T00:00:00Z",
    user: { name: "Mina Mori", picture: AVATAR },
    images: [],
    status,
    moderationReason,
});

const queueItem = (
    id: string,
    status: ReviewStatus,
    overrides: Partial<ReviewModerationQueueItem> = {}
): ReviewModerationQueueItem => ({
    id,
    review: LONG.repeat(2),
    rating: 4.5,
    status,
    isVerifiedPurchase: false,
    moderationReason: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    productName: `Considered piece ${id}`,
    productSlug: "considered-piece",
    authorName: "Avery Stone",
    authorEmail: "avery.stone.with-a-long-address@example.test",
    unresolvedReports: 0,
    ...overrides,
});

const queueAll =
    scenario === "empty"
        ? []
        : [
              queueItem("pending", "PENDING_REVIEW", {
                  isVerifiedPurchase: true,
              }),
              queueItem("flagged", "FLAGGED", { unresolvedReports: 3 }),
              queueItem("removed", "REMOVED", {
                  moderationReason: "Contains a link to another shop.",
              }),
          ];
// サーバーの絞り込みの代わり。?status= は useRouter().push の遷移で付く
const queueStatus = (params.get("status") as ReviewStatus | null) ?? null;
const queueVisible = queueStatus
    ? queueAll.filter((r) => r.status === queueStatus)
    : queueAll.filter(
          (r) => r.status === "PENDING_REVIEW" || r.status === "FLAGGED"
      );

function App() {
    if (screen === "admin")
        return (
            <SellerShell
                sidebar={
                    <nav aria-label="Admin navigation">
                        <Link href="/?screen=admin">Reviews</Link>
                    </nav>
                }
                header={<span>Administration</span>}
            >
                <AdminReviews
                    reviews={queueVisible}
                    status={queueStatus}
                    page={1}
                    totalPages={scenario === "empty" ? 1 : 2}
                    moderateAction={moderateAction}
                />
            </SellerShell>
        );
    return (
        <main className={productStyles.page}>
            <section id="reviews" className={productStyles.reviewSection}>
                <h1 style={{ font: "400 32px/1.2 Georgia,serif" }}>
                    Customer reviews
                </h1>
                <div className={productStyles.reviewGrid}>
                    <ReviewCard
                        editorial
                        review={storeReview("verified", {
                            isVerifiedPurchase: true,
                        })}
                        onReport={reportAction}
                    />
                    <ReviewCard
                        editorial
                        review={storeReview("unverified", {
                            user: { name: "Jordan Lee", picture: AVATAR },
                        })}
                        onReport={reportAction}
                    />
                </div>
            </section>
            <section
                aria-label="Your reviews"
                className={`${profileStyles.shell} ${reviewsStyles.reviews}`}
            >
                <ul className={reviewsStyles.list}>
                    <ReviewHistoryCard
                        review={history("pending", "PENDING_REVIEW", null)}
                    />
                    <ReviewHistoryCard
                        review={history(
                            "rejected",
                            "REJECTED",
                            "Mentions another shop by name."
                        )}
                    />
                </ul>
            </section>
        </main>
    );
}

createRoot(document.getElementById("root")!).render(<App />);
