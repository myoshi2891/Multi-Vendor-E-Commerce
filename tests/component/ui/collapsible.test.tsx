/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";

describe("Collapsible (snapshot)", () => {
    it("renders in closed state", () => {
        const { container } = render(
            <Collapsible>
                <CollapsibleTrigger>Toggle</CollapsibleTrigger>
                <CollapsibleContent>Hidden body</CollapsibleContent>
            </Collapsible>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders in defaultOpen state", () => {
        const { container } = render(
            <Collapsible defaultOpen>
                <CollapsibleTrigger>Toggle</CollapsibleTrigger>
                <CollapsibleContent>Visible body</CollapsibleContent>
            </Collapsible>
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
