/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

describe("Accordion (snapshot)", () => {
    it("renders single-mode accordion in closed state", () => {
        const { container } = render(
            <Accordion type="single" collapsible>
                <AccordionItem value="item-1">
                    <AccordionTrigger>Section 1</AccordionTrigger>
                    <AccordionContent>Body 1</AccordionContent>
                </AccordionItem>
            </Accordion>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders single-mode accordion with defaultValue open", () => {
        const { container } = render(
            <Accordion type="single" defaultValue="item-1" collapsible>
                <AccordionItem value="item-1">
                    <AccordionTrigger>Section 1</AccordionTrigger>
                    <AccordionContent>Body 1</AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                    <AccordionTrigger>Section 2</AccordionTrigger>
                    <AccordionContent>Body 2</AccordionContent>
                </AccordionItem>
            </Accordion>
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
