import { clerkSetup } from '@clerk/testing/playwright';

export default async function globalSetup() {
    try {
        await clerkSetup();
    } catch (error) {
        if (error instanceof Error) {
            console.error("clerkSetup failed:", error.message, error.stack);
            throw new Error(`clerkSetup failed: ${error.message}`);
        } else {
            console.error("clerkSetup failed:", error);
            throw error;
        }
    }
}
