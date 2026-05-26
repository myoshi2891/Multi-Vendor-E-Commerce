/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AspectRatio } from "@/components/ui/aspect-ratio";

describe("AspectRatio (snapshot)", () => {
    it("renders 16:9 ratio", () => {
        const { container } = render(
            <AspectRatio ratio={16 / 9}>
                <img src="/placeholder.jpg" alt="placeholder" />
            </AspectRatio>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders 1:1 ratio", () => {
        const { container } = render(
            <AspectRatio ratio={1}>
                <img src="/placeholder.jpg" alt="placeholder" />
            </AspectRatio>
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
