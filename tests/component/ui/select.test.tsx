/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectGroup,
    SelectLabel,
    SelectItem,
    SelectSeparator,
} from "@/components/ui/select";

describe("Select (snapshot)", () => {
    it("renders trigger with placeholder in closed state", () => {
        const { container } = render(
            <Select>
                <SelectTrigger>
                    <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="apple">Apple</SelectItem>
                    <SelectItem value="banana">Banana</SelectItem>
                </SelectContent>
            </Select>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders disabled trigger", () => {
        const { container } = render(
            <Select disabled>
                <SelectTrigger>
                    <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="apple">Apple</SelectItem>
                </SelectContent>
            </Select>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders content composition (Group + Label + Items + Separator)", () => {
        render(
            <Select defaultOpen>
                <SelectTrigger>
                    <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        <SelectLabel>Fruits</SelectLabel>
                        <SelectItem value="apple">Apple</SelectItem>
                        <SelectSeparator />
                    </SelectGroup>
                </SelectContent>
            </Select>
        );
        expect(document.body).toMatchSnapshot();
    });
});
