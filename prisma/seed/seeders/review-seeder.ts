/**
 * レビューseeder: Review
 */

import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { SEED_REVIEWS } from "../constants/reviews";
import type { SeedMaps } from "../types";

/**
 * Seeds review and review image records from the SEED_REVIEWS dataset.
 *
 * Existing reviews of the seed users are removed first, and everything is applied in a single
 * transaction. Reviews referencing products that cannot be resolved are skipped and reported.
 *
 * **トランザクション内のクエリ数を件数に比例させない。** 対話的トランザクションの既定
 * タイムアウトは 5 秒で、1 件ずつ `create` すると「クエリ数 × DB 往復時間」がそれを超える
 * （Neon ap-southeast-1 へ日本から接続すると 186 クエリで P2028 になった）。レビュー id を
 * ここで採番して画像の `reviewId` を先に決め、削除 1 + `createMany` 2 の定数回で書く。
 *
 * @param maps - Lookup maps containing `users` (maps user email to userId) and `products` (maps product slug to productId)
 *
 * @throws Error if a review references a userEmail not present in `maps.users`
 */
export async function seedReviews(
  prisma: PrismaClient,
  maps: Pick<SeedMaps, "users" | "products">
): Promise<void> {
  const missingProductSlugs: string[] = [];
  const reviews: Prisma.ReviewCreateManyInput[] = [];
  const images: Prisma.ReviewImageCreateManyInput[] = [];

  // 書き込み内容はトランザクションの外で組み立てる（検証エラーで tx を開かない）
  for (const r of SEED_REVIEWS) {
    const userId = maps.users.get(r.userEmail);
    if (!userId) {
      throw new Error(`ユーザーが見つかりません: ${r.userEmail}（レビュー）`);
    }

    const productId = maps.products.get(r.productSlug);
    if (!productId) {
      // 存在しない商品へのレビューはスキップ（Geminiデータの不整合を許容）
      missingProductSlugs.push(r.productSlug);
      continue;
    }

    const id = randomUUID();
    reviews.push({
      id,
      variant: r.variant,
      rating: r.rating,
      review: r.review,
      size: r.size,
      color: r.color,
      likes: r.likes,
      quantity: r.quantity,
      userId,
      productId,
    });
    for (const img of r.images ?? []) {
      images.push({ url: img.url, alt: img.alt, reviewId: id });
    }
  }

  await prisma.$transaction(async (tx) => {
    // seed ユーザーのレビューのみ削除（E2Eデータとの衝突回避）
    const seedUserIds = Array.from(maps.users.values());
    await tx.review.deleteMany({
      where: { userId: { in: seedUserIds } },
    });
    if (reviews.length > 0) {
      await tx.review.createMany({ data: reviews });
    }
    if (images.length > 0) {
      await tx.reviewImage.createMany({ data: images });
    }
  });

  if (missingProductSlugs.length > 0) {
    const uniqueSlugs = Array.from(new Set(missingProductSlugs));
    console.warn(
      `⚠️  ${missingProductSlugs.length}件のレビューがスキップされました（商品が存在しないため）\n` +
      `   対象slug: ${uniqueSlugs.join(", ")}`
    );
  }
}
