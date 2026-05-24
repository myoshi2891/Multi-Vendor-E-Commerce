/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Button } from "@/components/ui/button";

describe("Button (snapshot)", () => {
    const variants = [
        "default",
        "destructive",
        "outline",
        "secondary",
        "ghost",
        "link",
    ] as const;

    const sizes = ["default", "sm", "lg", "icon"] as const;

    describe("variants × sizes", () => {
        it.each(variants)("variant=%s renders default size correctly", (variant) => {
            const { container } = render(
                <Button variant={variant}>Click me</Button>
            );
            expect(container.firstChild).toMatchSnapshot();
        });

        it.each(sizes)("size=%s renders default variant correctly", (size) => {
            const { container } = render(<Button size={size}>Click me</Button>);
            expect(container.firstChild).toMatchSnapshot();
        });
    });

    describe("states", () => {
        it("renders disabled state", () => {
            const { container } = render(<Button disabled>Click me</Button>);
            expect(container.firstChild).toMatchSnapshot();
        });

        it("merges className prop", () => {
            const { container } = render(
                <Button className="mt-4">Click me</Button>
            );
            expect(container.firstChild).toMatchSnapshot();
        });
    });

    describe("asChild (Slot)", () => {
        it("renders as <a> when asChild is used with anchor", () => {
            const { container } = render(
                <Button asChild>
                    <a href="/somewhere">Go</a>
                </Button>
            );
            expect(container.firstChild).toMatchSnapshot();
        });
    });
});
