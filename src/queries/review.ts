"use server";

import {
    ModerationSubject,
    PaymentStatus,
    Prisma,
    ProductStatus,
    ReviewStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { ReviewDetailsType } from "@/lib/types";
import { requireAdmin, requireUser } from "@/lib/auth-guards";
import {
    ModerateReviewSchema,
    ReportReviewSchema,
    UpsertReviewSchema,
} from "@/lib/schemas";
import { isPublicReviewStatus, publicReviewWhere } from "@/lib/review-visibility";
import {
    moderationTransition,
    resolveReviewPolicy,
    shouldFlag,
    statusAfterAuthorWrite,
    type ReviewPolicy,
} from "@/lib/review-moderation";
import { normalizePageParam } from "@/lib/utils";

/**
 * 利用者へそのまま返してよい業務エラー（`attribute.ts` と同じ方式）。catch 側はこれだけを
 * 素通しし、それ以外（Prisma / ネットワーク）は構造化ログへ落として汎用メッセージに畳む。
 */
class ReviewActionError extends Error {}

const fail = (message: string): never => {
    throw new ReviewActionError(message);
};

const rethrow = (tag: string, fallback: string, error: unknown): never => {
    if (error instanceof ReviewActionError) throw new Error(error.message);
    if (error instanceof Error) {
        console.error(`[Review:${tag}] ${fallback}`, {
            error: error.message,
            stack: error.stack,
        });
    } else {
        console.error(`[Review:${tag}] Unknown error`, { error });
    }
    throw new Error(fallback);
};

// db.$transaction のコールバックが受け取る tx の型（Accelerate 拡張済みクライアント）。
// 素の Prisma.TransactionClient とは非互換のため、$transaction から導出する
// （`category.ts` / `order.ts` と同じ理由・同じ形）。
type ReviewTransactionClient = Parameters<
    Parameters<typeof db.$transaction>[0]
>[0];

/** REVIEW のモデレーション方針。行が無ければ既定値（即公開）で動く（design review-governance §3.3）。 */
const loadReviewPolicy = async (tx: ReviewTransactionClient): Promise<ReviewPolicy> =>
    resolveReviewPolicy(
        await tx.moderationPolicy.findUnique({
            where: { subject: ModerationSubject.REVIEW },
            select: { mode: true, requireVerifiedPurchase: true, flagThreshold: true },
        })
    );

/**
 * 商品と店舗の評価を、公開集合のレビューだけから DB で再計算する。
 * **呼び出し側は Product → Store の順で行ロックを取ってから呼ぶこと**（design §5.2）。
 * ロックを読む前に取るので、Read Committed でも後から commit した側の集計が
 * 先の行を取りこぼさない。Store の平均はレビュー単位の平均（商品平均の平均ではない）。
 */
const recomputeRatings = async (
    tx: ReviewTransactionClient,
    productId: string,
    storeId: string
): Promise<void> => {
    const productAgg = await tx.review.aggregate({
        where: publicReviewWhere({ productId }),
        _avg: { rating: true },
        _count: { _all: true },
    });
    await tx.product.update({
        where: { id: productId },
        data: {
            rating: productAgg._avg.rating ?? 0,
            numReviews: productAgg._count._all,
        },
    });

    const storeAgg = await tx.review.aggregate({
        where: publicReviewWhere({ product: { storeId } }),
        _avg: { rating: true },
        _count: { _all: true },
    });
    await tx.store.update({
        where: { id: storeId },
        data: {
            averageRating: storeAgg._avg.rating ?? 0,
            numReviews: storeAgg._count._all,
        },
    });
};

/**
 * Product → Store の順に行ロックを取り、店舗 ID を返す。店舗 ID はクライアントから受け取らない。
 * Prisma の fluent API はロック句を表現できないため $queryRaw を使う（値は常にパラメータ化される）。
 */
const lockProductAndStore = async (
    tx: ReviewTransactionClient,
    productId: string
): Promise<string> => {
    await tx.$queryRaw`
        SELECT "id" FROM "Product" WHERE "id" = ${productId} FOR UPDATE
    `;
    const product = await tx.product.findUnique({
        where: { id: productId },
        select: { storeId: true },
    });
    if (!product) return fail("Product not found.");
    await tx.$queryRaw`
        SELECT "id" FROM "Store" WHERE "id" = ${product.storeId} FOR UPDATE
    `;
    return product.storeId;
};

/**
 * 購入者の判定: 本人の支払い済み注文に、この商品の取り消されていない明細があること。
 * `Delivered` までは要求しない（明細の状態は seller の手動更新で、止まったままのことが多い。design §2.1）。
 */
const isVerifiedPurchaser = async (
    tx: ReviewTransactionClient,
    userId: string,
    productId: string
): Promise<boolean> =>
    (await tx.orderItem.count({
        where: {
            productId,
            status: { notIn: [ProductStatus.Canceled, ProductStatus.Refunded] },
            orderGroup: { order: { userId, paymentStatus: PaymentStatus.Paid } },
        },
    })) > 0;

/**
 * @name upsertReview
 * @description - 本人のレビューを作成・更新し、商品と店舗の評価集計を同じトランザクションで更新する。
 * @access Authenticated user（自分のレビューのみ）
 * @param productId - The ID of the product the review belongs to.
 * @param review - The review object containing details of the review to be upserted.
 * @returns {Review} - Returns the updated or newly created review details.
 */
export const upsertReview = async (
	productId: string,
	review: ReviewDetailsType
) => {
	// 認可ガードは try の外に置く（tech.md「認可ガード」）——
	// 中に入れると catch が `Error updating review: <原文>` で包み、
	// 呼び出し側が「未認証」と「DB 障害」を区別できなくなる。
	const user = await requireUser()

    // フォームの resolver だけでは Server Action の直接呼び出しを防げないので、サーバーでも検証する。
    // 範囲外の rating を保存すると平均が汚れる（DB の CHECK 制約は最終防衛）。
    const parsed = UpsertReviewSchema.safeParse(review)
    if (!parsed.success) throw new Error('Invalid review data.')
    const input = parsed.data

	try {
        // ローカル環境等の事情で Webhook 同期が漏れていた場合に備え、DB上に User レコードを
        // オンデマンドで自動作成（フォールバック）。既存行は一切書き換えない。
        //
        // ここは `db.$transaction`（下の集計ブロック）の**外側**にあり、行ロックによる
        // 直列化では守られない。同一ユーザーの二重送信（連打）は 2 本がそのまま同時に
        // 到達しうるため、この 1 文自体がレース安全である必要がある。
        //
        // `upsert` は使えない。実測（testcontainers PostgreSQL・同時 2 本 × 15 回）:
        //   - `update: {}` … Prisma は空の update を `ON CONFLICT DO UPDATE SET` へ
        //     組み立てられず **read → insert の 2 往復に退化**する。30 本中 14 本が
        //     `id` の P2002 で落ちた（CI の review-aggregation シナリオ 6 の実失敗原因）。
        //   - `update` を埋めて native `ON CONFLICT ("id")` にしても、conflict target は
        //     id 一本なので `email @unique` の衝突は素通りし、30 本中 4 本が P2002 で落ちた。
        //
        // `createMany` + `skipDuplicates` は `ON CONFLICT DO NOTHING`（target 無し
        // ＝ 全 unique 制約が対象）になり、上記どちらの衝突も握り潰す。実測 0/30。
        // 戻り値（作成件数）は参照しない —— 「作った」か「既に居た」かは呼び出し側に
        // とって等価だからで、これは `update: {}` が表していた意図そのものである。
        const email = user.emailAddresses[0]?.emailAddress
        if (!email) throw new Error('User email not found in Clerk.')

        await db.user.createMany({
            data: [
                {
                    id: user.id,
                    name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
                    email: email,
                    picture: user.imageUrl || '',
                    role: 'USER',
                },
            ],
            skipDuplicates: true,
        })

        if (!productId) throw new Error('Product ID is required.')

        // レビュー行の書き込みと Product / Store の集計更新は 1 つのトランザクションで行う。
        //
        // トランザクションで囲うだけでは足りない（既定の Read Committed では、並行する
        // 2 投稿が「相手の行がまだ見えない」時点で集計を読めるため、後から commit した側が
        // 1 件ぶん巻き戻す）。**Product 行 → Store 行の排他ロックで直列化する**のが要点で、
        // ロックは review の書き込みより手前で取る —— 後ろで取ると「両者が insert 済み」に
        // なるまでの窓が開いたままになる。ロックの順序は全経路（投稿・モデレーション）で
        // Product → Store に固定し、同じ店舗の別商品への並行投稿でもデッドロックさせない。
        //
        // 同一ユーザーの同時二重投稿も閉じる: 後続 tx はロック解放後に findFirst を
        // 撃ち直すので update に落ちる。ロックが無いと両方が create に進み、
        // `@@unique([userId, productId])` の P2002 で片方が失敗する。
        //
        // トランザクションオプションは付けない（外部 I/O 無しで既定 timeout 5s に収まる）。
        // ただし Store ロックの保持時間は、同じ店舗への並行投稿の待ち時間になる。
        const reviewDetails = await db.$transaction(async (tx) => {
            const storeId = await lockProductAndStore(tx, productId)
            const policy = await loadReviewPolicy(tx)

            const isVerifiedPurchase = await isVerifiedPurchaser(tx, user.id, productId)
            if (policy.requireVerifiedPurchase && !isVerifiedPurchase) {
                throw new Error('Only verified purchasers can review this product.')
            }

            // 自分のレビュー行も Product → Store → Review の順でロックしてから状態を読む。
            // ロックしないと並行する reportReview の PUBLISHED → FLAGGED を見落とし、
            // 古い状態から計算した status で FLAGGED を上書きしてしまう（行が無ければ何も取らない）
            await tx.$queryRaw`
                SELECT "id" FROM "Review"
                WHERE "productId" = ${productId} AND "userId" = ${user.id}
                FOR UPDATE
            `
            const existingReview = await tx.review.findFirst({
                where: {
                    productId,
                    userId: user.id,
                },
            })

            const status = statusAfterAuthorWrite(existingReview?.status ?? null, policy.mode)
            if (!status) throw new Error('This review has been removed.')

            // クライアント提供のIDを信頼せず、サーバー検証済みのIDのみ使用（IDOR防止）
            const fields = {
                review: input.review,
                rating: input.rating,
                size: input.size,
                quantity: input.quantity,
                variant: input.variant,
                color: input.color,
                status,
                isVerifiedPurchase,
                // 却下後の再投稿は新しい審査対象なので、前回の却下理由を審査キューに持ち越さない。
                // それ以外の状態では運営の判断記録を残す（キー自体を渡さない）
                ...(existingReview?.status === ReviewStatus.REJECTED && {
                    moderationReason: null,
                    moderatedAt: null,
                }),
            }
            const details = existingReview
                ? await tx.review.update({
                      where: {
                          id: existingReview.id,
                      },
                      data: {
                          ...fields,
                          images: {
                              deleteMany: {},
                              create: input.images.map((img) => ({
                                  url: img.url,
                              })),
                          },
                          userId: user.id,
                      },
                      include: {
                          images: true,
                          user: true,
                      },
                  })
                : await tx.review.create({
                      data: {
                          ...fields,
                          images: {
                              create: input.images.map((img) => ({
                                  url: img.url,
                              })),
                          },
                          productId,
                          userId: user.id,
                      },
                      include: {
                          images: true,
                          user: true,
                      },
                  })

            await recomputeRatings(tx, productId, storeId)

            return details
        })

        return reviewDetails
    } catch (error: unknown) {
        let message = 'Unknown error';
        if (error instanceof Error) {
            message = error.message;
            console.error('Error updating review:', error.message, error.stack)
        } else {
            message = String(error);
            console.error('Error updating review:', error)
        }
        throw new Error(`Error updating review: ${message}`)
    }
};

/**
 * @name reportReview
 * @description 公開中のレビューを通報する。事後審査で未解決の通報（異なる通報者）が閾値に達したら
 *   PUBLISHED → FLAGGED に遷移させる（design review-governance §4）。同じ人の二重通報は冪等。
 * @access Authenticated user（自分のレビューは通報できない）
 * @param input - `{ reviewId, reason, note? }`（`ReportReviewSchema`）
 * @returns `{ status }` — 通報後のレビューの状態
 */
export const reportReview = async (
    input: unknown
): Promise<{ status: ReviewStatus }> => {
    // 認可ガードは try の外（認可エラーを汎用メッセージで上書きしない）
    const user = await requireUser();

    const parsed = ReportReviewSchema.safeParse(input);
    if (!parsed.success) throw new Error("Invalid report.");
    const { reviewId, reason, note } = parsed.data;

    try {
        return await db.$transaction(async (tx) => {
            // Review 行だけをロックする（Product / Store は取らない — 集計を変えないため）。
            // ロックを取る経路はすべて Product → Store → Review の順の部分列なので、待ちの輪はできない。
            await tx.$queryRaw`
                SELECT "id" FROM "Review" WHERE "id" = ${reviewId} FOR UPDATE
            `;
            const target = await tx.review.findUnique({
                where: { id: reviewId },
                select: { userId: true, status: true },
            });
            if (!target || !isPublicReviewStatus(target.status)) {
                return fail("Review not found.");
            }
            if (target.userId === user.id) {
                return fail("You cannot report your own review.");
            }

            // P2002 を出すと PostgreSQL のトランザクションが中断する（以降の文が全部失敗する）ので、
            // catch で吸収せず ON CONFLICT DO NOTHING にする。
            await tx.reviewReport.createMany({
                data: [{ reviewId, reporterId: user.id, reason, note }],
                skipDuplicates: true,
            });

            if (target.status !== ReviewStatus.PUBLISHED) return { status: target.status };

            const policy = await loadReviewPolicy(tx);
            const unresolved = await tx.reviewReport.count({
                where: { reviewId, resolvedAt: null },
            });
            if (!shouldFlag(policy.mode, unresolved, policy.flagThreshold)) {
                return { status: target.status };
            }

            // PUBLISHED → FLAGGED は公開集合の中の遷移なので集計は変わらない
            await tx.review.update({
                where: { id: reviewId },
                data: { status: ReviewStatus.FLAGGED },
            });
            return { status: ReviewStatus.FLAGGED };
        });
    } catch (error: unknown) {
        return rethrow("reportReview", "Failed to report review.", error);
    }
};

/**
 * @name moderateReview
 * @description 運営によるレビューの承認・却下・削除・復帰。遷移表（`src/lib/review-moderation.ts`）に無い操作は拒否する。
 *   公開集合への出入りがある遷移では商品と店舗の評価を同じトランザクションで再計算する。
 * @access Admin only
 * @param input - `{ reviewId, action, reason? }`（`ModerateReviewSchema`。reject / remove は理由必須）
 * @returns `{ id, status }` — 遷移後のレビュー
 */
export const moderateReview = async (
    input: unknown
): Promise<{ id: string; status: ReviewStatus }> => {
    // 認可ガードは try の外（認可エラーを汎用メッセージで上書きしない）
    await requireAdmin();

    const parsed = ModerateReviewSchema.safeParse(input);
    if (!parsed.success) throw new Error("Invalid moderation request.");
    const { reviewId, action, reason } = parsed.data;

    try {
        return await db.$transaction(async (tx) => {
            // ロック対象を引く（ロックの前の読み取りなので、状態はロック後に読み直す）
            const located = await tx.review.findUnique({
                where: { id: reviewId },
                select: { productId: true, product: { select: { storeId: true } } },
            });
            if (!located) return fail("Review not found.");

            // 投稿と同じ Product → Store の順で取り、最後に Review を取る
            await tx.$queryRaw`
                SELECT "id" FROM "Product" WHERE "id" = ${located.productId} FOR UPDATE
            `;
            await tx.$queryRaw`
                SELECT "id" FROM "Store" WHERE "id" = ${located.product.storeId} FOR UPDATE
            `;
            await tx.$queryRaw`
                SELECT "id" FROM "Review" WHERE "id" = ${reviewId} FOR UPDATE
            `;
            const current = await tx.review.findUnique({
                where: { id: reviewId },
                select: { status: true },
            });
            if (!current) return fail("Review not found.");

            const next = moderationTransition(current.status, action);
            if (!next) return fail("Invalid moderation transition.");

            const updated = await tx.review.update({
                where: { id: reviewId },
                data: {
                    status: next,
                    moderationReason: reason || null,
                    moderatedAt: new Date(),
                },
                select: { id: true, status: true },
            });

            if (isPublicReviewStatus(current.status) !== isPublicReviewStatus(next)) {
                await recomputeRatings(tx, located.productId, located.product.storeId);
            }

            // FLAGGED の判断（復帰 / 削除）で未解決の通報を閉じる。閉じないと同じ通報が
            // 閾値に数え続けられ、復帰した直後に再び FLAGGED になりうる。
            if (action === "restore" || action === "remove") {
                await tx.reviewReport.updateMany({
                    where: { reviewId, resolvedAt: null },
                    data: { resolvedAt: new Date() },
                });
            }

            return updated;
        });
    } catch (error: unknown) {
        return rethrow("moderateReview", "Failed to moderate review.", error);
    }
};

const MODERATION_QUEUE_PAGE_SIZE = 20;
const DEFAULT_QUEUE_STATUSES = [ReviewStatus.PENDING_REVIEW, ReviewStatus.FLAGGED];

const isReviewStatus = (value: unknown): value is ReviewStatus =>
    typeof value === "string" && (Object.values(ReviewStatus) as string[]).includes(value);

/**
 * @name getReviewModerationQueue
 * @description 運営の審査キュー。既定は審査待ちと FLAGGED を古い順に返す。
 * @access Admin only
 * @param params - `status`（未定義・不正値は既定の集合）、`page`（URL 由来。`normalizePageParam` で正規化）
 * @returns `{ reviews, page, totalPages }`
 */
export const getReviewModerationQueue = async (params: {
    status?: unknown;
    page?: unknown;
}) => {
    await requireAdmin();

    const statuses = isReviewStatus(params.status) ? [params.status] : DEFAULT_QUEUE_STATUSES;
    const page = normalizePageParam(params.page);
    const where: Prisma.ReviewWhereInput = { status: { in: statuses } };

    try {
        const [reviews, total] = await Promise.all([
            db.review.findMany({
                where,
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                skip: (page - 1) * MODERATION_QUEUE_PAGE_SIZE,
                take: MODERATION_QUEUE_PAGE_SIZE,
                select: {
                    id: true,
                    review: true,
                    rating: true,
                    status: true,
                    isVerifiedPurchase: true,
                    moderationReason: true,
                    createdAt: true,
                    product: { select: { name: true, slug: true } },
                    user: { select: { name: true, email: true } },
                    _count: { select: { reports: { where: { resolvedAt: null } } } },
                },
            }),
            db.review.count({ where }),
        ]);

        return {
            reviews,
            page,
            totalPages: Math.max(1, Math.ceil(total / MODERATION_QUEUE_PAGE_SIZE)),
        };
    } catch (error: unknown) {
        return rethrow("getReviewModerationQueue", "Failed to load review queue.", error);
    }
};
