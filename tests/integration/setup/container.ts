/**
 * Jest `globalSetup` — Integration テスト用 PostgreSQL を起動し、
 * Prisma マイグレーションを適用する。
 *
 * 起動経路は以下の優先順位で決定する:
 *
 *   1. `process.env.DATABASE_URL` が設定されており、`postgresql://stub:stub@...` 等の
 *      CI スタブ値でない場合 (= 外部 DB モード):
 *      → docker-compose.test.yml で起動した postgres-test 等へ接続するとみなす。
 *         ただし `prisma migrate deploy` と各テストの TRUNCATE が実 DB に向くと
 *         データ破壊につながるため、以下の **2 つのガード** を必須とする:
 *           a. `INTEGRATION_DB_ALLOW_EXTERNAL === "1"` の明示的オプトイン
 *           b. 接続先 DB 名が `test` / `integration` を含むこと
 *         両方を満たした場合のみ testcontainers をスキップし migrate deploy を実行。
 *         `DIRECT_URL` 未設定時は `DATABASE_URL` を流用する (schema の
 *         `directUrl = env("DIRECT_URL")` を解決するため)。
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

/**
 * Determines whether a URL is considered a CI stub value.
 *
 * Treats `undefined` as a stub value and matches known stub patterns.
 *
 * @param url - The URL to check; if `undefined`, it is treated as a stub
 * @returns `true` if the URL is a CI stub value, `false` otherwise
 */
function isStubUrl(url: string | undefined): boolean {
    if (!url) return true;
    return STUB_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Determine whether the database name from a connection URL contains "test" or "integration".
 *
 * Parses the URL's pathname (leading '/' removed) as the database name and treats parsing failures as not safe.
 *
 * @param url - The connection URL to inspect
 * @returns `true` if the extracted database name contains "test" or "integration" (case-insensitive), `false` otherwise
 */
function isSafeTestDbName(url: string): boolean {
    try {
        const dbName = new URL(url).pathname.replace(/^\//, "").toLowerCase();
        return dbName.includes("test") || dbName.includes("integration");
    } catch {
        return false;
    }
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

/**
 * Prepare an integration-test PostgreSQL environment and apply Prisma migrations.
 *
 * If an external DATABASE_URL is provided (not a CI stub), validates explicit opt-in
 * and that the target database name contains "test" or "integration", sets DIRECT_URL
 * if missing, and then runs migrations against that database. Otherwise, starts a
 * PostgreSQL testcontainer, injects its connection URI into DATABASE_URL and DIRECT_URL,
 * stores the container instance on `globalThis.__INTEGRATION_PG_CONTAINER__` for teardown,
 * and runs migrations against the container.
 *
 * @throws Error If an external DATABASE_URL is present but INTEGRATION_DB_ALLOW_EXTERNAL !== "1".
 * @throws Error If an external DATABASE_URL is present and the database name does not contain "test" or "integration".
 */
export default async function globalSetup(): Promise<void> {
    const existingUrl = process.env.DATABASE_URL;

    if (!isStubUrl(existingUrl)) {
        // 外部 DB モード (docker-compose.test.yml 等)。
        // 実 DB へ migrate deploy / TRUNCATE が向くのを防ぐため 2 段ガードする。
        const url = existingUrl as string;

        if (process.env.INTEGRATION_DB_ALLOW_EXTERNAL !== "1") {
            throw new Error(
                "[integration-setup] External DATABASE_URL detected but " +
                    "INTEGRATION_DB_ALLOW_EXTERNAL is not set to '1'. " +
                    "Refusing to run migrations/TRUNCATE against a non-stub DB. " +
                    "Set INTEGRATION_DB_ALLOW_EXTERNAL=1 (docker-compose mode) or " +
                    "leave DATABASE_URL empty to use testcontainers."
            );
        }

        if (!isSafeTestDbName(url)) {
            throw new Error(
                "[integration-setup] Refusing to use DATABASE_URL whose database " +
                    "name does not contain 'test' or 'integration'. " +
                    "This guards against accidentally targeting a dev/prod DB."
            );
        }

        // schema の directUrl = env("DIRECT_URL") を解決するため、未設定なら流用する。
        if (!process.env.DIRECT_URL) {
            process.env.DIRECT_URL = url;
        }

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
