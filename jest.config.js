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
