/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Label } from "@/components/ui/label";

describe("Label (snapshot)", () => {
    it("renders default label", () => {
        const { container } = render(<Label>Username</Label>);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders label with htmlFor", () => {
        const { container } = render(
            <Label htmlFor="username-input">Username</Label>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("merges className", () => {
        const { container } = render(
            <Label className="mt-4">Username</Label>
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
