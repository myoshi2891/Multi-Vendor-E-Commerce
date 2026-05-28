/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Toaster } from "@/components/ui/sonner";

describe("Sonner Toaster (snapshot)", () => {
    it("renders Toaster root without active toasts", () => {
        const { container } = render(<Toaster />);
        expect(container.firstChild).toMatchSnapshot();
    });
});
