/**
 * Integration テスト用 Prisma クライアントのファクトリ。
 *
 * 本ファイルは `.claude/steering/structure.md` の "テストスクリプトは例外" 規定に依拠し、
 * `src/lib/db.ts` のシングルトンを介さず PrismaClient を直接 instantiate する。
 * これは:
 *   - テスト worker ごとに独立した接続が必要
 *   - container.ts が globalSetup で `DATABASE_URL` を書き換えた後で初期化したい
 * という二点による。
 *
 * Worker 内では singleton として扱い、`afterAll` で `disconnect()` する設計に
 * 寄せるため、cached instance を保持する。
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - tests/integration/setup/container.ts
 * - tests/integration/setup/reset-db.ts
 */
import { PrismaClient } from "@prisma/client";

let cachedClient: PrismaClient | null = null;

/**
 * Worker scope の PrismaClient を返す。
 * 接続文字列は `process.env.DATABASE_URL` （container.ts が globalSetup で確定済み）。
 */
export function getTestDb(): PrismaClient {
    if (cachedClient) return cachedClient;
    cachedClient = new PrismaClient({
        log: process.env.DEBUG_PRISMA === "1" ? ["query", "error", "warn"] : ["error"],
    });
    return cachedClient;
}

/**
 * `afterAll` で呼ぶ。Worker scope の接続を閉じてキャッシュをクリアする。
 */
export async function disconnectTestDb(): Promise<void> {
    if (!cachedClient) return;
    await cachedClient.$disconnect();
    cachedClient = null;
}
