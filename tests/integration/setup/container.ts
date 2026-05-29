/**
 * Jest `globalSetup` — Integration テスト用 PostgreSQL を起動し、
 * Prisma マイグレーションを適用する。
 *
 * 起動経路は以下の優先順位で決定する:
 *
 *   1. `process.env.DATABASE_URL` が設定されており、`postgresql://stub:stub@...` 等の
 *      CI スタブ値でない場合:
 *      → 外部 DB (docker-compose.test.yml で起動した postgres-test、または
 *         CI workflow の services.postgres 等) へ接続するとみなし、
 *         testcontainers の起動はスキップする。`prisma migrate deploy` のみ実行。
 *
 *   2. それ以外:
 *      → `@testcontainers/postgresql` で PostgreSqlContainer を起動し、
 *         接続文字列を `process.env.DATABASE_URL` / `process.env.DIRECT_URL` に注入してから
 *         `prisma migrate deploy` を実行する。
 *         container instance は `globalThis.__INTEGRATION_PG_CONTAINER__` に保持し、
 *         teardown.ts が停止する。
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - tests/integration/setup/teardown.ts
 */
import { execFileSync } from "node:child_process";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

const STUB_URL_PATTERNS = [
    /:\/\/stub:stub@/,
    /:\/\/$/,
];

/** 与えられた URL が CI スタブ値の場合 true。 */
function isStubUrl(url: string | undefined): boolean {
    if (!url) return true;
    return STUB_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * `prisma migrate deploy` を子プロセスで実行する。
 * `process.env.DATABASE_URL` が呼び出し時点で書き換わっている必要がある。
 *
 * `execFileSync` を引数配列形式で呼び出すことでシェル経由を避け、メタ文字解釈が発生しない
 * 安全な呼び出しとする。
 */
function applyMigrations(): void {
    try {
        execFileSync("bunx", ["prisma", "migrate", "deploy"], {
            stdio: "inherit",
            env: process.env,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
            `[integration-setup] prisma migrate deploy failed: ${message}`
        );
    }
}

export default async function globalSetup(): Promise<void> {
    const existingUrl = process.env.DATABASE_URL;

    if (!isStubUrl(existingUrl)) {
        // 外部 DB モード (docker-compose.test.yml / CI services.postgres 等)
        console.log(
            "[integration-setup] Using external DATABASE_URL (testcontainers skipped)"
        );
        applyMigrations();
        return;
    }

    console.log("[integration-setup] Starting testcontainers PostgreSQL...");
    // postgres:16-alpine を選択。CI の seed-idempotency ジョブで使う postgres:16.14 と
    // メジャーバージョンを揃えつつ、testcontainers のローカル起動を高速化する。
    const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
        "postgres:16-alpine"
    )
        .withDatabase("integration_test")
        .withUsername("test")
        .withPassword("test")
        .start();

    const url = container.getConnectionUri();
    process.env.DATABASE_URL = url;
    process.env.DIRECT_URL = url;

    // teardown.ts から参照するため globalThis に保持
    (globalThis as unknown as { __INTEGRATION_PG_CONTAINER__: StartedPostgreSqlContainer }).__INTEGRATION_PG_CONTAINER__ =
        container;

    console.log(`[integration-setup] testcontainers ready: ${url}`);
    applyMigrations();
}
