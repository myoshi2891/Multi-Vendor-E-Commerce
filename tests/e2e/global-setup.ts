import { clerkSetup } from '@clerk/testing/playwright';

const CLERK_SETUP_TIMEOUT_MS = 30_000; // 30秒

export default async function globalSetup() {
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
