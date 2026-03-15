/**
 * レビューseeder: Review
 */

import { PrismaClient } from "@prisma/client";
import { SEED_REVIEWS } from "../constants/reviews";
import type { SeedMaps } from "../types";

export async function seedReviews(
  prisma: PrismaClient,
  maps: Pick<SeedMaps, "users" | "products">
): Promise<void> {
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    // seed ユーザーのレビューのみ削除（E2Eデータとの衝突回避）
    const seedUserIds = Array.from(maps.users.values());
    await tx.review.deleteMany({
      where: { userId: { in: seedUserIds } },
    });

    for (const r of SEED_REVIEWS) {
      const userId = maps.users.get(r.userEmail);
      if (!userId) {
        throw new Error(`ユーザーが見つかりません: ${r.userEmail}（レビュー）`);
      }

      const productId = maps.products.get(r.productSlug);
      if (!productId) {
        // 存在しない商品へのレビューはスキップ（Geminiデータの不整合を許容）
        skipped++;
        continue;
      }

      const review = await tx.review.create({
        data: {
          variant: r.variant,
          rating: r.rating,
          review: r.review,
          size: r.size,
          color: r.color,
          likes: r.likes,
          quantity: r.quantity,
          userId,
          productId,
        },
      });

      if (r.images && r.images.length > 0) {
        await tx.reviewImage.createMany({
          data: r.images.map((img) => ({
            url: img.url,
            alt: img.alt,
            reviewId: review.id,
          })),
        });
      }
    }
  });

  if (skipped > 0) {
    console.warn(
      `⚠️  ${skipped}件のレビューがスキップされました（商品が存在しないため）`
    );
  }
}
