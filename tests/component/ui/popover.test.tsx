/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

describe("Popover (snapshot)", () => {
    it("renders trigger in closed state", () => {
        const { container } = render(
            <Popover>
                <PopoverTrigger>Open</PopoverTrigger>
                <PopoverContent>Popover body</PopoverContent>
            </Popover>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders PopoverContent in defaultOpen state", () => {
        render(
            <Popover defaultOpen>
                <PopoverTrigger>Open</PopoverTrigger>
                <PopoverContent>Popover body</PopoverContent>
            </Popover>
        );
        // PopoverContent は role="dialog" の styled div として描画される。
        // document.body 全体ではなくこの要素だけをスナップショット化してスコープを最小化する。
        expect(screen.getByRole("dialog")).toMatchSnapshot();
    });
});
