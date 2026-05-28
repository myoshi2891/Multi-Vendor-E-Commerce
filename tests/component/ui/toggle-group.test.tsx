/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    ToggleGroup,
    ToggleGroupItem,
} from "@/components/ui/toggle-group";

describe("ToggleGroup (snapshot)", () => {
    it("renders single-select group with defaultValue", () => {
        const { container } = render(
            <ToggleGroup type="single" defaultValue="bold">
                <ToggleGroupItem value="bold">B</ToggleGroupItem>
                <ToggleGroupItem value="italic">I</ToggleGroupItem>
                <ToggleGroupItem value="underline">U</ToggleGroupItem>
            </ToggleGroup>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders multi-select group with outline variant", () => {
        const { container } = render(
            <ToggleGroup type="multiple" variant="outline" defaultValue={["bold", "italic"]}>
                <ToggleGroupItem value="bold">B</ToggleGroupItem>
                <ToggleGroupItem value="italic">I</ToggleGroupItem>
            </ToggleGroup>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders with size=sm and disabled item", () => {
        const { container } = render(
            <ToggleGroup type="single" size="sm">
                <ToggleGroupItem value="a">A</ToggleGroupItem>
                <ToggleGroupItem value="b" disabled>
                    B
                </ToggleGroupItem>
            </ToggleGroup>
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
