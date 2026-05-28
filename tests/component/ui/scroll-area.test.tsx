/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

describe("ScrollArea (snapshot)", () => {
    it("renders default (vertical) area", () => {
        const { container } = render(
            <ScrollArea className="h-32 w-48">
                <div>Item 1</div>
                <div>Item 2</div>
                <div>Item 3</div>
            </ScrollArea>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders with horizontal ScrollBar", () => {
        const { container } = render(
            <ScrollArea className="h-32 w-48">
                <div style={{ width: 600 }}>wide content</div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
