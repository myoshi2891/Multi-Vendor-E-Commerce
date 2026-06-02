import { categorize, DOMAINS, CATEGORIES } from "./categorize";
import type { ScannedTest } from "./scan-tests";

function mk(relativePath: string, kind: ScannedTest["kind"] = "jest"): ScannedTest {
    return { relativePath, kind, hasSkip: false, testCount: 1 };
}

describe("categorize - domain detection", () => {
    it.each([
        ["src/queries/store.test.ts", "queries"],
        ["src/app/api/webhooks/route.test.ts", "api-routes"],
        ["src/app/api/search-products/route.test.ts", "api-routes"],
        ["src/components/store/cart-product.test.tsx", "store-ui"],
        ["src/components/dashboard/header.test.tsx", "dashboard-ui"],
        ["src/components/shared/country-selector.test.tsx", "shared-ui"],
        ["src/components/ui/button.test.tsx", "shared-ui"],
        ["src/hooks/use-mobile.test.tsx", "hooks-state"],
        ["src/cart-store/useCartStore.test.ts", "hooks-state"],
        ["src/providers/modal-provider.test.tsx", "hooks-state"],
        ["src/lib/utils.test.ts", "lib-utils"],
        ["src/utils/sanitize.test.ts", "lib-utils"],
        ["src/middleware.test.ts", "lib-utils"],
        ["prisma/seed/__tests__/base-seeder.test.ts", "seed"],
        ["tests/component/store/cart-product.test.tsx", "store-ui"],
        ["tests/component/dashboard/header.test.tsx", "dashboard-ui"],
        ["tests/component/shared/country-selector.test.tsx", "shared-ui"],
        ["tests/e2e/purchase-flow.spec.ts", "pages"],
        ["tests/integration/cart-checkout.test.ts", "queries"],
        ["tests/integration/order-placement.test.ts", "queries"],
    ])("%s -> domain=%s", (path, expectedDomain) => {
        const r = categorize(mk(path, path.includes("tests/e2e") ? "playwright" : "jest"));
        expect(r.domain).toBe(expectedDomain);
    });

    it("不明なパスは 'other' に分類する", () => {
        expect(categorize(mk("totally/unknown/place.test.ts")).domain).toBe("other");
    });
});

describe("categorize - category detection", () => {
    it("Playwright spec ファイルは category=e2e (デフォルト)", () => {
        expect(categorize(mk("tests/e2e/login.spec.ts", "playwright")).category).toBe("e2e");
    });

    it("tests/e2e/visual/ 配下の Playwright spec は category=visual-snapshot", () => {
        expect(categorize(mk("tests/e2e/visual/cart.spec.ts", "playwright")).category).toBe("visual-snapshot");
    });

    it("tests/e2e/a11y/ 配下の Playwright spec は category=a11y", () => {
        expect(categorize(mk("tests/e2e/a11y/sign-in.spec.ts", "playwright")).category).toBe("a11y");
    });

    it("tests/component/ 配下は category=integration", () => {
        expect(
            categorize(mk("tests/component/store/cart.test.tsx")).category
        ).toBe("integration");
    });

    it("tests/integration/ 配下は category=integration (実 DB 統合テスト)", () => {
        expect(
            categorize(mk("tests/integration/cart-checkout.test.ts")).category
        ).toBe("integration");
        expect(
            categorize(mk("tests/integration/order-placement.test.ts")).category
        ).toBe("integration");
    });

    it("src/app/api/ 配下は category=api-contract", () => {
        expect(
            categorize(mk("src/app/api/webhooks/route.test.ts")).category
        ).toBe("api-contract");
    });

    it("middleware は category=security (認可境界のため)", () => {
        expect(categorize(mk("src/middleware.test.ts")).category).toBe("security");
    });

    it("sanitize は category=security (XSS 防御のため)", () => {
        expect(categorize(mk("src/utils/sanitize.test.ts")).category).toBe("security");
    });

    it("それ以外の *.test.ts は category=unit", () => {
        expect(categorize(mk("src/queries/store.test.ts")).category).toBe("unit");
        expect(categorize(mk("src/lib/utils.test.ts")).category).toBe("unit");
    });
});

describe("categorize - constants exposed", () => {
    it("DOMAINS は 10 件 (9 ドメイン + other) で seed を含む", () => {
        expect(DOMAINS).toHaveLength(10);
        expect(DOMAINS.map((d) => d.id)).toContain("seed");
        expect(DOMAINS.map((d) => d.id)).toContain("other");
    });

    it("CATEGORIES は 8 件で security と performance を含む", () => {
        expect(CATEGORIES.map((c) => c.id)).toEqual(
            expect.arrayContaining([
                "unit",
                "integration",
                "e2e",
                "visual-snapshot",
                "a11y",
                "performance",
                "api-contract",
                "security",
            ])
        );
        expect(CATEGORIES).toHaveLength(8);
    });
});
