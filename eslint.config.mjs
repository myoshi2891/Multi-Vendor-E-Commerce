import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tailwindcss from "eslint-plugin-tailwindcss";

/** @type {import("eslint").Linter.Config[]} */
const config = [
    { ignores: ["coverage/**", ".next/**"] },
    ...nextCoreWebVitals,
    ...tailwindcss.configs["flat/recommended"],
    {
        files: ["**/*.{ts,tsx,jsx}"],
        rules: {
            "tailwindcss/classnames-order": "warn",
        },
    },
    {
        // eslint-plugin-react-hooks v6 の新ルールを一時的に warn に
        // 既存コードのリファクタリングは別タスクで対応
        files: ["**/*.{tsx,jsx}"],
        rules: {
            "react-hooks/set-state-in-effect": "warn",
            "react-hooks/static-components": "warn",
            "react-hooks/immutability": "warn",
            "react-hooks/purity": "warn",
            "react-hooks/globals": "warn",
        },
    },
    {
        // テストファイルは <img> を直接使うことがある — Next.js / a11y ルールを緩める
        files: ["tests/**/*.{tsx,jsx,ts}", "src/**/*.test.{tsx,jsx,ts}"],
        rules: {
            "@next/next/no-img-element": "off",
            "jsx-a11y/alt-text": "off",
        },
    },
];

export default config;
