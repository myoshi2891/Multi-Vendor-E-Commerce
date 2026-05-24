/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Badge } from "@/components/ui/badge";

describe("Badge (snapshot)", () => {
    const variants = ["default", "secondary", "destructive", "outline"] as const;

    it.each(variants)("variant=%s renders correctly", (variant) => {
        const { container } = render(<Badge variant={variant}>Label</Badge>);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("merges className prop", () => {
        const { container } = render(
            <Badge className="mt-4">Label</Badge>
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
