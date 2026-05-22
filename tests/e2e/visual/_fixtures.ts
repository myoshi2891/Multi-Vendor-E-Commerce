import { test as base, expect } from "@playwright/test";
import { buildE2ESeed } from "../seed/constants";
import { setupE2ETestState } from "@/config/test-helpers";

type E2ESeed = ReturnType<typeof buildE2ESeed>;

/**
 * Visual Regression spec 共通フィクスチャ。
 *
 * `seed` は workerIndex / projectName から決定論的に構築され、
 * 利用前に `setupE2ETestState` でブラウザ側の事前状態（localStorage 等）が
 * セットアップされる。cart.spec.ts / checkout.spec.ts から再利用する。
 */
export const test = base.extend<{ seed: E2ESeed }>({
    // 第2引数は Playwright の "use" コールバック。ESLint の react-hooks/rules-of-hooks が
    // "use" 名を React Hook と誤検出するため、別名で受け取る。
    seed: async ({ page }, provideSeed, testInfo) => {
        const seed = buildE2ESeed({
            workerIndex: testInfo.workerIndex,
            projectName: testInfo.project.name,
        });
        await setupE2ETestState(page, seed);
        await provideSeed(seed);
    },
});

export { expect };
