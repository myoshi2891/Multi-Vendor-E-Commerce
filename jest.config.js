// jest.config.js
module.exports = {
    preset: "ts-jest", // ts-jest を使ってる場合
    testEnvironment: "node",
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
    },
};
