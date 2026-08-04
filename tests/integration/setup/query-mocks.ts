/**
 * Integration テスト用の部分モック補助。
 *
 * `jest.mock(...)` で `@/queries/*` の一部だけを差し替える際、「他のテストには影響させない」
 * ために必要な**実装透過**（actual をそのまま呼ぶ）実装を 1 箇所へ集約する。
 * factory / `mockImplementationOnce` / `afterEach` の張り直しで同じ `requireActual` 式を
 * 三重に書くと、「reset したが張り直し忘れ」というリークの温床になるため。
 *
 * 置き場所について: モックユーティリティの既定は `src/config/test-helpers.ts`（CLAUDE.md）だが、
 * `tests/integration/` は別 Jest config（`jest.integration.config.js` — testcontainers の
 * globalSetup / `maxWorkers: 1`）で走り、`src/config/` を一切 import していない層である。
 * `tests/integration/setup/seed.ts` と同じく「shape は踏襲・実体は setup/」に従う。
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - tests/integration/setup/seed.ts (同じ層境界の先例)
 */

/**
 * 実装透過の delivery 詳細取得。
 *
 * `jest.mock("@/queries/product", ...)` で差し替えたモックの既定実装として使う。
 * 型注釈はインライン import 型クエリで完結させ、値名に対する `typeof` を避ける。
 *
 * 注意: `jest.mock` の factory 内からは**参照できない**（`jest.mock` は import より上へ
 * 巻き上げられ、その時点で本モジュールは未初期化のため）。factory 内はローカルの
 * `jest.requireActual` を使い、本ヘルパーは `mockImplementation` / `mockImplementationOnce`
 * など巻き上げの影響を受けない通常のコードからのみ参照すること。
 */
export const actualDeliveryDetails: (typeof import("@/queries/product"))["getDeliveryDetailsForStoreByCountry"] =
    (...args) =>
        jest
            .requireActual<typeof import("@/queries/product")>(
                "@/queries/product"
            )
            .getDeliveryDetailsForStoreByCountry(...args);
