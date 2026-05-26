/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

describe("RadioGroup (snapshot)", () => {
    it("renders default group with no selection", () => {
        const { container } = render(
            <RadioGroup>
                <RadioGroupItem value="a" />
                <RadioGroupItem value="b" />
            </RadioGroup>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders with defaultValue selecting item 'b'", () => {
        const { container } = render(
            <RadioGroup defaultValue="b">
                <RadioGroupItem value="a" />
                <RadioGroupItem value="b" />
            </RadioGroup>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders disabled state on item", () => {
        const { container } = render(
            <RadioGroup>
                <RadioGroupItem value="a" disabled />
                <RadioGroupItem value="b" />
            </RadioGroup>
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
