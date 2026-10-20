import { redirect } from "next/navigation";
import { ReviewStatus } from "@prisma/client";
import AdminReviews from "@/components/dashboard/admin/admin-reviews";
import SellerPage from "@/components/dashboard/design/seller-page";
import LoadError from "@/components/dashboard/design/load-error";
import { requireAdmin } from "@/lib/auth-guards";
import { toReviewModerationQueueItem } from "@/lib/review-moderation";
import { getReviewModerationQueue, moderateReview } from "@/queries/review";

export const dynamic = "force-dynamic";

/** URL の status を状態へ絞る。未知の値・配列は既定（審査待ち + FLAGGED）として扱う */
const toStatus = (raw: unknown): ReviewStatus | null =>
    typeof raw === "string" &&
    (Object.values(ReviewStatus) as string[]).includes(raw)
        ? (raw as ReviewStatus)
        : null;

/**
 * レビューの審査キュー（plan 092・DS-PAGE-069）。
 * 認可ガードは catch の外に置き、認可エラーを「取得失敗」の表示に畳まない（tech.md）。
 * page / status の正規化はクエリ側（`getReviewModerationQueue`）が行い、返ってきた page を正とする。
 */
export default async function AdminReviewsPage({
    searchParams,
}: Readonly<{
    searchParams: Promise<{
        status?: string | string[];
        page?: string | string[];
    }>;
}>) {
    await requireAdmin();
    const sp = await searchParams;
    const status = toStatus(sp.status);

    let result: Awaited<ReturnType<typeof getReviewModerationQueue>>;
    try {
        result = await getReviewModerationQueue({
            status: sp.status,
            page: sp.page,
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[AdminReviews] Failed to fetch review queue:",
                error.message,
                error.stack
            );
        } else {
            console.error(
                "[AdminReviews] Failed to fetch review queue:",
                error
            );
        }
        return (
            <SellerPage
                workspace="Administration"
                id="admin-reviews"
                title="Reviews"
            >
                <LoadError subject="reviews" />
            </SellerPage>
        );
    }

    // 範囲外のページは最終ページの正準 URL へ寄せる（tech.md「URL 数値パラメータの正規化」）
    if (result.page > result.totalPages) {
        const query = new URLSearchParams();
        if (status) query.set("status", status);
        query.set("page", String(result.totalPages));
        redirect(`/dashboard/admin/reviews?${query}`);
    }

    return (
        <AdminReviews
            reviews={result.reviews.map(toReviewModerationQueueItem)}
            status={status}
            page={result.page}
            totalPages={result.totalPages}
            moderateAction={moderateReview}
        />
    );
}
