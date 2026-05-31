// jest.config.js
module.exports = {
    preset: "ts-jest", // ts-jest を使ってる場合
    testEnvironment: "node",
    setupFilesAfterEnv: ["<rootDir>/tests-setup/jest.setup.ts"],
    moduleNameMapper: {
        "^@/public/(.*)$": "<rootDir>/public/$1",
        "^@/(.*)$": "<rootDir>/src/$1",
    },
    // tests/integration/ は jest.integration.config.js 経由でのみ実行する
    // (jsdom + testcontainers + globalSetup を伴うため別 worker pool が必要)
    testPathIgnorePatterns: ["/node_modules/", "/tests/e2e/", "/tests/integration/"],
    // カバレッジの分母をロジック中心の src 配下に固定する。
    // prisma/seed/ は src 外なので自動的に分母外。純表示物 (icons / RSC ラッパー) と
    // 型・定数・テストインフラは除外し、カバレッジ% を実態に即した値にする。
    collectCoverageFrom: [
        "src/**/*.{ts,tsx}",
        "!src/**/*.d.ts",
        "!src/**/*.test.{ts,tsx}",
        "!src/types/**",
        "!src/constants/**",
        "!src/data/**",
        "!src/config/**", // テスト共通インフラ
        "!src/migration-scripts/**",
        "!src/**/icons/**", // 純表示 SVG
        "!src/app/**/{layout,loading,error,not-found,template,page}.tsx", // 純 RSC ラッパー
    ],
    coverageReporters: ["lcov", "text-summary"],
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: {
                    jsx: "react-jsx",
                },
            },
        ],
    },
};
