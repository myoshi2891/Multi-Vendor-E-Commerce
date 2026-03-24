import { clerkSetup } from '@clerk/testing/playwright';
import { createServer } from 'net';

const CLERK_SETUP_TIMEOUT_MS = 30_000; // 30秒

/**
 * 指定ポートが使用中かどうかを検出する。
 * Playwright の reuseExistingServer 設定の動作をユーザーに明示するために使用。
 */
async function isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const server = createServer();
        server.once('error', () => resolve(true));
        server.once('listening', () => {
            server.close();
            resolve(false);
        });
        server.listen(port);
    });
}

export default async function globalSetup() {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
    const port = Number(new URL(baseURL).port) || 3000;

    // ポートチェックログは削除（リポジトリルール違反）
    await isPortInUse(port);  // 結果は使用しない（副作用なし）

    let timeoutId: NodeJS.Timeout | undefined;
    try {
        await Promise.race([
            clerkSetup(),
            new Promise<never>((_, reject) => {
                timeoutId = setTimeout(
                    () => reject(new Error(`clerkSetup() timed out after ${CLERK_SETUP_TIMEOUT_MS}ms. Check CLERK_SECRET_KEY and network connectivity.`)),
                    CLERK_SETUP_TIMEOUT_MS
                );
            }),
        ]);
    } catch (error) {
        if (error instanceof Error) {
            console.error("[globalSetup] clerkSetup failed:", error.message, error.stack);
            throw new Error(`clerkSetup failed: ${error.message}`);
        } else {
            console.error("[globalSetup] clerkSetup failed:", error);
            throw error;
        }
    } finally {
        if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
        }
    }
}
