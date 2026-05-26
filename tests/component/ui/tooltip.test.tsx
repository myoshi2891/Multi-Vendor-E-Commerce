/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

describe("Tooltip (snapshot)", () => {
    it("renders trigger in closed state", () => {
        const { container } = render(
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger>Hover</TooltipTrigger>
                    <TooltipContent>Tip body</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders portal content in defaultOpen state", () => {
        render(
            <TooltipProvider>
                <Tooltip defaultOpen>
                    <TooltipTrigger>Hover</TooltipTrigger>
                    <TooltipContent>Tip body</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
        expect(document.body).toMatchSnapshot();
    });
});
