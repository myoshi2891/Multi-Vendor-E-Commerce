/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Progress } from "@/components/ui/progress";

describe("Progress (snapshot)", () => {
    it("renders 0% (indicator translated -100%)", () => {
        const { container } = render(<Progress value={0} />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders 50% (indicator translated -50%)", () => {
        const { container } = render(<Progress value={50} />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders 100% (indicator translated 0%)", () => {
        const { container } = render(<Progress value={100} />);
        expect(container.firstChild).toMatchSnapshot();
    });
});
