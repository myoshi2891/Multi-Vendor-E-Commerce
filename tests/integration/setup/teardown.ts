/**
 * Jest `globalTeardown` — container.ts が起動した testcontainers PostgreSQL を停止する。
 *
 * 外部 DB モード (DATABASE_URL を docker-compose / CI services 等で指定したケース) では
 * `globalThis.__INTEGRATION_PG_CONTAINER__` が未定義のため、no-op で完了する。
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - tests/integration/setup/container.ts
 */
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Stops the integration PostgreSQL Testcontainers instance referenced by
 * `globalThis.__INTEGRATION_PG_CONTAINER__`; does nothing if no container is set.
 *
 * Attempts to stop the container and logs a success message. If stopping fails,
 * logs the error message and stack for `Error` instances or the raw thrown value
 * for non-`Error` throwables.
 */
export default async function globalTeardown(): Promise<void> {
    const container = (
        globalThis as unknown as {
            __INTEGRATION_PG_CONTAINER__?: StartedPostgreSqlContainer;
        }
    ).__INTEGRATION_PG_CONTAINER__;

    if (!container) {
        return;
    }

    try {
        await container.stop();
        console.log("[integration-teardown] testcontainers stopped");
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[integration-teardown] failed to stop container:",
                error.message,
                error.stack
            );
        } else {
            console.error("[integration-teardown] unknown error:", error);
        }
    }
}
