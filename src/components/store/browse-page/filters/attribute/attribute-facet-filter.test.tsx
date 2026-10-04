/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { ProductFacet } from "@/lib/types";
import AttributeFacetFilter from "./attribute-facet-filter";

const replace = jest.fn();
let currentSearch = "";
jest.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(currentSearch),
    usePathname: () => "/browse",
    useRouter: () => ({ replace }),
}));

const material: ProductFacet = {
    key: "material",
    name: "Material",
    unit: null,
    values: [
        { value: "wool", label: "Wool", count: 3, selected: false },
        { value: "silk", label: "Silk", count: 1, selected: false },
    ],
};

describe("AttributeFacetFilter", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        currentSearch = "category=fashion&page=3";
    });

    it("ファセットごとに見出しと、件数つきの値ボタンを描画する", () => {
        // Arrange / Act
        render(<AttributeFacetFilter facets={[material]} />);

        // Assert
        const section = screen.getByRole("region", { name: "Material" });
        const wool = within(section).getByRole("button", { name: "Wool (3)" });
        expect(wool).toHaveAttribute("aria-pressed", "false");
        expect(
            within(section).getByRole("button", { name: "Silk (1)" })
        ).toBeInTheDocument();
    });

    it("値を選ぶと attr.<key> を追加し、ページ番号は 1 ページ目へ戻す", () => {
        // Arrange
        render(<AttributeFacetFilter facets={[material]} />);

        // Act
        fireEvent.click(screen.getByRole("button", { name: "Wool (3)" }));

        // Assert — 絞り込みが変わると総ページ数も変わるので page は外す
        expect(replace).toHaveBeenCalledWith(
            "/browse?category=fashion&attr.material=wool"
        );
    });

    it("選択中の値をもう一度押すとその値だけを外す", () => {
        // Arrange
        currentSearch =
            "category=fashion&attr.material=wool&attr.material=silk";
        render(
            <AttributeFacetFilter
                facets={[
                    {
                        ...material,
                        values: material.values.map((v) => ({
                            ...v,
                            selected: true,
                        })),
                    },
                ]}
            />
        );

        // Act
        const wool = screen.getByRole("button", { name: "Wool (3)" });
        expect(wool).toHaveAttribute("aria-pressed", "true");
        fireEvent.click(wool);

        // Assert
        expect(replace).toHaveBeenCalledWith(
            "/browse?category=fashion&attr.material=silk"
        );
    });

    it("単位があれば見出しに添える", () => {
        render(
            <AttributeFacetFilter
                facets={[
                    {
                        ...material,
                        key: "screen_size",
                        name: "Screen size",
                        unit: "inch",
                    },
                ]}
            />
        );

        expect(
            screen.getByRole("region", { name: "Screen size (inch)" })
        ).toBeInTheDocument();
    });

    it("見出しのボタンで値の一覧を開閉できる", () => {
        // Arrange
        render(<AttributeFacetFilter facets={[material]} />);
        const toggle = screen.getByRole("button", { name: "Material" });

        // Act
        fireEvent.click(toggle);

        // Assert
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        // hidden 属性の付いた要素はロール検索から除外されるので hidden: true で取ってから見る
        expect(
            screen.getByRole("button", { name: "Wool (3)", hidden: true })
        ).not.toBeVisible();
    });

    it("ファセットが無ければ何も描画しない", () => {
        const { container } = render(<AttributeFacetFilter facets={[]} />);

        expect(container).toBeEmptyDOMElement();
    });
});
