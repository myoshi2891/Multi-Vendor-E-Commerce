import type { ScannedTest } from "./scan-tests";

export type DomainId =
    | "queries"
    | "api-routes"
    | "pages"
    | "store-ui"
    | "dashboard-ui"
    | "shared-ui"
    | "hooks-state"
    | "lib-utils"
    | "seed"
    | "other";

export type CategoryId =
    | "unit"
    | "integration"
    | "e2e"
    | "visual-snapshot"
    | "a11y"
    | "performance"
    | "api-contract"
    | "security";

export interface DomainMeta {
    id: DomainId;
    label: string;
    /** 短いラベル（マトリクス列見出し用） */
    shortLabel: string;
    description: string;
}

export interface CategoryMeta {
    id: CategoryId;
    label: string;
    description: string;
}

export const DOMAINS: readonly DomainMeta[] = [
    { id: "queries", label: "Server Actions", shortLabel: "queries", description: "src/queries/ 配下のサーバーアクション" },
    { id: "api-routes", label: "API Routes", shortLabel: "api", description: "src/app/api/ 配下の Route Handler" },
    { id: "pages", label: "Pages", shortLabel: "pages", description: "src/app/(store) / dashboard の Page コンポーネント" },
    { id: "store-ui", label: "Store UI", shortLabel: "store", description: "src/components/store/ 配下の顧客向け UI" },
    { id: "dashboard-ui", label: "Dashboard UI", shortLabel: "dashboard", description: "src/components/dashboard/ 配下の管理 UI" },
    { id: "shared-ui", label: "Shared & Primitives", shortLabel: "shared", description: "src/components/shared / ui の共通要素" },
    { id: "hooks-state", label: "Hooks & State", shortLabel: "hooks", description: "src/hooks / cart-store / providers" },
    { id: "lib-utils", label: "Lib & Utils", shortLabel: "lib", description: "src/lib / utils / middleware" },
    { id: "seed", label: "Seed", shortLabel: "seed", description: "prisma/seed/ のシードスクリプト" },
    { id: "other", label: "Other", shortLabel: "other", description: "上記いずれにも該当しないもの" },
] as const;

export const CATEGORIES: readonly CategoryMeta[] = [
    { id: "unit", label: "Unit", description: "個別関数・コンポーネントの単体テスト" },
    { id: "integration", label: "Integration", description: "モジュール間の連携テスト (RTL + MSW など)" },
    { id: "e2e", label: "E2E", description: "Playwright によるユーザーシナリオ再現" },
    { id: "visual-snapshot", label: "Visual / Snapshot", description: "UI の見た目の回帰テスト" },
    { id: "a11y", label: "Accessibility", description: "WCAG 等のアクセシビリティ適合" },
    { id: "performance", label: "Performance", description: "レンダリング・バンドルサイズ等の計測" },
    { id: "api-contract", label: "API / Contract", description: "API レスポンス・型契約の検証" },
    { id: "security", label: "Security", description: "XSS / CSRF / 認可境界 / 依存脆弱性" },
] as const;

// プレフィックス順序が重要: より具体的なものを先に評価する
const DOMAIN_RULES: ReadonlyArray<{ match: (p: string) => boolean; domain: DomainId }> = [
    { match: (p) => p.startsWith("src/queries/"), domain: "queries" },
    { match: (p) => p.startsWith("src/app/api/"), domain: "api-routes" },
    { match: (p) => p.startsWith("src/app/"), domain: "pages" },
    { match: (p) => p.startsWith("tests/e2e/"), domain: "pages" },
    // tests/integration/ は実 DB 統合テスト。SUT は src/queries/ (placeOrder / applyCoupon 等) のため queries 列へマップ
    { match: (p) => p.startsWith("tests/integration/"), domain: "queries" },
    { match: (p) => p.startsWith("src/components/store/") || p.startsWith("tests/component/store/"), domain: "store-ui" },
    { match: (p) => p.startsWith("src/components/dashboard/") || p.startsWith("tests/component/dashboard/"), domain: "dashboard-ui" },
    { match: (p) => p.startsWith("src/components/shared/") || p.startsWith("src/components/ui/") || p.startsWith("tests/component/shared/"), domain: "shared-ui" },
    { match: (p) => p.startsWith("tests/component/"), domain: "shared-ui" },
    { match: (p) => p.startsWith("src/components/"), domain: "shared-ui" },
    { match: (p) => p.startsWith("src/hooks/") || p.startsWith("src/cart-store/") || p.startsWith("src/providers/"), domain: "hooks-state" },
    { match: (p) => p.startsWith("src/lib/") || p.startsWith("src/utils/") || p === "src/middleware.test.ts" || p === "src/middleware.ts", domain: "lib-utils" },
    { match: (p) => p.startsWith("prisma/seed/"), domain: "seed" },
];

export interface CategorizedTest {
    test: ScannedTest;
    domain: DomainId;
    category: CategoryId;
}

/**
 * Map a project-relative file path to its domain identifier.
 *
 * @param relativePath - The file path relative to the repository root used to determine the domain
 * @returns The `DomainId` corresponding to the path, or `"other"` if no domain matches
 */
function detectDomain(relativePath: string): DomainId {
    for (const rule of DOMAIN_RULES) {
        if (rule.match(relativePath)) return rule.domain;
    }
    return "other";
}

const PLAYWRIGHT_CATEGORY_MAP: ReadonlyArray<{ prefix: string; category: CategoryId }> = [
    { prefix: "tests/e2e/visual/", category: "visual-snapshot" },
    { prefix: "tests/e2e/a11y/", category: "a11y" },
];

/**
 * Determine the test category from its kind and relative path.
 *
 * Rules:
 * - `kind === "playwright"`:
 *   - paths starting with `tests/e2e/visual/` → `visual-snapshot`
 *   - paths starting with `tests/e2e/a11y/` → `a11y`
 *   - otherwise → `e2e`
 * - paths starting with `tests/integration/` → `integration`
 * - paths starting with `tests/component/` → `integration`
 * - paths starting with `src/app/api/` → `api-contract`
 * - `src/middleware.test.ts` or paths starting with `src/utils/sanitize` → `security`
 * - otherwise → `unit`
 *
 * @param test - Scanned test metadata (uses `kind` and `relativePath` to decide)
 * @returns The chosen `CategoryId`
 */
function detectCategory(test: ScannedTest): CategoryId {
    const p = test.relativePath;

    if (test.kind === "playwright") {
        for (const rule of PLAYWRIGHT_CATEGORY_MAP) {
            if (p.startsWith(rule.prefix)) return rule.category;
        }
        return "e2e";
    }

    if (p.startsWith("tests/integration/")) return "integration";
    if (p.startsWith("tests/component/")) return "integration";
    if (p.startsWith("src/app/api/")) return "api-contract";

    // セキュリティ境界: middleware (認可) と sanitize (XSS) は Security へ
    if (p === "src/middleware.test.ts" || p.startsWith("src/utils/sanitize")) return "security";

    return "unit";
}

/**
 * Assigns a domain and category to a scanned test.
 *
 * @param test - The scanned test to classify
 * @returns An object containing the original `test` and its determined `domain` and `category`
 */
export function categorize(test: ScannedTest): CategorizedTest {
    return {
        test,
        domain: detectDomain(test.relativePath),
        category: detectCategory(test),
    };
}
