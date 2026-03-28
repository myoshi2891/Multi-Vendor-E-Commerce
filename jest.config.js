// jest.config.js
module.exports = {
    preset: "ts-jest", // ts-jest を使ってる場合
    testEnvironment: "node",
    setupFilesAfterEnv: ["<rootDir>/tests-setup/jest.setup.ts"],
    moduleNameMapper: {
        "^@/public/(.*)$": "<rootDir>/public/$1",
        "^@/(.*)$": "<rootDir>/src/$1",
    },
    testPathIgnorePatterns: ["/node_modules/", "/tests/e2e/"],
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
