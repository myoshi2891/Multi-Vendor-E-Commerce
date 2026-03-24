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

    const portInUse = await isPortInUse(port);
    if (portInUse) {
        console.log(`[globalSetup] Port ${port} is already in use. Reusing existing server.`);
    } else {
        console.log(`[globalSetup] Port ${port} is free. Playwright will start dev server.`);
    }

    console.log('[globalSetup] Starting clerkSetup...');
    try {
        await Promise.race([
            clerkSetup(),
            new Promise<never>((_, reject) =>
                setTimeout(
                    () => reject(new Error(`clerkSetup() timed out after ${CLERK_SETUP_TIMEOUT_MS}ms. Check CLERK_SECRET_KEY and network connectivity.`)),
                    CLERK_SETUP_TIMEOUT_MS
                )
            ),
        ]);
        console.log('[globalSetup] clerkSetup completed successfully.');
    } catch (error) {
        if (error instanceof Error) {
            console.error("[globalSetup] clerkSetup failed:", error.message, error.stack);
            throw new Error(`clerkSetup failed: ${error.message}`);
        } else {
            console.error("[globalSetup] clerkSetup failed:", error);
            throw error;
        }
    }
}
