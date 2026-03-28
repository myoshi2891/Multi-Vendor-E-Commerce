import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tailwindcss from "eslint-plugin-tailwindcss";

/** @type {import("eslint").Linter.Config[]} */
export default [
    ...nextCoreWebVitals,
    ...tailwindcss.configs["flat/recommended"],
    {
        files: ["**/*.{tsx,jsx}"],
        rules: {
            "tailwindcss/classnames-order": "warn",
        },
    },
    {
        // eslint-plugin-react-hooks v6 の新ルールを一時的に warn に
        // 既存コードのリファクタリングは別タスクで対応
        rules: {
            "react-hooks/set-state-in-effect": "warn",
            "react-hooks/static-components": "warn",
            "react-hooks/immutability": "warn",
            "react-hooks/purity": "warn",
            "react-hooks/globals": "warn",
        },
    },
];
