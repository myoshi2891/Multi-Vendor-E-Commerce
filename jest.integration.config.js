// jest.integration.config.js — Integration テスト専用 Jest 設定
//
// 本設定は `tests/integration/` 配下のテストにのみ適用される。
// メイン `jest.config.js` (unit / component) と分離することで:
//   - testEnvironment を jsdom に固定 (Cart / Checkout コンポーネントの hydration 検証用)
//   - globalSetup で testcontainers PostgreSQL を起動
//   - 並列実行を 1 worker に限定 (per-worker container 化は ADR-004 Future Work)
//
// 関連: docs/architecture/decisions/004-integration-test-db-strategy.md

module.exports = {
    preset: "ts-jest",
    testEnvironment: "jsdom",
    setupFilesAfterEnv: ["<rootDir>/tests-setup/jest.setup.ts"],
    testMatch: ["<rootDir>/tests/integration/**/*.test.{ts,tsx}"],
    testPathIgnorePatterns: [
        "/node_modules/",
        // setup/ 配下は helpers (testcontainers 起動・seed・reset) であり test ではない
        "<rootDir>/tests/integration/setup/",
    ],
    moduleNameMapper: {
        // 静的アセット (画像) と CSS を空文字列/オブジェクトスタブに差し替える。
        // CheckoutPage の transitive import (StoreHeader → download-app.tsx /
        // country-lang-curr-selector.tsx 等) で .webp/.png/.svg/.css を読み込むため、
        // jsdom 環境では構文エラーになる。テストではアセット自体は不要。
        "\\.(webp|png|jpg|jpeg|gif|svg)$": "<rootDir>/tests/integration/setup/file-mock.js",
        "\\.(css|less|scss|sass)$": "<rootDir>/tests/integration/setup/style-mock.js",
        "^@/public/(.*)$": "<rootDir>/public/$1",
        "^@/(.*)$": "<rootDir>/src/$1",
    },
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: {
                    jsx: "react-jsx",
                },
            },
        ],
        // uuid v14 は ESM のみで dist-node も export 構文を使うため、
        // ts-jest の JS 変換対象に明示的に含める。CheckoutPage の transitive import
        // (address-details.tsx → uuid) で必要になる。
        "^.+\\.js$": [
            "ts-jest",
            {
                useESM: false,
                tsconfig: {
                    allowJs: true,
                    target: "es2020",
                    module: "commonjs",
                },
            },
        ],
    },
    // node_modules はデフォルトで transform 対象外だが、uuid だけは ESM のため変換が必要
    transformIgnorePatterns: ["/node_modules/(?!uuid/)"],
    globalSetup: "<rootDir>/tests/integration/setup/container.ts",
    globalTeardown: "<rootDir>/tests/integration/setup/teardown.ts",
    // testcontainers 起動 + prisma migrate deploy のマージン
    testTimeout: 60_000,
    // ADR-004 記載: per-worker container 戦略は Future Work。
    // 当面は 1 worker で共有 DB を直列利用し、テスト間は tests/integration/setup/reset-db.ts で TRUNCATE する。
    maxWorkers: 1,
};
