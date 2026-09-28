/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Selection from "./selection";
import { getProducts } from "@/queries/product";
import { getBrandCategories } from "./data";

jest.mock("@/queries/product", () => ({ getProducts: jest.fn() }));
jest.mock("./data", () => ({ getBrandCategories: jest.fn() }));
jest.mock("next/image", () => ({ __esModule: true, default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
const products = jest.mocked(getProducts);
const categories = jest.mocked(getBrandCategories);
const result = (items: unknown[]) => ({ products: items, totalCount: items.length, totalPages: 1, currentPage: 1, pageSize: 8 }) as Awaited<ReturnType<typeof getProducts>>;
const item = { id: "p1", name: "Emerald pendant", slug: "emerald", variants: [{ variantSlug: "gold", images: [{ url: "/pendant.jpg" }], sizes: [{ price: 99.99, discount: 15 }] }] };

describe("Luxury home selection", () => {
    beforeEach(() => { jest.clearAllMocks(); categories.mockResolvedValue([]); });
    afterEach(() => jest.restoreAllMocks());
    it("uses real product routes and decimal discount prices", async () => {
        products.mockResolvedValue(result([item]));
        render(await Selection());
        expect(screen.getByRole("link", { name: /Emerald pendant/ })).toHaveAttribute("href", "/product/emerald/gold");
        expect(screen.getByText("From $84.99")).toBeVisible();
    });
    it("uses the live category slug for the curated selection", async () => {
        categories.mockResolvedValue([{ id: "c1", name: "Jewelry", url: "fine-jewels" }]);
        products.mockResolvedValue(result([item]));
        render(await Selection());
        expect(products).toHaveBeenCalledWith({ category: "fine-jewels" }, "", 1, 3);
    });
    it("shows an honest empty state when no products are available", async () => {
        products.mockResolvedValue(result([]));
        render(await Selection());
        expect(screen.getByRole("status")).toHaveTextContent("Something extraordinary is on its way.");
        expect(screen.getByRole("link")).toHaveAttribute("href", "/browse");
    });
    it("isolates product failures and provides a reload link", async () => {
        jest.spyOn(console, "error").mockImplementation(() => {});
        products.mockRejectedValue(new Error("Database unavailable"));
        render(await Selection());
        expect(screen.getByRole("status")).toHaveTextContent("商品を読み込めませんでした");
        expect(screen.getByRole("link", { name: /Try again/ })).toHaveAttribute("href", "/#collections");
    });
    it("reloads the page at the collections position when retrying", async () => {
        const errors = jest.spyOn(console, "error").mockImplementation(() => {});
        products.mockRejectedValue(new Error("Database unavailable"));
        window.history.replaceState(null, "", "/");
        render(await Selection());
        // 同一ページのフラグメント遷移で終わらせず、既定動作を止めて再読み込みする
        expect(fireEvent.click(screen.getByRole("link", { name: /Try again/ }))).toBe(false);
        expect(window.location.hash).toBe("#collections");
        // jsdom は reload を未実装としてエラー報告する＝reload が呼ばれた証跡
        expect(errors.mock.calls.some(([e]) => String(e).includes("navigation"))).toBe(true);
    });
});
