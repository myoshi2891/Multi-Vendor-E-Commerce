/**
 * Seed メインエントリポイント
 * ラグジュアリーファッションEコマースのダミーデータ投入
 */

import { PrismaClient } from "@prisma/client";
import { seedAll } from "./seeders";

const prisma = new PrismaClient();

/**
 * Runs the full database seeding process using the Prisma client and ensures the client is disconnected afterward.
 *
 * If seeding fails, logs a descriptive error message and rethrows the error for upstream handling.
 */
async function main() {
  try {
    await seedAll(prisma);
  } catch (error) {
    console.error("❌ Seed失敗:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log("\n✨ Seed処理が正常に完了しました");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Seed処理中にエラーが発生しました:", error);
    process.exit(1);
  });
