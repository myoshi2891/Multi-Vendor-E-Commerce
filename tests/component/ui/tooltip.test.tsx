/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
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

    it("renders TooltipContent in defaultOpen state", () => {
        render(
            <TooltipProvider>
                <Tooltip defaultOpen>
                    <TooltipTrigger>Hover</TooltipTrigger>
                    <TooltipContent>Tip body</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
        // role="tooltip" の ARIA span から親要素 (styled TooltipContent div) を取得し、
        // document.body 全体ではなく対象コンポーネントの出力だけをスナップショット化する。
        expect(screen.getByRole("tooltip").parentElement).toMatchSnapshot();
    });
});
