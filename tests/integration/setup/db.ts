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
 * Return a worker-scoped Prisma Client instance for integration tests.
 *
 * Initializes and caches a PrismaClient configured from `process.env.DATABASE_URL`.
 * Logging is enabled for `query`, `error`, and `warn` when `DEBUG_PRISMA === "1"`, otherwise only `error` is enabled.
 *
 * @returns The cached `PrismaClient` instance for the current test worker
 */
export function getTestDb(): PrismaClient {
    if (cachedClient) return cachedClient;
    cachedClient = new PrismaClient({
        log: process.env.DEBUG_PRISMA === "1" ? ["query", "error", "warn"] : ["error"],
    });
    return cachedClient;
}

/**
 * Closes the worker-scoped Prisma Client connection and clears the cached instance.
 *
 * If no client is cached, the function returns immediately.
 */
export async function disconnectTestDb(): Promise<void> {
    if (!cachedClient) return;
    await cachedClient.$disconnect();
    cachedClient = null;
}
