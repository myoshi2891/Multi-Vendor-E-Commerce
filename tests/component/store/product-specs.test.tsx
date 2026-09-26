/** @jest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProductSpecs from "@/components/store/product-page/product-specs";

const attribute = (
    name: string,
    values: string[],
    unit: string | null = null
) => ({ definitionId: `d-${name}`, key: name, name, unit, values });

describe("ProductSpecs", () => {
    it("構造化属性を「Specifications」、Spec を「Other specifications」の 2 セクションに分ける（design.md Q3）", () => {
        // Arrange & Act
        render(
            <ProductSpecs
                attributes={{
                    product: [attribute("Brand", ["Acme"])],
                    variant: [attribute("Storage", ["128"], "GB")],
                }}
                specs={{
                    product: [{ name: "Care", value: "Hand wash" }],
                    variant: [],
                }}
            />
        );

        // Assert
        const structured = screen.getByRole("region", {
            name: "Specifications",
        });
        expect(within(structured).getByText("Brand")).toBeInTheDocument();
        expect(within(structured).getByText("Acme")).toBeInTheDocument();
        expect(within(structured).getByText("128 GB")).toBeInTheDocument();
        expect(within(structured).queryByText("Care")).not.toBeInTheDocument();

        const other = screen.getByRole("region", {
            name: "Other specifications",
        });
        expect(within(other).getByText("Care")).toBeInTheDocument();
        expect(within(other).getByText("Hand wash")).toBeInTheDocument();
    });

    it("多値属性はカンマ区切りで 1 行に表示する", () => {
        render(
            <ProductSpecs
                attributes={{
                    product: [attribute("Allergens", ["Milk", "Egg"])],
                    variant: [],
                }}
                specs={{ product: [], variant: [] }}
            />
        );

        expect(screen.getByText("Milk, Egg")).toBeInTheDocument();
    });

    it("構造化属性が無ければ「Specifications」セクションを出さない（A-8: Spec のみの商品は従来どおり）", () => {
        render(
            <ProductSpecs
                attributes={{ product: [], variant: [] }}
                specs={{
                    product: [{ name: "Material", value: "Cotton" }],
                    variant: [{ name: "Lining", value: "Silk" }],
                }}
            />
        );

        expect(
            screen.queryByRole("region", { name: "Specifications" })
        ).not.toBeInTheDocument();
        const other = screen.getByRole("region", {
            name: "Other specifications",
        });
        expect(within(other).getByText("Cotton")).toBeInTheDocument();
        expect(within(other).getByText("Silk")).toBeInTheDocument();
    });

    it("Spec が無ければ「Other specifications」セクションを出さない", () => {
        render(
            <ProductSpecs
                attributes={{
                    product: [attribute("Brand", ["Acme"])],
                    variant: [],
                }}
                specs={{ product: [], variant: [] }}
            />
        );

        expect(
            screen.queryByRole("region", { name: "Other specifications" })
        ).not.toBeInTheDocument();
    });
});
