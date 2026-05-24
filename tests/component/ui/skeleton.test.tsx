/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Skeleton } from "@/components/ui/skeleton";

describe("Skeleton (snapshot)", () => {
    it("renders default skeleton", () => {
        const { container } = render(<Skeleton />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("merges className", () => {
        const { container } = render(
            <Skeleton className="h-4 w-32" />
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
