/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

describe("Avatar (snapshot)", () => {
    it("renders with image source", () => {
        const { container } = render(
            <Avatar>
                <AvatarImage src="/avatar.png" alt="User" />
                <AvatarFallback>U</AvatarFallback>
            </Avatar>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders with fallback only", () => {
        const { container } = render(
            <Avatar>
                <AvatarFallback>AB</AvatarFallback>
            </Avatar>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("merges className overrides", () => {
        const { container } = render(
            <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">XL</AvatarFallback>
            </Avatar>
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
