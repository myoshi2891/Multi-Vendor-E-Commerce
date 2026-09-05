"use server";

import { db } from "@/lib/db";
import { ReviewDetailsType } from "@/lib/types";
import { requireUser } from "@/lib/auth-guards";

/**
 * @name upsertReview
 * @description - Upserts a review into the database, updating if it exists or creating a new one if not.
 * @access Admin only for creation/updating of reviews.
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

	try {
        // ローカル環境等の事情で Webhook 同期が漏れていた場合に備え、DB上に User レコードをオンデマンドで自動作成（フォールバック）。
        // findUnique → create の2段構えだと並行リクエスト時に unique 制約違反のレースが起きうるため、upsert でアトミック化する。
        const email = user.emailAddresses[0]?.emailAddress
        if (!email) throw new Error('User email not found in Clerk.')

        await db.user.upsert({
            where: { id: user.id },
            update: {}, // 既存ユーザーは変更しない（フォールバック作成のみが目的）
            create: {
                id: user.id,
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
                email: email,
                picture: user.imageUrl || '',
                role: 'USER',
            },
        })

        // Ensure productId and review are provided
        if (!productId) throw new Error('Product ID is required.')
        if (!review) throw new Error('Please provide review data.')

        // レビュー行の書き込みと Product の集計更新は 1 つのトランザクションで行う。
        //
        // 分けていた頃は create → findMany → product.update の 3 往復で、並行投稿が
        // lost update を起こしえた: A と B が同時に投稿すると、両者が「相手の行が
        // まだ見えない」時点で findMany を撃ち、後から commit した側の
        // product.update が numReviews / rating を 1 件ぶん巻き戻す。
        //
        // トランザクションで囲うだけでは足りない（既定の Read Committed では
        // 両者が別スナップショットで findMany を撃てるため、A の行が B に見えない窓は
        // 残る）。**Product 行の排他ロックで直列化する**のが要点で、ロックは
        // review の書き込みより手前で取る —— 後ろで取ると「両者が insert 済み」に
        // なるまでの窓が開いたままになる。
        //
        // 副次効果として、同一ユーザーの同時二重投稿も閉じる: 後続 tx は
        // ロック解放後に findFirst を撃ち直すので、create ではなく update に落ちる
        // （`Review` には (productId, userId) の unique 制約が無いため、
        // ここを開けておくと同一ユーザーの行が 2 本できる）。
        //
        // トランザクションオプションは付けない（4 文・外部 I/O 無しで既定 timeout 5s に
        // 収まる）。ただしロック保持時間はそのまま同一商品への並行投稿の待ち時間になる。
        const reviewDetails = await db.$transaction(async (tx) => {
            // Prisma の fluent API はロック句を表現できないため $queryRaw を使う
            // （値は常にパラメータ化される）。行が無ければ 0 件が返り、下の
            // product.update が P2025 で落ちる。
            await tx.$queryRaw`
                SELECT "id" FROM "Product" WHERE "id" = ${productId} FOR UPDATE
            `

            // check for existing review
            const existingReview = await tx.review.findFirst({
                where: {
                    productId,
                    userId: user.id,
                },
            })

            // クライアント提供のIDを信頼せず、サーバー検証済みのIDのみ使用（IDOR防止）
            let details;
            if (existingReview) {
                details = await tx.review.update({
                    where: {
                        id: existingReview.id,
                    },
                    data: {
                        review: review.review,
                        rating: review.rating,
                        size: review.size,
                        quantity: review.quantity,
                        variant: review.variant,
                        color: review.color,
                        images: {
                            deleteMany: {},
                            create: review.images.map((img) => ({
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
            } else {
                details = await tx.review.create({
                    data: {
                        review: review.review,
                        rating: review.rating,
                        size: review.size,
                        quantity: review.quantity,
                        variant: review.variant,
                        color: review.color,
                        images: {
                            create: review.images.map((img) => ({
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
            }

            // Calculate the new average rating
            const productReviews = await tx.review.findMany({
                where: {
                    productId,
                },
                select: {
                    rating: true,
                },
            })

            const totalRating = productReviews.reduce(
                (acc, review) => acc + review.rating,
                0
            )
            const newAverageRating = totalRating / productReviews.length

            // Update the product's average rating
            await tx.product.update({
                where: {
                    id: productId,
                },
                data: {
                    rating: newAverageRating, // Update the average rating
                    numReviews: productReviews.length, // Update the number of reviews
                },
            })

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
