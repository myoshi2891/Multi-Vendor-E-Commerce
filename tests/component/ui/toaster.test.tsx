/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Toaster } from "@/components/ui/toaster";

describe("Toaster (snapshot)", () => {
    it("renders Toaster with no active toasts", () => {
        const { container } = render(<Toaster />);
        // useToast() の初期状態 toasts=[] のため、ToastViewport のみが描画される構成。
        expect(container.firstChild).toMatchSnapshot();
    });
});
