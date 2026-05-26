/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
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

    it("renders portal content in defaultOpen state", () => {
        render(
            <Popover defaultOpen>
                <PopoverTrigger>Open</PopoverTrigger>
                <PopoverContent>Popover body</PopoverContent>
            </Popover>
        );
        expect(document.body).toMatchSnapshot();
    });
});
