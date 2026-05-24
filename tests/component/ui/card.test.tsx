/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from "@/components/ui/card";

describe("Card (snapshot)", () => {
    it("renders bare Card", () => {
        const { container } = render(<Card>Body</Card>);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders full composition (Header + Title + Description + Content + Footer)", () => {
        const { container } = render(
            <Card>
                <CardHeader>
                    <CardTitle>Title</CardTitle>
                    <CardDescription>Description text</CardDescription>
                </CardHeader>
                <CardContent>Main content</CardContent>
                <CardFooter>Footer</CardFooter>
            </Card>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("merges className on Card", () => {
        const { container } = render(
            <Card className="mt-4">Body</Card>
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
