// jest.config.js
module.exports = {
    preset: "ts-jest", // ts-jest を使ってる場合
    testEnvironment: "node",
    setupFilesAfterEnv: ["<rootDir>/tests-setup/jest.setup.ts"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
    },
    testPathIgnorePatterns: ["/node_modules/", "/tests/e2e/"],
};
